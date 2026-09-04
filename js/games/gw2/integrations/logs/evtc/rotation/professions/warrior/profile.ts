import type { EvtcProfessionProfileSource } from '#gw2/integrations/logs/evtc/rotation/profile-contracts.js';
import { BLADESWORN_BUFF_TRANSITIONS } from '#gw2/integrations/logs/evtc/rotation/professions/warrior/bladesworn.js';

/**
 * Adds EVTC-only Warrior evidence so Bladesworn Gunsaber buff changes become explicit bundle actions.
 */
export const warriorProfileSource: EvtcProfessionProfileSource = {
  professionId: 'warrior',
  buffTransitionsBySpecialization: {
    bladesworn: BLADESWORN_BUFF_TRANSITIONS
  }
};
