const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const RES_DIR = path.resolve(__dirname, '../android/app/src/main/res');
const ASSETS_DIR = path.resolve(__dirname, '../assets');

// High-resolution SVG of the Imposter Mask + "IMPOSTER" game title in 1:1 square
function getSplashSvg(width, height) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="${width}" height="${height}">
  <defs>
    <linearGradient id="maskGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f43f5e" />
      <stop offset="100%" stop-color="#a855f7" />
    </linearGradient>
    <linearGradient id="textGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#ffffff" />
      <stop offset="100%" stop-color="#e2e8f0" />
    </linearGradient>
  </defs>

  <!-- Solid Background Dark #07090e across the entire 1:1 canvas -->
  <rect width="200" height="200" fill="#07090e" />

  <!-- Imposter Mask Logo (centered at x=100, y=72) -->
  <g transform="translate(50, 18)">
    <!-- Aura Glow Circle -->
    <circle cx="50" cy="52" r="42" fill="url(#maskGrad)" opacity="0.18" />

    <!-- Outer Mask Hood -->
    <path d="M50 18 C30 18 19 36 19 55 C19 78 34 87 50 87 C66 87 81 78 81 55 C81 36 70 18 50 18 Z" fill="url(#maskGrad)" />

    <!-- Eye Sockets -->
    <ellipse cx="39" cy="50" rx="7.5" ry="10" fill="#07090e" />
    <ellipse cx="61" cy="50" rx="7.5" ry="10" fill="#07090e" />

    <!-- Glowing Rose Pupils -->
    <circle cx="41" cy="48" r="2.8" fill="#f43f5e" />
    <circle cx="63" cy="48" r="2.8" fill="#f43f5e" />

    <!-- Subtle Smile / Smirk -->
    <path d="M41 71 Q50 66 59 71" stroke="#07090e" stroke-width="3.2" stroke-linecap="round" fill="none" />
  </g>

  <!-- Game Name 'IMPOSTER' -->
  <text x="100" y="142"
        text-anchor="middle"
        font-family="system-ui, -apple-system, Roboto, 'Segoe UI', Arial, sans-serif"
        font-weight="900"
        font-size="16"
        letter-spacing="5"
        fill="url(#textGrad)">IMPOSTER</text>

  <!-- Sleek Accent Line -->
  <line x1="72" y1="154" x2="128" y2="154" stroke="#f43f5e" stroke-width="1.5" stroke-linecap="round" opacity="0.85" />
</svg>`;
}

async function run() {
  console.log('Generating Splash Screen assets with dark background and IMPOSTER title...');

  // 1. Generate assets/splash-icon.png (512x512)
  const splash512 = Buffer.from(getSplashSvg(512, 512));
  await sharp(splash512)
    .resize(512, 512)
    .png()
    .toFile(path.join(ASSETS_DIR, 'splash-icon.png'));
  console.log('✔ Updated assets/splash-icon.png (512x512)');

  // 2. Generate all Android drawable densities
  const densities = [
    { dir: 'drawable-mdpi', size: 288 },
    { dir: 'drawable-hdpi', size: 432 },
    { dir: 'drawable-xhdpi', size: 576 },
    { dir: 'drawable-xxhdpi', size: 864 },
    { dir: 'drawable-xxxhdpi', size: 1152 }
  ];

  for (const { dir, size } of densities) {
    const targetDir = path.join(RES_DIR, dir);
    if (fs.existsSync(targetDir)) {
      const svgBuf = Buffer.from(getSplashSvg(size, size));
      const targetFile = path.join(targetDir, 'splashscreen_logo.png');
      await sharp(svgBuf)
        .resize(size, size)
        .png()
        .toFile(targetFile);
      console.log(`✔ Updated ${dir}/splashscreen_logo.png (${size}x${size})`);
    }
  }

  console.log('All splash assets generated successfully!');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
