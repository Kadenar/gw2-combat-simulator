import type { EvtcProfessionProfileSource } from '#gw2/integrations/logs/evtc/rotation/profiles.js';
import { LUMINARY_BUFF_TRANSITIONS } from '#gw2/integrations/logs/evtc/rotation/professions/guardian/luminary.js';

export const guardianProfileSource: EvtcProfessionProfileSource = {
  professionId: 'guardian',
  // Willbender Flames are passive virtue damage packets rather than player
  // inputs. Their Arc skill IDs can otherwise look like instant casts.
  ignoredInstantSkillIds: [62528, 62618, 62552],
  buffTransitionsBySpecialization: {
    luminary: LUMINARY_BUFF_TRANSITIONS
  }
};
