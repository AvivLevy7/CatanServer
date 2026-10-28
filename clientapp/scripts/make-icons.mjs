// Generates public/pwa-192x192.png and public/pwa-512x512.png without native deps:
// a parchment-coloured rounded tile with a dark hexagon. Run: node scripts/make-icons.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '..', 'public');
mkdirSync(out, { recursive: true });

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};

function png(size, pixel) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel(x, y);
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const inHex = (x, y, cx, cy, r) => {
  const dx = Math.abs(x - cx), dy = Math.abs(y - cy);
  return dy <= r * 0.866 && dx <= r - dy / 1.732;
};
const inRoundedRect = (x, y, size, radius) => {
  const nx = Math.max(radius - x, 0, x - (size - 1 - radius));
  const ny = Math.max(radius - y, 0, y - (size - 1 - radius));
  return nx * nx + ny * ny <= radius * radius;
};

for (const size of [192, 512]) {
  const buf = png(size, (x, y) => {
    if (!inRoundedRect(x, y, size, size * 0.18)) return [0, 0, 0, 0];
    const c = size / 2;
    if (inHex(x, y, c, c, size * 0.36)) {
      return inHex(x, y, c, c, size * 0.3) ? [245, 190, 90, 255] : [28, 25, 23, 255];
    }
    const t = y / size;
    return [Math.round(60 - 25 * t), Math.round(40 - 15 * t), Math.round(30 - 10 * t), 255];
  });
  writeFileSync(join(out, `pwa-${size}x${size}.png`), buf);
  console.log(`wrote pwa-${size}x${size}.png`);
}
