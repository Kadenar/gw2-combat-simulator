import type { ProfessionProfileSource } from '../../profiles.js';
import { SPECTER_BUFF_TRANSITIONS } from './specter.js';

export const thiefProfileSource: ProfessionProfileSource = {
  id: 'thief',
  name: 'Thief',
  specializations: {
    core: 'Core',
    daredevil: 'Daredevil',
    deadeye: 'Deadeye',
    specter: 'Specter',
    antiquary: 'Antiquary'
  },
  buffTransitionsBySpecialization: {
    specter: SPECTER_BUFF_TRANSITIONS
  }
};
