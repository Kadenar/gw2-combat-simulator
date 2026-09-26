import { buildResolverCondition } from '#gw2/platform/resolver/packets.js';
import {
  requireBalanceProfileFromContext,
  requireEffect,
  effectNumber,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
/**
 * @fileoverview Implements shared Guardian virtue validation, activation and
 * refresh events, plus the reusable resolver-time Justice burning contract.
 */
import { isGw2PlayerActorEvent, isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { GUARDIAN_SKILL_IDS, GUARDIAN_TRAIT_IDS } from '#gw2/professions/guardian/data/ids.js';
import { GUARDIAN_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/guardian/core/profiles.js';
import type { NativeResolvedDamageDetails } from '#gw2/platform/profession-definition/module-types.js';
import type { SkillId } from '#gw2/platform/engine/skills/types.js';
import type {
  GuardianResolverContext,
  GuardianResolverEvent,
  GuardianSkill,
  GuardianVirtue
} from '#gw2/professions/guardian/types.js';

const VIRTUES_BY_SLOT: readonly (GuardianVirtue | null)[] = Object.freeze([null, 'justice', 'resolve', 'courage']);

/** Decodes the slot's trailing digit; each caller owns its skill eligibility checks. */
export function guardianVirtueForSlot(slot: GuardianSkill['slot']): GuardianVirtue | null {
  return VIRTUES_BY_SLOT[Number(String(slot || '').match(/(\d)$/)?.[1] || 0)] || null;
}

/**
 * Applies and records one active or passive Virtue of Justice burn.
 */
function applyJusticeBurn(
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
  context.applyCondition(
    buildResolverCondition({
      at: event.at,
      source: 'guardian',
      sourceId,
      actorType: 'player',
      skillId,
      skillName,
      // The burn belongs to the actual triggering hit, even when that hit came from a delayed activation.
      activationId: event.activationId,
      causalOrder: event.causalOrder ?? event.eventOrder,
      name: `${skillName} — ${active ? 'Active' : 'Passive'} Burning`,
      condition: String(burn.condition),
      stacks: effectNumber(justiceProfile, burn, 'stacks'),
      duration: Number(
        !active && passiveBurnDuration != null ? passiveBurnDuration : effectNumber(justiceProfile, burn, 'duration')
      )
    })
  );
  if (active) professionCoreState(context).justiceActiveBurns += 1;
  else professionCoreState(context).justicePassiveBurns += 1;
  // Proc rows use the owning virtue's artwork instead of the attack that triggered the burn.
  context.recordProc(
    'profession',
    active ? 'Justice Active' : 'Justice Passive',
    event.at,
    event.skillName,
    '',
    context.helpers.skillsById?.get(skillId)?.icon || ''
  );
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

  if (!retainsPassive && event.at < Number(state.virtueReadyAt.justice || 0)) return;

  const justiceProfile = requireBalanceProfileFromContext(context, PROFILE.justice);
  if (!requireEffect(justiceProfile, 'condition', 'Burning (passive)')) return;
  state.justiceHitCount += 1;
  const triggerHits = balanceProfileNumber(
    requireBalanceProfileFromContext(
      context,
      hasTrait(context, GUARDIAN_TRAIT_IDS.PERMEATING_WRATH) ? PROFILE.permeatingWrath : PROFILE.justice
    ),
    'threshold'
  );
  if (state.justiceHitCount < triggerHits) return;
  state.justiceHitCount = 0;
  applyJusticeBurn(context, event, {
    active: false,
    skillId,
    skillName,
    passiveBurnDuration
  });
}
