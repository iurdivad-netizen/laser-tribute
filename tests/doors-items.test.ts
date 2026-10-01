import { describe, expect, it } from 'vitest';
import { applyCommand } from '../src/core/apply';
import { corridorRows, makeState, ok, reason, unit } from './helpers';

describe('doors', () => {
  const rows = ['#####', '#P+.#', '#..E#', '#####'];

  it('opens an adjacent door for 2 AP', () => {
    const s = makeState(rows);
    const r = ok(applyCommand(s, { type: 'OpenDoor', unitId: 'p1', at: { x: 2, y: 1 } }));
    expect(r.state.tiles[1][2].open).toBe(true);
    expect(unit(r.state, 'p1').ap).toBe(58);
    expect(r.events).toEqual([{ type: 'doorChanged', at: { x: 2, y: 1 }, open: true }]);
  });

  it('closes an open door', () => {
    const s = makeState(rows);
    s.tiles[1][2].open = true;
    const r = ok(applyCommand(s, { type: 'CloseDoor', unitId: 'p1', at: { x: 2, y: 1 } }));
    expect(r.state.tiles[1][2].open).toBe(false);
  });

  it('rejects opening a door that is already open', () => {
    const s = makeState(rows);
    s.tiles[1][2].open = true;
    expect(reason(applyCommand(s, { type: 'OpenDoor', unitId: 'p1', at: { x: 2, y: 1 } }))).toMatch(
      /already open/,
    );
  });

  it('rejects a door that is not adjacent', () => {
    const s = makeState(corridorRows('P..+.E'));
    expect(reason(applyCommand(s, { type: 'OpenDoor', unitId: 'p1', at: { x: 4, y: 1 } }))).toMatch(
      /adjacent/,
    );
  });

  it('rejects a tile that is not a door', () => {
    const s = makeState(rows);
    expect(reason(applyCommand(s, { type: 'OpenDoor', unitId: 'p1', at: { x: 1, y: 2 } }))).toMatch(
      /not a door/,
    );
  });

  it('rejects closing a door with a unit standing in it', () => {
    const s = makeState(rows);
    s.tiles[1][2].open = true;
    const moved = ok(applyCommand(s, { type: 'Move', unitId: 'p1', to: { x: 2, y: 1 } }));
    expect(
      reason(applyCommand(moved.state, { type: 'CloseDoor', unitId: 'p1', at: { x: 2, y: 1 } })),
    ).toMatch(/doorway/);
  });

  it('rejects opening a door without enough AP', () => {
    const s = makeState(rows);
    unit(s, 'p1').ap = 1;
    expect(reason(applyCommand(s, { type: 'OpenDoor', unitId: 'p1', at: { x: 2, y: 1 } }))).toMatch(
      /action points/,
    );
  });
});

describe('pickup', () => {
  const rows = corridorRows('P...E');
  const itemAt = (s: ReturnType<typeof makeState>, kind: 'rifle' | 'pistol' | 'grenade', x = 1) =>
    s.items.push({ id: 'i9', pos: { x, y: 1 }, kind });

  it('swaps weapons and leaves the old one on the floor', () => {
    const s = makeState(rows);
    unit(s, 'p1').weapon = 'pistol';
    itemAt(s, 'rifle');
    const r = ok(applyCommand(s, { type: 'PickUp', unitId: 'p1', itemId: 'i9' }));
    expect(unit(r.state, 'p1').weapon).toBe('rifle');
    expect(r.state.items).toEqual([{ id: 'i9', pos: { x: 1, y: 1 }, kind: 'pistol' }]);
    expect(unit(r.state, 'p1').ap).toBe(57);
    expect(r.events).toEqual([{ type: 'pickedUp', unitId: 'p1', itemId: 'i9', kind: 'rifle' }]);
  });

  it('adds a grenade and removes the item', () => {
    const s = makeState(rows);
    itemAt(s, 'grenade');
    const r = ok(applyCommand(s, { type: 'PickUp', unitId: 'p1', itemId: 'i9' }));
    expect(unit(r.state, 'p1').grenades).toBe(2);
    expect(r.state.items).toEqual([]);
  });

  it('rejects an item on another tile', () => {
    const s = makeState(rows);
    itemAt(s, 'grenade', 3);
    expect(reason(applyCommand(s, { type: 'PickUp', unitId: 'p1', itemId: 'i9' }))).toMatch(/here/);
  });

  it('rejects an unknown item', () => {
    const s = makeState(rows);
    expect(reason(applyCommand(s, { type: 'PickUp', unitId: 'p1', itemId: 'nope' }))).toMatch(
      /No such item/,
    );
  });

  it('rejects picking up the weapon already carried', () => {
    const s = makeState(rows);
    itemAt(s, 'rifle'); // p1 already carries a rifle
    expect(reason(applyCommand(s, { type: 'PickUp', unitId: 'p1', itemId: 'i9' }))).toMatch(
      /Already carrying/,
    );
  });

  it('rejects a pickup without enough AP', () => {
    const s = makeState(rows);
    itemAt(s, 'grenade');
    unit(s, 'p1').ap = 2;
    expect(reason(applyCommand(s, { type: 'PickUp', unitId: 'p1', itemId: 'i9' }))).toMatch(
      /action points/,
    );
  });
});
