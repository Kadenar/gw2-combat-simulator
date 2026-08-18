import { augmentSkill, replaceSkill } from '../../../platform/gw2/native-profession.js';
import { performEngineerDodge } from './dodge.js';
import { engineerFlipSkillHandlers } from './flips.js';
import { engineerKitSkillHandlers } from './kits.js';
import {
  scheduleConduitSurge,
  scheduleDevastatorFollowup,
  scheduleElectricArtillery,
  scheduleLightningRod,
  scheduleRoilingSkiesControl
} from './spear.js';
import { rechargeOtherSwordSkills } from './sword.js';
import { deployEngineerTurret } from './turrets.js';

// replaceSkill: the platform has no default behavior for this handlerId — the custom handler IS the cast
// augmentSkill: platform handles the default cast lifecycle; the custom handler runs alongside it
export const engineerCoreSkillHandlers = Object.freeze({
  // dodge uses beforeEffects so endurance is deducted before any damage events fire
  'engineer.dodge': replaceSkill({ beforeEffects: performEngineerDodge }),
  'engineer.kit-equip': augmentSkill({
    afterEffects: engineerKitSkillHandlers['engineer.kit-equip']
  }),
  'engineer.kit-stow': augmentSkill({
    afterEffects: engineerKitSkillHandlers['engineer.kit-stow']
  }),
  'engineer.arm-flip': augmentSkill({
    afterEffects: engineerFlipSkillHandlers['engineer.arm-flip']
  }),
  'engineer.consume-flip': augmentSkill({
    afterEffects: engineerFlipSkillHandlers['engineer.consume-flip']
  }),
  'engineer.gleam-saber': augmentSkill({
    afterEffects: rechargeOtherSwordSkills
  }),
  'engineer.lightning-rod': replaceSkill({
    afterEffects: scheduleLightningRod
  }),
  'engineer.conduit-surge': replaceSkill({
    afterEffects: scheduleConduitSurge
  }),
  'engineer.electric-artillery': replaceSkill({
    afterEffects: scheduleElectricArtillery
  }),
  'engineer.roiling-skies': augmentSkill({
    afterEffects: scheduleRoilingSkiesControl
  }),
  'engineer.turret-deploy': replaceSkill({
    afterEffects: deployEngineerTurret
  }),
  'engineer.devastator': augmentSkill({
    afterEffects: scheduleDevastatorFollowup
  })
});
