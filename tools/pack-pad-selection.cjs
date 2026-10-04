// Crop the generated transparent atlas and pack both UI states at map scale.
const path = require('node:path');
const sharp = require('sharp');
const root = path.join(__dirname, '..');

(async () => {
  const source = path.join(root, 'art/pad-selection/source.png');
  const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const split = Math.floor(info.width / 2);
  for (const [name, start, end] of [['allowed', 0, split], ['blocked', split, info.width]]) {
    let left = end, top = info.height, right = -1, bottom = -1;
    for (let y = 0; y < info.height; y++) for (let x = start; x < end; x++) {
      if (data[(y * info.width + x) * 4 + 3] < 128) continue;
      left = Math.min(left, x); top = Math.min(top, y);
      right = Math.max(right, x); bottom = Math.max(bottom, y);
    }
    if (right < left) throw new Error(`Empty frame: ${name}`);
    await sharp(source).extract({ left, top, width: right - left + 1, height: bottom - top + 1 })
      .resize(96, 96, { fit: 'fill', kernel: 'nearest' })
      .png().toFile(path.join(root, `dist/assets/ui/pad-${name}.png`));
  }
  console.log('Packed green and red 96×96 transparent selection frames.');
})().catch(error => { console.error(error); process.exitCode = 1; });
