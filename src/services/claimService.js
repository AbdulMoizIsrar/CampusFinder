import mongoose from 'mongoose';
import Claim from '../models/Claim.js';
import Item from '../models/Item.js';
import { fail } from '../utils/error.js';
import { requireItemOwner } from '../middleware/auth.js';
import { sanitizeText } from '../middleware/security.js';
import { canReviewClaim, pendingStatus } from '../utils/status.js';
import { notify } from './notificationService.js';
import { emitTo } from '../realtime/socket.js';
export async function createClaim(itemId, proofText, user) {
  const item = await Item.findById(itemId);
  if (!item) fail(404, 'NOT_FOUND', 'Item not found');
  if (String(item.reporter) === user.id) fail(409, 'SELF_CLAIM', 'You cannot claim your own report');
  if (!['open', 'claim_pending'].includes(item.status)) fail(409, 'ITEM_UNAVAILABLE', 'This item is no longer open for claims');
  if (await Claim.exists({ item: itemId, claimant: user.id })) fail(409, 'ALREADY_CLAIMED', 'You have already submitted a claim for this item');
  const proof = sanitizeText(proofText);
  if (proof.length < 15) fail(422, 'PROOF_REQUIRED', 'Proof must contain at least 15 characters');
  const claim = await Claim.create({ item: itemId, claimant: user.id, proofText: proof });
  await Item.updateOne({ _id: itemId, status: 'open' }, { $set: { status: 'claim_pending' } });
  const result = await Claim.findById(claim.id).populate('claimant', 'name email').lean();
  await notify(String(item.reporter), 'claim:new', `New claim for "${item.title}" from ${user.name}`, item.id);
  emitTo('moderators', 'claim:new', { claimId: claim.id, itemId });
  return result;
}
export async function claimsForItem(itemId, user) {
  const item = await Item.findById(itemId);
  if (!item) fail(404, 'NOT_FOUND', 'Item not found');
  requireItemOwner(user, item);
  return Claim.find({ item: itemId }).populate('claimant', 'name email').populate('decidedBy', 'name').sort({ createdAt: -1 }).lean();
}
export async function myClaims(user) {
  return Claim.find({ claimant: user.id }).populate('item', 'title category type status location').sort({ createdAt: -1 }).lean();
}
export async function reviewClaim(claimId, status, user) {
  if (!['approved', 'rejected'].includes(status)) fail(422, 'INVALID_DECISION', 'Decision must be approved or rejected');
  const claim = await Claim.findById(claimId);
  if (!claim) fail(404, 'NOT_FOUND', 'Claim not found');
  const item = await Item.findById(claim.item);
  if (!item) fail(404, 'NOT_FOUND', 'Item not found');
  requireItemOwner(user, item);
  if (!canReviewClaim(claim.status, item.status)) fail(409, 'INVALID_TRANSITION', 'This claim cannot be decided now');
  if (status === 'approved') {
    const updatedItem = await Item.findOneAndUpdate(
      { _id: item.id, status: mongoose.trusted({ $in: ['open', 'claim_pending'] }), approvedClaim: null },
      { $set: { status: 'claimed', approvedClaim: claim._id } }, { new: true }
    );
    if (!updatedItem) fail(409, 'ALREADY_APPROVED', 'Another claim was already approved');
  }
  claim.status = status;
  claim.decidedBy = user.id;
  claim.decidedAt = new Date();
  await claim.save();
  if (status === 'approved') {
    const otherPending = await Claim.find({ item: item.id, _id: mongoose.trusted({ $ne: claim.id }), status: 'pending' });
    for (const other of otherPending) {
      other.status = 'rejected'; other.decidedBy = user.id; other.decidedAt = new Date(); await other.save();
      await notify(String(other.claimant), 'claim:decided', `Your claim for "${item.title}" was rejected because another claim was approved`, item.id);
    }
  } else {
    const pendingCount = await Claim.countDocuments({ item: item.id, status: 'pending' });
    await Item.updateOne({ _id: item.id, status: 'claim_pending' }, { $set: { status: pendingStatus(pendingCount) } });
  }
  await notify(String(claim.claimant), 'claim:decided', `Your claim for "${item.title}" was ${status}`, item.id);
  return Claim.findById(claim.id).populate('claimant', 'name email').populate('decidedBy', 'name').lean();
}
export async function queueClaims(status = 'pending') {
  return Claim.find({ status }).populate('item', 'title category location status reporter').populate('claimant', 'name email').sort({ createdAt: -1 }).limit(100).lean();
}
