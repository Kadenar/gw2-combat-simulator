import {
  createProfessionAssumptionControls,
  STANDARD_POSITION_ASSUMPTION_CONTROLS
} from '../../../app/profession/assumptions.js';
import { THIEF_SKILL_IDS as ID } from '../data/ids.js';

const THIEF_SHARED_ASSUMPTION_CONTROLS = STANDARD_POSITION_ASSUMPTION_CONTROLS.filter(
  (control) => !['playerHealthPercent', 'targetDistance'].includes(control.key)
);

export const THIEF_CORE_ASSUMPTION_CONTROLS = createProfessionAssumptionControls([
  ...THIEF_SHARED_ASSUMPTION_CONTROLS,
  {
    key: 'stolenSkillChoice',
    label: 'Stolen skill',
    type: 'select',
    defaultValue: 'throw-gunk',
    specializations: ['Core', 'Daredevil'],
    options: [
      {
        value: 'throw-gunk',
        label: 'Throw Gunk (raid golem)',
        skillId: ID.THROW_GUNK
      },
      {
        value: 'consume-plasma',
        label: 'Consume Plasma',
        skillId: ID.CONSUME_PLASMA
      },
      {
        value: 'whirling-axe',
        label: 'Whirling Axe',
        skillId: ID.WHIRLING_AXE
      }
    ]
  }
]);
