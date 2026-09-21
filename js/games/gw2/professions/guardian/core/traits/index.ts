import { EPSILON } from '#kernel/core/clock.js';
import { balanceProfileFromContext, balanceProfileEffect } from '#gw2/platform/engine/skills/balance-profiles.js';
import { emitSkillBuff } from '#gw2/platform/execution/gw2-policy/skill-events.js';
import { GUARDIAN_SKILL_IDS, GUARDIAN_TRAIT_IDS } from '#gw2/professions/guardian/data/ids.js';
import { isInternalCooldownReady } from '#kernel/core/clock.js';
import { isGw2PlayerActorEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import type { NativeResolvedDamageDetails } from '#gw2/platform/profession-definition/module-types.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { gw2SchedulerBoonDuration } from '#gw2/platform/execution/gw2-policy/policy.js';
import { GUARDIAN_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/guardian/core/profiles.js';
import { applyWritOfPersistence } from '#gw2/professions/guardian/core/traits/honor.js';
import {
  applyFuriousFocus,
  applySymbolicExposure,
  reactToZealotsResolution,
  reactToZealSymbolTraits
} from '#gw2/professions/guardian/core/traits/zeal.js';
import {
  applyIndomitableCourage,
  applyInspiredVirtue,
  applyInspiringVirtue,
  applyMasterOfConsecrations,
  applyVirtueOfResolution,
  replaceVirtueOfResolutionDuration
} from '#gw2/professions/guardian/core/traits/virtues.js';
import {
  applyHealersResolution,
  handleRighteousInstinctsTick,
  reactToRighteousInstincts
} from '#gw2/professions/guardian/core/traits/radiance.js';
import {
  emitGuardianProc,
  guardianResolverState,
  guardianTraitIcon,
  isGuardianSymbolSkill
} from '#gw2/professions/guardian/core/traits/shared.js';
import type {
  GuardianCastContext,
  GuardianResolverContext,
  GuardianResolverEvent,
  GuardianSchedulerContext,
  GuardianSkill
} from '#gw2/professions/guardian/types.js';

export { emitGuardianProc, guardianTraitIcon, isGuardianSymbolSkill, handleRighteousInstinctsTick };

/** Preserves Core Guardian's mixed trait and base-skill execution order behind one public dispatcher. */
export function updateGuardianTraitCastState(context: GuardianCastContext, skill: GuardianSkill): void {
  // Only committed casts create trait effects; other lifecycle hooks still handle cancelled attempts.
  if (context.action.cancelled) return;

  const at = context.effectiveEnd;
  applyHealersResolution(context, skill, at);
  applyWritOfPersistence(context, skill);

  if (skill.id === GUARDIAN_SKILL_IDS.SYMBOL_OF_IGNITION) {
    const field = balanceProfileEffect(balanceProfileFromContext(context, PROFILE.symbolOfIgnition), 'buff');
    const duration = Number(field?.duration ?? 4);
    context.replaceEvent(context.action, {
      comboFields: [
        {
          ownerId: 'guardian',
          fieldType: 'Light',
          duration,
          startAnchor: 'castEnd'
        }
      ]
    });
    context.emit({
      type: 'guardian.symbol-of-ignition-field',
      at: context.effectiveEnd,
      source: 'guardian',
      sourceId: skill.id,
      actorType: 'effect',
      skillId: skill.id,
      skillName: skill.name,
      duration
    });
  }

  if (skill.id === GUARDIAN_SKILL_IDS.PURGING_FLAMES) {
    const durationMultiplier = Number(
      balanceProfileFromContext(context, PROFILE.masterOfConsecrations)?.durationMultiplier ?? 1.4
    );
    context.replaceEvent(context.action, {
      comboFields: [
        {
          ownerId: 'guardian',
          fieldType: 'Fire',
          duration: hasTrait(context, GUARDIAN_TRAIT_IDS.MASTER_OF_CONSECRATIONS) ? 5 * durationMultiplier : 5,
          startAnchor: 'castEnd'
        }
      ]
    });
  }

  let virtueSlot = skill.categories?.includes('Virtue') ? String(skill.slot || '') : '';
  // Virtue activation traits only trigger when the passive was ready before
  // the activation disabled it; repeat activations cannot retrigger them.
  if (virtueSlot && !professionCoreState(context).lastVirtuePassiveWasReady) virtueSlot = '';
  if (virtueSlot) {
    applyInspiredVirtue(context, skill, virtueSlot, at);
    applyVirtueOfResolution(context, skill, at);
    applyInspiringVirtue(context, skill, at);
    applyIndomitableCourage(context, skill, virtueSlot, at);
  }

  applyFuriousFocus(context, skill, virtueSlot, at);
  applyMasterOfConsecrations(context, skill);
}

export function handleSymbolOfIgnitionField(context: GuardianResolverContext, event: GuardianResolverEvent): void {
  const state = guardianResolverState(context);
  state.symbolIgnitionStartsAt = event.at;
  state.symbolIgnitionUntil = event.at + Number(event.duration ?? 4);
}

// Symbol hits and projectile hits have independent ignition cooldowns. Torch pulses
// and fire-whirl bolts also ignite, but ordinary conditions and ignition itself do not.
export function reactToSymbolOfIgnition(context: GuardianResolverContext, event: GuardianResolverEvent): void {
  const profile = balanceProfileFromContext(context, PROFILE.symbolOfIgnition);
  const burning = balanceProfileEffect(profile, 'condition');
  const burningBolt =
    event.type === 'condition' &&
    event.condition === 'Burning' &&
    !!event.comboId &&
    event.fieldType === 'Fire' &&
    event.finisherType === 'Whirl';
  const torchPulse =
    event.type === 'condition' && event.condition === 'Burning' && event.skillId === GUARDIAN_SKILL_IDS.ZEALOTS_FLAME;
  if (
    !isGw2PlayerActorEvent(event) ||
    !((event.type === 'damage' && Number(event.coefficient || 0) > 0) || burningBolt || torchPulse) ||
    event.skillId === GUARDIAN_SKILL_IDS.SYMBOL_OF_IGNITION
  ) {
    return;
  }

  const state = guardianResolverState(context);
  if (
    Number(state.symbolIgnitionUntil || 0) <= Number(state.symbolIgnitionStartsAt || 0) ||
    event.at < Number(state.symbolIgnitionStartsAt || 0) - EPSILON ||
    event.at > Number(state.symbolIgnitionUntil || 0) + EPSILON
  ) {
    return;
  }

  const projectile = event.projectile === true || burningBolt;
  const cooldownKey = projectile ? 'symbolProjectileIgnitionReadyAt' : 'symbolIgnitionReadyAt';
  // Match gw2combat's end-of-tick cooldown removal: the deadline itself is still blocked.
  if (!isInternalCooldownReady(event.at, state[cooldownKey])) return;

  state[cooldownKey] = event.at + Number(profile?.internalCooldown ?? 0.24);
  context.queue.enqueue({
    type: 'condition',
    at: event.at,
    priority: 5,
    source: 'guardian',
    sourceId: GUARDIAN_SKILL_IDS.SYMBOL_OF_IGNITION,
    actorType: 'player',
    skillId: GUARDIAN_SKILL_IDS.SYMBOL_OF_IGNITION,
    skillName: 'Symbol of Ignition',
    name: 'Symbol of Ignition — Ignition',
    condition: String(burning?.condition || 'Burning'),
    stacks: Number(burning?.stacks ?? 1),
    duration: Number(burning?.duration ?? 1),
    triggeredBy: event.skillName,
    projectile
  });
}

// Normalize Resolution duration before it enters the queue, then decorate
// canonical symbol packets with scheduler-owned trait effects.
export function observeGuardianScheduledEvent(context: GuardianSchedulerContext, event: GuardianResolverEvent): void {
  if (replaceVirtueOfResolutionDuration(context, event)) return;
  if (event.type !== 'damage') return;

  const skillId = event.skillId;
  const skill = skillId == null ? undefined : context.catalog.skillsById.get(skillId);
  if (!(event.isSymbol || isGuardianSymbolSkill(skill, event.skillName))) return;

  applySymbolicExposure(context, event);

  if (skillId === GUARDIAN_SKILL_IDS.SYMBOL_OF_RESOLUTION) {
    const sourceSkill =
      skill ||
      ({
        id: GUARDIAN_SKILL_IDS.SYMBOL_OF_RESOLUTION,
        name: event.skillName || 'Symbol of Resolution'
      } as GuardianSkill);
    emitSkillBuff(context, {
      at: event.at,
      source: 'guardian',
      sourceId: skillId,
      actorType: 'player',
      skillId,
      skillName: event.skillName,
      kind: 'resolution',
      stacks: 1,
      duration: gw2SchedulerBoonDuration(context, sourceSkill, 'resolution', 1)
    });
  }
}

export function reactToGuardianDamageTraits(
  context: GuardianResolverContext,
  event: GuardianResolverEvent,
  details: NativeResolvedDamageDetails = {}
): void {
  reactToSymbolOfIgnition(context, event);
  reactToZealSymbolTraits(context, event);
  reactToZealotsResolution(context, event, details.hitContext?.damage ?? 0);
}

export function reactToGuardianBuffTraits(context: GuardianResolverContext, event: GuardianResolverEvent): void {
  reactToRighteousInstincts(context, event);
}
