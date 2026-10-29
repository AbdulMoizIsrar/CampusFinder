import * as claims from '../services/claimService.js';
export async function mine(req, res) { res.json({ claims: await claims.myClaims(req.user) }); }
export async function review(req, res) {
  res.json({ claim: await claims.reviewClaim(req.params.id, req.body.status, req.user) });
}
export async function queue(req, res) { res.json({ claims: await claims.queueClaims(req.query.status || 'pending') }); }
