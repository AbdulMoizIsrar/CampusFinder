import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import yaml from 'yaml';
import fs from 'node:fs';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env.js';
import { AppError } from './utils/error.js';
import { maybeLimit, generalLimiter } from './middleware/security.js';
import { notFound, errorHandler } from './middleware/errors.js';
import authRoutes from './routes/authRoutes.js';
import itemRoutes from './routes/itemRoutes.js';
import claimRoutes from './routes/claimRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import { CATEGORIES } from './models/Item.js';
import { mountGraphql } from './graphql/dashboard.js';
const currentDir = path.dirname(fileURLToPath(import.meta.url));
export async function createApp() {
  const app = express();
  app.disable('x-powered-by');
  if (env.helmetEnabled) app.use(helmet({ contentSecurityPolicy: {
    directives: { defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'"],
      connectSrc: ["'self'", 'ws:', 'wss:'], imgSrc: ["'self'", 'data:', 'https://*.public.blob.vercel-storage.com'], objectSrc: ["'none'"], upgradeInsecureRequests: env.nodeEnv === 'production' ? [] : null }
  } }));
  app.use(cors({ origin: (origin, callback) => {
    if (!origin || origin === env.clientOrigin) return callback(null, true);
    callback(new AppError(403, 'CORS_BLOCKED', 'This origin is not permitted'));
  }, credentials: true }));
  app.use(express.json({ limit: '40kb' }));
  app.use(cookieParser());
  app.use('/api', maybeLimit(generalLimiter));
  app.use('/api', (req, _res, next) => {
    const isItemUpload = (req.method === 'POST' && req.path === '/v1/items') ||
      (req.method === 'PATCH' && /^\/v1\/items\/[a-f\d]{24}$/i.test(req.path));
    if (['POST', 'PATCH', 'PUT'].includes(req.method) &&
        !req.is('application/json') && !(isItemUpload && req.is('multipart/form-data'))) {
      return next(new AppError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Send JSON (or multipart/form-data for item photos)'));
    }
    next();
  });
  app.get('/api/v1/health', (_req, res) => res.json({ ok: true, service: 'CampusFinder', version: '1.0.0' }));
  app.get('/api/v1/meta', (_req, res) => res.json({ categories: CATEGORIES, types: ['lost', 'found'], statuses: ['open','claim_pending','claimed','returned'] }));
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/items', itemRoutes);
  app.use('/api/v1/claims', claimRoutes);
  app.use('/api/v1/notifications', notificationRoutes);
  app.use('/api/v1/admin', adminRoutes);
  const spec = yaml.parse(fs.readFileSync(path.resolve(currentDir, '../docs/openapi.yaml'), 'utf8'));
  // Swagger bundles rely on inline initialization; restrict that exception to API docs.
  app.use('/api-docs', (_req, res, next) => {
    if (env.helmetEnabled) res.set('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; object-src 'none'");
    next();
  }, swaggerUi.serve, swaggerUi.setup(spec, { explorer: true, customSiteTitle: 'CampusFinder API Docs' }));
  await mountGraphql(app);
  app.use(express.static(path.resolve(currentDir, '../public'), { extensions: ['html'] }));
  app.get('/', (_req, res) => res.sendFile(path.resolve(currentDir, '../public/index.html')));
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
