import imageCompression from 'browser-image-compression';

let env = {};
try {
  // Accessing import.meta may throw in some tooling; guard with try/catch
  env = import.meta && import.meta.env ? import.meta.env : {};
} catch (e) {
  env = {};
}

const DEFAULTS = {
  maxBytes: Number(env && env.VITE_IMAGE_MAX_BYTES) || 500 * 1024,
  maxDimension: Number(env && env.VITE_IMAGE_MAX_DIMENSION) || 1600,
  initialQuality: Number(env && env.VITE_IMAGE_INITIAL_QUALITY) || 0.8,
  minQuality: Number(env && env.VITE_IMAGE_MIN_QUALITY) || 0.4,
  preferWebP: (env && env.VITE_IMAGE_PREFER_WEBP) === 'true',
};

const SUPPORTED_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);

export function bytesToKB(bytes) {
  return Math.round((bytes / 1024) * 10) / 10;
}

export function formatCompressionStats(originalBytes, finalBytes) {
  const ratio = originalBytes > 0 ? Math.max(0, (1 - finalBytes / originalBytes)) : 0;
  return {
    original: originalBytes,
    final: finalBytes,
    saved: Math.max(0, originalBytes - finalBytes),
    ratio, // 0..1
  };
}

export async function compressImageClient(file, userOptions = {}) {
  if (!file) throw new Error('No file provided');
  const options = { ...DEFAULTS, ...userOptions };

  if (!SUPPORTED_TYPES.has(file.type)) {
    const err = new Error('Unsupported image format');
    err.code = 'UNSUPPORTED_FORMAT';
    throw err;
  }

  if (file.size <= options.maxBytes) {
    return { file, stats: formatCompressionStats(file.size, file.size), transformed: false };
  }

  const tryFormats = [];
  if (options.preferWebP && file.type !== 'image/webp') {
    tryFormats.push('image/webp');
  }
  if (file.type === 'image/png') {
    tryFormats.push('image/webp');
  }
  if (file.type !== 'image/jpeg') {
    tryFormats.push('image/jpeg');
  }
  if (!tryFormats.includes(file.type)) {
    tryFormats.unshift(file.type);
  }

  const qualities = [];
  const startQ = Math.min(1, Math.max(options.minQuality, options.initialQuality));
  for (let q = startQ; q >= options.minQuality; q = Math.round((q - 0.1) * 100) / 100) {
    qualities.push(q);
  }

  let best = { file: null, size: Number.POSITIVE_INFINITY };

  for (const fmt of tryFormats) {
    for (const q of qualities) {
      try {
        const compressed = await imageCompression(file, {
          maxWidthOrHeight: options.maxDimension,
          initialQuality: q,
          maxSizeMB: options.maxBytes / (1024 * 1024),
          fileType: fmt,
          useWebWorker: true,
        });
        if (compressed.size < best.size) {
          best = { file: compressed, size: compressed.size };
        }
        if (compressed.size <= options.maxBytes) {
          const renamed = renameWithExtension(compressed, file.name, fmt);
          return {
            file: renamed,
            stats: formatCompressionStats(file.size, renamed.size),
            transformed: true,
          };
        }
      } catch {
        continue;
      }
    }
  }

  if (best.file) {
    if (best.size <= options.maxBytes) {
      const renamed = renameWithExtension(best.file, file.name, best.file.type || file.type);
      return {
        file: renamed,
        stats: formatCompressionStats(file.size, renamed.size),
        transformed: true,
      };
    }
    const renamed = renameWithExtension(best.file, file.name, best.file.type || file.type);
    const err = new Error('Unable to compress image below the size limit');
    err.code = 'SIZE_NOT_MET';
    err.partial = {
      file: renamed,
      stats: formatCompressionStats(file.size, renamed.size),
    };
    throw err;
  }

  const err = new Error('Image compression failed');
  err.code = 'COMPRESSION_FAILED';
  throw err;
}

function renameWithExtension(file, originalName, mime) {
  try {
    const ext = mimeToExt(mime);
    const base = originalName.replace(/\.[^.]+$/, '');
    const name = `${base}${ext}`;
    return new File([file], name, { type: mime });
  } catch {
    return file;
  }
}

function mimeToExt(mime) {
  switch (mime) {
    case 'image/jpeg':
      return '.jpg';
    case 'image/png':
      return '.png';
    case 'image/webp':
      return '.webp';
    default:
      return '';
  }
}
