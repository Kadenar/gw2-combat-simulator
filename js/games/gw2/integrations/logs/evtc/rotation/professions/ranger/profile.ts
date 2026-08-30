import type { EvtcProfessionProfileSource } from '#gw2/integrations/logs/evtc/rotation/profiles.js';
import { DRUID_BUFF_TRANSITIONS } from '#gw2/integrations/logs/evtc/rotation/professions/ranger/druid.js';
import { SOULBEAST_BUFF_TRANSITIONS } from '#gw2/integrations/logs/evtc/rotation/professions/ranger/soulbeast.js';
import { UNTAMED_BUFF_TRANSITIONS } from '#gw2/integrations/logs/evtc/rotation/professions/ranger/untamed.js';

export const rangerProfileSource: EvtcProfessionProfileSource = {
  professionId: 'ranger',
  buffTransitionsBySpecialization: {
    druid: DRUID_BUFF_TRANSITIONS,
    soulbeast: SOULBEAST_BUFF_TRANSITIONS,
    untamed: UNTAMED_BUFF_TRANSITIONS
  }
};
