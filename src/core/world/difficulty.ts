export type DifficultyId = 'calm' | 'standard' | 'pressure';

export const DIFFICULTY_IDS: readonly DifficultyId[] = ['calm', 'standard', 'pressure'];

export interface Difficulty {
  name: string;
  /** One short line for the difficulty screen (at most 34 characters). */
  blurb: string;
  /** Unfought enemy garrisons grow by one every this many days; null never. */
  growthEvery: number | null;
  /** A garrison grows to at most its base plus this. */
  growthCap: number;
  /** The enemy tries to retake the weakest liberated region every this many days; null never. */
  counterEvery: number | null;
  /** Credits per day for each region held or allied (supply contracts add to it). */
  income: number;
}

/** Starting values; project 4 (balance) tunes them. A new preset is one more row. */
export const DIFFICULTIES: Record<DifficultyId, Difficulty> = {
  calm: {
    name: 'CALM', blurb: 'No pushback. Take your time.',
    growthEvery: null, growthCap: 0, counterEvery: null, income: 4,
  },
  standard: {
    name: 'STANDARD', blurb: 'Garrisons slowly dig in.',
    growthEvery: 12, growthCap: 3, counterEvery: null, income: 3,
  },
  pressure: {
    name: 'PRESSURE', blurb: 'They fight back. Regions can fall.',
    growthEvery: 6, growthCap: 5, counterEvery: 15, income: 2,
  },
};

/** What the actions cost in days. */
export const DAYS = { attack: 3, visit: 2, lossPenalty: 6 } as const;
