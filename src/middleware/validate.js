import { validationResult, body, param, query } from 'express-validator';
import { AppError } from '../utils/error.js';
import { CATEGORIES, STATUSES } from '../models/Item.js';
import { validColor } from '../../public/js/colorPalette.js';
import { REPORT_NAME_RE, REGISTRATION_RE, normalizeName, formatRegistration, normalizeWhatsApp } from '../utils/reportContact.js';
export function validated(req, _res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return next(new AppError(422, 'VALIDATION_ERROR', 'Please check the provided fields', errors.array({ onlyFirstError: true }).map(x => ({ field: x.path, message: x.msg }))));
  next();
}
export const mongoId = (field = 'id') => param(field).isMongoId().withMessage('Invalid ID');
export const verificationEmailRules = [body('email').isEmail().normalizeEmail()];
export const registrationRules = [
  body('name').isString().trim().isLength({ min: 2, max: 80 }),
  body('email').isEmail().normalizeEmail(),
  body('password').isString().isLength({ min: 8, max: 72 }).matches(/[A-Z]/).matches(/[a-z]/).matches(/[0-9]/),
  body('verificationCode').matches(/^[0-9]{6}$/).withMessage('Enter the six-digit email code')
];
export const loginRules = [body('email').isEmail().normalizeEmail(), body('password').isString().notEmpty()];
export const itemCreateRules = [
  body('reporterName').isString().customSanitizer(normalizeName).matches(REPORT_NAME_RE).withMessage('Name must contain only letters and spaces (2-80 characters)'),
  body('registrationNumber').isString().customSanitizer(formatRegistration).matches(REGISTRATION_RE).withMessage('Use registration format FA21-BEE-091'),
  body('whatsapp').optional({ values: 'falsy' }).isString().customSanitizer(normalizeWhatsApp).matches(/^\+[1-9][0-9]{7,14}$/).withMessage('Use WhatsApp like +923001234567 or 03001234567'),
  body('shareWhatsappOnMatch').optional().isBoolean().toBoolean(),
  body('title').isString().trim().isLength({ min: 3, max: 100 }),
  body('description').isString().trim().isLength({ min: 10, max: 2000 }),
  body('category').isIn(CATEGORIES),
  body('location').isString().trim().isLength({ min: 2, max: 120 }),
  body('date').isISO8601().toDate(),
  body('type').isIn(['lost', 'found']),
  body('brand').optional().isString().trim().isLength({ max: 80 }),
  body('color').optional().custom(validColor).withMessage('Select a valid color')
];
export const itemUpdateRules = [
  body('reporterName').optional().isString().customSanitizer(normalizeName).matches(REPORT_NAME_RE).withMessage('Name must contain only letters and spaces (2-80 characters)'),
  body('registrationNumber').optional().isString().customSanitizer(formatRegistration).matches(REGISTRATION_RE).withMessage('Use registration format FA21-BEE-091'),
  body('whatsapp').optional({ values: 'falsy' }).isString().customSanitizer(normalizeWhatsApp).matches(/^\+[1-9][0-9]{7,14}$/).withMessage('Use WhatsApp like +923001234567 or 03001234567'),
  body('shareWhatsappOnMatch').optional().isBoolean().toBoolean(),
  body('title').optional().isString().trim().isLength({ min: 3, max: 100 }),
  body('description').optional().isString().trim().isLength({ min: 10, max: 2000 }),
  body('category').optional().isIn(CATEGORIES),
  body('location').optional().isString().trim().isLength({ min: 2, max: 120 }),
  body('date').optional().isISO8601().toDate(),
  body('type').optional().isIn(['lost', 'found']),
  body('brand').optional().isString().trim().isLength({ max: 80 }),
  body('color').optional().custom(validColor).withMessage('Select a valid color'),
  body('status').optional().isIn(STATUSES)
];
export const itemListRules = [
  query('page').optional().isInt({ min: 1, max: 100000 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 50 }).toInt(),
  query('type').optional().isIn(['lost', 'found']),
  query('category').optional().isIn(CATEGORIES),
  query('status').optional().isIn(STATUSES),
  query('from').optional().isISO8601(),
  query('to').optional().isISO8601(),
  query('q').optional().isString().isLength({ max: 100 }),
  query('location').optional().isString().isLength({ max: 100 }),
  query('sort').optional().isIn(['newest', 'oldest', 'date_asc', 'date_desc', 'title_asc', 'title_desc']),
  query('fields').optional().isString().isLength({ max: 200 })
];

export function allowQueryKeys(...allowed) {
  return (req, _res, next) => {
    const unknown = Object.keys(req.query || {}).filter(key => !allowed.includes(key));
    return unknown.length ? next(new AppError(422, 'INVALID_QUERY', `Unknown query parameter: ${unknown[0]}`)) : next();
  };
}
