const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const root = path.resolve(__dirname, '..');
const distDir = path.join(root, 'dist');
const outDir = path.join(root, 'build-uploads');

if (!fs.existsSync(distDir)) {
  console.error('[zip-dist] dist folder not found. Run `npm run build` first.');
  process.exit(1);
}
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

function zipFiles(zipPath, collector) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    output.on('close', () => resolve());
    archive.on('error', err => reject(err));
    archive.pipe(output);
    collector(archive);
    archive.finalize();
  });
}

(async () => {
  const distZip = path.join(outDir, 'dist.zip');
  await zipFiles(distZip, (archive) => {
    const items = fs.readdirSync(distDir);
    items.forEach((item) => {
      if (item === 'assets') return;
      const full = path.join(distDir, item);
      const rel = item;
      const stat = fs.statSync(full);
      if (stat.isDirectory()) {
        archive.directory(full, rel);
      } else {
        archive.file(full, { name: rel });
      }
    });
  });
  console.log(`[zip-dist] Wrote ${distZip}`);

  const assetsDir = path.join(distDir, 'assets');
  const assetsZip = path.join(outDir, 'dist-assets.zip');
  if (fs.existsSync(assetsDir)) {
    await zipFiles(assetsZip, (archive) => {
      archive.directory(assetsDir, 'assets');
    });
    console.log(`[zip-dist] Wrote ${assetsZip}`);
  } else {
    console.warn('[zip-dist] No assets directory found in dist.');
  }
})().catch((err) => {
  console.error('[zip-dist] Failed:', err);
  process.exit(1);
});
