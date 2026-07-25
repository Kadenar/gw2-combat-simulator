import { NECROMANCER_SKILL_IDS as ID } from "../data/ids.js";

export const NECROMANCER_AUTOATTACK_CHAINS = Object.freeze([
  [10698, 10699, 10552],
  [10702, 10703, 10704],
  [29705, 30799, 29867],
  [73012, 73040, 73047],
  [ID.ENERVATION_BLADE, ID.ENERVATION_ECHO],
  [ID.LIFE_REND, ID.LIFE_SLASH, ID.LIFE_REAP],
].map(chain => Object.freeze(chain)));
