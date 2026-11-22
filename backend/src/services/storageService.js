const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const { v2: cloudinary } = require('cloudinary');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');

const useCloudinary = Boolean(env.cloudinary.cloudName && env.cloudinary.apiKey && env.cloudinary.apiSecret);

if (useCloudinary) {
  cloudinary.config({
    cloud_name: env.cloudinary.cloudName,
    api_key: env.cloudinary.apiKey,
    api_secret: env.cloudinary.apiSecret,
    secure: true,
  });
}

const EXT = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'video/mp4': '.mp4',
  'video/quicktime': '.mov',
  'video/webm': '.webm',
  'application/pdf': '.pdf',
  'text/plain': '.txt',
};

/**
 * Stores an uploaded file (multer memory buffer). Uses Cloudinary when configured,
 * otherwise local disk under backend/uploads (served at /uploads).
 * @returns {{url: string, publicId: string, provider: string}}
 */
async function uploadFile(file, folder = 'misc') {
  if (!file?.buffer) throw new Error('No file buffer');
  if (useCloudinary) {
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: `jencorps/${folder}`, resource_type: 'auto' },
        (err, res) => (err ? reject(err) : resolve(res))
      );
      stream.end(file.buffer);
    });
    return { url: result.secure_url, publicId: `cloudinary:${result.resource_type}:${result.public_id}`, provider: 'cloudinary' };
  }

  if (env.isServerless) {
    throw new ApiError(503, 'File uploads need Cloudinary when hosted on Vercel. Add the CLOUDINARY_* environment variables.', undefined, 'STORAGE_NOT_CONFIGURED');
  }
  const safeFolder = folder.replace(/[^a-z0-9-]/gi, '');
  const dir = path.join(env.uploadDir, safeFolder);
  await fs.mkdir(dir, { recursive: true });
  const filename = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${EXT[file.mimetype] || ''}`;
  await fs.writeFile(path.join(dir, filename), file.buffer);
  return { url: `${env.publicApiUrl}/uploads/${safeFolder}/${filename}`, publicId: `local:${safeFolder}/${filename}`, provider: 'local' };
}

async function deleteFile(publicId) {
  if (!publicId) return;
  try {
    if (publicId.startsWith('cloudinary:') && useCloudinary) {
      const [, resourceType, ...rest] = publicId.split(':');
      await cloudinary.uploader.destroy(rest.join(':'), { resource_type: resourceType });
    } else if (publicId.startsWith('local:')) {
      const rel = publicId.slice(6);
      const full = path.resolve(env.uploadDir, rel);
      if (full.startsWith(env.uploadDir)) await fs.unlink(full);
    }
  } catch {
    // best effort
  }
}

module.exports = { uploadFile, deleteFile, useCloudinary };
