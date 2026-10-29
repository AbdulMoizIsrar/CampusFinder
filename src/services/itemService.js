import mongoose from 'mongoose';
import Item, { CATEGORIES } from '../models/Item.js';
import Claim from '../models/Claim.js';
import User from '../models/User.js';
import { sendMatchEmail, emailConfigured } from './mailService.js';
import { sanitizeText } from '../middleware/security.js';
import { fail } from '../utils/error.js';
import { requireItemOwner } from '../middleware/auth.js';
import { canMarkReturned } from '../utils/status.js';
import { scoreMatch } from '../utils/match.js';
import { notify } from './notificationService.js';
import { emitTo } from '../realtime/socket.js';
const CREATE_FIELDS = ['title', 'description', 'category', 'location', 'date', 'type', 'brand', 'color', 'reporterName', 'registrationNumber', 'whatsapp', 'shareWhatsappOnMatch'];
const EDIT_FIELDS = ['title', 'description', 'category', 'location', 'date', 'type', 'brand', 'color', 'reporterName', 'registrationNumber', 'whatsapp', 'shareWhatsappOnMatch'];
const PUBLIC_FIELDS = ['reporterName','title','description','category','location','date','type','status','reporter','createdAt','updatedAt','returnedAt','imageUrl','brand','color'];
const clean = (obj, keys) => Object.fromEntries(keys.filter(key => Object.hasOwn(obj, key)).map(key => [key, typeof obj[key] === 'string' ? sanitizeText(obj[key]) : obj[key]]));
const escaped = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export function asPublicItem(item) { return item; }
export async function getItem(id) {
  const item = await Item.findById(id).populate('reporter', 'name role').lean();
  if (!item) fail(404, 'NOT_FOUND', 'Item not found');
  return item;
}
export async function getPrivateReportDetails(id, user) {
  const item = await Item.findById(id).select('+registrationNumber +whatsapp +shareWhatsappOnMatch');
  if (!item) fail(404, 'NOT_FOUND', 'Item not found');
  if (String(item.reporter) !== String(user.id)) fail(403, 'FORBIDDEN', 'Only the original reporter can access private contact details');
  return { reporterName: item.reporterName || '', registrationNumber: item.registrationNumber || '', whatsapp: item.whatsapp || '', shareWhatsappOnMatch: Boolean(item.shareWhatsappOnMatch) };
}
export async function listItems(query = {}, reporterId = null) {
  const filter = reporterId ? { reporter: reporterId } : {};
  for (const key of ['type', 'category', 'status']) if (query[key]) filter[key] = query[key];
  if (query.location) filter.location = new RegExp(escaped(query.location), 'i');
  if (query.from || query.to) {
    filter.date = mongoose.trusted({ ...(query.from ? { $gte: new Date(query.from) } : {}), ...(query.to ? { $lte: new Date(query.to) } : {}) });
  }
  if (query.q) {
    const pattern = new RegExp(escaped(query.q), 'i');
    filter.$or = [{ title: pattern }, { description: pattern }, { location: pattern }];
  }
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(query.limit) || 10));
  const sort = {
    newest: { createdAt: -1 }, oldest: { createdAt: 1 },
    date_asc: { date: 1 }, date_desc: { date: -1 },
    title_asc: { title: 1 }, title_desc: { title: -1 }
  }[query.sort || 'newest'];
  const requested = query.fields?.split(',').map(s => s.trim()).filter(Boolean) || [];
  if (requested.some(field => !PUBLIC_FIELDS.includes(field))) fail(422, 'INVALID_FIELDS', 'One or more requested fields are not allowed');
  const projection = requested.length ? [...new Set([...requested, 'reporter', 'status', 'type'])].join(' ') : undefined;
  const [items, total] = await Promise.all([
    Item.find(filter).select(projection).sort(sort).skip((page - 1) * limit).limit(limit).populate('reporter', 'name role').lean(),
    Item.countDocuments(filter)
  ]);
  return { items, page, limit, total, pages: Math.ceil(total / limit) };
}
export async function listMatches(item, limit = 10) {
  if (item.imageUrl && !item.imageHash) {
    const stored = await Item.findById(item._id).select('+imageHash').lean();
    if (stored?.imageHash) item = { ...item, imageHash: stored.imageHash };
  }
  const possibles = await Item.find({ _id: mongoose.trusted({ $ne: item._id }), type: item.type === 'lost' ? 'found' : 'lost', category: item.category, status: mongoose.trusted({ $in: ['open', 'claim_pending'] }) })
    .select('+imageHash').sort({ createdAt: -1 }).limit(250).populate('reporter', 'name').lean();
  return possibles.map(candidate => {
    const { imageHash, ...publicItem } = candidate;
    return { ...publicItem, matchScore: scoreMatch(item, candidate) };
  })
    .filter(candidate => candidate.matchScore >= 55).sort((a, b) => b.matchScore - a.matchScore).slice(0, limit);
}
export async function createItem(input, user, imageUrl = null, imageHash = null) {
  if (new Date(input.date) > new Date(Date.now() + 86400_000)) fail(422, 'INVALID_DATE', 'Item date cannot be in the future');
  if (input.shareWhatsappOnMatch && !input.whatsapp) fail(422, 'WHATSAPP_REQUIRED', 'Add a WhatsApp number before allowing match emails to share it');
  const item = await Item.create({ ...clean(input, CREATE_FIELDS), imageUrl, imageHash, reporter: user.id });
  const populated = await getItem(item.id);
  emitTo(`category:${item.category}`, 'item:new', populated);
  const matches = await listMatches(item);
  const noticed = new Set();
  for (const match of matches.slice(0, 5)) {
    const receiver = String(match.reporter?._id || match.reporter);
    if (receiver !== user.id && !noticed.has(receiver)) {
      noticed.add(receiver);
      await notify(receiver, 'match:suggested', `Potential match: "${item.title}" (${match.matchScore}% match)`, item._id);
      emitTo(`user:${receiver}`, 'match:suggested', { item: populated, matchScore: match.matchScore });
    }
  }
  if (matches.length) {
    await notify(user.id, 'match:suggested', `${matches.length} potential match(es) found for your new report`, item._id);
  }
  // Email is best effort: SMTP failures must not cause a successfully saved report to fail.
  if (matches.length && emailConfigured()) {
    const reporter = await User.findById(user.id).select('name email').lean();
    const rawMatches = await Item.find({ _id: mongoose.trusted({ $in: matches.slice(0,5).map(m => m._id) }) })
      .select('+whatsapp +shareWhatsappOnMatch').populate('reporter', 'name email').lean();
    const byId = new Map(rawMatches.map(m => [String(m._id), m]));
    for (const match of matches.slice(0,5)) {
      const opposite = byId.get(String(match._id));
      if (!opposite || !reporter || !opposite.reporter?.email || String(opposite.reporter._id) === String(user.id)) continue;
      const current = { ...item.toObject(), whatsapp: item.whatsapp, shareWhatsappOnMatch: item.shareWhatsappOnMatch };
      for (const mail of [
        { recipient: reporter, counterpart: opposite.reporter, item: current, otherItem: opposite, score: match.matchScore },
        { recipient: opposite.reporter, counterpart: reporter, item: opposite, otherItem: current, score: match.matchScore }
      ]) {
        try { await sendMatchEmail(mail); }
        catch (error) { console.error('Match email could not be sent:', error.message); }
      }
    }
  }
  return populated;
}
export async function updateItem(id, input, user, imageUrl = null, imageHash = null) {
  const item = await Item.findById(id).select('+registrationNumber +whatsapp +shareWhatsappOnMatch');
  if (!item) fail(404, 'NOT_FOUND', 'Item not found');
  requireItemOwner(user, item);
  if (input.status !== undefined) {
    if (input.status !== 'returned' || !canMarkReturned(item.status)) fail(409, 'INVALID_TRANSITION', 'An item can only be marked returned after a claim is approved');
    if (Object.keys(input).some(k => k !== 'status')) fail(422, 'INVALID_UPDATE', 'Mark an item returned separately from editing its details');
    item.status = 'returned';
    item.returnedAt = new Date();
    await item.save();
    const approved = await Claim.findById(item.approvedClaim);
    const recipients = new Set([String(item.reporter)]);
    if (approved) recipients.add(String(approved.claimant));
    for (const recipient of recipients) await notify(recipient, 'item:returned', `"${item.title}" was marked as returned`, item.id);
    emitTo(`category:${item.category}`, 'item:returned', { itemId: item.id });
    return getItem(item.id);
  }
  if (['claimed', 'returned'].includes(item.status)) fail(409, 'ITEM_LOCKED', 'Claimed or returned item details cannot be modified');
  if (input.date && new Date(input.date) > new Date(Date.now() + 86400_000)) fail(422, 'INVALID_DATE', 'Item date cannot be in the future');
  const allowed = clean(input, EDIT_FIELDS);
  const effectivePhone = allowed.whatsapp !== undefined ? allowed.whatsapp : item.whatsapp;
  const effectiveConsent = allowed.shareWhatsappOnMatch !== undefined ? allowed.shareWhatsappOnMatch : item.shareWhatsappOnMatch;
  if (effectiveConsent && !effectivePhone) fail(422, 'WHATSAPP_REQUIRED', 'Add a WhatsApp number before allowing match emails to share it');
  if (imageUrl) { allowed.imageUrl = imageUrl; allowed.imageHash = imageHash; }
  if (!Object.keys(allowed).length) fail(422, 'INVALID_UPDATE', 'No supported fields to update');
  Object.assign(item, allowed);
  await item.save();
  return getItem(item.id);
}
export async function deleteItem(id, user) {
  const item = await Item.findById(id);
  if (!item) fail(404, 'NOT_FOUND', 'Item not found');
  requireItemOwner(user, item);
  await Claim.deleteMany({ item: item._id });
  await item.deleteOne();
  emitTo(`category:${item.category}`, 'item:deleted', { itemId: id });
}
export { CATEGORIES };
