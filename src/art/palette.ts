/** One character per colour. A slightly muted, Amiga-era set: blue for the player's side, red for the enemy. */
export const PALETTE: Record<string, string> = {
  k: '#0b0c12', K: '#1c1f2e', // outline, dark
  g: '#2f3347', G: '#3a3f57', h: '#262a3d', // floor
  w: '#8b8fa8', W: '#b8bcd4', v: '#5d6178', // wall
  B: '#4da6ff', C: '#9bd2ff', N: '#2a6fb8', // blue team
  R: '#ff5555', P: '#ff9a9a', M: '#b02a2a', // red team
  s: '#f0c8a0', // skin
  y: '#ffe14d', o: '#ff9a2e', f: '#ffffff', u: '#a01818', // flash, fire, white, blood
  O: '#b5651d', d: '#8a4d12', D: '#5a3a1a', // door
  e: '#3cb371', E: '#26734a', // grenade
  a: '#d0d0d0', A: '#8a8a99', // gun metal
};

export const TRANSPARENT = '.';
