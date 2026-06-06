#!/usr/bin/env node

const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const DEFAULT_OUTPUT_DIR = path.join(__dirname, 'store');
const RVSG_CONVERT_BIN = 'rsvg-convert';
const APP_NAME = 'Roselt Invoice Generator';
const STACKED_APP_NAME = ['Roselt Invoice', 'Generator'];
const BG_PRIMARY = '#17324f';
const BG_SECONDARY = '#091521';
const BG_TERTIARY = '#0c1e31';
const BORDER = '#3c6b90';
const FOREGROUND = '#eef6fd';
const ACCENT = '#27b4f3';
const ACCENT_SOFT = '#097fd8';
const LOGO_SVG = fs.readFileSync(path.join(__dirname, 'favicon.svg'), 'utf8');
const LOGO_DATA_URL = toDataUrl(LOGO_SVG, 'image/svg+xml');
const { width: LOGO_VIEWBOX_WIDTH, height: LOGO_VIEWBOX_HEIGHT } = parseSvgViewBox(LOGO_SVG);
const LOGO_ASPECT_RATIO = LOGO_VIEWBOX_WIDTH / LOGO_VIEWBOX_HEIGHT;
const TEMPLATE_SPECS = [
  { fileName: 'Header Capsule.png', width: 920, height: 430 },
  { fileName: 'Library Capsule.png', width: 600, height: 900 },
  { fileName: 'Library Header.png', width: 920, height: 430 },
  { fileName: 'Library Hero.png', width: 3840, height: 1240 },
  { fileName: 'Library Logo.png', width: 1280, height: 720 },
  { fileName: 'Main Capsule.png', width: 1232, height: 706 },
  { fileName: 'Shortcut Icon.png', width: 512, height: 512 },
  { fileName: 'Small Capsule.png', width: 462, height: 174 },
  { fileName: 'Vertical Capsule.png', width: 748, height: 896 }
];

function toDataUrl(content, mimeType) {
  const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8');
  return `data:${mimeType};base64,${buffer.toString('base64')}`;
}

function parseSvgViewBox(svgMarkup) {
  const match = svgMarkup.match(/viewBox=["']\s*[-+\d.]+\s+[-+\d.]+\s+([-+\d.]+)\s+([-+\d.]+)\s*["']/i);

  if (!match) {
    throw new Error('Could not determine favicon.svg viewBox.');
  }

  return {
    width: Number.parseFloat(match[1]),
    height: Number.parseFloat(match[2])
  };
}

function printHelp() {
  console.log('Generate store marketing images into assets/img/store.');
  console.log('');
  console.log('Usage: node assets/img/generate_store_images.cjs [options]');
  console.log('');
  console.log('Options:');
  console.log(`  --output-dir=${DEFAULT_OUTPUT_DIR}  Override the output directory.`);
  console.log('  --help, -h                         Show this help.');
}

function parseArgs(argv) {
  const options = {
    outputDir: DEFAULT_OUTPUT_DIR,
    help: false
  };

  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }

    if (arg.startsWith('--output-dir=')) {
      const rawOutputDir = arg.slice('--output-dir='.length).trim();
      options.outputDir = rawOutputDir ? path.resolve(rawOutputDir) : DEFAULT_OUTPUT_DIR;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function ensureRsvgInstalled() {
  const result = spawnSync(RVSG_CONVERT_BIN, ['--version'], { stdio: 'ignore' });

  if (result.error) {
    throw new Error(`Unable to find ${RVSG_CONVERT_BIN}. Install librsvg first.`);
  }
}

function detectLayout(fileName) {
  if (fileName === 'Library Hero.png') {
    return 'hero';
  }

  if (fileName === 'Shortcut Icon.png') {
    return 'icon';
  }

  if (fileName === 'Library Logo.png') {
    return 'logo-wide';
  }

  if (fileName === 'Library Capsule.png' || fileName === 'Vertical Capsule.png') {
    return 'stacked';
  }

  if (fileName === 'Small Capsule.png') {
    return 'small';
  }

  if (fileName === 'Main Capsule.png') {
    return 'feature';
  }

  return 'wide';
}

function loadTemplateSpecs() {
  return TEMPLATE_SPECS.map((spec) => ({
    ...spec,
    layout: detectLayout(spec.fileName)
  }));
}

function svgLength(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function escapeText(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function renderLogo(x, y, height) {
  const width = height * LOGO_ASPECT_RATIO;

  return `<image href="${LOGO_DATA_URL}" x="${svgLength(x)}" y="${svgLength(y)}" width="${svgLength(width)}" height="${svgLength(height)}" preserveAspectRatio="xMidYMid meet"/>`;
}

function renderTextLines({ lines, x, y, fontSize, lineHeight, textAnchor = 'middle' }) {
  return lines
    .map((line, index) => `<text class="title" x="${svgLength(x)}" y="${svgLength(y + index * lineHeight)}" font-size="${svgLength(fontSize)}" text-anchor="${textAnchor}">${escapeText(line)}</text>`)
    .join('');
}

function fitFontSize(text, maxFontSize, maxWidth, widthFactor = 0.58) {
  const safeText = String(text || '').trim();

  if (!safeText) {
    return maxFontSize;
  }

  const estimatedWidth = safeText.length * widthFactor;

  if (estimatedWidth <= 0) {
    return maxFontSize;
  }

  return Math.min(maxFontSize, maxWidth / estimatedWidth);
}

function renderBackdrop(width, height, options = {}) {
  const edgeRadius = Math.min(width, height) * 0.06;
  const accentOpacity = options.hero ? 0.12 : 0.06;

  return [
    `<rect width="${width}" height="${height}" fill="${BG_SECONDARY}" rx="${svgLength(edgeRadius)}"/>`,
    `<rect width="${width}" height="${height}" fill="url(#baseGradient)" rx="${svgLength(edgeRadius)}"/>`,
    `<circle cx="${svgLength(width * 0.18)}" cy="${svgLength(height * 0.16)}" r="${svgLength(Math.max(width, height) * 0.22)}" fill="url(#blueGlow)" fill-opacity="${svgLength(accentOpacity)}"/>`,
    `<circle cx="${svgLength(width * 0.84)}" cy="${svgLength(height * 0.82)}" r="${svgLength(Math.max(width, height) * 0.24)}" fill="url(#blueGlow)" fill-opacity="${svgLength(accentOpacity * 0.8)}"/>`,
    `<rect x="${svgLength(width * 0.04)}" y="${svgLength(height * 0.04)}" width="${svgLength(width * 0.92)}" height="${svgLength(height * 0.92)}" rx="${svgLength(edgeRadius * 0.72)}" fill="none" stroke="${BORDER}" stroke-opacity="0.55" stroke-width="${svgLength(Math.max(2, Math.min(width, height) * 0.003))}"/>`
  ].join('');
}

function renderHeroKeys(width, height) {
  const startX = width * 0.08;
  const startY = height * 0.22;
  const keyWidth = width * 0.12;
  const keyHeight = height * 0.22;
  const gap = width * 0.022;
  const rows = 2;
  const cols = 3;
  const cells = [];

  for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
    for (let columnIndex = 0; columnIndex < cols; columnIndex += 1) {
      const x = startX + columnIndex * (keyWidth + gap);
      const y = startY + rowIndex * (keyHeight + gap * 1.4);
      const fillOpacity = rowIndex === 0 && columnIndex === 2 ? 0.12 : 0.045;

      cells.push(`<rect x="${svgLength(x)}" y="${svgLength(y)}" width="${svgLength(keyWidth)}" height="${svgLength(keyHeight)}" rx="${svgLength(width * 0.015)}" fill="rgba(0,122,204,${fillOpacity})" stroke="rgba(0,122,204,0.12)" stroke-width="${svgLength(width * 0.0019)}"/>`);
    }
  }

  return cells.join('');
}

function renderWideLayout(spec) {
  const logoHeight = spec.height * (spec.layout === 'feature' ? 0.42 : 0.36);
  const logoWidth = logoHeight * LOGO_ASPECT_RATIO;
  const logoX = (spec.width - logoWidth) / 2;
  const logoY = spec.height * 0.1;
  const maxFontSize = Math.min(spec.height * (spec.layout === 'feature' ? 0.17 : 0.18), spec.width * 0.095);
  const fontSize = fitFontSize(APP_NAME, maxFontSize, spec.width * 0.82);
  const baselineY = spec.height * (spec.layout === 'feature' ? 0.82 : 0.79);
  const accentWidth = spec.width * 0.44;
  const accentHeight = Math.max(6, spec.height * 0.015);
  const accentX = (spec.width - accentWidth) / 2;
  const accentY = baselineY - fontSize * 0.95;

  return [
    `<rect x="${svgLength(accentX)}" y="${svgLength(accentY)}" width="${svgLength(accentWidth)}" height="${svgLength(accentHeight)}" rx="${svgLength(accentHeight / 2)}" fill="url(#accentGradient)" fill-opacity="0.56"/>`,
    renderLogo(logoX, logoY, logoHeight),
    renderTextLines({
      lines: [APP_NAME],
      x: spec.width / 2,
      y: baselineY,
      fontSize,
      lineHeight: fontSize * 1.08
    })
  ].join('');
}

function renderSmallLayout(spec) {
  const logoHeight = spec.height * 0.46; // increased for a larger logo in the small capsule
  const logoWidth = logoHeight * LOGO_ASPECT_RATIO;
  const logoX = (spec.width - logoWidth) / 2;
  const logoY = spec.height * 0.08;
  const maxFontSize = Math.min(spec.height * 0.16, spec.width * 0.09);
  const fontSize = fitFontSize(APP_NAME, maxFontSize, spec.width * 0.84);

  return [
    renderLogo(logoX, logoY, logoHeight),
    renderTextLines({
      lines: [APP_NAME],
      x: spec.width / 2,
      y: spec.height * 0.77,
      fontSize,
      lineHeight: fontSize * 1.08
    })
  ].join('');
}

function renderStackedLayout(spec) {
  const logoHeight = spec.height * 0.34;
  const logoWidth = logoHeight * LOGO_ASPECT_RATIO;
  const logoX = (spec.width - logoWidth) / 2;
  const logoY = spec.height * 0.08;
  const maxFontSize = Math.min(spec.width * 0.11, spec.height * 0.12);
  const longestLine = STACKED_APP_NAME.reduce((longest, line) => line.length > longest.length ? line : longest, '');
  const fontSize = fitFontSize(longestLine, maxFontSize, spec.width * 0.72);

  return [
    renderLogo(logoX, logoY, logoHeight),
    renderTextLines({
      lines: STACKED_APP_NAME,
      x: spec.width / 2,
      y: spec.height * 0.64,
      fontSize,
      lineHeight: fontSize * 1.1
    })
  ].join('');
}

function renderLogoWideLayout(spec) {
  const logoHeight = spec.height * 0.42;
  const logoWidth = logoHeight * LOGO_ASPECT_RATIO;
  const logoX = (spec.width - logoWidth) / 2;
  const logoY = spec.height * 0.08;
  const maxFontSize = Math.min(spec.height * 0.15, spec.width * 0.08);
  const fontSize = fitFontSize(APP_NAME, maxFontSize, spec.width * 0.8);

  return [
    renderLogo(logoX, logoY, logoHeight),
    renderTextLines({
      lines: [APP_NAME],
      x: spec.width / 2,
      y: spec.height * 0.8,
      fontSize,
      lineHeight: fontSize * 1.08
    })
  ].join('');
}

function renderIconLayout(spec) {
  const logoHeight = Math.min(spec.width, spec.height) * 0.62;
  const logoWidth = logoHeight * LOGO_ASPECT_RATIO;
  const logoX = (spec.width - logoWidth) / 2;
  const logoY = (spec.height - logoHeight) / 2;

  return [
    `<circle cx="${svgLength(spec.width * 0.5)}" cy="${svgLength(spec.height * 0.48)}" r="${svgLength(spec.width * 0.34)}" fill="url(#blueGlow)" fill-opacity="0.1"/>`,
    renderLogo(logoX, logoY, logoHeight)
  ].join('');
}

function renderHeroLayout(spec) {
  // Library Hero should be decorative only: no logos or text
  return renderHeroKeys(spec.width, spec.height);
}

function renderLayout(spec) {
  if (spec.layout === 'hero') {
    return renderHeroLayout(spec);
  }

  if (spec.layout === 'icon') {
    return renderIconLayout(spec);
  }

  if (spec.layout === 'logo-wide') {
    return renderLogoWideLayout(spec);
  }

  if (spec.layout === 'stacked') {
    return renderStackedLayout(spec);
  }

  if (spec.layout === 'small') {
    return renderSmallLayout(spec);
  }

  return renderWideLayout(spec);
}

function createSvg(spec) {
  const backdropMarkup = spec.layout === 'logo-wide'
    ? ''
    : renderBackdrop(spec.width, spec.height, { hero: spec.layout === 'hero' });

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${spec.width}" height="${spec.height}" viewBox="0 0 ${spec.width} ${spec.height}" role="img" aria-label="${escapeText(spec.fileName.replace(/\.png$/i, ''))}">
  <defs>
    <style>
      .title {
        fill: ${FOREGROUND};
        font-family: 'Segoe UI', 'Inter', 'DejaVu Sans', Arial, sans-serif;
        font-weight: 700;
        letter-spacing: -0.045em;
        text-rendering: geometricPrecision;
      }
    </style>
    <linearGradient id="baseGradient" x1="0" y1="0" x2="${svgLength(spec.width)}" y2="${svgLength(spec.height)}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${BG_PRIMARY}"/>
      <stop offset="0.48" stop-color="${BG_TERTIARY}"/>
      <stop offset="1" stop-color="${BG_SECONDARY}"/>
    </linearGradient>
    <radialGradient id="blueGlow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(${svgLength(spec.width * 0.5)} ${svgLength(spec.height * 0.5)}) rotate(90) scale(${svgLength(spec.height * 0.8)} ${svgLength(spec.width * 0.7)})">
      <stop offset="0" stop-color="${ACCENT}" stop-opacity="1"/>
      <stop offset="1" stop-color="${ACCENT_SOFT}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="accentGradient" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${ACCENT}"/>
      <stop offset="1" stop-color="${ACCENT_SOFT}"/>
    </linearGradient>
  </defs>
  ${backdropMarkup}
  ${renderLayout(spec)}
</svg>`;
}

function renderSvgToPng(svgMarkup, outputPath, width, height) {
  return new Promise((resolve, reject) => {
    const child = spawn(RVSG_CONVERT_BIN, [
      '--format',
      'png',
      '--width',
      String(width),
      '--height',
      String(height),
      '--output',
      outputPath,
      '-'
    ]);

    let stderr = '';

    child.on('error', reject);
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`rsvg-convert failed for ${path.basename(outputPath)}: ${stderr.trim() || `exit code ${code}`}`));
    });

    child.stdin.end(svgMarkup);
  });
}

async function generateAssets(options) {
  const specs = loadTemplateSpecs();
  await fsp.mkdir(options.outputDir, { recursive: true });

  for (const spec of specs) {
    const svgMarkup = createSvg(spec);
    const outputPath = path.join(options.outputDir, spec.fileName);
    await renderSvgToPng(svgMarkup, outputPath, spec.width, spec.height);
    console.log(`generated ${spec.fileName} (${spec.width}x${spec.height})`);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    printHelp();
    return;
  }

  ensureRsvgInstalled();
  await generateAssets(options);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});
