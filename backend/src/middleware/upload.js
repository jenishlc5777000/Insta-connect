const multer = require('multer');
const ApiError = require('../utils/ApiError');

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];
const DOC_TYPES = ['application/pdf', 'text/plain'];

function make(allowed, maxMb) {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxMb * 1024 * 1024, files: 1 },
    fileFilter: (_req, file, cb) => {
      if (allowed.includes(file.mimetype)) return cb(null, true);
      return cb(ApiError.badRequest(`Unsupported file type: ${file.mimetype}`));
    },
  });
}

module.exports = {
  imageUpload: make(IMAGE_TYPES, 5).single('file'),
  resourceUpload: make([...IMAGE_TYPES, ...VIDEO_TYPES, ...DOC_TYPES], 100).single('file'),
};
