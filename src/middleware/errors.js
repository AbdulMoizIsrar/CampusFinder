import mongoose from 'mongoose';
import multer from 'multer';
export function notFound(req, _res, next) { const error = new Error(`No route for ${req.method} ${req.path}`); error.status = 404; error.code = 'NOT_FOUND'; next(error); }
export function errorHandler(err, _req, res, _next) {
  let status = err.status || err.statusCode || 500;
  let code = err.code || 'SERVER_ERROR';
  let message = err.message || 'An unexpected error occurred';
  if (err instanceof multer.MulterError) {
    status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 422;
    code = 'IMAGE_UPLOAD_ERROR';
    message = err.code === 'LIMIT_FILE_SIZE' ? 'Image must be 5 MB or smaller' : 'Invalid image upload';
  }
  else if (err instanceof mongoose.Error.ValidationError || err instanceof mongoose.Error.CastError) {
    status = 422; code = 'VALIDATION_ERROR'; message = 'Invalid request data';
  } else if (err.code === 11000) { status = 409; code = 'DUPLICATE'; message = 'This resource already exists'; }
  else if (err.type === 'entity.parse.failed') { status = 400; code = 'BAD_JSON'; message = 'Malformed JSON body'; }
  if (status >= 500) { console.error(err); message = 'Internal server error'; }
  res.status(status).json({ error: { code, message, ...(err.details ? { details: err.details } : {}) } });
}
