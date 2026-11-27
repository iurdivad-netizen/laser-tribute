import { faceImage } from './faces';
import { NAME_W } from './baseinfo';
import { itemOfNode, type ItemRef } from '../core/world/iteminfo';
import { rankFor, rankShort } from '../core/ranks';
import { attachmentPrice, gadgetPrice, throwablePrice, weaponPrice } from '../core/loadout';
import { BASE_RULES, NODES, bedCount, levelsOf, nodeById, researchDays, type ResearchNode } from '../core/world/base';
import { canHire, canTrain } from '../core/world/barracks';
import { canResearch } from '../core/world/research';
import { incomePerDay, type PoolSoldier, type World } from '../core/world/world';
import { VIEW } from '../render/layout';
import { UI, drawButton, drawFrame, type Rect } from '../ui/frame';
import { clipText, drawText } from '../ui/text';

export type PanelId = 'lab' | 'market' | 'barracks' | 'training' | 'hospital' | 'wait';

export interface PanelRow {
  label: string;
  detail: string;
  enabled: boolean;
}

/** Rows shown at once; longer lists (the 22 research nodes) are paged. */
export const PANEL_PAGE = 11;

export const PANEL = {
  rows: Array.from({ length: PANEL_PAGE }, (_, i): Rect => ({ x: 18, y: 34 + i * 23, w: 444, h: 21 })),
  prev: { x: 18, y: 292, w: 70, h: 20 },
  next: { x: 96, y: 292, w: 70, h: 20 },
  act: { x: 18, y: 340, w: 200, h: 28 },
  back: { x: 262, y: 340, w: 200, h: 28 },
  /** The INFO button in the header: it explains the building. */
  info: { x: 326, y: 5, w: 70, h: 20 },
} as const;

export type PanelHit = { kind: 'row'; index: number } | { kind: 'name'; index: number } | { kind: 'info' } | { kind: 'act' } | { kind: 'back' } | { kind: 'prev' } | { kind: 'next' };

const TITLE: Record<PanelId, string> = {
  lab: 'LAB: RESEARCH', market: 'MARKET: WHAT GEAR COSTS', barracks: 'BARRACKS', training: 'TRAINING', hospital: 'FIELD HOSPITAL', wait: 'WAIT',
};

const isGear = (n: ResearchNode): boolean => Boolean(n.gives.weapon || n.gives.throwable || n.gives.gadget || n.gives.attachment);

function basePrice(n: ResearchNode): number {
  const g = n.gives;
  if (g.weapon) return weaponPrice(g.weapon);
  if (g.throwable) return throwablePrice({ throwable: g.throwable });
  if (g.gadget) return gadgetPrice(g.gadget);
  return attachmentPrice(g.attachment!);
}

const soldierLabel = (s: World['soldiers'][number]): string =>
  `${s.name.toUpperCase()} ${rankShort(rankFor(s.kills + s.trained).name).toUpperCase()}`;

const hospitalNext = (w: World): ResearchNode | undefined => nodeById(`hospital${levelsOf(w.research.done).hospital + 1}`);

/** The hospital's facility rows, above its list of the wounded. */
const HOSPITAL_HEAD = 3;

const wounded = (w: World): PoolSoldier[] => w.soldiers.filter((s) => s.status === 'wounded');

/** The soldier a panel row shows (its absolute row index), or undefined on every other row. */
export function panelSoldier(id: PanelId, w: World, index: number): PoolSoldier | undefined {
  if (id === 'barracks' || id === 'training') return w.soldiers[index];
  if (id === 'hospital') return wounded(w)[index - HOSPITAL_HEAD];
  return undefined;
}

export function panelRows(id: PanelId, w: World): PanelRow[] {
  const done = w.research.done;
  switch (id) {
    case 'lab':
      return NODES.map((n) => {
        let detail: string;
        if (done.includes(n.id)) detail = 'DONE';
        else if (w.research.active?.node === n.id) detail = `IN PROGRESS ${w.research.active.daysLeft}D`;
        else {
          const missing = n.needs.find((d) => !done.includes(d));
          detail = missing ? `NEEDS ${nodeById(missing)!.name.toUpperCase()}` : `${n.cost} CR  ${researchDays(n, done)}D`;
        }
        return { label: n.name.toUpperCase(), detail, enabled: canResearch(w, n.id) };
      });
    case 'market':
      return NODES.filter(isGear).map((n) => {
        const base = basePrice(n);
        const premium = Math.max(1, Math.round(base * BASE_RULES.premium));
        return {
          label: n.name.toUpperCase(),
          detail: done.includes(n.id) ? 'OWNED' : `BASE ${base}   MARKET ${premium}`,
          enabled: true,
        };
      });
    case 'barracks':
      return w.soldiers.map((s) => ({
        label: soldierLabel(s),
        detail: `${s.status.toUpperCase()}${s.status === 'ready' ? '' : ` ${s.daysLeft}D`}  K${s.kills}`,
        enabled: true,
      }));
    case 'training':
      return w.soldiers.map((s) => {
        const level = levelsOf(done).training;
        let detail = 'AT RANK CAP';
        if (level === 0) detail = 'NO FACILITY';
        else if (s.status === 'training') detail = `TRAINING ${s.daysLeft}D`;
        else if (s.status === 'wounded') detail = `WOUNDED ${s.daysLeft}D`;
        else if (canTrain(w, s.name)) detail = 'CAN TRAIN';
        else if (w.soldiers.filter((x) => x.status === 'training').length >= level) detail = 'FULL';
        return { label: soldierLabel(s), detail, enabled: canTrain(w, s.name) };
      });
    case 'hospital': {
      const level = levelsOf(done).hospital;
      const next = hospitalNext(w);
      return [
        { label: 'FIELD HOSPITAL', detail: `LEVEL ${level} OF 2`, enabled: true },
        { label: 'SECOND CHANCE', detail: `${Math.round(BASE_RULES.hospitalChance[level] * 100)}%`, enabled: true },
        {
          label: 'NEXT UPGRADE',
          detail: next ? `${next.name.toUpperCase()} ${next.cost} CR ${researchDays(next, done)}D` : 'FULLY BUILT',
          enabled: next ? canResearch(w, next.id) : false,
        },
        ...wounded(w).map((s) => ({ label: soldierLabel(s), detail: `WOUNDED ${s.daysLeft}D`, enabled: true })),
      ];
    }
    case 'wait':
      return BASE_RULES.waitOptions.map((d) => ({
        label: d === 1 ? 'WAIT 1 DAY' : `WAIT ${d} DAYS`,
        detail: `INCOME +${incomePerDay(w) * d}`,
        enabled: w.status === 'active',
      }));
  }
}

/** The action button's label for the selected row, or null when nothing can be done. */
export function panelAction(id: PanelId, w: World, selected: number | null): string | null {
  const rows = panelRows(id, w);
  const row = selected !== null ? rows[selected] : undefined;
  switch (id) {
    case 'lab': return row?.enabled ? 'START' : null;
    case 'market': return null;
    case 'barracks': return canHire(w) ? 'HIRE' : null;
    case 'training': return row?.enabled ? 'TRAIN' : null;
    case 'hospital': {
      // START is the facility upgrade: with a wounded soldier selected it would read as treating them
      if (selected !== null && panelSoldier(id, w, selected)) return null;
      const next = hospitalNext(w);
      return next && canResearch(w, next.id) ? 'START' : null;
    }
    case 'wait': return row?.enabled ? 'WAIT' : null;
  }
}

const inside = (b: Rect, px: number, py: number, slop: number): boolean =>
  px >= b.x - slop && px < b.x + b.w + slop && py >= b.y - slop && py < b.y + b.h + slop;

const pages = (count: number): number => Math.max(1, Math.ceil(count / PANEL_PAGE));

/** The item a Market or Lab row shows (its absolute row index), the research node for a Lab upgrade row, or null past the last row and on every other panel. */
export function panelItem(id: PanelId, index: number): ItemRef | null {
  if (id === 'market') {
    const node = NODES.filter(isGear)[index];
    return node ? itemOfNode(node.id) : null;
  }
  if (id === 'lab') {
    const node = NODES[index];
    return node ? (itemOfNode(node.id) ?? { kind: 'node', id: node.id }) : null;
  }
  return null;
}

/** What a menu-space point is on: a row of the current page, a button, or the pager. The slop widens the buttons. */
export function panelHit(id: PanelId, px: number, py: number, w: World, page: number, slop = 0): PanelHit | null {
  const count = panelRows(id, w).length;
  for (let i = 0; i < PANEL_PAGE; i++) {
    if (inside(PANEL.rows[i], px, py, 0)) {
      const index = page * PANEL_PAGE + i;
      if (index >= count) return null;
      // on a soldier row the name opens the soldier's card, on the Market and Lab gear rows the item's card; the rest of the row selects as always
      const inName = px < PANEL.rows[i].x + NAME_W;
      return inName && (panelSoldier(id, w, index) || panelItem(id, index)) ? { kind: 'name', index } : { kind: 'row', index };
    }
  }
  if (inside(PANEL.info, px, py, slop)) return { kind: 'info' };
  if (inside(PANEL.act, px, py, slop)) return { kind: 'act' };
  if (inside(PANEL.back, px, py, slop)) return { kind: 'back' };
  if (page + 1 < pages(count) && inside(PANEL.next, px, py, slop)) return { kind: 'next' };
  if (page > 0 && inside(PANEL.prev, px, py, slop)) return { kind: 'prev' };
  return null;
}

export function drawPanel(
  ctx: CanvasRenderingContext2D, id: PanelId, w: World, selected: number | null, page: number, notice: string,
): void {
  ctx.fillStyle = UI.black;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  drawText(ctx, TITLE[id], 18, 12, UI.accent, 'left');
  drawText(ctx, `${w.credits} CR`, 462, 12, UI.text, 'right');
  const rows = panelRows(id, w);
  for (let i = 0; i < PANEL_PAGE; i++) {
    const index = page * PANEL_PAGE + i;
    const row = rows[index];
    if (!row) continue;
    const r = PANEL.rows[i];
    drawFrame(ctx, r.x, r.y, r.w, r.h, index === selected ? 'hover' : 'raised');
    const colour = row.enabled ? UI.text : UI.disabledText;
    // a soldier's small face, with the label moved right to make room
    const soldier = panelSoldier(id, w, index);
    const face = soldier ? faceImage(soldier.name, true) : null;
    if (face) ctx.drawImage(face, r.x + 3, r.y + 2, 16, 16);
    drawText(ctx, clipText(row.label, face ? 172 : 190), r.x + (face ? 26 : 8), r.y + 7, colour, 'left');
    drawText(ctx, clipText(row.detail, 230), r.x + r.w - 8, r.y + 7, row.enabled ? UI.dim : UI.disabledText, 'right');
  }
  if (pages(rows.length) > 1) {
    drawButton(ctx, PANEL.prev, 'PREV', page > 0 ? 'raised' : 'disabled');
    drawButton(ctx, PANEL.next, 'NEXT', page + 1 < pages(rows.length) ? 'raised' : 'disabled');
    drawText(ctx, `PAGE ${page + 1} OF ${pages(rows.length)}`, 180, 298, UI.hint, 'left');
  }
  let info = '';
  if (id === 'barracks') info = `BEDS ${w.soldiers.length}/${bedCount(w.research.done)}   HIRE ${BASE_RULES.hireCost} CR`;
  else if (id === 'lab' && w.research.active) info = `RESEARCHING ${nodeById(w.research.active.node)!.name.toUpperCase()} ${w.research.active.daysLeft}D`;
  else if (id === 'training') info = `FACILITY LEVEL ${levelsOf(w.research.done).training}`;
  if (info) drawText(ctx, clipText(info, 440), 18, 318, UI.dim, 'left');
  if (notice) drawText(ctx, clipText(notice.toUpperCase(), 440), 18, 328, UI.accent, 'left');
  const label = panelAction(id, w, selected);
  drawButton(ctx, PANEL.act, label ?? 'NO ACTION', label ? 'raised' : 'disabled');
  drawButton(ctx, PANEL.back, 'BACK', 'raised');
  drawButton(ctx, PANEL.info, 'INFO', 'raised');
}
