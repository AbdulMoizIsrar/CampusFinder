import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreMatch, matches } from '../src/utils/match.js';
test('opposite reports with overlapping description/location match', () => {
  const a = { type: 'lost', category: 'Electronics', title: 'Silver HP calculator', description: 'silver scientific calculator', location: 'Library second floor' };
  const b = { type: 'found', category: 'Electronics', title: 'HP calculator', description: 'scientific calculator found', location: 'Library ground floor' };
  assert.ok(scoreMatch(a, b) >= 55); assert.ok(matches(a, b));
});
test('same type and different category do not match', () => {
  const a = { type: 'lost', category: 'Keys' };
  assert.equal(scoreMatch(a, { type: 'lost', category: 'Keys' }), 0);
  assert.equal(scoreMatch(a, { type: 'found', category: 'Bags' }), 0);
});
