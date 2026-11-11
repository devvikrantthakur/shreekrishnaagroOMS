const fs = require('fs');
const path = require('path');
const multer = require('multer');
const env = require('../config/env');
const { AppError } = require('./errorHandler');

const vegUploadPath = path.join(env.uploadDir, 'vegetables');
fs.mkdirSync(vegUploadPath, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, vegUploadPath);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.png';
    const safeName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, safeName);
  },
});

const allowedMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
]);

const uploadVegetableImage = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (allowedMimeTypes.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new AppError('Only JPG, PNG, WEBP, GIF, and SVG images are allowed.', 400));
    }
  },
});

module.exports = {
  uploadVegetableImage,
};
