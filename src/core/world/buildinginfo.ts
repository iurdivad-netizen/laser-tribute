import { rankFor } from '../ranks';
import { BASE_RULES, bedCount, levelsOf } from './base';
import { incomePerDay, type World } from './world';

export type InfoId = 'lab' | 'market' | 'barracks' | 'training' | 'hospital' | 'wait';

export interface BuildingInfo {
  title: string;
  lines: string[];
}

const pct = (n: number): number => Math.round(n * 100);

/** A plain explanation of a building, with the game's live numbers (nothing typed in, so a balance change shows up here). */
export function buildingInfo(id: InfoId, w: World): BuildingInfo {
  const levels = levelsOf(w.research.done);
  switch (id) {
    case 'lab':
      return {
        title: 'LAB',
        lines: [
          'Research unlocks new gear and base upgrades.',
          'One project runs at a time and its credits are spent when it starts.',
          `Labs level ${levels.labs}: projects take ${pct(BASE_RULES.labFactor[levels.labs])}% of their normal days.`,
          'Better labs are a research project too.',
        ],
      };
    case 'barracks':
      return {
        title: 'BARRACKS',
        lines: [
          `Your soldiers sleep here: ${w.soldiers.length} of ${bedCount(w.research.done)} beds are in use.`,
          `Hiring costs ${BASE_RULES.hireCost} credits and needs a free bed.`,
          `A fight needs four. Each missing soldier is replaced by a loaned mercenary for ${BASE_RULES.mercFee} credits.`,
          'More beds come from the Barracks projects in the lab.',
        ],
      };
    case 'market':
      return {
        title: 'MARKET',
        lines: [
          'Gear you have not researched can still be bought on the equipment screen.',
          `It costs ${pct(BASE_RULES.premium)}% of its normal price until the lab researches it.`,
          'Researching an item removes the extra cost for good.',
        ],
      };
    case 'training': {
      const level = levels.training;
      return {
        title: 'TRAINING',
        lines: [
          level === 0 ? 'Not built yet: research Training facility I at the lab.' : 'Training makes a ready soldier better without a fight.',
          `It takes ${BASE_RULES.trainDays} days, one soldier at a time, and the soldier is out of the squad meanwhile.`,
          level === 0
            ? 'Each training lifts the soldier to the next rank, up to a cap that grows with the facility.'
            : `Each training lifts the soldier to the next rank. Level ${level} trains up to ${BASE_RULES.trainCaps[level - 1]} points (${rankFor(BASE_RULES.trainCaps[level - 1]).name}).`,
        ],
      };
    }
    case 'hospital':
      return {
        title: 'FIELD HOSPITAL',
        lines: [
          'After a won fight, a soldier who fell may be saved instead of lost.',
          `Your second chance is ${pct(BASE_RULES.hospitalChance[levels.hospital])}% per fallen soldier (level ${levels.hospital} of 2).`,
          `A saved soldier is wounded for ${BASE_RULES.woundedDays} days and cannot fight.`,
        ],
      };
    case 'wait':
      return {
        title: 'WAIT',
        lines: [
          `Waiting passes ${BASE_RULES.waitOptions.join(' or ')} days with nothing else done.`,
          `Income arrives every day: now ${incomePerDay(w)} credits a day.`,
          'Research, training and healing move forward.',
          'On harder settings the enemy grows stronger or counterattacks.',
        ],
      };
  }
}
