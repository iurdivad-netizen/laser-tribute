import { describe, expect, it } from 'vitest';
import { aiNextCommand } from '../src/core/ai';
import { RETREAT_SHARE, canShoot, coverStep, isHurt, pickTarget, retreatStep, targetScore } from '../src/core/aiscore';
import { distance } from '../src/core/geometry';
import { corridorRows, makeState, unit } from './helpers';

const enemyTurn = (rows: string[]) => {
  const s = makeState(rows);
  s.turn = 'enemy';
  return s;
};

/** e1 with a rifle looking east along the corridor. */
function shooter(s: ReturnType<typeof makeState>) {
  const e = unit(s, 'e1');
  e.weapon = 'rifle';
  e.ammo = 5;
  e.facing = 2;
  return e;
}

describe('target choice', () => {
  it('prefers a target it can finish over a nearer healthy one', () => {
    const s = enemyTurn(corridorRows('E..P.P'));
    const e = shooter(s);
    unit(s, 'p2').hp = 10;
    expect(pickTarget(s, e, [unit(s, 'p1'), unit(s, 'p2')])!.id).toBe('p2');
  });

  it('takes the nearer of two equal targets', () => {
    const s = enemyTurn(corridorRows('E..P.P'));
    const e = shooter(s);
    expect(pickTarget(s, e, [unit(s, 'p2'), unit(s, 'p1')])!.id).toBe('p1');
  });

  it('anything it can shoot beats anything it cannot, however weak', () => {
    const s = enemyTurn(corridorRows('E..P#..P'));
    const e = shooter(s);
    unit(s, 'p2').hp = 1;
    expect(canShoot(s, e, unit(s, 'p2'))).toBe(false);
    expect(pickTarget(s, e, [unit(s, 'p2'), unit(s, 'p1')])!.id).toBe('p1');
  });

  it('with nothing in reach it ranks by distance, nearest first', () => {
    const s = enemyTurn(corridorRows('E..P..P'));
    const e = shooter(s);
    e.ammo = 0;
    expect(targetScore(s, e, unit(s, 'p1'))).toBeGreaterThan(targetScore(s, e, unit(s, 'p2')));
    expect(pickTarget(s, e, [unit(s, 'p2'), unit(s, 'p1')])!.id).toBe('p1');
  });

  it('shoots the soldier it can kill: an aimed shot at the wounded one, not the nearer one', () => {
    const s = enemyTurn(corridorRows('E..P.P'));
    shooter(s);
    unit(s, 'p2').hp = 10;
    expect(aiNextCommand(s)).toEqual({ type: 'AimedShot', unitId: 'e1', targetId: 'p2' });
  });

  it('knows no target: undefined', () => {
    const s = enemyTurn(corridorRows('E...'));
    expect(pickTarget(s, shooter(s), [])).toBeUndefined();
  });
});

/** The squad member p1 at the left, e1 at the right end of the corridor with a hidden nook below it. */
const nook = () => {
  const s = enemyTurn(['#########', '#P.....E#', '#######.#', '#########']);
  unit(s, 'p1').facing = 2;
  const e = unit(s, 'e1');
  e.weapon = 'rifle';
  e.ammo = 5;
  e.facing = 6;
  return { s, e };
};

describe('retreat', () => {
  it('a badly hurt soldier in the squad\'s view steps out of it', () => {
    const { s, e } = nook();
    e.hp = 10;
    expect(isHurt(e)).toBe(true);
    expect(retreatStep(s, e)).toEqual({ type: 'Move', unitId: 'e1', to: { x: 7, y: 2 } });
    expect(aiNextCommand(s)).toEqual({ type: 'Move', unitId: 'e1', to: { x: 7, y: 2 } });
  });

  it('a healthy soldier stands and shoots', () => {
    const { s } = nook();
    expect(aiNextCommand(s).type).toMatch(/Shot/);
  });

  it('a hurt soldier that can kill its target shoots instead of running', () => {
    const { s, e } = nook();
    e.hp = 10;
    unit(s, 'p1').hp = 20; // a rifle does 30
    expect(aiNextCommand(s).type).toMatch(/Shot/);
  });

  it('is hurt at 40% of health or under, and not above it', () => {
    const { e } = nook();
    e.hp = e.maxHp * RETREAT_SHARE;
    expect(isHurt(e)).toBe(true);
    e.hp = e.maxHp * RETREAT_SHARE + 1;
    expect(isHurt(e)).toBe(false);
  });

  it('has nowhere to go when every tile around is seen: no step', () => {
    const s = enemyTurn(corridorRows('P....E'));
    unit(s, 'p1').facing = 2;
    const e = unit(s, 'e1');
    e.hp = 5;
    expect(retreatStep(s, e)).toBeNull();
  });

  it('once hidden it stays: no hunting back out, even knowing where the squad is', () => {
    const { s, e } = nook();
    e.hp = 10;
    e.pos = { x: 7, y: 2 };
    s.enemyMemory = { x: 1, y: 1 };
    expect(retreatStep(s, e)).toBeNull(); // not in view, nothing to do
    expect(aiNextCommand(s)).toEqual({ type: 'EndTurn' });
  });

  it('a healthy soldier in the same spot still hunts', () => {
    const { s, e } = nook();
    e.pos = { x: 7, y: 2 };
    s.enemyMemory = { x: 1, y: 1 };
    expect(aiNextCommand(s).type).toBe('Move');
  });
});

describe('cover', () => {
  // soldier at (1,2); a prop at (4,2) shields the tiles right behind it from fire from the west
  const room = () => {
    const s = enemyTurn(['#########', '#.......#', '#P..x.E.#', '#.......#', '#########']);
    unit(s, 'p1').facing = 2;
    const e = unit(s, 'e1');
    e.weapon = 'rifle';
    e.ammo = 5;
    e.facing = 6;
    return { s, e, goal: unit(s, 'p1').pos };
  };

  it('swaps a step into the open for one into cover that is closer to the target', () => {
    const { s, e, goal } = room();
    expect(coverStep(s, e, goal, { x: 5, y: 1 })).toEqual({ type: 'Move', unitId: 'e1', to: { x: 5, y: 2 } });
  });

  it('keeps the plan when the planned step is in cover already', () => {
    const { s, e, goal } = room();
    expect(coverStep(s, e, goal, { x: 5, y: 2 })).toBeNull();
  });

  it('keeps the plan when no closer tile is in cover', () => {
    const { s, e, goal } = room();
    s.tiles[2][4] = { kind: 'floor', open: false }; // the prop is gone
    expect(coverStep(s, e, goal, { x: 5, y: 1 })).toBeNull();
  });

  it('never picks a tile that is not closer, so it cannot go in circles', () => {
    const { s, e, goal } = room();
    for (let y = 1; y <= 3; y++) {
      for (let x = 1; x <= 7; x++) {
        e.pos = { x, y };
        const c = coverStep(s, e, goal, { x: x - 1, y });
        if (c && c.type === 'Move') expect(distance(c.to, goal)).toBeLessThan(distance(e.pos, goal));
      }
    }
  });

  it('closing in with no AP to shoot, it moves closer to the soldier it sees', () => {
    const { s, e } = room();
    e.ap = 10; // a rifle snap shot needs 15
    const cmd = aiNextCommand(s);
    expect(cmd.type).toBe('Move');
    if (cmd.type === 'Move') expect(distance(cmd.to, { x: 1, y: 2 })).toBeLessThan(distance(e.pos, { x: 1, y: 2 }));
  });
});
