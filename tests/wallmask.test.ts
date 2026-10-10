import { describe, expect, it } from 'vitest';
import { E, N, NE, NW, S, SE, SW, W, wallMask } from '../src/render/wallmask';
import { makeState } from './helpers';

const seen = (rows: string[]) => {
  const s = makeState(rows);
  s.explored = s.explored.map((r) => r.map(() => true));
  return s;
};

describe('wallMask', () => {
  it('has the bit values of the spec', () => {
    expect([N, E, S, W, NE, SE, SW, NW]).toEqual([1, 2, 4, 8, 16, 32, 64, 128]);
  });

  it('is 0 for a wall surrounded by walls and by the map edge', () => {
    const s = seen(['###', '###', '###']);
    expect(wallMask(s, 1, 1)).toBe(0);
    expect(wallMask(s, 0, 0)).toBe(0);
    expect(wallMask(s, 2, 1)).toBe(0);
  });

  it('sets one bit for each open side', () => {
    expect(wallMask(seen(['#.#', '###', '###']), 1, 1)).toBe(N);
    expect(wallMask(seen(['###', '###', '#.#']), 1, 1)).toBe(S);
    expect(wallMask(seen(['###', '.##', '###']), 1, 1)).toBe(W);
    expect(wallMask(seen(['###', '##.', '###']), 1, 1)).toBe(E);
  });

  it('sets two, three and four sides', () => {
    expect(wallMask(seen(['#.#', '###', '###']), 1, 1)).toBe(N);
    expect(wallMask(seen(['#.#', '##.', '###']), 1, 1)).toBe(N | E);
    expect(wallMask(seen(['#.#', '.#.', '###']), 1, 1)).toBe(N | E | W);
    expect(wallMask(seen(['#.#', '.#.', '#.#']), 1, 1)).toBe(N | E | S | W);
  });

  it('sets an inner corner bit only when the diagonal is open and both touching sides are solid', () => {
    expect(wallMask(seen(['##.', '###', '###']), 1, 1)).toBe(NE);
    expect(wallMask(seen(['###', '###', '##.']), 1, 1)).toBe(SE);
    expect(wallMask(seen(['###', '###', '.##']), 1, 1)).toBe(SW);
    expect(wallMask(seen(['.##', '###', '###']), 1, 1)).toBe(NW);
    // with the north side open the corner is covered by the side edge
    expect(wallMask(seen(['...', '###', '###']), 1, 1)).toBe(N);
    expect(wallMask(seen(['.#.', '###', '###']), 1, 1)).toBe(NE | NW);
  });

  it('counts a door as open ground, closed or open', () => {
    const s = seen(['#+#', '###', '###']);
    expect(wallMask(s, 1, 1)).toBe(N);
    s.tiles[0][1].open = true;
    expect(wallMask(s, 1, 1)).toBe(N);
  });

  it('counts an unexplored neighbour as solid, and picks the edge up once it is explored', () => {
    const s = seen(['#.#', '###', '###']);
    s.explored[0][1] = false;
    expect(wallMask(s, 1, 1)).toBe(0);
    s.explored[0][1] = true;
    expect(wallMask(s, 1, 1)).toBe(N);
    const corner = seen(['##.', '###', '###']);
    corner.explored[0][2] = false;
    expect(wallMask(corner, 1, 1)).toBe(0);
  });

  it('counts a prop as open ground for the wall beside it', () => {
    expect(wallMask(seen(['#x#', '###', '###']), 1, 1)).toBe(N);
    const edge = seen(['###', '#x#', '###']);
    expect(wallMask(edge, 0, 1)).toBe(E);
    edge.explored[1][1] = false;
    expect(wallMask(edge, 0, 1)).toBe(0);
  });

  it('gives a one-tile wall both its edges', () => {
    expect(wallMask(seen(['.#.', '.#.', '.#.']), 1, 1)).toBe(E | W);
    expect(wallMask(seen(['...', '###', '...']), 1, 1)).toBe(N | S);
  });
});
