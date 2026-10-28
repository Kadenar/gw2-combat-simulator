import { SHARED_STATE_IDS } from '#gw2/platform/results/state-ids.js';
import { ELEMENTALIST_STATE_IDS } from '#gw2/professions/elementalist/state-ids.js';
import { ENGINEER_STATE_IDS } from '#gw2/professions/engineer/state-ids.js';
import { MESMER_STATE_IDS } from '#gw2/professions/mesmer/state-ids.js';
import { RANGER_STATE_IDS } from '#gw2/professions/ranger/state-ids.js';
import { WARRIOR_STATE_IDS } from '#gw2/professions/warrior/state-ids.js';
import { NECROMANCER_STATE_IDS } from '#gw2/professions/necromancer/state-ids.js';
import { THIEF_STATE_IDS } from '#gw2/professions/thief/state-ids.js';
import { GUARDIAN_STATE_IDS } from '#gw2/professions/guardian/state-ids.js';
import { REVENANT_STATE_IDS } from '#gw2/professions/revenant/state-ids.js';

/** Compose the public vocabulary once; each owner still publishes only its own observations. */
export const PROFESSION_STATE_IDS = Object.freeze({
  ...SHARED_STATE_IDS,
  ...ELEMENTALIST_STATE_IDS,
  ...ENGINEER_STATE_IDS,
  ...MESMER_STATE_IDS,
  ...RANGER_STATE_IDS,
  ...WARRIOR_STATE_IDS,
  ...NECROMANCER_STATE_IDS,
  ...THIEF_STATE_IDS,
  ...GUARDIAN_STATE_IDS,
  ...REVENANT_STATE_IDS
});
