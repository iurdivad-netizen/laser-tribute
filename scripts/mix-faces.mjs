// Writes every allowed face (see src/art/facemix.ts) to one contact sheet, to judge the swaps by eye.
// usage: node scripts/mix-faces.mjs <sheet.png>
import { writeFileSync } from 'node:fs';
import { crc32, deflateSync } from 'node:zlib';
import { allowedPicks, canvas, get, mixFace, set } from '../src/art/facemix.ts';
import { preparePortraits } from './build-faces.mjs';

function encodePng({ w, h, rgba }) {
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type), data]);
    const out = Buffer.alloc(12 + data.length);
    out.writeUInt32BE(data.length, 0);
    body.copy(out, 4);
    out.writeUInt32BE(crc32(body), 8 + data.length);
    return out;
  };
  const head = Buffer.alloc(13);
  head.writeUInt32BE(w, 0);
  head.writeUInt32BE(h, 4);
  head[8] = 8; // bit depth
  head[9] = 6; // RGBA
  const raw = Buffer.alloc(h * (w * 4 + 1));
  for (let y = 0; y < h; y++) raw.set(rgba.subarray(y * w * 4, (y + 1) * w * 4), y * (w * 4 + 1) + 1);
  const magic = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([magic, chunk('IHDR', head), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const file = process.argv[2];
if (!file) throw new Error('usage: node scripts/mix-faces.mjs <sheet.png>');
const portraits = preparePortraits();
const picks = allowedPicks();
const columns = 20;
const scale = 2;
const cell = 64 * scale + 4;
const sheet = canvas(columns * cell, Math.ceil(picks.length / columns) * cell, [120, 120, 120]);
picks.forEach((pick, n) => {
  const face = mixFace(portraits, pick);
  const ox = (n % columns) * cell + 2;
  const oy = Math.floor(n / columns) * cell + 2;
  for (let y = 0; y < 64 * scale; y++) for (let x = 0; x < 64 * scale; x++) {
    set(sheet, ox + x, oy + y, get(face, Math.floor(x / scale), Math.floor(y / scale)), sheet.w);
  }
});
writeFileSync(file, encodePng(sheet));
console.log(`wrote ${file}: ${picks.length} faces`);
