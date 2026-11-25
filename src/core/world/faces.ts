/** How many choices each part of a generated face has. `beard` and `extra` count "none" as choice 0. */
export const FACE_PARTS = { skin: 6, hairStyle: 8, hairColour: 8, eyes: 5, brows: 4, mouth: 4, beard: 4, extra: 5 } as const;

export type FaceSpec = { -readonly [P in keyof typeof FACE_PARTS]: number };

/** FNV-1a over the UTF-16 units of the name. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

/** Finishes a hash so that each part gets its own, uncorrelated, number. */
function stream(h: number, salt: number): number {
  let x = Math.imul(h ^ Math.imul(salt + 1, 0x9e3779b1), 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return x >>> 0;
}

/** The parts of a soldier's face: the same name always gives the same parts. */
export function faceSpec(name: string): FaceSpec {
  const h = hash(name);
  const spec = {} as FaceSpec;
  (Object.keys(FACE_PARTS) as (keyof FaceSpec)[]).forEach((part, i) => {
    spec[part] = stream(h, i) % FACE_PARTS[part];
  });
  return spec;
}
