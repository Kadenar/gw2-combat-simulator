import type { MechanicContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import { isGw2PlayerActorEvent, isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import {
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import type { NativeResolvedDamageDetails } from '#gw2/platform/profession-definition/module-types.js';
import { buildResolverCondition } from '#gw2/platform/resolver/packets.js';

import { gw2CooldownReadyAt } from '#gw2/platform/execution/cast-timing.js';
import { GUARDIAN_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/guardian/core/profiles.js';
import { permeatingWrathThreshold } from '#gw2/professions/guardian/core/traits/behavior.js';
import { GUARDIAN_SKILL_IDS } from '#gw2/professions/guardian/data/ids.js';
import type {
  GuardianResolverContext,
  GuardianResolverEvent,
  GuardianRuntimeState,
  GuardianSkill,
  GuardianVirtue
} from '#gw2/professions/guardian/types.js';

/**
 * @fileoverview Implements shared Guardian virtue validation, activation and
 * refresh events, plus the reusable resolver-time Justice burning contract.
 */

type Runtime = MechanicContext<GuardianRuntimeState, GuardianSkill>;
const VIRTUES_BY_SLOT: readonly (GuardianVirtue | null)[] = Object.freeze([null, 'justice', 'resolve', 'courage']);

/** Decodes the slot's trailing digit; each caller owns its skill eligibility checks. */
export function guardianVirtueForSlot(slot: GuardianSkill['slot']): GuardianVirtue | null {
  return VIRTUES_BY_SLOT[Number(String(slot || '').match(/(\d)$/)?.[1] || 0)] || null;
}

/**
 * Applies and records one active or passive Virtue of Justice burn.
 */
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
): void {
  const justiceProfile = requireBalanceProfileFromContext(context, PROFILE.justice);
  const burn = requireEffect(justiceProfile, 'condition', active ? 'Burning (active)' : 'Burning (passive)');
  if (!burn) return;
  const sourceId = active ? 'guardian.justice-active' : 'guardian.justice-passive';
  // Justice burns resolve immediately so passive/active counters and chained
  // condition reactions remain synchronized at the triggering hit timestamp.
  context.effects.emit({
    kind: 'packet',
    settlement: 'reaction',
    event: buildResolverCondition({
      at: event.at,
      source: 'guardian',
      sourceId,
      actorType: 'player',
      skillId,
      skillName,
      // Justice owns this proc; the activation still records which hit caused it for chronological reactions.
      procType: 'profession',
      icon: context.helpers.skillsById.get(skillId)?.icon,
      activationId: event.activationId,
      causalOrder: event.causalOrder ?? event.eventOrder,
      name: `${skillName} — ${active ? 'Active' : 'Passive'} Burning`,
      condition: String(burn.condition),
      stacks: effectNumber(justiceProfile, burn, 'stacks'),
      duration:
        !active && passiveBurnDuration != null ? passiveBurnDuration : effectNumber(justiceProfile, burn, 'duration')
    })
  });
  if (active) professionCoreState(context).justiceActiveBurns += 1;
  else professionCoreState(context).justicePassiveBurns += 1;
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
}

/** Applies Justice from canonical resolved-hit details with specialization-selected options. */
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
): void {
  // Justice counts direct and symbol packets plus Guardian effects owned by
  // the player, such as Sovereign of Light, without admitting gear procs.
  const isGuardianOwnedHit =
    isGw2PlayerActorEvent(event) || (event.source === 'guardian' && isGw2PlayerModifierOwnedEvent(event));
  if (!hitContext || !isGuardianOwnedHit || !(Number(event.coefficient) > 0)) return;

  const state = professionCoreState(context);
  if (state.justiceActiveArmed) {
    state.justiceActiveArmed = false;
    applyJusticeBurn(context, event, {
      active: true,
      skillId,
      skillName,
      passiveBurnDuration
    });
    return;
  }

  if (!retainsPassive && event.at < (state.virtueReadyAt.justice || 0)) return;

  const justiceProfile = requireBalanceProfileFromContext(context, PROFILE.justice);
  if (!requireEffect(justiceProfile, 'condition', 'Burning (passive)')) return;
  state.justiceHitCount += 1;
  const triggerHits = permeatingWrathThreshold(context, 'justice', PROFILE.justice);
  if (state.justiceHitCount < triggerHits) return;
  state.justiceHitCount = 0;
  applyJusticeBurn(context, event, {
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
/** Recharge-backed virtue projections follow the shared cast controller, including Alacrity and explicit resets. */
export function refreshGuardianVirtues(runtime: Runtime): void {
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
