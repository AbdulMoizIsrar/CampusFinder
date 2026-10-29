import test from 'node:test';
import assert from 'node:assert/strict';
import { canMarkReturned, pendingStatus, canReviewClaim } from '../src/utils/status.js';
test('returned requires an approved claim', () => {
  assert.ok(canMarkReturned('claimed'));
  for (const status of ['open', 'claim_pending', 'returned']) assert.equal(canMarkReturned(status), false);
});
test('pending claim status restores open only after final rejection', () => {
  assert.equal(pendingStatus(1), 'claim_pending'); assert.equal(pendingStatus(0), 'open');
  assert.equal(canReviewClaim('rejected', 'open'), false);
  assert.equal(canReviewClaim('pending', 'returned'), false);
});
