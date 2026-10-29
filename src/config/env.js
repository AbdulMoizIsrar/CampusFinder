import 'dotenv/config';
const bool = (name, fallback = true) => process.env[name] === undefined ? fallback : process.env[name] !== 'false';
export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 3000),
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/campusfinder',
  jwtSecret: process.env.JWT_SECRET || '',
  csrfSecret: process.env.CSRF_SECRET || '',
  jwtAccessExpires: process.env.JWT_ACCESS_EXPIRES || '15m',
  refreshDays: Number(process.env.REFRESH_DAYS || 7),
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:3000',
  campusEmailDomain: (process.env.CAMPUS_EMAIL_DOMAIN || '').toLowerCase(),
  smtpHost: process.env.SMTP_HOST || '',
  smtpPort: Number(process.env.SMTP_PORT || 465),
  smtpUser: process.env.SMTP_USER || '',
  smtpPassword: process.env.SMTP_PASSWORD || '',
  mailFrom: process.env.MAIL_FROM || '',
  helmetEnabled: bool('SECURITY_HELMET'),
  rateLimitEnabled: bool('SECURITY_RATE_LIMIT'),
  csrfEnabled: bool('SECURITY_CSRF'),
  sanitizeEnabled: bool('SECURITY_SANITIZE')
};
export function validateEnv() {
  if (env.jwtSecret.length < 32 || env.csrfSecret.length < 32 || env.jwtSecret === env.csrfSecret) {
    throw new Error('Set unique JWT_SECRET and CSRF_SECRET values (at least 32 characters). Run npm run setup.');
  }
  if (!Number.isInteger(env.port) || env.port < 1 || env.port > 65535) throw new Error('Invalid PORT');
  if (!Number.isInteger(env.refreshDays) || env.refreshDays < 1 || env.refreshDays > 30) throw new Error('REFRESH_DAYS must be 1–30');
}
