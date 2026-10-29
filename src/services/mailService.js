import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { fail } from '../utils/error.js';
import { canShareWhatsApp } from '../utils/reportContact.js';
let transport;
export function emailConfigured() {
  return Boolean(env.smtpHost && env.smtpUser && env.smtpPassword && env.mailFrom);
}
export async function sendMail({ to, subject, text }) {
  if (!emailConfigured()) fail(503, 'MAIL_NOT_CONFIGURED', 'Email service is not configured. Ask the administrator to set SMTP credentials.');
  transport ||= nodemailer.createTransport({
    host: env.smtpHost, port: env.smtpPort, secure: env.smtpPort === 465,
    requireTLS: env.smtpPort !== 465,
    auth: { user: env.smtpUser, pass: env.smtpPassword },
    connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000
  });
  await transport.sendMail({ from: env.mailFrom, to, subject, text });
}
export async function sendVerificationEmail(email, code) {
  await sendMail({ to: email, subject: 'CampusFinder - Your email verification code',
    text: `Your CampusFinder verification code is: ${code}\n\nThis code expires in 10 minutes. Never share it with anyone.\nIf you didn't request it, ignore this message.` });
}
export async function sendMatchEmail({ recipient, counterpart, item, otherItem, score }) {
  if (!emailConfigured()) return;
  // Phone may be disclosed only after explicit per-report consent and a high-confidence match.
  const disclosedPhone = canShareWhatsApp(otherItem, score) ? otherItem.whatsapp : null;
  const counterpartRole = otherItem.type === 'found' ? 'finder' : 'person who lost the item';
  const lines = [
    `Hello ${recipient.name},`, '',
    `CampusFinder found a POTENTIAL match (${score}%) between your report and another campus report.`,
    `Your report: ${item.title} (${item.type})`,
    `Other report: ${otherItem.title} (${otherItem.type})`,
    `Reported by: ${otherItem.reporterName || counterpart.name} (${counterpartRole})`,
    '',
    disclosedPhone ? `The ${counterpartRole} agreed to share their WhatsApp for strong matches: ${disclosedPhone}` : 'The other reporter has not shared a WhatsApp contact for this match.',
    '', 'This is only a suggested match, NOT proof of ownership. Use CampusFinder to submit or review a claim before handing over an item.',
    `Open CampusFinder: ${env.clientOrigin}`, '', 'CampusFinder team'
  ];
  await sendMail({ to: recipient.email, subject: `CampusFinder: possible ${otherItem.type} item match`, text: lines.join('\n') });
}
