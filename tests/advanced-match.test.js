import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreMatch, matches, imageHashSimilarity } from '../src/utils/match.js';
import { validColor } from '../public/js/colorPalette.js';
const lost = { type:'lost', category:'Electronics', title:'Samsung earbuds', description:'Samsung galaxy earbuds in blue case', location:'Main library', date:'2026-10-25', brand:'Samsung', color:'blue', imageHash:'0123456789abcdef' };
const found = { type:'found', category:'Electronics', title:'Samsung galaxy earbuds', description:'Found galaxy earbuds', location:'Main library', date:'2026-10-26', brand:'Samsung', color:'blue', imageHash:'0123456789abcdef' };
test('matching color, brand, date and image raises confidence', () => {
 const full = scoreMatch(lost, found);
 assert.ok(full >= 80);
 assert.ok(full > scoreMatch({...lost,brand:'',color:'',imageHash:null,date:null}, {...found,brand:'',color:'',imageHash:null,date:null}));
});
test('different brand/color and impossible timeline lower score', () => {
 const mismatch = {...found,brand:'Apple',color:'red',date:'2026-09-01', imageHash:'ffffffffffffffff'};
 assert.ok(scoreMatch(lost, mismatch) < scoreMatch(lost, found));
});
test('no category-only or location-only false match', () => {
 const a = {...lost, title:'Umbrella',description:'my favorite umbrella',brand:'',color:'',imageHash:null};
 const b = {...found, title:'Laptop',description:'my laptop is here',brand:'',color:'',imageHash:null};
 assert.equal(scoreMatch(a,b),0);
});
test('old reports with matching descriptive words still match', () => {
 const a = {type:'lost',category:'Electronics',title:'HP scientific calculator',description:'silver scientific calculator',location:'Library second floor'};
 const b = {type:'found',category:'Electronics',title:'HP scientific calculator',description:'scientific calculator found',location:'Library ground floor'};
 assert.ok(matches(a,b));
});
test('photo similarity is a fingerprint and is optional', () => {
 assert.equal(imageHashSimilarity('1234567890abcdef','1234567890abcdef'),1);
 assert.equal(imageHashSimilarity('0000000000000000','ffffffffffffffff'),null);
 assert.equal(imageHashSimilarity(null,null),null);
});
test('color catalog allows standard colors transparent and any custom hex', () => {
 assert.equal(validColor('rebeccapurple'),true);
 assert.equal(validColor('transparent'),true);
 assert.equal(validColor('multicolor'),true);
 assert.equal(validColor('#123abc'),true);
 assert.equal(validColor('#something'),false);
});
