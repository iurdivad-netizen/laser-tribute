import { CONFIG } from './config';
import type { FloorItem, GameState, ItemKind, Side, Tile, Unit, WeaponId } from './types';

const PLAYER_WEAPONS: WeaponId[] = ['rifle', 'rifle', 'pistol', 'pistol'];
const ENEMY_WEAPONS: WeaponId[] = ['rifle', 'pistol', 'rifle', 'pistol'];
const ITEM_CHARS: Record<string, ItemKind> = { r: 'rifle', p: 'pistol', g: 'grenade' };

function makeUnit(id: string, side: Side, x: number, y: number, weapon: WeaponId): Unit {
  const hp = side === 'player' ? CONFIG.soldierHp : CONFIG.enemyHp;
  return {
    id,
    side,
    pos: { x, y },
    facing: side === 'player' ? 0 : 4,
    hp,
    maxHp: hp,
    ap: CONFIG.maxAp,
    maxAp: CONFIG.maxAp,
    weapon,
    grenades: side === 'player' ? CONFIG.soldierGrenades : 0,
    alive: true,
    patrol: [],
    patrolIndex: 0,
  };
}

export function parseMap(rows: string[], seed = 1): GameState {
  const height = rows.length;
  const width = rows[0].length;
  const tiles: Tile[][] = [];
  const units: Unit[] = [];
  const items: FloorItem[] = [];
  let players = 0;
  let enemies = 0;

  rows.forEach((row, y) => {
    if (row.length !== width) {
      throw new Error(`Row ${y} is ${row.length} wide, expected ${width}`);
    }
    const line: Tile[] = [];
    [...row].forEach((ch, x) => {
      if (ch === '#') {
        line.push({ kind: 'wall', open: false });
        return;
      }
      line.push({ kind: ch === '+' ? 'door' : 'floor', open: false });
      if (ch === 'P') {
        players += 1;
        units.push(makeUnit(`p${players}`, 'player', x, y, PLAYER_WEAPONS[(players - 1) % 4]));
      } else if (ch === 'E') {
        enemies += 1;
        units.push(makeUnit(`e${enemies}`, 'enemy', x, y, ENEMY_WEAPONS[(enemies - 1) % 4]));
      } else if (ch in ITEM_CHARS) {
        items.push({ id: `i${items.length + 1}`, pos: { x, y }, kind: ITEM_CHARS[ch] });
      }
    });
    tiles.push(line);
  });

  return {
    width,
    height,
    tiles,
    units,
    items,
    turn: 'player',
    turnNumber: 1,
    rngState: seed,
    explored: Array.from({ length: height }, () => Array<boolean>(width).fill(false)),
    enemyMemory: null,
    settings: { reactionFire: false },
    status: 'playing',
  };
}
