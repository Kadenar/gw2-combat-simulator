import type { EvtcProfessionProfileSource } from '../../profiles.js';
import { DRUID_BUFF_TRANSITIONS } from './druid.js';
import { SOULBEAST_BUFF_TRANSITIONS } from './soulbeast.js';
import { UNTAMED_BUFF_TRANSITIONS } from './untamed.js';

export const rangerProfileSource: EvtcProfessionProfileSource = {
  professionId: 'ranger',
  buffTransitionsBySpecialization: {
    druid: DRUID_BUFF_TRANSITIONS,
    soulbeast: SOULBEAST_BUFF_TRANSITIONS,
    untamed: UNTAMED_BUFF_TRANSITIONS
  }
};
