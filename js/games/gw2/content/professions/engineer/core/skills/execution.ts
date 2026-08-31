import { emitSkillCondition, emitSkillDamage } from '#gw2/platform/scheduler/skill-events.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { augmentSkill, replaceSkill } from '#gw2/integrations/patches/authoring/mechanics.js';
import { ENGINEER_SKILL_IDS as ID, ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/content/professions/engineer/data/ids.js';
import { performEngineerDodge } from '#gw2/content/professions/engineer/core/skills/dodge.js';
import { engineerFlipSkillHandlers } from '#gw2/content/professions/engineer/core/skills/flips.js';
import { engineerKitSkillHandlers } from '#gw2/content/professions/engineer/core/mechanics/kits.js';
import {
  scheduleConduitSurge,
  scheduleDevastatorFollowup,
  scheduleElectricArtillery,
  scheduleLightningRod,
  scheduleRoilingSkiesControl
} from '#gw2/content/professions/engineer/core/skills/spear.js';
import { rechargeOtherSwordSkills } from '#gw2/content/professions/engineer/core/skills/sword.js';
import { applyEngineerToolbeltTraits } from '#gw2/content/professions/engineer/core/traits/index.js';
import { deployEngineerTurret } from '#gw2/content/professions/engineer/core/mechanics/turrets.js';
import type { SchedulerRecord, SimulationEvent } from '#gw2/platform/engine/types.js';
import type {
  EngineerCastContext,
  EngineerSchedulerContext,
  EngineerSkill
} from '#gw2/content/professions/engineer/types.js';

/** Emits every authored Mine Field damage and condition packet at a shared detonation time. */
function emitMineField(
  context: EngineerSchedulerContext,
  skill: EngineerSkill,
  at: number,
  activationId: string
): void {
  // Precast fields keep their authored packet profile but move every mine to the combat boundary.
  const strike = skill.effects?.find((effect) => effect.type === 'strike') as SchedulerRecord | undefined;
  if (strike) {
    emitSkillDamage(context, skill, {
      at,
      activationId,
      coefficient: Number(strike.coefficient || 0),
      hits: Number(strike.hits || 1),
      name: String(strike.name || skill.name),
      actorType: 'player',
      metadata: strike.metadata as SchedulerRecord | undefined
    });
  }

  const condition = skill.effects?.find((effect) => effect.type === 'condition') as SchedulerRecord | undefined;
  const applications = Array.isArray(condition?.ticks) ? condition.ticks : condition ? [condition] : [];
  for (const application of applications as SchedulerRecord[]) {
    emitSkillCondition(context, skill, {
      at,
      activationId,
      condition: String(application.condition || ''),
      stacks: Number(application.stacks || 1),
      duration: Number(application.duration || 0),
      actorType: 'player'
    });
  }
}

/** Defers a precast Mine Field until combat start or applies its immediate detonation traits. */
function armPrecombatMineField(context: EngineerCastContext): void {
  if (context.hasExplicitCombatStart && context.combatStartTime == null) {
    professionCoreState(context).pendingMineFieldActivationIds.push(context.reservationId);
    return;
  }

  // An active Mine Field auto-detonates as its second toolbelt activation, so toolbelt traits fire again.
  const detonation = context.catalog.skillsById.get(ID.DETONATE_MINE_FIELD) as EngineerSkill | undefined;
  if (detonation) applyEngineerToolbeltTraits(context, detonation, context.effectiveEnd);
}

/** Adds Gadgeteer's bonus mine to a qualifying Detonate damage event. */
function duplicateGadgeteerMine(context: EngineerCastContext, skill: EngineerSkill, event: SimulationEvent): void {
  if (skill.id !== ID.DETONATE || event.type !== 'damage' || !hasTrait(context.config, TRAIT.GADGETEER)) return;
  // The added mine needs a separate combo attempt while sharing the original Detonate activation.
  const comboFinishers = Array.isArray(event.comboFinishers)
    ? (event.comboFinishers as SchedulerRecord[]).map((finisher) => ({
        ...finisher,
        attemptGroup: 'gadgeteer-mine'
      }))
    : undefined;
  emitSkillDamage(context, skill, {
    at: event.at,
    coefficient: Number(event.coefficient || 0),
    name: event.name,
    actorType: 'player',
    skillWeapon: String(event.skillWeapon || 'Unequipped'),
    metadata: {
      damageKind: event.damageKind,
      comboFinishers
    }
  });
}

/** Detonates Mine Fields held during precast when the explicit combat-start event arrives. */
export function observeEngineerMineFieldEvent(context: EngineerSchedulerContext, event: SimulationEvent): void {
  if (event.type !== 'combat_start') return;
  const state = professionCoreState(context);
  const pending = state.pendingMineFieldActivationIds.splice(0);
  const skill = context.catalog.skillsById.get(ID.MINE_FIELD) as EngineerSkill | undefined;
  const detonation = context.catalog.skillsById.get(ID.DETONATE_MINE_FIELD) as EngineerSkill | undefined;
  if (!skill || !detonation) return;
  for (const activationId of pending) {
    emitMineField(context, skill, event.at, activationId);
    // A precast field performs its second toolbelt activation only when combat lets the mines detonate.
    applyEngineerToolbeltTraits(context, detonation, event.at);
  }
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
    afterEffects: engineerFlipSkillHandlers['engineer.arm-flip']
  }),
  'engineer.consume-flip': augmentSkill({
    afterEffect: duplicateGadgeteerMine,
    afterEffects: engineerFlipSkillHandlers['engineer.consume-flip']
  }),
  'engineer.mine-field': augmentSkill({
    // A precast field replaces normal emission so its packets can move to the combat boundary.
    resolveMode: (context: EngineerCastContext) =>
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
  'engineer.turret-deploy': replaceSkill({
    afterEffects: deployEngineerTurret
  }),
  'engineer.devastator': augmentSkill({
    afterEffects: scheduleDevastatorFollowup
  })
});
