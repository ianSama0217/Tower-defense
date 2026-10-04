// Slice the transparent, text-free UI sheet; retain the generated pixel artwork.
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');
const root = path.join(__dirname, '..');
const source = path.join(root, 'art/level-select/ui-kit-source.png');
const output = path.join(root, 'dist/assets/ui/stage-kit');
const regions = {
  title: [16, 8, 1024, 180],
  subtitle: [157, 191, 656, 106],
  heading: [26, 302, 756, 124],
  'record-label': [24, 461, 244, 96],
  cleared: [494, 461, 300, 98],
  panel: [798, 301, 389, 255],
  challenge: [16, 562, 1031, 192],
  close: [1071, 578, 165, 162],
  card: [24, 755, 329, 263],
  nameplate: [677, 776, 485, 115],
};
(async () => {
  fs.mkdirSync(output, { recursive: true });
  const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const manifest = { source: 'art/level-select/ui-kit-source.png', sprites: {} };
  for (const [name, [x, y, width, height]] of Object.entries(regions)) {
    let left = x + width, top = y + height, right = -1, bottom = -1;
    for (let py = y; py < y + height; py++) for (let px = x; px < x + width; px++) {
      if (data[(py * info.width + px) * 4 + 3] < 32) continue;
      left = Math.min(left, px); right = Math.max(right, px);
      top = Math.min(top, py); bottom = Math.max(bottom, py);
    }
    if (right < left) throw new Error(`Empty sprite: ${name}`);
    const crop = { left, top, width: right - left + 1, height: bottom - top + 1 };
    await sharp(source).extract(crop).png().toFile(path.join(output, `${name}.png`));
    manifest.sprites[name] = crop;
  }
  fs.writeFileSync(path.join(output, 'sprites.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log('Packed ten transparent stage UI components.');
})().catch(error => { console.error(error); process.exitCode = 1; });
