// Pack the generated transparent hand into a native CSS cursor.
const path = require('node:path');
const sharp = require('sharp');
const root = path.join(__dirname, '..');

(async () => {
  const variant = process.argv[2] || 'hand';
  if (!['hand', 'blocked'].includes(variant)) throw new Error('Expected hand or blocked');
  const innerWidth = variant === 'blocked' ? 44 : 36;
  const source = path.join(root, `art/cursor/${variant === 'blocked' ? 'blocked-source' : 'source'}.png`);
  const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let left = info.width, top = info.height, right = -1, bottom = -1;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * 4 + 3] < 128) continue;
      left = Math.min(left, x); top = Math.min(top, y);
      right = Math.max(right, x); bottom = Math.max(bottom, y);
    }
  }
  if (right < left) throw new Error('Cursor source is empty');
  const out = path.join(root, `dist/assets/ui/cursor-${variant}.png`);
  await sharp(source)
    .extract({ left, top, width: right - left + 1, height: bottom - top + 1 })
    .resize(innerWidth, 44, { fit: 'contain', position: 'left top', kernel: 'nearest', background: '#00000000' })
    .extend({ top: 2, bottom: 2, left: 2, right: 2, background: '#00000000' })
    .png().toFile(out);
  console.log(`Packed ${innerWidth + 4}×48 cursor:`, out);
})().catch(error => { console.error(error); process.exitCode = 1; });
