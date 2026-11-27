import { allowedPicks, type FaceName, type FacePick } from './facemix';

const own = (n: FaceName): FacePick => ({ head: n, eyes: n, mouth: n, clothes: n });

/** The faces of the four originals. A Map, so a name such as `constructor` finds nothing here. */
const ORIGINAL_FACES = new Map<string, FacePick>([
  ['Alvarez', { head: 'veteran', eyes: 'veteran', mouth: 'veteran', clothes: 'woman' }],
  ['Brandt', { head: 'man', eyes: 'man', mouth: 'veteran', clothes: 'man' }],
  ['Chen', own('chen')],
  ['Dubois', own('dubois')],
]);

// chen and dubois heads belong to those two, and no hire has an original's head together with its clothes
const HIRE_HEADS: FaceName[] = ['woman', 'veteran', 'man', 'blonde'];
const taken = [...ORIGINAL_FACES.values()];
const HIRE_FACES = HIRE_HEADS.map((head) => allowedPicks().filter(
  (p) => p.head === head && !taken.some((o) => o.head === p.head && o.clothes === p.clothes),
));

/** FNV-1a over the UTF-16 units of the name. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

/** Finishes a hash so that each choice gets its own, uncorrelated, number. */
function stream(h: number, salt: number): number {
  let x = Math.imul(h ^ Math.imul(salt + 1, 0x9e3779b1), 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return x >>> 0;
}

/** A soldier's face: the same name always gives the same one. */
export function facePick(name: string): FacePick {
  const fixed = ORIGINAL_FACES.get(name);
  if (fixed) return fixed;
  const h = hash(name);
  // the head first, so that each is as common as the others
  const faces = HIRE_FACES[stream(h, 0) % HIRE_FACES.length];
  return faces[stream(h, 1) % faces.length];
}
