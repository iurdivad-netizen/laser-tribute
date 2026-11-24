import { addStash, capStash } from '../loot';
import { stashOf, type StashKey } from '../stash';
import { advance, capitalOpen, regionsHeld, type World } from './world';

/** The four mercenaries the story is about. Later hires have no voice of their own. */
export const ORIGINALS = ['Alvarez', 'Brandt', 'Chen', 'Dubois'] as const;

/** One spoken line. `by` lists the speakers in order of preference; the first one still in the barracks says it. */
export interface SceneLine { by: string[]; text: string }

/** What a choice changes: credits (clamped at 0), days that pass, or one stash item. */
export interface ChoiceEffect { credits?: number; days?: number; stash?: StashKey }

export interface SceneChoice { label: string; effect: ChoiceEffect; reply: SceneLine[] }

export interface Scene {
  id: string;
  /** Pure: reads the world only. A scene plays once, the first time this holds. */
  when: (w: World) => boolean;
  lines: SceneLine[];
  choice?: [SceneChoice, SceneChoice];
}

const active = (f: (w: World) => boolean) => (w: World): boolean => w.status === 'active' && f(w);
const anyAllied = (w: World): boolean => w.regions.some((r) => r.holder === 'allied');
const say = (by: string[], text: string): SceneLine => ({ by, text });
const ALL = ['Alvarez', 'Brandt', 'Chen', 'Dubois'];
const memorial = (name: string, a: SceneLine, b: SceneLine): Scene => ({
  id: `memorial-${name}`,
  when: active((w) => w.fallen.some((f) => f.name === name)),
  lines: [a, b],
});

/** Every story scene, in the order they are offered when several are pending. */
export const SCENES: Scene[] = [
  {
    id: 'landing',
    when: active(() => true),
    lines: [
      say(['Alvarez', 'Brandt'], 'Meridian Holdings took this colony with a private army. The settlers hired us to take it back.'),
      say(['Brandt', 'Alvarez'], 'Four of us against an army. I have seen worse odds. Not many.'),
      say(['Dubois', 'Chen'], 'Where do we start?'),
      say(['Alvarez', 'Brandt'], 'Ashfall Ridge. Then the next one. Then the one after that.'),
    ],
  },
  {
    id: 'first-blood',
    when: active((w) => regionsHeld(w) >= 2),
    lines: [
      say(['Brandt', 'Alvarez'], 'One down. Sixteen to go.'),
      say(['Dubois', 'Chen'], 'Is it going to be like this every time?'),
      say(['Alvarez', 'Brandt'], 'Every time. Eat something.'),
    ],
  },
  {
    id: 'friends',
    when: active(anyAllied),
    lines: [
      say(['Dubois', 'Chen'], 'They thanked us. Nobody has thanked me for anything in years.'),
      say(['Alvarez', 'Brandt'], 'Enjoy it. Do not get used to it.'),
    ],
  },
  {
    id: 'first-lab',
    when: active((w) => w.research.done.length >= 1),
    lines: [
      say(['Chen', 'Dubois'], 'The lab finished its first job. Do not ask what it cost.'),
      say(['Alvarez', 'Brandt'], 'I am asking.'),
      say(['Chen', 'Dubois'], 'Less than a funeral.'),
    ],
  },
  {
    id: 'wounded',
    when: active((w) => w.soldiers.some((s) => s.status === 'wounded')),
    lines: [
      say(['Chen', 'Alvarez'], 'Someone is hurt. The field hospital earned its beds today.'),
      say(['Alvarez', 'Brandt'], 'Then keep them for the living.'),
    ],
  },
  {
    id: 'recruits',
    when: active((w) => w.soldiers.some((s) => !(ORIGINALS as readonly string[]).includes(s.name))),
    lines: [
      say(['Dubois', 'Chen'], 'New faces. I will show them where the coffee is.'),
      say(['Brandt', 'Alvarez'], 'I will show them where the cover is.'),
    ],
  },
  {
    id: 'offer',
    when: active((w) => regionsHeld(w) >= 6 && w.day >= 20),
    lines: [
      say(['Alvarez', 'Brandt'], 'A Meridian courier left an envelope at the gate.'),
      say(['Chen', 'Dubois'], 'A ceasefire. Sixty credits and three quiet days, if we sit still.'),
      say(['Brandt', 'Alvarez'], 'They will use those days. You know they will.'),
    ],
    choice: [
      { label: 'TAKE IT', effect: { credits: 60, days: 3 }, reply: [say(['Alvarez', 'Brandt'], 'We take the money. We pay for it later.')] },
      { label: 'BURN IT', effect: {}, reply: [say(['Brandt', 'Alvarez'], 'Good. I was hoping you would say that.')] },
    ],
  },
  memorial('Alvarez',
    say(['Brandt', 'Chen', 'Dubois'], 'Alvarez never raised a voice. Not even at the end.'),
    say(['Chen', 'Dubois'], 'I will miss the quiet.')),
  memorial('Brandt',
    say(['Alvarez', 'Chen', 'Dubois'], 'Brandt said the things we were all afraid to say.'),
    say(['Dubois', 'Chen'], 'Somebody will have to be rude for us now.')),
  memorial('Chen',
    say(['Alvarez', 'Brandt', 'Dubois'], 'Chen kept us alive and kept us laughing.'),
    say(['Dubois', 'Brandt'], 'The lab is very quiet.')),
  memorial('Dubois',
    say(['Alvarez', 'Brandt', 'Chen'], 'Dubois believed we would win. Somebody has to keep believing.'),
    say(['Chen', 'Brandt'], 'Then we carry that now.')),
  {
    id: 'halfway',
    when: active((w) => regionsHeld(w) >= 10),
    lines: [
      say(['Alvarez', 'Brandt'], 'Ten regions. Count who is still standing.'),
      say(['Chen', 'Dubois'], 'I counted twice. I would like to keep counting.'),
    ],
  },
  {
    id: 'refugees',
    when: active((w) => regionsHeld(w) >= 12 && anyAllied(w)),
    lines: [
      say(['Dubois', 'Chen'], 'There are families at the gate. They have nowhere else.'),
      say(['Brandt', 'Alvarez'], 'Every mouth we feed is a mouth that is not a gun.'),
    ],
    choice: [
      { label: 'SHELTER THEM', effect: { credits: -30, stash: 'medkit' }, reply: [say(['Dubois', 'Chen'], 'They left us a medkit and the best soup I ever had.')] },
      { label: 'MOVE ON', effect: {}, reply: [say(['Alvarez', 'Brandt'], 'We move on. We do not talk about it.')] },
    ],
  },
  {
    id: 'one-left',
    when: active((w) => regionsHeld(w) === 1 && w.day >= 10),
    lines: [
      say(ALL, 'One region left. This is the thin line.'),
      say(['Brandt', 'Alvarez'], 'Then we hold it.'),
    ],
  },
  {
    id: 'citadel-open',
    when: active(capitalOpen),
    lines: [
      say(['Brandt', 'Alvarez'], 'That is Meridian Citadel. Two gates are ours. One road in.'),
      say(['Alvarez', 'Brandt'], 'If anyone wants to stay behind, now is the time.'),
      say(['Dubois', 'Chen'], 'Nobody is staying behind.'),
    ],
  },
  {
    id: 'deserter',
    when: active((w) => capitalOpen(w) && w.seen.includes('citadel-open')),
    lines: [
      say(['Chen', 'Dubois'], 'A Meridian officer is at the fence. They say they have the gate codes.'),
      say(['Brandt', 'Alvarez'], 'Or they have a rope and a very patient friend.'),
    ],
    choice: [
      { label: 'TRUST THEM', effect: { days: 2, stash: 'scanner' }, reply: [say(['Chen', 'Dubois'], 'The codes were real. So was the scanner they left behind.')] },
      { label: 'SEND THEM AWAY', effect: {}, reply: [say(['Brandt', 'Alvarez'], 'No codes. No trap. I can live with that.')] },
    ],
  },
  {
    id: 'victory',
    when: (w) => w.status === 'won',
    lines: [
      say(ALL, 'The Citadel is ours. The colony is free.'),
      say(['Brandt', 'Dubois', 'Chen', 'Alvarez'], 'Four against an army, they said.'),
      say(['Dubois', 'Chen', 'Alvarez', 'Brandt'], 'Remember the ones who did not make it up here.'),
    ],
  },
  {
    id: 'defeat',
    when: (w) => w.status === 'lost',
    lines: [
      say(ALL, 'The last light is out.'),
      say(['Brandt', 'Alvarez', 'Chen', 'Dubois'], 'We held as long as we could.'),
    ],
  },
];

export const sceneById = (id: string, table: Scene[] = SCENES): Scene | undefined => table.find((s) => s.id === id);

/** The first scene not yet seen whose trigger holds, or null. */
export function nextScene(w: World, table: Scene[] = SCENES): Scene | null {
  return table.find((s) => !w.seen.includes(s.id) && s.when(w)) ?? null;
}

/** The world with this scene marked as seen. */
export function see(w: World, id: string): World {
  return w.seen.includes(id) ? { ...w, seen: [...w.seen], chosen: { ...w.chosen } } : { ...w, seen: [...w.seen, id], chosen: { ...w.chosen } };
}

/** Takes one option of a choice scene: records it, marks the scene seen and applies the effect. */
export function choose(w: World, scene: Scene, option: 0 | 1): World {
  if (!scene.choice) throw new Error('scene has no choice');
  const effect = scene.choice[option].effect;
  let next: World = see(w, scene.id);
  next.chosen[scene.id] = option;
  if (effect.credits !== undefined) next = { ...next, credits: Math.max(0, next.credits + effect.credits) };
  if (effect.stash !== undefined) next = { ...next, stash: capStash(addStash(next.stash, stashOf({ [effect.stash]: 1 }))) };
  if (effect.days) next = advance(next, effect.days);
  return next;
}

/** Who says a line: the first preferred original still in the barracks, else a recruit. */
export function speakerFor(w: World, line: SceneLine): string {
  const here = (name: string): boolean => (ORIGINALS as readonly string[]).includes(name) && w.soldiers.some((s) => s.name === name);
  return line.by.find(here) ?? 'RECRUIT';
}
