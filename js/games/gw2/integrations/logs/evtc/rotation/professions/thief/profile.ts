import type { EvtcProfessionProfileSource } from '#gw2/integrations/logs/evtc/rotation/profile-contracts.js';
import { SPECTER_BUFF_TRANSITIONS } from '#gw2/integrations/logs/evtc/rotation/professions/thief/specter.js';

export const thiefProfileSource: EvtcProfessionProfileSource = {
  professionId: 'thief',
  buffTransitionsBySpecialization: {
    specter: SPECTER_BUFF_TRANSITIONS
  }
};
