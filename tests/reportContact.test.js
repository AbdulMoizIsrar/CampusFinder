import test from 'node:test';
import assert from 'node:assert/strict';
import { formatRegistration, REGISTRATION_RE, normalizeName, REPORT_NAME_RE, normalizeWhatsApp, canShareWhatsApp } from '../src/utils/reportContact.js';
test('registration auto uppercase and dashes', () => {
  assert.equal(formatRegistration('fa21bee091'), 'FA21-BEE-091');
  assert.equal(formatRegistration('sp24-bcs-001'), 'SP24-BCS-001');
  assert.ok(REGISTRATION_RE.test(formatRegistration('FA21BEE091')));
});
test('invalid registration symbols and lengths rejected', () => {
  assert.equal(formatRegistration('fa21bee091!'), '');
  assert.equal(formatRegistration('FA2BEE091'), '');
});
test('full name cannot include numbers or punctuation', () => {
  assert.ok(REPORT_NAME_RE.test(normalizeName('  Abdul   Moiz Israr ')));
  assert.equal(REPORT_NAME_RE.test('Abdul123'), false);
  assert.equal(REPORT_NAME_RE.test('Abdul @'), false);
});
test('WhatsApp normalizes Pakistani local and E164', () => {
  assert.equal(normalizeWhatsApp('03001234567'), '+923001234567');
  assert.equal(normalizeWhatsApp('+923001234567'), '+923001234567');
  assert.equal(normalizeWhatsApp('abc'), '');
});

test('WhatsApp contact is only shareable with explicit permission at high score', () => {
  const report = { whatsapp: '+923001234567', shareWhatsappOnMatch: false };
  assert.equal(canShareWhatsApp(report, 99), false);
  report.shareWhatsappOnMatch = true;
  assert.equal(canShareWhatsApp(report, 79), false);
  assert.equal(canShareWhatsApp(report, 80), true);
  report.whatsapp = '';
  assert.equal(canShareWhatsApp(report, 100), false);
});
