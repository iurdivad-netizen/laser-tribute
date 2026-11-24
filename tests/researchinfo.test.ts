import { describe, expect, it } from 'vitest';
import { rankFor } from '../src/core/ranks';
import { BASE_RULES, NODES, levelsOf, researchDays } from '../src/core/world/base';
import { ALL_ITEMS, itemCard, itemOfNode, nodeCard, type ItemRef } from '../src/core/world/iteminfo';
import { newWorld, type World } from '../src/core/world/world';
import { unsupportedChars } from '../src/ui/font';

const fresh = () => newWorld(1, 'calm');
const withResearch = (done: string[], active: World['research']['active'] = null): World => ({ ...fresh(), research: { done, active } });
const UPGRADES = NODES.filter((n) => itemOfNode(n.id) === null);
const value = (id: string, label: string, w: World | null = null): string | undefined => nodeCard(id, w)?.rows.find((r) => r[0] === label)?.[1];

describe('nodeCard', () => {
  it('exists for exactly the 13 upgrade nodes', () => {
    expect(UPGRADES).toHaveLength(13);
    for (const n of NODES) expect(nodeCard(n.id, null) !== null, n.id).toBe(itemOfNode(n.id) === null);
    expect(nodeCard('nope', null)).toBeNull();
    expect(nodeCard('shotgun', null)).toBeNull();
    expect(nodeCard('scope', null)).toBeNull();
  });

  it('titles the card with the node name', () => {
    expect(nodeCard('beds2', null)!.title).toBe('BARRACKS II');
    for (const n of UPGRADES) expect(nodeCard(n.id, null)!.title).toBe(n.name.toUpperCase());
  });

  it('states the effect from the tables', () => {
    expect(value('beds1', 'EFFECT')).toBe('+2 BEDS (TOTAL 8)');
    expect(value('beds3', 'EFFECT')).toBe('+2 BEDS (TOTAL 12)');
    expect(value('labs1', 'EFFECT')).toBe('RESEARCH 75% OF DAYS');
    expect(value('labs2', 'EFFECT')).toBe('RESEARCH 50% OF DAYS');
    expect(value('contracts2', 'EFFECT')).toBe('+1 CREDIT/DAY/REGION');
    expect(value('hospital1', 'EFFECT')).toBe('25% SECOND CHANCE');
    expect(value('hospital2', 'EFFECT')).toBe('50% SECOND CHANCE');
    expect(value('training3', 'EFFECT')).toBe('CAP 9 (CAPTAIN)');
    expect(value('training1', 'EFFECT')).toBe(`CAP 2 (${rankFor(BASE_RULES.trainCaps[0]).name.toUpperCase()})`);
    for (const n of UPGRADES) {
      const g = n.gives;
      const level = (g.beds ?? g.labs ?? g.contracts ?? g.hospital ?? g.training)!;
      const expected = g.beds
        ? `+${BASE_RULES.bedsPerLevel} BEDS (TOTAL ${BASE_RULES.startBeds + BASE_RULES.bedsPerLevel * level})`
        : g.labs
          ? `RESEARCH ${Math.round(BASE_RULES.labFactor[level] * 100)}% OF DAYS`
          : g.contracts
            ? '+1 CREDIT/DAY/REGION'
            : g.hospital
              ? `${Math.round(BASE_RULES.hospitalChance[level] * 100)}% SECOND CHANCE`
              : `CAP ${BASE_RULES.trainCaps[level - 1]} (${rankFor(BASE_RULES.trainCaps[level - 1]).name.toUpperCase()})`;
      expect(value(n.id, 'EFFECT'), n.id).toBe(expected);
    }
  });

  it('shows cost, days (with the labs level) and the prerequisite', () => {
    for (const n of UPGRADES) {
      expect(value(n.id, 'COST'), n.id).toBe(`${n.cost}`);
      expect(value(n.id, 'DAYS'), n.id).toBe(`${researchDays(n, [])}`);
      expect(value(n.id, 'DAYS', withResearch(['labs1'])), n.id).toBe(`${researchDays(n, ['labs1'])}`);
      if (n.needs.length === 0) expect(value(n.id, 'NEEDS'), n.id).toBeUndefined();
      else expect(value(n.id, 'NEEDS'), n.id).toBe(n.needs.map((id) => NODES.find((m) => m.id === id)!.name.toUpperCase()).join(', '));
    }
    expect(value('beds2', 'NEEDS')).toBe('BARRACKS I');
    expect(levelsOf(['labs1']).labs).toBe(1);
    expect(researchDays(NODES.find((n) => n.id === 'beds1')!, ['labs1'])).toBeLessThan(NODES.find((n) => n.id === 'beds1')!.days);
  });

  it('says where the node stands, and shows no status without a world', () => {
    expect(value('beds1', 'STATUS', fresh())).toBe('AVAILABLE');
    expect(value('beds1', 'STATUS', withResearch(['beds1']))).toBe('RESEARCHED');
    expect(value('beds1', 'STATUS', withResearch([], { node: 'beds1', daysLeft: 2 }))).toBe('IN PROGRESS');
    expect(value('beds2', 'STATUS', fresh())).toBe('LOCKED');
    expect(value('beds2', 'STATUS', withResearch(['beds1']))).toBe('AVAILABLE');
    for (const n of UPGRADES) expect(value(n.id, 'STATUS', null), n.id).toBeUndefined();
  });

  it('follows the card contract, with and without a world', () => {
    for (const w of [null, fresh()]) {
      for (const n of UPGRADES) {
        const card = nodeCard(n.id, w)!;
        expect(card.rows.length, n.id).toBeGreaterThanOrEqual(2);
        expect(card.rows.length, n.id).toBeLessThanOrEqual(12);
        expect(card.goodFor.length, n.id).toBeGreaterThan(0);
        expect(card.goodFor, n.id).not.toMatch(/[0-9]/);
        for (const [label, v] of card.rows) {
          expect(label.length, `${n.id} ${label}`).toBeLessThanOrEqual(10);
          expect(v.length, `${n.id} ${v}`).toBeLessThanOrEqual(22);
          expect(unsupportedChars(label + v), `${n.id} ${label} ${v}`).toEqual([]);
        }
        expect(unsupportedChars(card.title + card.goodFor), n.id).toEqual([]);
      }
    }
  });

  it('is what itemCard gives for a node ref, and the item list stays at 13', () => {
    const ref: ItemRef = { kind: 'node', id: 'beds1' };
    expect(itemCard(ref, fresh())).toEqual(nodeCard('beds1', fresh()));
    expect(itemCard(ref, null)).toEqual(nodeCard('beds1', null));
    expect(ALL_ITEMS).toHaveLength(13);
  });
});
