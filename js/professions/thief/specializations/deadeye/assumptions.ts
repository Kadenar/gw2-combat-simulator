import { createProfessionAssumptionControls } from '../../../../app/profession/assumptions.js';
import { THIEF_SKILL_IDS as ID } from '../../data/ids.js';

export const THIEF_DEADEYE_ASSUMPTION_CONTROLS = createProfessionAssumptionControls([
  {
    key: 'deadeyeStolenSkillChoice',
    label: 'Deadeye stolen skill',
    type: 'select',
    // Fire for Effect ignores this choice and always grants Steal Time — see selectedDeadeyeStolenSkill in mechanics.ts
    defaultValue: 'steal-time',
    specializations: ['Deadeye'],
    options: [
      {
        value: 'steal-time',
        label: 'Steal Time (raid boss)',
        skillId: ID.STEAL_TIME
      },
      {
        value: 'steal-warmth',
        label: 'Steal Warmth',
        skillId: ID.STEAL_WARMTH
      },
      {
        value: 'steal-resistance',
        label: 'Steal Resistance',
        skillId: ID.STEAL_RESISTANCE
      },
      {
        value: 'steal-precision',
        label: 'Steal Precision',
        skillId: ID.STEAL_PRECISION
      },
      {
        value: 'steal-health',
        label: 'Steal Health',
        skillId: ID.STEAL_HEALTH
      },
      {
        value: 'steal-strength',
        label: 'Steal Strength',
        skillId: ID.STEAL_STRENGTH
      },
      {
        value: 'steal-durability',
        label: 'Steal Durability',
        skillId: ID.STEAL_DURABILITY
      },
      {
        value: 'steal-defenses',
        label: 'Steal Defenses',
        skillId: ID.STEAL_DEFENSES
      },
      {
        value: 'steal-mobility',
        label: 'Steal Mobility',
        skillId: ID.STEAL_MOBILITY
      }
    ]
  }
]);
