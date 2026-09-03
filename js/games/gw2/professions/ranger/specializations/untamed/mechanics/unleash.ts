import { balanceProfileValueFromContext } from '#gw2/platform/combat/state/balance-profiles.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers/rules.js';
import { isInternalCooldownReady } from '#kernel/core/clock.js';
import { readProfessionSpecializationState } from '#gw2/platform/engine/profession/state.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import type { AvailabilityResult } from '#gw2/platform/engine/types.js';
import { denySkillCast as deny } from '#gw2/professions/lib/availability.js';
import type { Gw2ModifierContext, Gw2ModifierRule } from '#gw2/platform/combat/modifiers/types.js';
import type {
  RangerCastContext,
  RangerPrecastContext,
  RangerSchedulerContext,
  RangerSkill
} from '#gw2/professions/ranger/types.js';
import { untamedState } from '#gw2/professions/ranger/specializations/untamed/state.js';
import { RANGER_CORE_BALANCE_PROFILE_IDS as CORE_PROFILE } from '#gw2/professions/ranger/core/profiles.js';
import { UNTAMED_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/ranger/specializations/untamed/profiles.js';

const BLINDING_OUTBURST_SKILL_IDS = new Set<number>([ID.VENOMOUS_OUTBURST, ID.RELENTLESS_WHIRL, ID.DEFT_STRIKE]);

export function untamedCastAvailability(context: RangerPrecastContext, skill: RangerSkill): AvailabilityResult {
  const state = untamedState.from(context);
  if (skill.id === ID.UNLEASH_RANGER && state.rangerUnleashed) {
    return deny(skill, 'ranger.ranger-unleashed', 'the ranger is already unleashed.');
  }

  if (skill.id === ID.UNLEASH_PET && !state.rangerUnleashed) {
    return deny(skill, 'ranger.pet-unleashed', 'the pet is already unleashed.');
  }

  if (skill.unleashedPetSkill && state.rangerUnleashed) {
    return deny(skill, 'ranger.pet-not-unleashed', 'Unleash Pet first.');
  }

  if (skill.unleashedAmbushSkill) {
    if (!state.rangerUnleashed) {
      return deny(skill, 'ranger.not-unleashed', 'Unleash Ranger first.');
    }

    // ambushReadyUntil is a deadline, not a cooldown: the window closes when time reaches it.
    if (context.start >= state.ambushReadyUntil - context.epsilon) {
      return deny(skill, 'ranger.ambush-unavailable', 'unleash to make an ambush available.');
    }
  }

  return { ready: true };
}

interface UntamedModifierState {
  readonly rangerUnleashed?: boolean;
  readonly ferociousSymbiosisPlayerStacks?: number;
  readonly ferociousSymbiosisPlayerUntil?: number;
  readonly ferociousSymbiosisPetStacks?: number;
  readonly ferociousSymbiosisPetUntil?: number;
}

function untamedModifierState(context: Gw2ModifierContext): Partial<UntamedModifierState> {
  return readProfessionSpecializationState<UntamedModifierState>(context.runtime?.profession, 'Untamed') || {};
}

function rangerUnleashed(context: Gw2ModifierContext): boolean {
  return untamedModifierState(context).rangerUnleashed === true;
}

export const untamedModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: 'ranger.vow-of-the-untamed',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'damage-additive',
    amount: 0.25,
    when: (context) =>
      isGw2PlayerModifierOwnedEvent(context.event) &&
      // Pet strikes don't benefit from Vow even when Ranger is unleashed.
      context.event?.source !== 'ranger-pet' &&
      rangerUnleashed(context) &&
      hasTrait(context, TRAIT.VOW_OF_THE_UNTAMED)
  },
  {
    id: 'ranger.blinding-outburst',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'damage-additive',
    amount: 0.25,
    when: (context) =>
      hasTrait(context, TRAIT.BLINDING_OUTBURST) &&
      BLINDING_OUTBURST_SKILL_IDS.has(Number(context.event?.skillId ?? context.skillId))
  },
  {
    id: 'ranger.ferocious-symbiosis',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    parameters: {
      baseFactor: 1,
      maximumStacks: 5,
      damagePerStack: 0.05
    } as Readonly<Record<string, number>>,
    factor: (context, _target, parameters) => {
      const state = untamedModifierState(context);
      const pet = context.event?.source === 'ranger-pet';
      // Pet strikes use Pet stacks; player strikes use Player stacks (each built by the other).
      const stacks = pet
        ? context.time < Number(state.ferociousSymbiosisPetUntil || 0)
          ? Number(state.ferociousSymbiosisPetStacks || 0)
          : 0
        : context.time < Number(state.ferociousSymbiosisPlayerUntil || 0)
          ? Number(state.ferociousSymbiosisPlayerStacks || 0)
          : 0;
      return parameters.baseFactor + Math.min(parameters.maximumStacks, stacks) * parameters.damagePerStack;
    },
    when: (context) =>
      hasTrait(context, TRAIT.FEROCIOUS_SYMBIOSIS) &&
      (isGw2PlayerModifierOwnedEvent(context.event) || context.event?.source === 'ranger-pet')
  }
]);

export const untamedAttributeRules = Object.freeze({
  modifierRules: untamedModifierRules
});
export const untamedCastRules = Object.freeze({
  availability: {
    id: 'ranger.untamed-availability',
    order: 20,
    handler: untamedCastAvailability
  },
  // Unleashed pet skills belong to Untamed's replacement bar, not the Core pet recharge contract.
  modifyRechargeDuration(context: RangerSchedulerContext & { skill?: RangerSkill }, duration: number): number {
    if (!context.skill?.petSkill || !context.skill.unleashedPetSkill || !hasTrait(context, TRAIT.PACK_ALPHA)) {
      return duration;
    }

    return (
      duration /
      Math.max(
        Number.EPSILON,
        balanceProfileValueFromContext(context, CORE_PROFILE.packAlpha, 'rechargeMultiplier', 0.8)
      )
    );
  }
});

/** Runs Untamed mechanics owned by one completed skill activation. */
export const untamedSkillMechanicHandlers = Object.freeze({
  'ranger.untamed.sync-unleash-cooldown': ({
    context,
    castStart,
    activationId
  }: {
    context: RangerSchedulerContext;
    castStart: number;
    activationId: string;
  }): void => {
    // This shared F5 recharge is fixed and therefore intentionally ignores Alacrity.
    const readyAt = castStart + balanceProfileValueFromContext(context, PROFILE.resources, 'recharge', 1);
    context.state.cooldowns.set(ID.UNLEASH_RANGER, readyAt);
    context.state.cooldowns.set(ID.UNLEASH_PET, readyAt);
    const action = context.events.find(
      (event) => event.type === 'action' && String(event.activationId || '') === activationId
    );
    if (action) context.replaceEvent(action, { rechargeReadyAt: readyAt });
  }
});

export const untamedSchedulerHooks = Object.freeze({
  // Let Loose extends the shared swap only while combat is active.
  onWeaponSwap(context: RangerCastContext): void {
    if (
      !hasTrait(context, TRAIT.LET_LOOSE) ||
      // Pre-combat weapon swaps don't trigger Let Loose; only in-combat swaps count.
      context.combatStartTime == null ||
      context.start < context.combatStartTime
    ) {
      return;
    }

    const state = untamedState.from(context);
    if (!isInternalCooldownReady(context.start, state.letLooseReadyAt)) return;
    const profileId = PROFILE.letLoose;
    state.letLooseReadyAt = context.start + balanceProfileValueFromContext(context, profileId, 'internalCooldown', 9);
    // Weapon swap resets Unleashed Power so the next Unleash Ranger re-opens an ambush window.
    state.unleashedPowerReadyAt = 0;
    if (state.rangerUnleashed) {
      // Weapon-swap ambush window is counted from effectiveEnd (post-cast), not cast start.
      state.ambushReadyUntil =
        context.effectiveEnd + balanceProfileValueFromContext(context, PROFILE.resources, 'durationMultiplier', 4);
    }
  }
});
