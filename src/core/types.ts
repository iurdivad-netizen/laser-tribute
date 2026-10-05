export type Side = 'player' | 'enemy';

export interface Pos {
  x: number;
  y: number;
}

/** 0 = N, 1 = NE, 2 = E, 3 = SE, 4 = S, 5 = SW, 6 = W, 7 = NW */
export type Facing = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type TileKind = 'floor' | 'wall' | 'door';

export interface Tile {
  kind: TileKind;
  open: boolean; // only meaningful when kind === 'door'
}

export type WeaponId = 'pistol' | 'rifle';
export type GadgetId = 'medkit' | 'armour' | 'scanner';
export type ItemKind = WeaponId | 'grenade';
export type ShotMode = 'snap' | 'aimed';

export interface Unit {
  id: string;
  /** Display name; campaign soldiers carry their roster name. */
  name: string;
  side: Side;
  pos: Pos;
  facing: Facing;
  hp: number;
  maxHp: number;
  ap: number;
  maxAp: number;
  weapon: WeaponId;
  grenades: number;
  alive: boolean;
  /** On alert: keeps AP for the other side's turn and fires at enemies that move into view. */
  alert: boolean;
  /** Added to the weapon's accuracy. 0 for Rookies and enemies. */
  accuracy: number;
  /** Rank name for soldiers ('Rookie', 'Private', ...); '' for enemies. */
  rank: string;
  /** Rounds left in the gun. */
  ammo: number;
  /** Spare clips: each reload uses one. Clips fit any weapon. */
  clips: number;
  /** Enemies killed in this mission, credited to the shooter or grenade thrower. */
  kills: number;
  /** The one gadget carried: 'medkit' and 'scanner' are used up, 'armour' is worn for the whole mission. */
  gadget: GadgetId | null;
  patrol: Pos[];
  patrolIndex: number;
}

export interface FloorItem {
  id: string;
  pos: Pos;
  kind: ItemKind;
  /** Rounds in a weapon lying on the floor; absent means a full magazine (map-placed weapons). */
  ammo?: number;
}

export type GameStatus = 'playing' | 'won' | 'lost';

export interface GameState {
  width: number;
  height: number;
  tiles: Tile[][]; // tiles[y][x]
  units: Unit[];
  items: FloorItem[];
  turn: Side;
  turnNumber: number;
  rngState: number;
  explored: boolean[][]; // explored[y][x], the player's map memory
  enemyMemory: Pos | null; // where the enemy side last saw a player unit
  /** Enemy positions found by a scan this turn; cleared when the player ends the turn. Never read by the AI. */
  scanned: Pos[];
  /** Reaction shots already taken this turn, as 'shooterId>targetId'. Cleared when a turn ends. */
  reacted: string[];
  status: GameStatus;
}

export type Command =
  | { type: 'Move'; unitId: string; to: Pos }
  | { type: 'Turn'; unitId: string; facing: Facing }
  | { type: 'SnapShot'; unitId: string; targetId: string }
  | { type: 'AimedShot'; unitId: string; targetId: string }
  | { type: 'Stab'; unitId: string; targetId: string }
  | { type: 'Reload'; unitId: string }
  | { type: 'OpenDoor'; unitId: string; at: Pos }
  | { type: 'CloseDoor'; unitId: string; at: Pos }
  | { type: 'PickUp'; unitId: string; itemId: string }
  | { type: 'Throw'; unitId: string; at: Pos }
  | { type: 'Alert'; unitId: string; on: boolean }
  | { type: 'EndTurn' };

export type GameEvent =
  | { type: 'moved'; unitId: string; from: Pos; to: Pos }
  | { type: 'turned'; unitId: string; facing: Facing }
  | { type: 'alert'; unitId: string; on: boolean }
  | {
      type: 'shot';
      unitId: string;
      targetId: string;
      mode: ShotMode;
      hit: boolean;
      damage: number;
      from: Pos;
      impact: Pos;
    }
  | { type: 'stab'; unitId: string; targetId: string; hit: boolean; damage: number; from: Pos; at: Pos }
  | { type: 'reloaded'; unitId: string; ammo: number; at: Pos }
  | { type: 'died'; unitId: string; at: Pos }
  | { type: 'doorChanged'; at: Pos; open: boolean }
  | { type: 'pickedUp'; unitId: string; itemId: string; kind: ItemKind }
  | {
      type: 'grenade';
      unitId: string;
      at: Pos;
      hits: { unitId: string; damage: number }[];
      doorsDestroyed: Pos[];
    }
  | { type: 'turnEnded'; side: Side }
  | { type: 'gameOver'; winner: Side };

export type Result =
  | { ok: true; state: GameState; events: GameEvent[] }
  | { ok: false; reason: string };
