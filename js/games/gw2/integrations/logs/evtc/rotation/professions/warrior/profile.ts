import type { EvtcProfessionProfileSource } from '../../profiles.js';
import { BLADESWORN_BUFF_TRANSITIONS } from './bladesworn.js';

/**
 * Adds EVTC-only Warrior evidence so Bladesworn Gunsaber buff changes become explicit bundle actions.
 */
export const warriorProfileSource: EvtcProfessionProfileSource = {
  professionId: 'warrior',
  buffTransitionsBySpecialization: {
    bladesworn: BLADESWORN_BUFF_TRANSITIONS
  }
};
