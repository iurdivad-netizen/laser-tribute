import { describe, expect, it } from 'vitest';
import { aiNextCommand, runEnemyTurn } from '../src/core/ai';
import { findPath } from '../src/core/path';
import { WEAPONS } from '../src/core/config';
import { applyCommand } from '../src/core/apply';
import { corridorRows, makeState, ok, unit } from './helpers';

const rows3 = ['#########', '#E......#', '#.......#', '#......P#', '#########'];

describe('enemy movement and fire', () => {
  it('walks around a fire tile when a detour exists', () => {
    const s = makeState(rows3);
    s.hazards.push({ pos: { x: 3, y: 1 }, kind: 'fire', turnsLeft: 3 });
    const path = findPath(s, 'e1', { x: 6, y: 1 }, { ignoreOccupantAtGoal: true })!;
    expect(path.some((p) => p.x === 3 && p.y === 1)).toBe(false);
  });

  it('still crosses fire when it is the only way', () => {
    const s = makeState(corridorRows('E..P'));
    s.hazards.push({ pos: { x: 2, y: 1 }, kind: 'fire', turnsLeft: 3 });
    const path = findPath(s, 'e1', { x: 3, y: 1 }, { ignoreOccupantAtGoal: true });
    expect(path).not.toBeNull();
    expect(path!.some((p) => p.x === 2)).toBe(true);
  });
});

describe('enemies and the new weapons', () => {
  it('an SMG enemy fires a full burst in one action', () => {
    const s = makeState(corridorRows('E..P'));
    const e = unit(s, 'e1'); e.weapon = 'smg'; e.ammo = WEAPONS.smg.magazine; e.facing = 2;
    unit(s, 'p1').hp = 999;
    s.turn = 'enemy';
    const cmd = aiNextCommand(s);
    expect(['SnapShot', 'AimedShot']).toContain(cmd.type);
    const r = ok(applyCommand(s, cmd));
    expect(r.events.filter((x) => x.type === 'shot').length).toBe(3);
  });

  it('a soldier hidden by smoke is not shot at; the enemy ends its turn or moves instead', () => {
    const s = makeState(corridorRows('E...P'));
    const e = unit(s, 'e1'); e.facing = 2;
    s.hazards.push({ pos: { x: 3, y: 1 }, kind: 'smoke', turnsLeft: 3 });
    s.turn = 'enemy';
    const { events } = runEnemyTurn(s);
    expect(events.some((x) => x.type === 'shot')).toBe(false);
  });
});
