const multer = require('multer');
const ApiError = require('../utils/ApiError');

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

// Images are kept in memory (not written to disk): they are either forwarded
// to the vision service or uploaded straight to S3.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (ALLOWED_TYPES.includes(file.mimetype)) callback(null, true);
    else callback(ApiError.badRequest('Only JPEG, PNG or WebP images are allowed'));
  },
});

// Accepts one image in the given multipart field and makes it required.
function singleImage(fieldName) {
  const parse = upload.single(fieldName);
  return (req, res, next) => {
    parse(req, res, (error) => {
      if (error) return next(error);
      if (!req.file) return next(ApiError.badRequest(`An image file is required in the "${fieldName}" field`));
      return next();
    });
  };
}

module.exports = { singleImage, MAX_IMAGE_BYTES };
