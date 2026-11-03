/**
 * The weapons and the grenade that lie on the floor, painted with the shape painter of prop-paint.mjs: side views with a lit
 * top edge, a shaded underside, wood and metal tones, and the dark outline added by the painter. They stay in the upper part
 * of the tile (rows 1 to 8), so a pickup under a corpse still shows (see tests/imagesdata.test.ts).
 */
import { paint } from './prop-paint.mjs';

const OUTLINE = '#0b0c12';
const METAL = { k: OUTLINE, b: '#ecece8', a: '#d0d0d0', A: '#8a8a99', D: '#4a4a58', O: '#b5651d', o: '#7a4310', y: '#ffe14d', c: '#7fe0ff' };

/** A metal bar: lit top row, body, shaded bottom row. */
const bar = (p, x, y, w, h) => {
  p.rect(x, y, w, h, 'a').rect(x, y, w, 1, 'b').rect(x, y + h - 1, w, 1, 'A');
  return p;
};
/** A wooden part: body and a dark underside. */
const wood = (p, x, y, w, h) => {
  p.rect(x, y, w, h, 'O').rect(x, y + h - 1, w, 1, 'o').px(x, y, 'O');
  return p;
};

const PISTOL = (() => {
  const p = paint(16);
  bar(p, 2, 3, 10, 3);
  p.rect(12, 3, 2, 2, 'A').px(13, 3, 'D');
  p.px(3, 2, 'D').px(11, 2, 'D');
  p.rect(2, 6, 6, 1, 'A');
  wood(p, 3, 7, 3, 3);
  p.px(7, 7, 'D').px(8, 6, 'D').px(7, 8, 'D');
  p.px(4, 4, 'D');
  return p.outline().rows();
})();

const RIFLE = (() => {
  const p = paint(16);
  wood(p, 1, 4, 4, 3);
  bar(p, 5, 4, 6, 3);
  bar(p, 11, 4, 4, 2); p.rect(11, 4, 4, 1, 'a');
  p.rect(8, 6, 3, 1, 'D');
  p.rect(6, 7, 2, 3, 'A').rect(6, 9, 2, 1, 'D');
  p.rect(6, 2, 4, 2, 'D').px(9, 2, 'c').px(6, 2, 'A');
  p.px(14, 3, 'D');
  return p.outline().rows();
})();

const SHOTGUN = (() => {
  const p = paint(16);
  wood(p, 1, 5, 4, 3);
  bar(p, 5, 4, 4, 3);
  p.rect(9, 4, 6, 1, 'b').rect(9, 5, 6, 1, 'A').rect(9, 3, 6, 1, 'a');
  wood(p, 8, 6, 4, 2);
  p.px(14, 3, 'D').px(5, 3, 'D');
  return p.outline().rows();
})();

const SMG = (() => {
  const p = paint(16);
  bar(p, 3, 3, 9, 3);
  p.rect(12, 3, 3, 2, 'A').px(14, 3, 'D');
  p.rect(1, 3, 2, 1, 'D').rect(1, 4, 1, 2, 'D');
  p.rect(6, 6, 2, 4, 'A').rect(6, 9, 2, 1, 'D').px(6, 6, 'a');
  wood(p, 9, 6, 2, 3);
  p.px(4, 2, 'D').px(11, 2, 'D');
  return p.outline().rows();
})();

const SNIPER = (() => {
  const p = paint(16);
  wood(p, 1, 4, 4, 4);
  bar(p, 5, 4, 6, 2);
  p.rect(11, 4, 5, 1, 'a').rect(11, 5, 5, 1, 'A');
  p.rect(5, 1, 7, 2, 'D').rect(5, 1, 7, 1, 'A').px(11, 2, 'c').px(5, 2, 'c');
  p.rect(7, 3, 1, 1, 'A').rect(10, 3, 1, 1, 'A');
  p.px(13, 6, 'D').px(12, 7, 'D').px(15, 6, 'D').px(15, 7, 'D');
  return p.outline().rows();
})();

const GRENADE = (() => {
  const p = paint(16);
  p.ell(7, 5, 3, 2, 'e');
  p.rect(5, 5, 5, 1, 'E');
  p.rect(10, 4, 1, 3, 'E').rect(4, 6, 1, 1, 'E');
  p.rect(6, 2, 3, 1, 'm').rect(9, 2, 1, 3, 'm');
  p.px(5, 4, 'L').px(6, 3, 'L');
  p.px(10, 1, 'y').px(11, 1, 'y').px(11, 2, 'y');
  return p.outline().rows();
})();

const GREY = { k: OUTLINE, e: '#3cb371', E: '#26734a', L: '#8ff0b0', m: '#9a9aa8', y: '#ffe14d' };

export const ITEM_PAINTED = {
  item_pistol: { palette: METAL, rows: PISTOL },
  item_rifle: { palette: METAL, rows: RIFLE },
  item_shotgun: { palette: METAL, rows: SHOTGUN },
  item_smg: { palette: METAL, rows: SMG },
  item_sniper: { palette: METAL, rows: SNIPER },
  item_grenade: { palette: GREY, rows: GRENADE },
};
