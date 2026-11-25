/**
 * Premade pieces of room furniture. Characters are the map's own: `#` tall wall (blocks sight), `x` and `y` props (low
 * walls: block movement, not sight), `.` floor. Every floor tile inside a block can be walked to from outside it, in any
 * orientation, so a block never shuts anyone in.
 */
export const BLOCK_TAGS = ['crates', 'barracks', 'hall', 'fort', 'vault'] as const;
export type BlockTag = (typeof BLOCK_TAGS)[number];

export interface Block {
  name: string;
  tag: BlockTag;
  rows: string[];
}

export const BLOCKS: Block[] = [
  { name: 'crate pair', tag: 'crates', rows: ['xx', 'xy'] },
  { name: 'crate stack', tag: 'crates', rows: ['xxy', '.xx'] },
  { name: 'crate cross', tag: 'crates', rows: ['.x.', 'xyx', '.x.'] },
  { name: 'crate diagonal', tag: 'crates', rows: ['x...', '.y..', '..x.', '...y'] },
  { name: 'barricade', tag: 'crates', rows: ['xx..xx'] },
  { name: 'bunks', tag: 'barracks', rows: ['xx.xx', '.....', 'xx.xx'] },
  { name: 'long table', tag: 'barracks', rows: ['yyyy', 'yyyy'] },
  { name: 'cots', tag: 'barracks', rows: ['x.x.x', '.....', 'y.y.y'] },
  { name: 'pillar square', tag: 'hall', rows: ['#.#', '...', '#.#'] },
  { name: 'pillar row', tag: 'hall', rows: ['#.#.#.#'] },
  { name: 'pillared hall', tag: 'hall', rows: ['#.#.#.#', '.......', '#.#.#.#'] },
  { name: 'L wall', tag: 'fort', rows: ['###', '#..', '#..'] },
  { name: 'chicane', tag: 'fort', rows: ['##...', '.....', '...##'] },
  { name: 'bastion', tag: 'fort', rows: ['#####', '#...#'] },
  { name: 'vault corner', tag: 'vault', rows: ['####', '#..#', '#..#', '##.#'] },
  { name: 'strongroom', tag: 'vault', rows: ['#####', '#...#', '##.##'] },
];

const flip = (rows: string[]): string[] => rows.map((r) => [...r].reverse().join(''));
const turn = (rows: string[]): string[] => rows[0].split('').map((_, x) => rows.map((r) => r[x]).reverse().join(''));

/** The distinct rotations and mirror images of a block (up to eight). */
export function orientations(rows: string[]): string[][] {
  const seen = new Map<string, string[]>();
  let r = rows;
  for (let i = 0; i < 4; i++) {
    for (const v of [r, flip(r)]) seen.set(v.join('/'), v);
    r = turn(r);
  }
  return [...seen.values()];
}
