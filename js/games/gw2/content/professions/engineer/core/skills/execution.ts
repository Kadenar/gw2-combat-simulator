/**
 * Owns the Core Engineer skill-handler registry and thin cast-phase routing.
 * Skill-family implementations live in their named execution or mechanic owners.
 */
import { augmentSkill, replaceSkill } from '#gw2/integrations/patches/authoring/mechanics.js';
import { performEngineerDodge } from '#gw2/content/professions/engineer/core/skills/dodge.js';
import { engineerFlipSkillHandlers } from '#gw2/content/professions/engineer/core/mechanics/skill-flips.js';
import { engineerKitSkillHandlers } from '#gw2/content/professions/engineer/core/mechanics/kits.js';
import {
  armPrecombatMineField,
  duplicateGadgeteerMine
} from '#gw2/content/professions/engineer/core/skills/mine-field-execution.js';
import {
  scheduleConduitSurge,
  scheduleDevastatorFollowup,
  scheduleElectricArtillery,
  scheduleLightningRod,
  scheduleRoilingSkiesControl
} from '#gw2/content/professions/engineer/core/mechanics/spear.js';
import { rechargeOtherSwordSkills } from '#gw2/content/professions/engineer/core/skills/sword-execution.js';

// replaceSkill: the platform has no default behavior for this handlerId — the custom handler IS the cast
// augmentSkill: platform handles the default cast lifecycle; the custom handler runs alongside it
/** Maps Core Engineer handler IDs to replacement or augmentation phases in the cast lifecycle. */
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
    afterEffect: duplicateGadgeteerMine,
    afterEffects: engineerFlipSkillHandlers['engineer.consume-flip']
  }),
  'engineer.mine-field': augmentSkill({
    // A precast field replaces normal emission so its packets can move to the combat boundary.
    resolveMode: (context) =>
      context.hasExplicitCombatStart && context.combatStartTime == null ? 'replace' : 'augment',
    afterEffects: armPrecombatMineField
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
  'engineer.devastator': augmentSkill({
    afterEffects: scheduleDevastatorFollowup
  })
});
