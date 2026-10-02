const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const rootFiles = [
  ...fs.readdirSync(root).filter((name) => name.endsWith('.html')),
  'ads.txt',
  'CNAME',
  'favicon.svg',
  'llms.txt',
  'llms-full.txt',
  'robots.txt',
  'site.webmanifest',
  'sitemap.xml'
].sort();

function listFiles(directory, prefix = '') {
  return fs.readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const relative = path.posix.join(prefix, entry.name);
      return entry.isDirectory()
        ? listFiles(path.join(directory, entry.name), relative)
        : [relative];
    });
}

function hashFile(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function copyExact(relativePath) {
  const source = path.join(root, ...relativePath.split('/'));
  const target = path.join(dist, ...relativePath.split('/'));
  if (!fs.existsSync(source) || !fs.statSync(source).isFile()) {
    throw new Error(`Missing deploy source: ${relativePath}`);
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
  if (hashFile(source) !== hashFile(target)) throw new Error(`Byte mismatch after copy: ${relativePath}`);
}

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });

const deployFiles = [
  ...rootFiles,
  ...listFiles(path.join(root, 'assets'), 'assets'),
  ...fs.readdirSync(path.join(root, 'seo'))
    .filter((name) => name.endsWith('.html'))
    .map((name) => `seo/${name}`)
].sort();

deployFiles.forEach(copyExact);

const manifest = {
  schemaVersion: 1,
  generatedFrom: 'tracked runtime sources',
  files: deployFiles.map((relativePath) => {
    const filePath = path.join(dist, ...relativePath.split('/'));
    return {
      path: relativePath,
      bytes: fs.statSync(filePath).size,
      sha256: hashFile(filePath)
    };
  })
};

fs.writeFileSync(path.join(dist, 'asset-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

const forbidden = listFiles(dist).filter((relativePath) =>
  relativePath.endsWith('.bak')
  || relativePath.endsWith('.js') && relativePath.startsWith('seo/')
  || relativePath.includes('_sitemap_fragment')
);
if (forbidden.length) throw new Error(`Authoring files leaked into dist: ${forbidden.join(', ')}`);

const totalBytes = manifest.files.reduce((sum, file) => sum + file.bytes, 0);
console.log(`Built ${manifest.files.length} byte-identical runtime files (${totalBytes} bytes).`);
console.log('Backups and SEO authoring tools are excluded from dist/.');
