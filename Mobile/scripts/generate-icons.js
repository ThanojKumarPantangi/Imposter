const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const SVG_PATH = path.resolve(__dirname, '../../Frontend/public/icon.svg');
const ASSETS_DIR = path.resolve(__dirname, '../assets');

async function generate() {
  console.log('Reading SVG from:', SVG_PATH);
  const svgContent = fs.readFileSync(SVG_PATH, 'utf8');

  // 1. Full square app icon for iOS and universal fallback (1024x1024)
  // Remove rx="24" from background rect so app stores don't get black/transparent corner artifacts
  const fullSquareSvg = svgContent.replace(/<rect width="100" height="100" rx="24" fill="#0d1117" \/>/, '<rect width="100" height="100" fill="#0d1117" />');
  const iconBuffer = Buffer.from(fullSquareSvg);

  console.log('Generating assets/icon.png (1024x1024)...');
  await sharp(iconBuffer, { density: 1024 })
    .resize(1024, 1024)
    .png()
    .toFile(path.join(ASSETS_DIR, 'icon.png'));

  // 2. Splash screen icon (512x512 with transparent background around mask)
  // Isolate mask graphics (circle, mask path, eyes, pupils, mouth) on transparent background
  const splashSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f43f5e" />
      <stop offset="100%" stop-color="#a855f7" />
    </linearGradient>
  </defs>
  <circle cx="50" cy="50" r="38" fill="url(#grad)" opacity="0.18" />
  <path d="M50 20 C32 20 22 36 22 52 C22 72 35 80 50 80 C65 80 78 72 78 52 C78 36 68 20 50 20 Z" fill="url(#grad)" />
  <ellipse cx="40" cy="48" rx="7" ry="9" fill="#07090e" />
  <ellipse cx="60" cy="48" rx="7" ry="9" fill="#07090e" />
  <circle cx="42" cy="46" r="2.5" fill="#f43f5e" />
  <circle cx="62" cy="46" r="2.5" fill="#f43f5e" />
  <path d="M42 66 Q50 62 58 66" stroke="#07090e" stroke-width="3" stroke-linecap="round" fill="none" />
</svg>`;

  console.log('Generating assets/splash-icon.png (512x512)...');
  await sharp(Buffer.from(splashSvg), { density: 512 })
    .resize(512, 512)
    .png()
    .toFile(path.join(ASSETS_DIR, 'splash-icon.png'));

  // 3. Android adaptive icon foreground (1024x1024 with inner 60% safe zone)
  const androidForegroundSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f43f5e" />
      <stop offset="100%" stop-color="#a855f7" />
    </linearGradient>
  </defs>
  <g transform="translate(15, 15) scale(0.7)">
    <circle cx="50" cy="50" r="38" fill="url(#grad)" opacity="0.18" />
    <path d="M50 20 C32 20 22 36 22 52 C22 72 35 80 50 80 C65 80 78 72 78 52 C78 36 68 20 50 20 Z" fill="url(#grad)" />
    <ellipse cx="40" cy="48" rx="7" ry="9" fill="#07090e" />
    <ellipse cx="60" cy="48" rx="7" ry="9" fill="#07090e" />
    <circle cx="42" cy="46" r="2.5" fill="#f43f5e" />
    <circle cx="62" cy="46" r="2.5" fill="#f43f5e" />
    <path d="M42 66 Q50 62 58 66" stroke="#07090e" stroke-width="3" stroke-linecap="round" fill="none" />
  </g>
</svg>`;

  console.log('Generating assets/android-icon-foreground.png (1024x1024)...');
  await sharp(Buffer.from(androidForegroundSvg), { density: 1024 })
    .resize(1024, 1024)
    .png()
    .toFile(path.join(ASSETS_DIR, 'android-icon-foreground.png'));

  // 4. Android adaptive icon background (1024x1024 solid #0d1117)
  console.log('Generating assets/android-icon-background.png (1024x1024)...');
  await sharp({
    create: {
      width: 1024,
      height: 1024,
      channels: 4,
      background: { r: 13, g: 17, b: 23, alpha: 1 },
    },
  })
    .png()
    .toFile(path.join(ASSETS_DIR, 'android-icon-background.png'));

  // 5. Android adaptive icon monochrome (for themed icons)
  const androidMonochromeSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
  <g transform="translate(15, 15) scale(0.7)">
    <circle cx="50" cy="50" r="38" fill="#ffffff" opacity="0.2" />
    <path d="M50 20 C32 20 22 36 22 52 C22 72 35 80 50 80 C65 80 78 72 78 52 C78 36 68 20 50 20 Z" fill="#ffffff" />
    <ellipse cx="40" cy="48" rx="7" ry="9" fill="#000000" />
    <ellipse cx="60" cy="48" rx="7" ry="9" fill="#000000" />
    <circle cx="42" cy="46" r="2.5" fill="#ffffff" />
    <circle cx="62" cy="46" r="2.5" fill="#ffffff" />
    <path d="M42 66 Q50 62 58 66" stroke="#000000" stroke-width="3" stroke-linecap="round" fill="none" />
  </g>
</svg>`;

  console.log('Generating assets/android-icon-monochrome.png (1024x1024)...');
  await sharp(Buffer.from(androidMonochromeSvg), { density: 1024 })
    .resize(1024, 1024)
    .png()
    .toFile(path.join(ASSETS_DIR, 'android-icon-monochrome.png'));

  // 6. Favicon for web preview (48x48)
  console.log('Generating assets/favicon.png (48x48)...');
  await sharp(iconBuffer, { density: 1024 })
    .resize(48, 48)
    .png()
    .toFile(path.join(ASSETS_DIR, 'favicon.png'));

  console.log('✅ All app icon and launch screen assets generated successfully!');
}

generate().catch((err) => {
  console.error('Error generating icons:', err);
  process.exit(1);
});

