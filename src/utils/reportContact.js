// Normalize report contact data on the server as well as in the browser.
export const REPORT_NAME_RE = /^(?=.{2,80}$)\p{L}+(?: \p{L}+)*$/u;
export const REGISTRATION_RE = /^[A-Z]{2}[0-9]{2}-[A-Z]{3}-[0-9]{3}$/;

export function normalizeName(value) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
}
export function formatRegistration(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9\s-]*$/.test(value)) return '';
  const raw = value.toUpperCase().replace(/[\s-]/g, '');
  if (raw.length !== 10) return '';
  return `${raw.slice(0,4)}-${raw.slice(4,7)}-${raw.slice(7)}`;
}
export function normalizeWhatsApp(value) {
  if (value == null || value === '') return '';
  if (typeof value !== 'string' || !/^\+?[0-9\s()-]{8,25}$/.test(value)) return '';
  let raw = value.replace(/[\s()-]/g, '');
  // Accept Pakistani local 03XXXXXXXXX numbers and convert to E.164.
  if (/^03[0-9]{9}$/.test(raw)) raw = `+92${raw.slice(1)}`;
  else if (/^92[0-9]{10}$/.test(raw)) raw = `+${raw}`;
  return /^\+[1-9][0-9]{7,14}$/.test(raw) ? raw : '';
}

// Never disclose a private phone number merely because an algorithm suggests a match.
export function canShareWhatsApp(report, score) {
  return Boolean(report?.shareWhatsappOnMatch && report?.whatsapp && score >= 80);
}
