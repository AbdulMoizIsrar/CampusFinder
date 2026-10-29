import * as items from '../services/itemService.js';
import * as claims from '../services/claimService.js';
import { saveItemImage, deleteItemImage, imageHashFromBuffer } from '../middleware/itemImage.js';
import { fail } from '../utils/error.js';
import { requireItemOwner } from '../middleware/auth.js';
export async function list(req, res) { res.json(await items.listItems(req.query)); }
export async function mine(req, res) { res.json(await items.listItems(req.query, req.user.id)); }
export async function one(req, res) { res.json({ item: await items.getItem(req.params.id) }); }
export async function privateDetails(req, res) { res.json({ details: await items.getPrivateReportDetails(req.params.id, req.user) }); }
export async function create(req, res) {
  const imageHash = await imageHashFromBuffer(req.file?.buffer);
  const imageUrl = await saveItemImage(req.file);
  try {
    const item = await items.createItem(req.body, req.user, imageUrl, imageHash);
    res.location(`/api/v1/items/${item._id}`).status(201).json({ item });
  } catch (error) {
    await deleteItemImage(imageUrl);
    throw error;
  }
}
export async function update(req, res) {
  const old = await items.getItem(req.params.id);
  const imageHash = await imageHashFromBuffer(req.file?.buffer);
  const imageUrl = await saveItemImage(req.file);
  try {
    const item = await items.updateItem(req.params.id, req.body, req.user, imageUrl, imageHash);
    if (imageUrl) await deleteItemImage(old.imageUrl);
    res.json({ item });
  } catch (error) {
    await deleteItemImage(imageUrl);
    throw error;
  }
}
export async function remove(req, res) {
  const old = await items.getItem(req.params.id);
  await items.deleteItem(req.params.id, req.user);
  await deleteItemImage(old.imageUrl);
  res.status(204).end();
}
export async function matches(req, res) {
  const item = await items.getItem(req.params.id);
  requireItemOwner(req.user, item);
  res.json({ matches: await items.listMatches(item) });
}
export async function claim(req, res) {
  if (!req.body || typeof req.body.proofText !== 'string') fail(422, 'PROOF_REQUIRED', 'Provide proofText');
  const result = await claims.createClaim(req.params.id, req.body.proofText, req.user);
  res.status(201).json({ claim: result });
}
export async function itemClaims(req, res) { res.json({ claims: await claims.claimsForItem(req.params.id, req.user) }); }
