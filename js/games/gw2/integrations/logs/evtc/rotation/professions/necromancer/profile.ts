import type { EvtcProfessionProfileSource } from '#gw2/integrations/logs/evtc/rotation/profile-contracts.js';
import { HARBINGER_BUFF_TRANSITIONS } from '#gw2/integrations/logs/evtc/rotation/professions/necromancer/harbinger.js';
import { REAPER_BUFF_TRANSITIONS } from '#gw2/integrations/logs/evtc/rotation/professions/necromancer/reaper.js';
import { RITUALIST_BUFF_TRANSITIONS } from '#gw2/integrations/logs/evtc/rotation/professions/necromancer/ritualist.js';

export const necromancerProfileSource: EvtcProfessionProfileSource = {
  professionId: 'necromancer',
  buffTransitions: [
    {
      buffSkillId: 72976,
      loss: { name: 'Distress', skillId: 73116 },
      lossRequiresRemainingDuration: true,
      suppressWeaponSwap: false
    }
  ],
  buffTransitionsBySpecialization: {
    reaper: REAPER_BUFF_TRANSITIONS,
    harbinger: HARBINGER_BUFF_TRANSITIONS,
    ritualist: RITUALIST_BUFF_TRANSITIONS
  },
  initialSummons: [
    {
      agentSpeciesId: 1104,
      action: { name: 'Summon Blood Fiend', skillId: 10547 }
    },
    {
      agentSpeciesId: 1792,
      action: { name: 'Summon Flesh Golem', skillId: 10646 }
    },
    {
      agentSpeciesId: 1458,
      action: { name: 'Summon Bone Fiend', skillId: 10533 }
    },
    {
      agentSpeciesId: 1192,
      action: { name: 'Summon Bone Minions', skillId: 10541 }
    },
    {
      agentSpeciesId: 6002,
      action: { name: 'Summon Flesh Wurm', skillId: 10543 }
    },
    {
      agentSpeciesId: 5673,
      action: { name: 'Summon Shadow Fiend', skillId: 10589 }
    }
  ]
};
