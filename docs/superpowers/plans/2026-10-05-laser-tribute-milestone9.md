# Laser Tribute Milestone 9: Saving and Loading Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Autosave the campaign after every mission result and offer CONTINUE or NEW CAMPAIGN on a small title screen when a save exists.

**Architecture:** A new `src/save.ts` (validator `parseSave` plus `SaveStore` over an injectable storage) keeps all storage code out of `src/core`. A new `src/screens/title.ts` draws the title screen. `App` gets a `'title'` screen, a store option, an autosave call after `recordMission`, and a two-press NEW CAMPAIGN confirmation.

**Tech Stack:** TypeScript, Canvas 2D, Vite, Vitest (node environment, no `window`).

**Spec:** `docs/superpowers/specs/2026-10-05-laser-tribute-milestone9-design.md`

## Global Constraints

- Pure `src/core` stays free of browser code; storage lives in `src/save.ts` and `src/app.ts` only.
- Save key `laser-tribute-save`; value `{ "version": 1, "campaign": Campaign, "loadout": Loadout }`.
- Only an active campaign is saved; a finished campaign clears the save. `Campaign` gets no new fields.
- A save that cannot be parsed or validated is ignored and never deleted by `load`.
- Storage errors (read, write, remove) are swallowed; no dialogs.
- NEW CAMPAIGN needs a second press within 3 s (`REPLACE SAVE? PRESS AGAIN`).
- Existing 510 tests keep passing; `new App()` without a store must not touch real storage (under Vitest there is no `window`).
- Test file names must be free: `tests/save.test.ts` and `tests/title.test.ts` are new (check with `ls tests`). Never overwrite an existing test file; append to `tests/app.test.ts` and `tests/layout.test.ts`.
- All on-screen text goes through `drawText` with characters the 5x7 font supports.
- Commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

- A save written by one `App` and read by a fresh `App` gives the same campaign and loadout (the "reload" case), including after a death and rookie replacement.
- Hostile or stale data: bad JSON, wrong shapes, out-of-range numbers, a finished campaign, `missionIndex` beyond the mission list: opens on equipment with no crash and without deleting the data.
- Storage that throws on every call (private mode, quota) must not break the game, including the autosave in `update()`.
- Pressing Enter or N on the title with a held key or a double click must not chain screens or wipe a save on the first press.
- A saved loadout that no longer fits the budget or stash must come back valid.

## File Structure

- Create `src/save.ts`: `SAVE_KEY`, `parseSave`, `SaveStore`, `defaultSaveStore`.
- Create `src/screens/title.ts`: `TITLE`, `TitleView`, `titleHit`, `drawTitle`.
- Modify `src/app.ts`: `Screen`, `AppOptions.store`, constructor load, autosave, title input and drawing.
- Create `tests/save.test.ts`, `tests/title.test.ts`; append to `tests/app.test.ts`, `tests/layout.test.ts`.

---

### Task 1: The save module

**Files:**
- Create: `src/save.ts`
- Test: `tests/save.test.ts`

**Interfaces:**
- Consumes: `CAMPAIGN`, `Campaign`, `RosterSoldier` (`src/core/campaign.ts`); `defaultLoadout`, `Loadout` (`src/core/loadout.ts`).
- Produces:
  - `SAVE_KEY = 'laser-tribute-save'`
  - `interface SaveStorage { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void }`
  - `interface Save { campaign: Campaign; loadout: Loadout }`
  - `parseSave(text: string | null, missionCount: number): Save | null`
  - `class SaveStore { constructor(storage: SaveStorage | null, missionCount: number); load(): Save | null; save(campaign: Campaign, loadout: Loadout): void; clear(): void }`
  - `defaultSaveStore(missionCount: number): SaveStore | null` (null when there is no `window.localStorage`)

- [ ] **Step 1: Write the failing tests**

Create `tests/save.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { newCampaign, recordMission, type Campaign } from '../src/core/campaign';
import { defaultLoadout } from '../src/core/loadout';
import { SAVE_KEY, SaveStore, defaultSaveStore, parseSave, type SaveStorage } from '../src/save';
import { corridorRows, makeState, unit } from './helpers';

function memory(initial?: string): SaveStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  if (initial !== undefined) data.set(SAVE_KEY, initial);
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => { data.set(k, v); },
    removeItem: (k) => { data.delete(k); },
  };
}

const throwing: SaveStorage = {
  getItem: () => { throw new Error('denied'); },
  setItem: () => { throw new Error('quota'); },
  removeItem: () => { throw new Error('denied'); },
};

/** A campaign after one won mission with a death (rookie replacement), a promotion-worthy soldier and a stash. */
function played(): Campaign {
  const s = makeState(corridorRows('PPPP'));
  unit(s, 'p2').alive = false;
  unit(s, 'p2').kills = 3;
  unit(s, 'p1').kills = 2;
  s.status = 'won';
  const c = recordMission(newCampaign(), s, 3, defaultLoadout());
  c.stash = { rifle: 2, pistol: 1, grenade: 3, clip: 4 };
  return c;
}

const json = (over: (o: any) => void, c: Campaign = played()): string => {
  const o: any = { version: 1, campaign: JSON.parse(JSON.stringify(c)), loadout: defaultLoadout() };
  over(o);
  return JSON.stringify(o);
};

describe('SaveStore', () => {
  it('round-trips a played campaign and its loadout', () => {
    const mem = memory();
    const store = new SaveStore(mem, 3);
    const c = played();
    const loadout = defaultLoadout();
    loadout[0].clips = 3;
    store.save(c, loadout);
    expect(store.load()).toEqual({ campaign: c, loadout });
  });

  it('returns null with no save, and clear removes a save', () => {
    const mem = memory();
    const store = new SaveStore(mem, 3);
    expect(store.load()).toBeNull();
    store.save(played(), defaultLoadout());
    expect(mem.data.has(SAVE_KEY)).toBe(true);
    store.clear();
    expect(mem.data.has(SAVE_KEY)).toBe(false);
  });

  it('survives storage that throws on every call, and a missing storage', () => {
    for (const storage of [throwing, null]) {
      const store = new SaveStore(storage, 3);
      expect(() => store.save(played(), defaultLoadout())).not.toThrow();
      expect(store.load()).toBeNull();
      expect(() => store.clear()).not.toThrow();
    }
  });

  it('does not delete a save it cannot read', () => {
    const mem = memory('{"version":2,"future":true}');
    const store = new SaveStore(mem, 3);
    expect(store.load()).toBeNull();
    expect(mem.data.get(SAVE_KEY)).toBe('{"version":2,"future":true}');
  });

  it('has no default store without a browser', () => {
    expect(defaultSaveStore(3)).toBeNull();
  });
});

describe('parseSave', () => {
  it('accepts a valid save', () => {
    expect(parseSave(json(() => undefined), 3)).not.toBeNull();
  });

  it.each([
    ['null text', null],
    ['not JSON', '{nope'],
    ['an array', '[]'],
    ['a string', '"x"'],
    ['the wrong version', json((o) => { o.version = 2; })],
    ['a missing campaign', json((o) => { delete o.campaign; })],
    ['a finished campaign', json((o) => { o.campaign.status = 'won'; })],
    ['a lost campaign', json((o) => { o.campaign.status = 'lost'; })],
    ['a mission index past the list', json((o) => { o.campaign.missionIndex = 3; o.campaign.missionsWon = 3; })],
    ['a negative mission index', json((o) => { o.campaign.missionIndex = -1; o.campaign.missionsWon = -1; })],
    ['wins that differ from the index', json((o) => { o.campaign.missionsWon = 2; })],
    ['a roster of the wrong size', json((o) => { o.campaign.roster.pop(); })],
    ['an empty name', json((o) => { o.campaign.roster[0].name = ''; })],
    ['fractional kills', json((o) => { o.campaign.roster[0].kills = 1.5; })],
    ['negative kills', json((o) => { o.campaign.roster[0].kills = -1; })],
    ['a bad fallen entry', json((o) => { o.campaign.fallen = [{ name: 5, kills: 0 }]; })],
    ['fewer names used than the roster', json((o) => { o.campaign.namesUsed = 2; })],
    ['a negative stash', json((o) => { o.campaign.stash.rifle = -1; })],
    ['a missing stash field', json((o) => { delete o.campaign.stash.clip; })],
    ['a huge stash', json((o) => { o.campaign.stash.grenade = 1000; })],
  ])('rejects %s', (_name, text) => {
    expect(parseSave(text, 3)).toBeNull();
  });

  it('drops unknown fields', () => {
    const save = parseSave(json((o) => { o.campaign.extra = 1; o.campaign.roster[0].secret = 'x'; o.junk = 1; }), 3)!;
    expect(save.campaign).not.toHaveProperty('extra');
    expect(save.campaign.roster[0]).not.toHaveProperty('secret');
    expect(save).not.toHaveProperty('junk');
  });

  it('replaces a bad loadout with the default one, and keeps a good one', () => {
    for (const bad of [null, 'x', [], [{ weapon: 'rifle' }], defaultLoadout().map((s) => ({ ...s, weapon: 'laser' })),
      defaultLoadout().map((s) => ({ ...s, grenades: 9 })), defaultLoadout().map((s) => ({ ...s, clips: 0 }))]) {
      const save = parseSave(json((o) => { o.loadout = bad; }), 3)!;
      expect(save.loadout).toEqual(defaultLoadout());
    }
    const custom = defaultLoadout();
    custom[1] = { weapon: 'pistol', grenades: 3, clips: 4 };
    expect(parseSave(json((o) => { o.loadout = custom; }), 3)!.loadout).toEqual(custom);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/save.test.ts`
Expected: FAIL (cannot resolve `../src/save`).

- [ ] **Step 3: Write the implementation**

Create `src/save.ts`:

```ts
import { CAMPAIGN, type Campaign, type RosterSoldier } from './core/campaign';
import { defaultLoadout, type Loadout } from './core/loadout';
import type { Stash } from './core/stash';

export const SAVE_KEY = 'laser-tribute-save';
const SAVE_VERSION = 1;

export interface SaveStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface Save {
  campaign: Campaign;
  loadout: Loadout;
}

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isInt = (v: unknown, min: number, max: number): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;

function soldier(v: unknown): RosterSoldier | null {
  if (!isObj(v) || typeof v.name !== 'string' || v.name.length === 0 || v.name.length > 40) return null;
  if (!isInt(v.kills, 0, 9999)) return null;
  return { name: v.name, kills: v.kills };
}

function soldiers(v: unknown, exactly?: number): RosterSoldier[] | null {
  if (!Array.isArray(v) || v.length > 999 || (exactly !== undefined && v.length !== exactly)) return null;
  const out: RosterSoldier[] = [];
  for (const item of v) {
    const s = soldier(item);
    if (!s) return null;
    out.push(s);
  }
  return out;
}

function stash(v: unknown): Stash | null {
  if (!isObj(v)) return null;
  const { rifle, pistol, grenade, clip } = v;
  if (!isInt(rifle, 0, 99) || !isInt(pistol, 0, 99) || !isInt(grenade, 0, 99) || !isInt(clip, 0, 99)) return null;
  return { rifle, pistol, grenade, clip };
}

/** The saved loadout when it is well formed; the default one otherwise (the app then fits it to the budget). */
function loadout(v: unknown): Loadout {
  if (!Array.isArray(v) || v.length !== CAMPAIGN.rosterSize) return defaultLoadout();
  const out: Loadout = [];
  for (const s of v) {
    if (!isObj(s) || (s.weapon !== 'pistol' && s.weapon !== 'rifle')) return defaultLoadout();
    if (!isInt(s.grenades, 0, 3) || !isInt(s.clips, 1, 4)) return defaultLoadout();
    out.push({ weapon: s.weapon, grenades: s.grenades, clips: s.clips });
  }
  return out;
}

/** The saved campaign and loadout, or null when the text is missing or not a valid save. */
export function parseSave(text: string | null, missionCount: number): Save | null {
  if (text === null) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isObj(raw) || raw.version !== SAVE_VERSION || !isObj(raw.campaign)) return null;
  const c = raw.campaign;
  if (c.status !== 'active') return null;
  if (!isInt(c.missionIndex, 0, missionCount - 1) || c.missionsWon !== c.missionIndex) return null;
  const roster = soldiers(c.roster, CAMPAIGN.rosterSize);
  const fallen = soldiers(c.fallen);
  const gear = stash(c.stash);
  if (!roster || !fallen || !gear) return null;
  if (!isInt(c.namesUsed, CAMPAIGN.rosterSize, 9999)) return null;
  const campaign: Campaign = {
    missionIndex: c.missionIndex,
    missionsWon: c.missionIndex,
    roster,
    fallen,
    namesUsed: c.namesUsed,
    status: 'active',
    stash: gear,
  };
  return { campaign, loadout: loadout(raw.loadout) };
}

/** Reads and writes the one save. Every storage error is swallowed: the game just plays without saving. */
export class SaveStore {
  constructor(
    private readonly storage: SaveStorage | null,
    private readonly missionCount: number,
  ) {}

  load(): Save | null {
    try {
      return parseSave(this.storage?.getItem(SAVE_KEY) ?? null, this.missionCount);
    } catch {
      return null;
    }
  }

  save(campaign: Campaign, loadout: Loadout): void {
    try {
      this.storage?.setItem(SAVE_KEY, JSON.stringify({ version: SAVE_VERSION, campaign, loadout }));
    } catch {
      // private mode or a full disk: carry on unsaved
    }
  }

  clear(): void {
    try {
      this.storage?.removeItem(SAVE_KEY);
    } catch {
      // nothing to do
    }
  }
}

/** A store over the browser's localStorage, or null where there is none (tests, blocked storage). */
export function defaultSaveStore(missionCount: number): SaveStore | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return new SaveStore(window.localStorage, missionCount);
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/save.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/save.ts tests/save.test.ts
git commit -m "feat: save store with a strict validator"
```

---

### Task 2: The title screen

**Files:**
- Create: `src/screens/title.ts`
- Test: `tests/title.test.ts`; append a case to `tests/layout.test.ts`

**Interfaces:**
- Consumes: `VIEW` (`src/render/layout`), `UI`, `drawButton`, `drawFrame` (`src/ui/frame`), `drawText` (`src/ui/text`).
- Produces:
  - `interface TitleView { missionNumber: number; missionCount: number; soldiers: number; budget: number; armed: boolean }`
  - `TITLE = { card: {x:90,y:70,w:300,h:220}, cont: {x:160,y:160,w:160,h:28}, fresh: {x:160,y:200,w:160,h:28} }`
  - `titleHit(px: number, py: number): 'continue' | 'new' | null`
  - `drawTitle(ctx: CanvasRenderingContext2D, v: TitleView): void`
  - `titleSummary(v: TitleView): string` (`MISSION 2 OF 3, 4 SOLDIERS, 215 CR`)

- [ ] **Step 1: Write the failing tests**

Create `tests/title.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { TITLE, drawTitle, titleHit, titleSummary, type TitleView } from '../src/screens/title';
import { textWidth, unsupportedChars } from '../src/ui/font';
import { onText, type TextRun } from '../src/ui/text';

const view = (over: Partial<TitleView> = {}): TitleView => ({
  missionNumber: 2, missionCount: 3, soldiers: 4, budget: 215, armed: false, ...over,
});

const left = (r: TextRun): number =>
  r.align === 'left' ? r.x : r.align === 'right' ? r.x - r.width : r.x - Math.floor(r.width / 2);

function texts(v: TitleView): TextRun[] {
  const runs: TextRun[] = [];
  const stop = onText((r) => runs.push(r));
  const ctx = new Proxy({}, { get: () => () => undefined, set: () => true }) as unknown as CanvasRenderingContext2D;
  drawTitle(ctx, v);
  stop();
  return runs;
}

describe('title screen', () => {
  it('finds the two buttons and ignores everything else', () => {
    expect(titleHit(240, 174)).toBe('continue');
    expect(titleHit(160, 160)).toBe('continue');
    expect(titleHit(319, 187)).toBe('continue');
    expect(titleHit(240, 214)).toBe('new');
    expect(titleHit(160, 200)).toBe('new');
    expect(titleHit(240, 195)).toBeNull(); // between the buttons
    expect(titleHit(159, 174)).toBeNull();
    expect(titleHit(320, 174)).toBeNull();
    expect(titleHit(10, 10)).toBeNull();
  });

  it('summarises the saved campaign', () => {
    expect(titleSummary(view())).toBe('MISSION 2 OF 3, 4 SOLDIERS, 215 CR');
    expect(titleSummary(view({ soldiers: 1 }))).toBe('MISSION 2 OF 3, 1 SOLDIER, 215 CR');
  });

  it('draws the heading, the summary, both buttons and the hint', () => {
    const t = texts(view()).map((r) => r.text);
    expect(t).toContain('LASER TRIBUTE');
    expect(t).toContain('MISSION 2 OF 3, 4 SOLDIERS, 215 CR');
    expect(t).toContain('CONTINUE');
    expect(t).toContain('NEW CAMPAIGN');
    expect(t.some((s) => s.includes('ENTER') && s.includes('N'))).toBe(true);
  });

  it('shows the confirmation text on the New campaign button when armed', () => {
    const t = texts(view({ armed: true })).map((r) => r.text);
    expect(t).toContain('REPLACE SAVE? PRESS AGAIN');
    expect(t).not.toContain('NEW CAMPAIGN');
  });

  it('fits every text inside the card and every label inside its button, even with big numbers', () => {
    for (const v of [view(), view({ armed: true }), view({ missionNumber: 3, budget: 9999 })]) {
      for (const r of texts(v)) {
        expect(unsupportedChars(r.text), r.text).toEqual([]);
        expect(left(r), r.text).toBeGreaterThanOrEqual(TITLE.card.x);
        expect(left(r) + r.width, r.text).toBeLessThanOrEqual(TITLE.card.x + TITLE.card.w);
      }
    }
    expect(textWidth('REPLACE SAVE? PRESS AGAIN') + 6).toBeLessThanOrEqual(TITLE.fresh.w);
    expect(textWidth('CONTINUE') + 6).toBeLessThanOrEqual(TITLE.cont.w);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/title.test.ts`
Expected: FAIL (cannot resolve `../src/screens/title`).

- [ ] **Step 3: Write the implementation**

Create `src/screens/title.ts`:

```ts
import { VIEW } from '../render/layout';
import { UI, drawButton, drawFrame } from '../ui/frame';
import { drawText } from '../ui/text';

export interface TitleView {
  missionNumber: number;
  missionCount: number;
  soldiers: number;
  budget: number;
  /** The first press of NEW CAMPAIGN happened; a second one replaces the save. */
  armed: boolean;
}

export const TITLE = {
  card: { x: 90, y: 70, w: 300, h: 220 },
  cont: { x: 160, y: 160, w: 160, h: 28 },
  fresh: { x: 160, y: 200, w: 160, h: 28 },
} as const;

const inside = (b: { x: number; y: number; w: number; h: number }, px: number, py: number): boolean =>
  px >= b.x && px < b.x + b.w && py >= b.y && py < b.y + b.h;

export function titleHit(px: number, py: number): 'continue' | 'new' | null {
  if (inside(TITLE.cont, px, py)) return 'continue';
  if (inside(TITLE.fresh, px, py)) return 'new';
  return null;
}

export function titleSummary(v: TitleView): string {
  return `MISSION ${v.missionNumber} OF ${v.missionCount}, ${v.soldiers} ${v.soldiers === 1 ? 'SOLDIER' : 'SOLDIERS'}, ${v.budget} CR`;
}

export function drawTitle(ctx: CanvasRenderingContext2D, v: TitleView): void {
  ctx.fillStyle = UI.black;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);

  const c = TITLE.card;
  drawFrame(ctx, c.x, c.y, c.w, c.h, 'raised');
  drawFrame(ctx, c.x + 8, c.y + 8, c.w - 16, 30, 'inset');
  drawText(ctx, 'LASER TRIBUTE', c.x + c.w / 2, c.y + 20, UI.accent, 'center');
  drawText(ctx, titleSummary(v), c.x + c.w / 2, c.y + 60, UI.text, 'center');

  const k = TITLE.cont;
  drawButton(ctx, { x: k.x, y: k.y, w: k.w, h: k.h }, 'CONTINUE', 'raised');
  const n = TITLE.fresh;
  if (v.armed) {
    drawFrame(ctx, n.x, n.y, n.w, n.h, 'raised');
    drawText(ctx, 'REPLACE SAVE? PRESS AGAIN', n.x + n.w / 2, n.y + Math.floor((n.h - 7) / 2), UI.red, 'center');
  } else {
    drawButton(ctx, { x: n.x, y: n.y, w: n.w, h: n.h }, 'NEW CAMPAIGN', 'raised');
  }
  drawText(ctx, 'ENTER CONTINUE   N NEW CAMPAIGN', c.x + c.w / 2, c.y + 180, UI.hint, 'center');
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/title.test.ts`
Expected: PASS. If the heading or hint fails the bounds check, shrink nothing: widen `TITLE.card.w` instead and keep the buttons centred (update `titleHit` test coordinates to match).

- [ ] **Step 5: Add the title to the layout checker and commit**

Append inside the `describe` of `tests/layout.test.ts` (before the `describe('the layout checker itself'` block), importing `drawTitle`:

```ts
  it('the title screen, with the largest numbers and the confirmation text', () => {
    for (const armed of [false, true]) {
      check('title', collect(() => drawTitle(ctx, {
        missionNumber: 3, missionCount: 3, soldiers: 4, budget: 9999, armed,
      })));
    }
  });
```

Add `import { drawTitle } from '../src/screens/title';` with the other imports.

Run: `npx vitest run tests/title.test.ts tests/layout.test.ts` — Expected: PASS.

```bash
git add src/screens/title.ts tests/title.test.ts tests/layout.test.ts
git commit -m "feat: title screen with continue and new campaign"
```

---

### Task 3: Wire saving and the title into the app

**Files:**
- Modify: `src/app.ts`
- Test: append to `tests/app.test.ts`

**Interfaces:**
- Consumes: `SaveStore`, `defaultSaveStore` (Task 1); `drawTitle`, `titleHit` (Task 2); `fitLoadout`, `campaignBudget`.
- Produces: `AppOptions.store?: SaveStore | null`; `Screen` includes `'title'`; the title input rules below.

- [ ] **Step 1: Write the failing tests**

Append to `tests/app.test.ts` (add imports `SAVE_KEY, SaveStore` from `'../src/save'`, and `validateLoadout`, `fitLoadout` from `'../src/core/loadout'` to the existing loadout import):

```ts
const CONTINUE_T = { x: 240, y: 174 }; // CONTINUE on the title screen
const NEW_T = { x: 240, y: 214 }; // NEW CAMPAIGN on the title screen

function memoryStorage(initial?: string) {
  const data = new Map<string, string>();
  if (initial !== undefined) data.set(SAVE_KEY, initial);
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => { data.set(k, v); },
    removeItem: (k: string) => { data.delete(k); },
  };
}

describe('App saving and loading', () => {
  const store = (mem = memoryStorage()) => ({ mem, store: new SaveStore(mem, 3) });

  it('opens on the equipment screen when there is no save', () => {
    const { app } = make({ store: store().store });
    expect(app.screen).toBe('equipment');
  });

  it('autosaves after a won mission, and a fresh App over the same storage opens on the title with that campaign', () => {
    const { mem, store: s } = store();
    const { app, wait } = make({ store: s, createMission: winWithCasualty });
    app.click(START);
    endWin(app, 0);
    expect(mem.data.has(SAVE_KEY)).toBe(true);
    wait();
    const reloaded = new App({ store: new SaveStore(mem, 3) });
    expect(reloaded.screen).toBe('title');
    expect(reloaded.campaign).toEqual(app.campaign);
    expect(reloaded.loadout).toEqual(fitLoadout(app.loadout, campaignBudget(app.campaign), app.campaign.stash));
  });

  it('CONTINUE opens the saved equipment screen, by click and by Enter', () => {
    for (const how of ['click', 'enter']) {
      const { mem, store: s } = store();
      const first = make({ store: s, createMission: winTiny });
      playWin(first.app, first.wait, 0);
      const { app, wait } = make({ store: new SaveStore(mem, 3) });
      expect(app.screen).toBe('title');
      wait();
      if (how === 'click') app.click(CONTINUE_T); else app.key('Enter');
      expect(app.screen).toBe('equipment');
      expect(app.campaign.missionIndex).toBe(1);
      expect(validateLoadout(app.loadout, campaignBudget(app.campaign), app.campaign.stash)).toBeNull();
    }
  });

  it('NEW CAMPAIGN needs a second press, then clears the save and starts fresh', () => {
    const { mem, store: s } = store();
    const first = make({ store: s, createMission: winTiny });
    playWin(first.app, first.wait, 0);
    const { app, wait } = make({ store: new SaveStore(mem, 3) });
    wait();
    app.click(NEW_T);
    expect(app.screen).toBe('title');
    expect(mem.data.has(SAVE_KEY)).toBe(true);
    wait();
    app.click(NEW_T);
    expect(app.screen).toBe('equipment');
    expect(app.campaign.missionIndex).toBe(0);
    expect(mem.data.has(SAVE_KEY)).toBe(false);
  });

  it('the N key works the same way, and the first press arms without clearing', () => {
    const { mem, store: s } = store();
    const first = make({ store: s, createMission: winTiny });
    playWin(first.app, first.wait, 0);
    const { app, wait } = make({ store: new SaveStore(mem, 3) });
    wait();
    app.key('n');
    expect(app.screen).toBe('title');
    expect(mem.data.has(SAVE_KEY)).toBe(true);
    app.key('N');
    expect(app.screen).toBe('equipment');
    expect(mem.data.has(SAVE_KEY)).toBe(false);
  });

  it('the confirmation lapses after 3 seconds', () => {
    const { mem, store: s } = store();
    const first = make({ store: s, createMission: winTiny });
    playWin(first.app, first.wait, 0);
    const { app, wait } = make({ store: new SaveStore(mem, 3) });
    wait();
    app.click(NEW_T);
    for (let i = 0; i < 7; i++) wait(); // 3.5 s
    app.click(NEW_T);
    expect(app.screen).toBe('title');
    expect(mem.data.has(SAVE_KEY)).toBe(true);
  });

  it('a held Enter does not chain from the title into the mission', () => {
    const { mem, store: s } = store();
    const first = make({ store: s, createMission: winTiny });
    playWin(first.app, first.wait, 0);
    const { app, wait } = make({ store: new SaveStore(mem, 3) });
    wait();
    app.key('Enter', true);
    expect(app.screen).toBe('title');
  });

  it('clears the save when the campaign is won or lost', () => {
    const won = store();
    const a = make({ store: won.store, createMission: winTiny });
    playWin(a.app, a.wait, 0);
    playWin(a.app, a.wait, 10_000);
    expect(won.mem.data.has(SAVE_KEY)).toBe(true);
    a.app.click(START);
    endWin(a.app, 20_000);
    expect(a.app.campaign.status).toBe('won');
    expect(won.mem.data.has(SAVE_KEY)).toBe(false);

    const lost = store();
    const b = make({ store: lost.store, createMission: loseAll });
    b.app.click(START);
    b.app.controller!.run({ type: 'Turn', unitId: 'e1', facing: 6 });
    b.app.update(1000);
    b.app.update(2100);
    expect(b.app.campaign.status).toBe('lost');
    expect(lost.mem.data.has(SAVE_KEY)).toBe(false);
  });

  it('ignores a bad save, leaves it in place, and opens on equipment', () => {
    const mem = memoryStorage('{"version":1,"campaign":{"status":"active"}}');
    const { app } = make({ store: new SaveStore(mem, 3) });
    expect(app.screen).toBe('equipment');
    expect(mem.data.size).toBe(1);
  });

  it('fits a saved loadout that no longer fits the budget', () => {
    const { mem, store: s } = store();
    const first = make({ store: s, createMission: winTiny });
    playWin(first.app, first.wait, 0);
    const o = JSON.parse(mem.data.get(SAVE_KEY)!);
    o.loadout = o.loadout.map(() => ({ weapon: 'rifle', grenades: 3, clips: 4 })); // far over budget
    o.campaign.stash = { rifle: 0, pistol: 0, grenade: 0, clip: 0 };
    mem.data.set(SAVE_KEY, JSON.stringify(o));
    const { app } = make({ store: new SaveStore(mem, 3) });
    expect(validateLoadout(app.loadout, campaignBudget(app.campaign), app.campaign.stash)).toBeNull();
  });

  it('plays on when storage throws on every call', () => {
    const broken = {
      getItem: () => { throw new Error('denied'); },
      setItem: () => { throw new Error('quota'); },
      removeItem: () => { throw new Error('denied'); },
    };
    const { app, wait } = make({ store: new SaveStore(broken, 3), createMission: winTiny });
    expect(app.screen).toBe('equipment');
    playWin(app, wait, 0);
    expect(app.screen).toBe('equipment');
    expect(app.campaign.missionIndex).toBe(1);
  });

  it('draws the title screen without error', () => {
    const { mem, store: s } = store();
    const first = make({ store: s, createMission: winTiny });
    playWin(first.app, first.wait, 0);
    const { app } = make({ store: new SaveStore(mem, 3) });
    const ctx = new Proxy({}, { get: () => () => ({ width: 0 }), set: () => true }) as unknown as CanvasRenderingContext2D;
    expect(() => app.draw(ctx, 0)).not.toThrow();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/app.test.ts`
Expected: the new tests FAIL (`store` option unknown, screen never `title`); the existing app tests still pass.

- [ ] **Step 3: Implement in `src/app.ts`**

1. Imports: add `import { SaveStore, defaultSaveStore } from './save';`, `import { drawTitle, titleHit } from './screens/title';`.
2. `export type Screen = 'title' | 'equipment' | 'mission' | 'result' | 'end';`
3. Add `const NEW_CONFIRM_MS = 3000;` next to `INPUT_LOCK_MS`.
4. `AppOptions`: add `store?: SaveStore | null;` (undefined means the browser default, null means no saving).
5. Fields: `private readonly store: SaveStore | null;` and `private newArmedUntil = 0;`.
6. End of the constructor:

```ts
    this.store = opts.store === undefined ? defaultSaveStore(this.missions.length) : opts.store;
    const saved = this.store?.load() ?? null;
    if (saved) {
      this.campaign = saved.campaign;
      this.loadout = fitLoadout(saved.loadout, campaignBudget(saved.campaign), saved.campaign.stash);
      this.screen = 'title';
    }
```

7. New methods (near `newCampaignScreen`):

```ts
  private continueFromTitle(): void {
    this.newArmedUntil = 0;
    this.screen = 'equipment';
    this.hover = null;
    this.lock();
    this.sound.play('click', 0.9);
  }

  /** NEW CAMPAIGN on the title: the first press arms, a second one within 3 s replaces the save. */
  private pressNew(): void {
    if (this.clock() < this.newArmedUntil) {
      this.newArmedUntil = 0;
      this.store?.clear();
      this.newCampaignScreen();
      return;
    }
    this.newArmedUntil = this.clock() + NEW_CONFIRM_MS;
    this.sound.play('click', 0.9);
  }
```

8. `click()`: add before `case 'equipment'`:

```ts
      case 'title': {
        const hit = titleHit(p.x, p.y);
        if (hit === 'continue') this.continueFromTitle();
        else if (hit === 'new') this.pressNew();
        return;
      }
```

9. `key()`: add before `case 'equipment'`:

```ts
      case 'title':
        if (k === 'Enter') {
          if (!this.locked()) this.continueFromTitle();
          return true;
        }
        if (k === 'n' || k === 'N') {
          if (!this.locked()) this.pressNew();
          return true;
        }
        return false;
```

10. `update()`: directly after the line `this.campaign = recordMission(...)`, add:

```ts
      if (this.campaign.status === 'active') {
        this.store?.save(this.campaign, fitLoadout(this.loadout, this.budget(), this.campaign.stash));
      } else {
        this.store?.clear();
      }
```

11. `drawScreen()`: at the top add:

```ts
    if (this.screen === 'title') {
      const c = this.campaign;
      drawTitle(ctx, {
        missionNumber: c.missionIndex + 1,
        missionCount: this.missions.length,
        soldiers: c.roster.length,
        budget: this.budget(),
        armed: this.clock() < this.newArmedUntil,
      });
      return;
    }
```

12. `drawSoundHint()`: change the screen test to `this.screen === 'title' || this.screen === 'equipment' || this.screen === 'end'`.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/app.test.ts`
Expected: PASS (new and existing).

- [ ] **Step 5: Whole-suite check and commit**

Run: `npx vitest run; npx tsc --noEmit; npm run build`
Expected: all tests pass (510 + new), typecheck and build clean.

```bash
git add src/app.ts tests/app.test.ts
git commit -m "feat: autosave between missions and a title screen to continue or start over"
```

---

### Task 4: Look at it in a real browser

**Files:** none (verification only); fix any defect found with a test first.

- [ ] **Step 1: Start the dev server and check a real save**

Use `preview_start` (launch config for the Vite dev server; create `.claude/launch.json` entry only if none exists). In the page, with `window.app` (dev hook): win a mission quickly by `app.controller` is not needed; instead run in the page console:

```js
localStorage.removeItem('laser-tribute-save');
```

reload, confirm the equipment screen; start a mission, kill all enemies or call the dev hook to finish it (or simply write a valid save by hand: `localStorage.setItem('laser-tribute-save', JSON.stringify({version:1,campaign:{missionIndex:1,missionsWon:1,roster:[{name:'Alvarez',kills:2},{name:'Brandt',kills:0},{name:'Chen',kills:0},{name:'Dubois',kills:1}],fallen:[],namesUsed:4,status:'active',stash:{rifle:2,pistol:0,grenade:1,clip:2}},loadout:[{weapon:'rifle',grenades:1,clips:1},{weapon:'rifle',grenades:1,clips:1},{weapon:'pistol',grenades:1,clips:1},{weapon:'pistol',grenades:1,clips:1}]}))`), then reload.
Expected: the title screen appears with `MISSION 2 OF 3, 4 SOLDIERS, <budget> CR`; screenshot it; CONTINUE shows the equipment screen with the stash discounts; reload and press N twice (within 3 s) to see the save removed (`localStorage.getItem('laser-tribute-save') === null`) and mission 1.

- [ ] **Step 2: Console and frame time**

Read the console (no errors) and confirm nothing else changed on the equipment screen. Reset the viewport if resized.

- [ ] **Step 3: Commit any fix** (only if something was found; otherwise nothing to commit).
