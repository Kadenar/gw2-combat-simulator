/**
 * Owns the Core Engineer skill-handler registry and thin cast-phase routing.
 * Skill-family implementations live in their named execution or mechanic owners.
 */
import { augmentSkill, replaceSkill } from '#gw2/platform/profession-definition/mechanics.js';
import { performEngineerDodge } from '#gw2/professions/engineer/core/execution/dodge.js';
import { armSkillFlip, consumeSkillFlip } from '#gw2/platform/engine/skills/skill-flips.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { emitEngineerStateSnapshot } from '#gw2/professions/engineer/family-state.js';
import { engineerKitSkillHandlers } from '#gw2/professions/engineer/core/mechanics/kits.js';
import { armPrecombatMineField, duplicateGadgeteerMine } from '#gw2/professions/engineer/core/mechanics/mine-field.js';
import {
  scheduleConduitSurge,
  scheduleDevastatorFollowup,
  scheduleElectricArtillery,
  scheduleLightningRod,
  scheduleRoilingSkiesControl
} from '#gw2/professions/engineer/core/mechanics/spear.js';
import {
  scheduleCleansingBurstUse,
  scheduleHealingTurretCast,
  scheduleHealingTurretDetonate
} from '#gw2/professions/engineer/core/mechanics/healing-turret.js';
import { rechargeOtherSwordSkills } from '#gw2/professions/engineer/core/execution/sword.js';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import type { EngineerCastContext, EngineerSkill } from '#gw2/professions/engineer/types.js';

/** Arms a palette flip, then applies Healing Turret's own additional overcharge-cycle setup. */
function armFlipAndHealingTurretCast(context: EngineerCastContext, skill: EngineerSkill): void {
  // Raw API links also encode chains; only authored consumable palette children may be armed.
  const flip = skill.paletteFlipSkillId == null ? undefined : context.catalog.skillsById.get(skill.paletteFlipSkillId);
  if (!flip || flip.handlerId !== 'engineer.consume-flip') {
    throw new TypeError(`Engineer skill ${skill.name} requires a paletteFlipSkillId referencing a consumable flip.`);
  }

  armSkillFlip(professionCoreState(context).availableFlips, flip.id, context.effectiveEnd);
  emitEngineerStateSnapshot(context, context.effectiveEnd, 'arm-flip');
  if (skill.id === ID.HEALING_TURRET) scheduleHealingTurretCast(context, skill);
}

/** Consumes a palette flip, then applies Detonate/Cleansing Burst's additional overcharge-cycle transitions. */
function consumeFlipAndHealingTurretTransition(context: EngineerCastContext, skill: EngineerSkill): void {
  consumeSkillFlip(professionCoreState(context).availableFlips, skill.id);
  emitEngineerStateSnapshot(context, context.effectiveEnd, 'consume-flip');
  if (skill.id === ID.DETONATE_HEALING_TURRET) scheduleHealingTurretDetonate(context, skill);
  else if (skill.id === ID.CLEANSING_BURST) scheduleCleansingBurstUse(context, skill);
}

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
    afterEffects: armFlipAndHealingTurretCast
  }),
  'engineer.consume-flip': augmentSkill({
    afterEffect: duplicateGadgeteerMine,
    afterEffects: consumeFlipAndHealingTurretTransition
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
