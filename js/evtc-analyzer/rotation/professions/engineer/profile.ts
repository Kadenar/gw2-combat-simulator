import type { ProfessionProfileSource } from '../../profiles.js';

export const engineerProfileSource: ProfessionProfileSource = {
  id: 'engineer',
  name: 'Engineer',
  specializations: {
    core: 'Core',
    scrapper: 'Scrapper',
    holosmith: 'Holosmith',
    mechanist: 'Mechanist',
    amalgam: 'Amalgam'
  },
  // Passive damage packets, trait procs, effect children, and automatic Overheat
  // are not player inputs. Specialization modules reconstruct the owning actions.
  ignoredInstantSkillIds: [29889, 41612, 43630, 43937, 45119, 59562, 70303, 76640, 77104, 77163],
  inferCombatStartFromFirstCast: true
};
