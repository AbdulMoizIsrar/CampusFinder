// Matching is evidence-based, not a claim of identity. Scores are ranking signals only.
// The category and opposite report type are mandatory. No date/color/image is required.
import { colorToHex } from '../../public/js/colorPalette.js';

const IGNORE = new Set(['the','and','with','for','from','this','that','was','are','have','has','there','near','lost','found','item','some','your','mine','black','white']);
const terms = value => new Set(String(value || '').toLowerCase().match(/[\p{L}\p{N}]+/gu)?.filter(w => w.length > 2 && !IGNORE.has(w)) || []);
const norm = value => String(value || '').trim().toLowerCase().replace(/\s+/g,' ');
const day = 86400000;

// dHash is a simple perceptual image fingerprint; same-view similar photos may match.
// Different angles/crops of the very same physical item are NOT reliably recognized.
export function imageHashSimilarity(first, second) {
  if (!/^[0-9a-f]{16}$/i.test(first || '') || !/^[0-9a-f]{16}$/i.test(second || '')) return null;
  if (first === '0000000000000000' || second === '0000000000000000' || first === 'ffffffffffffffff' || second === 'ffffffffffffffff') return null;
  let bits = BigInt(`0x${first}`) ^ BigInt(`0x${second}`);
  let diff = 0;
  while (bits) { bits &= bits - 1n; diff++; }
  return 1 - diff / 64;
}
function colorPoints(a, b) {
  if (!a || !b || a === 'unsure' || b === 'unsure') return 0;
  if (norm(a) === norm(b)) return 15;
  const hexA = colorToHex(a), hexB = colorToHex(b);
  if (!hexA || !hexB) return a === 'multicolor' || b === 'multicolor' ? 0 : -8;
  const rgb = v => [1,3,5].map(i => parseInt(v.slice(i,i+2),16));
  const p = rgb(hexA), q = rgb(hexB);
  const distance = Math.sqrt(p.reduce((sum, n, i) => sum + (n-q[i])**2, 0));
  if (distance <= 28) return 14;
  if (distance <= 65) return 9;
  if (distance <= 105) return 4;
  return -8;
}
function datePoints(a, b) {
  if (!a.date || !b.date) return 0;
  const first = new Date(a.date).getTime(), second = new Date(b.date).getTime();
  if (!Number.isFinite(first) || !Number.isFinite(second)) return 0;
  // A found item substantially predating the loss is unlikely to be the same object.
  const lost = a.type === 'lost' ? first : second;
  const found = a.type === 'found' ? first : second;
  if (found < lost - day) return -10;
  const distance = Math.abs(first-second)/day;
  if (distance <= 2) return 10;
  if (distance <= 7) return 7;
  if (distance <= 30) return 3;
  return 0;
}
export function scoreMatch(a, b) {
  if (!a || !b || a.type === b.type || a.category !== b.category) return 0;
  const first = terms(`${a.title} ${a.description}`);
  const second = terms(`${b.title} ${b.description}`);
  const overlapping = [...first].filter(t => second.has(t)).length;
  let score = 10 + Math.min(30, overlapping * 15);
  // At least one distinct descriptive signal is required for a genuine suggestion.
  const locA = terms(a.location), locB = terms(b.location);
  const locationMatch = [...locA].some(w => locB.has(w));
  if (locationMatch) score += 15;
  if (a.brand && b.brand) score += norm(a.brand) === norm(b.brand) ? 15 : -15;
  score += colorPoints(a.color, b.color);
  score += datePoints(a, b);
  const sim = imageHashSimilarity(a.imageHash, b.imageHash);
  if (sim != null) {
    if (sim >= 0.92) score += 20;
    else if (sim >= 0.82) score += 12;
    else if (sim >= 0.73) score += 6;
  }
  // Category + same location alone must not generate a match.
  // A precise brand+color match is also meaningful even if text descriptions differ.
  if (overlapping === 0 && !(a.brand && b.brand && norm(a.brand) === norm(b.brand) && colorPoints(a.color,b.color) >= 9) && !(sim != null && sim >= 0.92)) return 0;
  return Math.max(0, Math.min(100, Math.round(score)));
}
export function matches(a, b, minScore = 55) { return scoreMatch(a, b) >= minScore; }
