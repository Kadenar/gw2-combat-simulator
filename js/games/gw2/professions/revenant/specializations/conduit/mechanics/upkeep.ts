/** Conduit supplies rewards and cadence policy while Core owns each upkeep activation's pending work. */
import { createRevenantUpkeepContribution } from '#gw2/professions/revenant/core/mechanics/upkeep-lifecycle.js';
import { REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';
import { gainAffinity } from '#gw2/professions/revenant/specializations/conduit/mechanics/affinity.js';
import { lesserDaggers } from '#gw2/professions/revenant/specializations/conduit/skills/form-attacks.js';

export const conduitUpkeepLifecycle = createRevenantUpkeepContribution([
  {
    name: 'revenant.conduit-upkeep-affinity',
    accepts: () => true,
    interval: 3,
    priority: -200,
    background: true,
    pulse: (runtime) => gainAffinity(runtime, 1)
  },
  {
    name: 'revenant.conduit-upkeep-daggers',
    accepts: (skill) => skill.id === ID.IMPOSSIBLE_ODDS,
    interval: 1,
    priority: -190,
    pulse: (runtime, skill) => lesserDaggers(runtime, skill)
  }
]);
