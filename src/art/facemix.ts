// Mixes soldier faces from six straight-front portraits: head, eyes, mouth and clothes can each come from a different one.
// No imports: scripts/build-faces.mjs and scripts/mix-faces.mjs load this file with plain Node.

export type FaceName = 'chen' | 'dubois' | 'woman' | 'veteran' | 'man' | 'blonde';
export interface FacePick { head: FaceName; eyes: FaceName; mouth: FaceName; clothes: FaceName }
export interface Pixels { w: number; h: number; rgba: Uint8ClampedArray }
/** The mean skin colour, the rows of the eyes and mouth, and the jaw as [column, lowest head row] points. */
export interface Measures { skin: number[]; eyes: number; mouth: number; jaw: number[][]; locks?: number }
/** A cleaned 64 x 64 portrait. */
export interface Portrait extends Measures { rgba: Uint8ClampedArray }
/** A portrait as stored: colours as 'rrggbb', and 64 rows of 64 indexes into them. */
export interface BakedPortrait extends Measures { palette: string[]; rows: string[] }

export const BACKGROUND = [20, 18, 19] as const;
/** The palette indexes of a stored portrait. */
export const DIGITS = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
export const FACES: readonly FaceName[] = ['chen', 'dubois', 'woman', 'veteran', 'man', 'blonde'];

// Swaps that looked wrong when judged by eye. A face may always keep its own parts.
const EYE_DONORS: FaceName[] = ['dubois', 'man', 'blonde']; // chen: blank with a dark bar; woman: black eyes; veteran: red nose mark
const MOUTH_DONORS: FaceName[] = ['woman', 'veteran', 'man']; // chen: black stroke by the lips; dubois: dripping grin; blonde: blood mark
const NEVER_STUBBLE: FaceName[] = ['woman', 'blonde']; // heads that never take the veteran's mouth
// head: clothes that leave a black block under its chin
const BAD_NECK: Partial<Record<FaceName, FaceName[]>> = { chen: ['woman', 'veteran'], man: ['woman', 'veteran'], blonde: ['woman'] };

export function isAllowed({ head, eyes, mouth, clothes }: FacePick): boolean {
  return [head, eyes, mouth, clothes].every((n) => FACES.includes(n))
    && (eyes === head || EYE_DONORS.includes(eyes))
    && (mouth === head || (MOUTH_DONORS.includes(mouth) && !(mouth === 'veteran' && NEVER_STUBBLE.includes(head))))
    && !BAD_NECK[head]?.includes(clothes);
}

export function allowedPicks(): FacePick[] {
  const picks: FacePick[] = [];
  for (const head of FACES) for (const eyes of FACES) for (const mouth of FACES) for (const clothes of FACES) {
    const pick = { head, eyes, mouth, clothes };
    if (isAllowed(pick)) picks.push(pick);
  }
  return picks;
}

export function canvas(w: number, h: number, colour: readonly number[]): Pixels {
  const rgba = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) rgba.set([colour[0], colour[1], colour[2], 255], i * 4);
  return { w, h, rgba };
}

/** The colour at a pixel of a 64 pixel wide picture. */
export function get({ rgba }: { rgba: ArrayLike<number> }, x: number, y: number): number[] {
  const i = (y * 64 + x) * 4;
  return [rgba[i], rgba[i + 1], rgba[i + 2]];
}

export function set({ rgba }: { rgba: Uint8ClampedArray }, x: number, y: number, c: readonly number[], w = 64): void {
  rgba.set([c[0], c[1], c[2], 255], (y * w + x) * 4);
}

export const clamp = (v: number): number => Math.max(0, Math.min(63, v));

/** Lowest head row in a column; 40 outside the jaw. */
function jaw({ jaw: points }: Portrait, x: number): number {
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1];
    const [x1, y1] = points[i];
    if (x >= x0 && x <= x1) return Math.round(y0 + ((y1 - y0) * (x - x0)) / (x1 - x0));
  }
  return 40;
}

/** Moves a colour from the donor's skin tone to the base's. Darkening scales; lightening uses a gamma so nothing clips. */
const tone = (colour: number[], base: Portrait, donor: Portrait): number[] => colour.map((v, i) => {
  const gain = base.skin[i] / donor.skin[i];
  return Math.round(gain < 1 ? v * gain : 255 * (v / 255) ** (Math.log(base.skin[i] / 255) / Math.log(donor.skin[i] / 255)));
});

const isSkin = ([r, g, b]: number[]): boolean => r > 50 && r > g * 1.2 && r > b * 1.3;

/** Puts the head (everything down to its jaw) over another portrait's body. */
function dress(head: Pixels, base: Portrait, donor: Portrait): Pixels {
  const out = canvas(64, 64, BACKGROUND);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const mine = jaw(base, x);
    if (y <= mine) { set(out, x, y, get(head, x, y)); continue; }
    const theirs = jaw(donor, x);
    // a shorter chin leaves a gap under it: repeat the donor's first neck row into the gap only, so the collar is not warped
    const sy = mine > 40 && theirs > mine && y <= theirs ? theirs + 1 : y;
    let c = mine === 40 && y <= theirs ? [...BACKGROUND] : get(donor, x, Math.min(63, sy));
    // hair hanging beside the neck belongs to the donor's head, not its clothes
    const beside = x < donor.jaw[0][0] || x > donor.jaw[donor.jaw.length - 1][0];
    if (beside && y < (donor.locks ?? 0)) c = [...BACKGROUND];
    if (x >= 22 && x <= 42 && isSkin(c)) c = tone(c, base, donor);
    set(out, x, y, c);
  }
  return out;
}

const PATCHES = { eyes: [11.5, 4.6], mouth: [8.5, 4.8] }; // ellipse radii, centred on column 32

/** A 64 x 64 face. Throws for a swap that is not allowed. */
export function mixFace(portraits: Record<FaceName, Portrait>, pick: FacePick): Pixels {
  if (!isAllowed(pick)) throw new Error(`face swap not allowed: ${JSON.stringify(pick)}`);
  const base = portraits[pick.head];
  const out = { w: 64, h: 64, rgba: new Uint8ClampedArray(base.rgba) };
  for (const part of ['eyes', 'mouth'] as const) {
    const donor = portraits[pick[part]];
    if (donor === base) continue;
    const [rx, ry] = PATCHES[part];
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
      if (((x - 32) / rx) ** 2 + ((y - base[part]) / ry) ** 2 > 1) continue;
      const sy = clamp(y + Math.round(donor[part] - base[part])); // sample the donor at its own feature row
      // never copy chin outline, collar or background into a face
      if (y >= jaw(base, x) || sy >= jaw(donor, x) - 2) continue;
      set(out, x, y, tone(get(donor, x, sy), base, donor));
    }
  }
  return pick.clothes === pick.head ? out : dress(out, base, portraits[pick.clothes]);
}

/** The 16 x 16 face from a 64 x 64 one: only the middle 48 x 48 is shrunk, so that the head stays large enough to read. */
export function shrinkFace(face: Pixels): Pixels {
  const out = canvas(16, 16, BACKGROUND);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const sum = [0, 0, 0];
    for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 3; dx++) {
      get(face, 8 + x * 3 + dx, 6 + y * 3 + dy).forEach((v, i) => { sum[i] += v; });
    }
    set(out, x, y, sum.map((v) => Math.round(v / 9)), 16);
  }
  return out;
}
