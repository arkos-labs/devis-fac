#!/usr/bin/env node
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const svgIcon = (size) => `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1e40af;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#3b82f6;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#grad)"/>
  <text x="50%" y="50%" font-size="${size * 0.5}" font-weight="bold" text-anchor="middle" dominant-baseline="central" fill="white" font-family="Arial, sans-serif">CP</text>
</svg>
`;

const publicDir = path.join(__dirname, '../public');

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

const sizes = [192, 512];

(async () => {
  for (const size of sizes) {
    const svg = svgIcon(size);
    const filename = `pwa-${size}x${size}.png`;
    const filepath = path.join(publicDir, filename);

    try {
      await sharp(Buffer.from(svg))
        .png()
        .toFile(filepath);
      console.log(`✓ Created ${filename}`);
    } catch (err) {
      console.error(`✗ Error creating ${filename}:`, err.message);
    }
  }
})();
