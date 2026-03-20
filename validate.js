const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
let errors = 0;
let passes = 0;

function check(condition, passMsg, failMsg) {
  if (condition) {
    console.log(`  \u2705 ${passMsg}`);
    passes++;
  } else {
    console.log(`  \u274C ${failMsg}`);
    errors++;
  }
}

function fileExists(relPath) {
  return fs.existsSync(path.join(ROOT, relPath));
}

function readFile(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf-8');
}

// ──────────────────────────────────────────────
//  1. Required files
// ──────────────────────────────────────────────
console.log('\n[1] Required Files');

const requiredFiles = [
  'index.html',
  'index-en.html',
  'privacy.html',
  'terms.html',
  'CNAME',
  'sitemap.xml',
  'robots.txt',
  'favicon.svg',
  'ads.txt',
  'llms.txt',
  'assets/css/style.css',
  'assets/js/main.js',
  'assets/js/browser-check.js',
  'assets/js/constellation.js',
  'assets/js/cursor.js',
  'assets/js/ga.js',
  'assets/images/archerlab_mini_logo.png',
  'assets/images/archerlab_full_logo.png',
  'assets/images/archerlab_logo.png',
];

for (const f of requiredFiles) {
  check(fileExists(f), `${f} exists`, `${f} MISSING`);
}

// ──────────────────────────────────────────────
//  2. CNAME validation
// ──────────────────────────────────────────────
console.log('\n[2] CNAME');

const cname = readFile('CNAME').trim();
check(cname.length > 0, `CNAME has value: ${cname}`, 'CNAME is empty');
check(
  /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(cname),
  'CNAME is valid domain format',
  `CNAME has invalid format: "${cname}"`
);

// ──────────────────────────────────────────────
//  3. HTML internal link / asset reference checks
// ──────────────────────────────────────────────
console.log('\n[3] HTML Local Asset References');

const htmlFiles = ['index.html', 'index-en.html', 'privacy.html', 'terms.html'];

for (const htmlFile of htmlFiles) {
  const content = readFile(htmlFile);
  const htmlDir = path.dirname(path.join(ROOT, htmlFile));

  // Extract local src= and href= references (skip http, https, #, mailto, tel, data, //)
  const refPattern = /(?:src|href)=["']([^"']+)["']/g;
  let match;
  const localRefs = new Set();

  while ((match = refPattern.exec(content)) !== null) {
    const ref = match[1];
    if (
      ref.startsWith('http://') ||
      ref.startsWith('https://') ||
      ref.startsWith('//') ||
      ref.startsWith('#') ||
      ref.startsWith('mailto:') ||
      ref.startsWith('tel:') ||
      ref.startsWith('data:')
    ) {
      continue;
    }
    // Strip query string and fragment for file existence check
    const cleanRef = ref.split('?')[0].split('#')[0];
    if (cleanRef) localRefs.add(cleanRef);
  }

  for (const ref of localRefs) {
    const refPath = path.resolve(htmlDir, ref);
    // Extensionless links (e.g. "privacy", "terms") resolve to .html on static hosts
    const exists =
      fs.existsSync(refPath) ||
      fs.existsSync(refPath + '.html') ||
      fs.existsSync(path.join(refPath, 'index.html'));
    check(exists, `${htmlFile} -> ${ref}`, `${htmlFile} -> ${ref} NOT FOUND`);
  }
}

// ──────────────────────────────────────────────
//  4. Cross-links between pages
// ──────────────────────────────────────────────
console.log('\n[4] Internal Page Cross-Links');

// index.html should link to privacy and terms
const indexContent = readFile('index.html');
check(
  /href=["']privacy["']/.test(indexContent),
  'index.html links to privacy',
  'index.html missing link to privacy'
);
check(
  /href=["']terms["']/.test(indexContent),
  'index.html links to terms',
  'index.html missing link to terms'
);

// index-en.html should link to privacy and terms
const indexEnContent = readFile('index-en.html');
check(
  /href=["']privacy["']/.test(indexEnContent),
  'index-en.html links to privacy',
  'index-en.html missing link to privacy'
);
check(
  /href=["']terms["']/.test(indexEnContent),
  'index-en.html links to terms',
  'index-en.html missing link to terms'
);

// Hreflang cross-references
check(
  indexContent.includes('hreflang="en"') && indexContent.includes('index-en'),
  'index.html has hreflang link to index-en',
  'index.html missing hreflang to index-en'
);
check(
  indexEnContent.includes('hreflang="ko"') && indexEnContent.includes('archerlab.dev/'),
  'index-en.html has hreflang link to index.html (ko)',
  'index-en.html missing hreflang to index.html'
);

// ──────────────────────────────────────────────
//  5. Sitemap validation
// ──────────────────────────────────────────────
console.log('\n[5] Sitemap');

const sitemap = readFile('sitemap.xml');
check(
  sitemap.includes('<?xml') && sitemap.includes('<urlset'),
  'sitemap.xml has valid XML structure',
  'sitemap.xml missing XML declaration or urlset'
);
check(
  sitemap.includes('<loc>'),
  'sitemap.xml contains <loc> entries',
  'sitemap.xml has no <loc> entries'
);

// Check that key pages are in sitemap
const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
check(
  sitemapUrls.some(u => u === 'https://archerlab.dev/' || u === 'https://archerlab.dev'),
  'sitemap contains main page URL',
  'sitemap missing main page URL'
);
check(
  sitemapUrls.some(u => u.includes('index-en')),
  'sitemap contains English page URL',
  'sitemap missing English page URL'
);
check(
  sitemapUrls.some(u => u.includes('/privacy')),
  'sitemap contains privacy page URL',
  'sitemap missing privacy page URL'
);
check(
  sitemapUrls.some(u => u.includes('/terms')),
  'sitemap contains terms page URL',
  'sitemap missing terms page URL'
);

// ──────────────────────────────────────────────
//  6. robots.txt validation
// ──────────────────────────────────────────────
console.log('\n[6] robots.txt');

const robots = readFile('robots.txt');
check(
  robots.includes('User-agent:'),
  'robots.txt has User-agent directive',
  'robots.txt missing User-agent directive'
);
check(
  /Sitemap:\s*https?:\/\//.test(robots),
  'robots.txt references sitemap URL',
  'robots.txt missing Sitemap directive'
);

// ──────────────────────────────────────────────
//  7. Image files referenced in HTML exist
// ──────────────────────────────────────────────
console.log('\n[7] Project Image Assets');

const imageFiles = fs.readdirSync(path.join(ROOT, 'assets/images'));
check(imageFiles.length > 0, `${imageFiles.length} images in assets/images/`, 'No images found in assets/images/');

// Check all project card images referenced in index.html
const imgSrcPattern = /src=["']assets\/images\/([^"'?]+)/g;
const referencedImages = new Set();
let imgMatch;
const allHtmlContent = indexContent + indexEnContent;
while ((imgMatch = imgSrcPattern.exec(allHtmlContent)) !== null) {
  referencedImages.add(imgMatch[1]);
}
for (const img of referencedImages) {
  check(
    fileExists(`assets/images/${img}`),
    `Image asset: ${img}`,
    `Image asset MISSING: ${img}`
  );
}

// ──────────────────────────────────────────────
//  Summary
// ──────────────────────────────────────────────
console.log('\n' + '='.repeat(50));
console.log(`mainBlog validation: ${passes} passed, ${errors} failed`);
console.log('='.repeat(50));

if (errors > 0) {
  process.exit(1);
}
