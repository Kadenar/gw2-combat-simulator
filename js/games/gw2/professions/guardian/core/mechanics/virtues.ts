import { ACTOR } from '#gw2/platform/constants.js';
import { gw2CooldownReadyAt } from '#gw2/platform/combat/action-tick.js';
import { advanceCounter } from '#gw2/platform/combat/resources/counters.js';
import { isGw2PlayerActorEvent, isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { buildResolverCondition } from '#gw2/platform/effects/packet-builders.js';

import type { NativeResolvedDamageDetails } from '#gw2/platform/profession-definition/module-types.js';
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import {
  effectNumber,
  skillNumber,
  requireSkillFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import { permeatingWrathThreshold } from '#gw2/professions/guardian/core/traits/virtues/behavior.js';
import { GUARDIAN_SKILL_IDS, GUARDIAN_TRAIT_IDS } from '#gw2/professions/guardian/data/ids.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { defineTriggerPoint } from '#gw2/platform/profession-definition/trigger-points.js';
import type {
  GuardianResolverContext,
  GuardianResolverEvent,
  GuardianSkill,
  GuardianVirtue,
  GuardianRuntime
} from '#gw2/professions/guardian/types.js';

/**
 * @fileoverview Implements shared Guardian virtue validation, activation and
 * refresh events, plus the reusable resolver-time Justice burning contract.
 */

/** An accepted virtue activation; each owner has already admitted its own readiness and replacement rules. */
export interface VirtueActivation {
  readonly cast: RuntimeCast<GuardianSkill>;
  readonly virtue: GuardianVirtue;
}

/** Every accepted virtue activation, Core or elite, grants the shared virtue rewards in this order. */
export const virtueActivated = defineTriggerPoint<VirtueActivation>('guardian.virtue-activated', [
  GUARDIAN_TRAIT_IDS.INSPIRED_VIRTUE,
  GUARDIAN_TRAIT_IDS.VIRTUE_OF_RESOLUTION,
  GUARDIAN_TRAIT_IDS.INSPIRING_VIRTUE,
  GUARDIAN_TRAIT_IDS.INDOMITABLE_COURAGE,
  GUARDIAN_TRAIT_IDS.JUSTICE_IS_BLIND
]);

/** An accepted Justice activation; Dragonhunter's deferred spear supplies only the cast identity. */
export interface JusticeActivation {
  readonly cast: { readonly id: string; readonly skill: Pick<GuardianSkill, 'id' | 'name'> };
}

/**
 * Justice has its own point because Dragonhunter grants Furious Focus later than the shared virtue rewards; the other
 * owners fire it right after virtue activation.
 */
export const justiceActivated = defineTriggerPoint<JusticeActivation>('guardian.justice-activated', [
  GUARDIAN_TRAIT_IDS.FURIOUS_FOCUS
]);

const VIRTUES_BY_SLOT: readonly (GuardianVirtue | null)[] = Object.freeze([null, 'justice', 'resolve', 'courage']);

/** Decodes the slot's trailing digit; each caller owns its skill eligibility checks. */
export function guardianVirtueForSlot(slot: GuardianSkill['slot']): GuardianVirtue | null {
  return VIRTUES_BY_SLOT[Number(String(slot || '').match(/(\d)$/)?.[1] || 0)] || null;
}

/** Describe this call's emission so specialization follow-ups need no cumulative observation state. */
type JusticeBurnOutcome = 'active' | 'passive' | null;

/** Emit one Justice burn and its announcement before reporting which follow-up is eligible. */
export function applyJusticeBurn(
  context: GuardianResolverContext,
  event: GuardianResolverEvent,
  {
    active,
    skillId = GUARDIAN_SKILL_IDS.JUSTICE,
    skillName = 'Virtue of Justice',
    passiveBurnDuration
  }: {
    readonly active: boolean;
    readonly skillId?: SkillId;
    readonly skillName?: string;
    readonly passiveBurnDuration?: number;
  }
): JusticeBurnOutcome {
  const justiceSkill = requireSkillFromContext(context, GUARDIAN_SKILL_IDS.JUSTICE);
  const burn = requireEffect(justiceSkill, 'condition', active ? 'Burning (active)' : 'Burning (passive)');

  if (!burn) return null;

  const sourceId = active ? 'guardian.justice-active' : 'guardian.justice-passive';
  // Settle Burning and its chained reactions before specialization follow-ups resume on the triggering hit.
  context.effects.emit({
    kind: 'packet',
    settlement: 'reaction',
    event: buildResolverCondition({
      at: event.at,
      source: 'guardian',
      sourceId,
      actorType: ACTOR.PLAYER,
      skillId,
      skillName,
      // Justice owns this proc; the activation still records which hit caused it for chronological reactions.
      procType: 'profession',
      icon: context.helpers.skillsById.get(skillId)?.icon,
      activationId: event.activationId,
      causalOrder: event.causalOrder ?? event.eventOrder,
      name: `${skillName} — ${active ? 'Active' : 'Passive'} Burning`,
      condition: String(burn.condition),
      stacks: effectNumber(justiceSkill, burn, 'stacks'),
      duration:
        !active && passiveBurnDuration != null ? passiveBurnDuration : effectNumber(justiceSkill, burn, 'duration')
    })
  });

  // Proc rows use the owning virtue's artwork instead of the attack that triggered the burn.
  context.effects.emit({
    kind: 'announcement',
    announcement: {
      type: 'profession',
      name: active ? 'Justice Active' : 'Justice Passive',
      at: event.at,
      sourceSkill: event.skillName,
      detail: '',
      icon: context.helpers.skillsById.get(skillId)?.icon || ''
    }
  });
  return active ? 'active' : 'passive';
}

/** Apply Justice from resolved-hit details and report only the burn emitted by this hit. */
export function reactToJusticeHitWithOptions(
  context: GuardianResolverContext,
  event: GuardianResolverEvent,
  { hitContext }: Pick<NativeResolvedDamageDetails, 'hitContext'> = {},
  {
    retainsPassive = false,
    skillId = GUARDIAN_SKILL_IDS.JUSTICE,
    skillName = 'Virtue of Justice',
    passiveBurnDuration
  }: {
    readonly retainsPassive?: boolean;
    readonly skillId?: SkillId;
    readonly skillName?: string;
    readonly passiveBurnDuration?: number;
  } = {}
): JusticeBurnOutcome {
  // Justice counts direct and symbol packets plus Guardian effects owned by
  // the player, such as Sovereign of Light, without admitting gear procs.
  const isGuardianOwnedHit =
    isGw2PlayerActorEvent(event) || (event.source === 'guardian' && isGw2PlayerModifierOwnedEvent(event));

  if (!hitContext || !isGuardianOwnedHit || !(Number(event.coefficient) > 0)) return null;

  const state = professionCoreState(context);

  if (state.justiceActiveArmed) {
    state.justiceActiveArmed = false;
    return applyJusticeBurn(context, event, {
      active: true,
      skillId,
      skillName,
      passiveBurnDuration
    });
  }

  if (!retainsPassive && event.at < (state.virtueReadyAt.justice || 0)) return null;

  const justiceSkill = requireSkillFromContext(context, GUARDIAN_SKILL_IDS.JUSTICE);

  if (!requireEffect(justiceSkill, 'condition', 'Burning (passive)')) return null;

  const triggerHits = permeatingWrathThreshold(context, 'justice', skillNumber(justiceSkill, 'threshold'));
  // Reset accepted passive hit progress before burning can cause another reaction.
  const progress = advanceCounter(state.justiceHitCount, 1, triggerHits, 'reset');
  state.justiceHitCount = progress.value;

  if (!progress.reached) return null;

  return applyJusticeBurn(context, event, {
    active: false,
    skillId,
    skillName,
    passiveBurnDuration
  });
}

/** Core virtue skills and the virtue each one activates; hooks resolve completed casts through the same table. */
export const CORE_VIRTUES = [
  [GUARDIAN_SKILL_IDS.JUSTICE, 'justice'],
  [GUARDIAN_SKILL_IDS.RESOLVE, 'resolve'],
  [GUARDIAN_SKILL_IDS.COURAGE, 'courage']
] as const;
const DRAGONHUNTER_VIRTUES = [
  [GUARDIAN_SKILL_IDS.SPEAR_OF_JUSTICE, 'justice'],
  [GUARDIAN_SKILL_IDS.WINGS_OF_RESOLVE, 'resolve'],
  [GUARDIAN_SKILL_IDS.SHIELD_OF_COURAGE, 'courage']
] as const;
const WILLBENDER_VIRTUES = [
  [GUARDIAN_SKILL_IDS.RUSHING_JUSTICE, 'justice'],
  [GUARDIAN_SKILL_IDS.FLOWING_RESOLVE, 'resolve'],
  [GUARDIAN_SKILL_IDS.CRASHING_COURAGE, 'courage']
] as const;
const LUMINARY_VIRTUES = [
  [GUARDIAN_SKILL_IDS.RADIANT_JUSTICE, 'justice'],
  [GUARDIAN_SKILL_IDS.RADIANT_RESOLVE, 'resolve'],
  [GUARDIAN_SKILL_IDS.RADIANT_COURAGE, 'courage']
] as const;

const readyVirtueActivations = new WeakSet<RuntimeCast<GuardianSkill>>();

/**
 * Records at acceptance whether a virtue's recharge was ready, before the cast starts its own recharge. Only a ready
 * activation earns the shared rewards when it commits.
 */
export function admitVirtueActivation(
  runtime: GuardianRuntime,
  cast: RuntimeCast<GuardianSkill>,
  virtue: GuardianVirtue
): boolean {
  refreshGuardianVirtues(runtime);

  if (runtime.profession.core.virtueReadyAt[virtue] > runtime.time) return false;

  readyVirtueActivations.add(cast);
  return true;
}

/** A committed ready virtue grants the shared rewards; an owner that defers Justice's own point fires it later. */
export function completeVirtueActivation(
  runtime: GuardianRuntime,
  cast: RuntimeCast<GuardianSkill>,
  virtue: GuardianVirtue,
  { deferJustice = false }: { readonly deferJustice?: boolean } = {}
): void {
  refreshGuardianVirtues(runtime);

  if (!readyVirtueActivations.has(cast)) return;

  runtime.fireTrigger(virtueActivated, { cast, virtue });

  if (virtue === 'justice' && !deferJustice) runtime.fireTrigger(justiceActivated, { cast });
}

/** Recharge-backed virtue projections follow the shared cast controller, including Alacrity and explicit resets. */
export function refreshGuardianVirtues(runtime: GuardianRuntime): void {
  const kind = runtime.profession.specialization.kind;
  const virtues =
    kind === 'Core'
      ? CORE_VIRTUES
      : kind === 'Dragonhunter'
        ? DRAGONHUNTER_VIRTUES
        : kind === 'Willbender'
          ? WILLBENDER_VIRTUES
          : kind === 'Luminary'
            ? LUMINARY_VIRTUES
            : null;

  if (!virtues) return;

  runtime.cooldownController.refresh(runtime.time);
  for (const [id, virtue] of virtues)
    runtime.profession.core.virtueReadyAt[virtue] = gw2CooldownReadyAt(runtime.cooldownController.readyAt(id) ?? 0);
}
