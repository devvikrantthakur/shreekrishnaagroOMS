const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

const isProd = process.env.NODE_ENV === 'production';
const envCandidates = isProd
  ? [
      path.resolve(__dirname, '../../.env.production'),
      path.resolve(__dirname, '../../../.env.production'),
      path.resolve(__dirname, '../../.env'),
      path.resolve(__dirname, '../../../.env'),
    ]
  : [
      path.resolve(__dirname, '../../.env'),
      path.resolve(__dirname, '../../../.env'),
    ];

for (const envPath of envCandidates) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    break;
  }
}

if (!process.env.JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET environment variable is required in production');
  }
}

const uploadDirEnv = process.env.UPLOAD_DIR;
const resolvedUploadDir = uploadDirEnv
  ? path.isAbsolute(uploadDirEnv)
    ? uploadDirEnv
    : path.resolve(__dirname, '../..', uploadDirEnv)
  : path.resolve(__dirname, '../../uploads');

module.exports = {
  port: Number(process.env.PORT || 5000),
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  jwtSecret: process.env.JWT_SECRET || 'dev_only_shree_krishna_agro_secret_change_in_prod',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  uploadDir: resolvedUploadDir,
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'shri_krishna_agro',
  },
};
