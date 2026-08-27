import type { EvtcProfessionProfileSource } from '../../profiles.js';
import { SPECTER_BUFF_TRANSITIONS } from './specter.js';

export const thiefProfileSource: EvtcProfessionProfileSource = {
  professionId: 'thief',
  buffTransitionsBySpecialization: {
    specter: SPECTER_BUFF_TRANSITIONS
  }
};
