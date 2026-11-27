import { DIGITS, FACES, canvas, set, type BakedPortrait, type FaceName, type Portrait } from './facemix';
import { FACE_DATA } from './faces.generated';

function decode({ palette, rows, ...measures }: BakedPortrait): Portrait {
  const colours = palette.map((hex) => [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)));
  const { rgba } = canvas(64, 64, [0, 0, 0]);
  rows.forEach((row, y) => [...row].forEach((digit, x) => set({ rgba }, x, y, colours[DIGITS.indexOf(digit)])));
  return { ...measures, rgba };
}

/** The six portraits faces are mixed from. */
export const PORTRAITS = Object.fromEntries(FACES.map((name) => [name, decode(FACE_DATA[name])])) as Record<FaceName, Portrait>;
