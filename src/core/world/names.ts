import type { World } from './world';

/** Surnames for Story-mode hires: ASCII only, at most 10 letters, none of the originals or the old fixed list. */
export const RECRUIT_SURNAMES: readonly string[] = [
  'Abbott', 'Adeyemi', 'Aguilar', 'Akhtar', 'Alder', 'Amari', 'Andrade', 'Arkwright', 'Baptiste', 'Barros',
  'Bellamy', 'Bianchi', 'Bishop', 'Blake', 'Bondar', 'Brennan', 'Calder', 'Carvalho', 'Castillo', 'Cohen',
  'Costa', 'Crane', 'Dalton', 'Delgado', 'Demir', 'Dietrich', 'Dlamini', 'Doyle', 'Duarte', 'Eklund',
  'Estrada', 'Farouk', 'Ferrara', 'Finch', 'Flores', 'Gallo', 'Gill', 'Grimaldi', 'Gunnar', 'Hale',
  'Hansen', 'Harlow', 'Hassan', 'Hayashi', 'Holt', 'Horvat', 'Hughes', 'Ibarra', 'Iqbal', 'Jaeger',
  'Jovanovic', 'Kaplan', 'Keane', 'Khoury', 'Kim', 'Koval', 'Kruger', 'Lang', 'Larsen', 'Leclerc',
  'Lund', 'Maddox', 'Mahlangu', 'Marsh', 'Mbeki', 'Medina', 'Moreau', 'Mori', 'Nakamura', 'Navarro',
  'Novak', 'Nunez', 'Okafor', 'Olsen', 'Ortega', 'Osei', 'Pavlov', 'Petrov', 'Pike', 'Quinn',
  'Rahman', 'Reyes', 'Ricci', 'Roque', 'Rossi', 'Saito', 'Salazar', 'Santos', 'Sato', 'Silva',
  'Singh', 'Sokolov', 'Sousa', 'Stark', 'Tanaka', 'Thorne', 'Torres', 'Tran', 'Ueda', 'Vance',
  'Varga', 'Vega', 'Voss', 'Wagner', 'Walsh', 'Weber', 'Wolfe', 'Xavier', 'Yamada', 'Yilmaz',
  'Zaman', 'Zeller', 'Zhou', 'Zuniga',
];

/** A small integer hash of two numbers, the same on every machine. */
function mix(a: number, b: number): number {
  let h = Math.imul(a | 0, 0x9e3779b1) ^ Math.imul((b | 0) + 0x7f4a7c15, 0x85ebca6b);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  return h >>> 0;
}

/**
 * The name of the next hire. It depends only on the world seed and the hire count, so a run is reproducible, and it skips
 * every name a current or fallen soldier has. Only when the whole pool is in use does it append a number.
 */
export function recruitName(w: World): string {
  const taken = new Set([...w.soldiers, ...w.fallen].map((s) => s.name.toLowerCase()));
  const start = mix(w.seed, w.namesUsed) % RECRUIT_SURNAMES.length;
  for (let i = 0; i < RECRUIT_SURNAMES.length; i++) {
    const name = RECRUIT_SURNAMES[(start + i) % RECRUIT_SURNAMES.length];
    if (!taken.has(name.toLowerCase())) return name;
  }
  for (let n = 2; ; n++) {
    const name = `${RECRUIT_SURNAMES[start]} ${n}`;
    if (!taken.has(name.toLowerCase())) return name;
  }
}
