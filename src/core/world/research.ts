import { NODES, nodeById, researchDays } from './base';
import type { World } from './world';

/** Whether a project can start now: the story is on, nothing else is running, the node is new, its needs are done and the credits cover it. */
export function canResearch(w: World, id: string): boolean {
  const node = nodeById(id);
  if (!node || w.status !== 'active' || w.research.active !== null) return false;
  if (w.research.done.includes(id)) return false;
  if (!node.needs.every((n) => w.research.done.includes(n))) return false;
  return w.credits >= node.cost;
}

/** Every node that can start now, in tree order. */
export function researchOptions(w: World): string[] {
  return NODES.filter((n) => canResearch(w, n.id)).map((n) => n.id);
}

/** Pays for a project and starts it. Throws unless `canResearch`. The credits are not refunded. */
export function startResearch(w: World, id: string): World {
  if (!canResearch(w, id)) throw new Error(`cannot research ${id}`);
  const node = nodeById(id)!;
  return {
    ...w,
    credits: w.credits - node.cost,
    research: { done: [...w.research.done], active: { node: id, daysLeft: researchDays(node, w.research.done) } },
  };
}
