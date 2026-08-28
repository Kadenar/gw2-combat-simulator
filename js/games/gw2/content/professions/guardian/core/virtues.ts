import { professionCoreState } from '../../../../platform/engine/profession/state.js';
/**
 * @fileoverview Implements shared Guardian virtue validation, activation and
 * refresh events, plus the reusable resolver-time Justice burning contract.
 */

import {
  isGw2PlayerActorEvent,
  isGw2PlayerModifierOwnedEvent
} from '../../../../platform/combat/state/event-ownership.js';
import { hasTrait } from '../../../../platform/combat/state/traits.js';
import { GUARDIAN_SKILL_IDS, GUARDIAN_TRAIT_IDS } from '../data/ids.js';
import { emitGuardianEvent } from './events.js';
import { GUARDIAN_CORE_BALANCE_PROFILE_IDS as PROFILE, guardianBalanceProfile } from './profiles.js';
import type { SkillId } from '../../../../platform/engine/types.js';
import type {
  GuardianCastContext,
  GuardianResolverContext,
  GuardianResolverEvent,
  GuardianSkill,
  GuardianVirtue
} from '../types.js';

interface JusticeHitDependencies {
  readonly hitContext?: object;
}

const VIRTUES_BY_SLOT: readonly (GuardianVirtue | null)[] = Object.freeze([null, 'justice', 'resolve', 'courage']);

/**
 * Activates the virtue represented by the skill's profession slot and emits
 * the neutral resolver transition decorated by active elite modules.
 *
 * @param {GuardianCastContext} context Skill-handler context.
 * @param {GuardianSkill} skill Virtue skill.
 * @returns {boolean} False when the virtue was handled; false also rejects an
 * unrecognized profession slot without emitting a transition.
 */
function activateVirtue(context: GuardianCastContext, skill: GuardianSkill): boolean {
  const slot = Number(String(skill.slot || '').match(/(\d)$/)?.[1] || 0);
  const virtue = VIRTUES_BY_SLOT[slot];
  if (!virtue) return false;
  const state = professionCoreState(context);
  state.lastVirtue = virtue;
  state.lastVirtuePassiveWasReady = Number(state.virtueReadyAt[virtue] || 0) <= context.effectiveEnd + context.epsilon;
  const passiveReadyAt = context.rechargeReadyAt ?? context.effectiveEnd;
  emitGuardianEvent(context, skill, 'guardian.virtue-activated', {
    virtue,
    passiveReadyAt,
    // Radiant Justice's activation-generated Sovereign and symbol packets hit
    // before its passive is disabled, matching their EVTC ordering.
    ...(skill.id === GUARDIAN_SKILL_IDS.RADIANT_JUSTICE ? { priority: 10 } : {})
  });
  state.virtueReadyAt[virtue] = passiveReadyAt;
  return false;
}

/**
 * Clears all Guardian virtue cooldowns after Renewed Focus completes and emits
 * a resolver refresh event.
 *
 * @param {GuardianCastContext} context Skill-handler context.
 * @param {GuardianSkill} skill Renewed Focus skill.
 * @returns {boolean} Always true because this replacing handler owns the cast.
 */
function renewedFocus(context: GuardianCastContext, skill: GuardianSkill): boolean {
  if (context.effectiveEnd < context.fullEnd - context.epsilon) return true;
  for (const virtue of context.catalog.skills.filter(
    (candidate) => candidate.categories?.includes('Virtue') && /^Profession_[1-3]$/.test(String(candidate.slot || ''))
  )) {
    context.state.cooldowns.delete(virtue.id);
  }

  emitGuardianEvent(context, skill, 'guardian.virtues-refreshed');
  return true;
}

/**
 * Raw virtue callbacks consumed by the central handler registry.
 */
export const guardianVirtueSkillHandlers = Object.freeze({
  'guardian.virtue': activateVirtue,
  'guardian.renewed-focus': renewedFocus
});

/**
 * Replays a Core virtue activation into resolver state.
 *
 * @param {GuardianResolverContext} context Resolver event-handler context.
 * @param {GuardianResolverEvent} event Virtue-activated timeline event.
 * @returns {void}
 */
export function handleVirtueActivation(context: GuardianResolverContext, event: GuardianResolverEvent): void {
  const virtue = event.virtue;
  if (!virtue) return;
  professionCoreState(context).virtueReadyAt[virtue] = Number(event.passiveReadyAt || event.at);
  if (virtue === 'justice' && event.skillId === GUARDIAN_SKILL_IDS.JUSTICE) {
    professionCoreState(context).justiceActiveArmed = true;
    professionCoreState(context).justiceArmed = true;
  }
}

/**
 * Marks all resolver-side virtue passives ready at the refresh timestamp.
 *
 * @param {GuardianResolverContext} context Resolver event-handler context.
 * @param {GuardianResolverEvent} event Virtues-refreshed timeline event.
 * @returns {void}
 */
export function handleVirtueRefresh(context: GuardianResolverContext, event: GuardianResolverEvent): void {
  professionCoreState(context).virtueReadyAt = {
    justice: event.at,
    resolve: event.at,
    courage: event.at
  };
}

/**
 * Applies and records one active or passive Virtue of Justice burn.
 *
 * @param {GuardianResolverContext} context Resolver reaction context.
 * @param {GuardianResolverEvent} event Damage event that triggered Justice.
 * @param {{ readonly active: boolean }} options Justice trigger options.
 * @returns {void}
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
  const justice = guardianBalanceProfile(context, PROFILE.justice);
  const burn = justice?.effects?.find(
    (effect) => effect.type === 'condition' && effect.packetLabel === (active ? 'active' : 'passive')
  );
  const sourceId = active ? 'guardian.justice-active' : 'guardian.justice-passive';
  // Justice burns resolve immediately so passive/active counters and chained
  // condition reactions remain synchronized at the triggering hit timestamp.
  context.applyCondition({
    type: 'condition',
    at: event.at,
    source: 'guardian',
    sourceId,
    actorType: 'player',
    skillId,
    skillName,
    name: `${skillName} — ${active ? 'Active' : 'Passive'} Burning`,
    condition: String(burn?.condition || 'Burning'),
    stacks: Number(burn?.stacks || 1),
    duration: Number(
      !active && passiveBurnDuration != null ? passiveBurnDuration : burn?.duration || (active ? 2 : 1.2)
    )
  });
  professionCoreState(context).justiceBurns += 1;
  if (active) professionCoreState(context).justiceActiveBurns += 1;
  else professionCoreState(context).justicePassiveBurns += 1;
  context.recordProc('profession', active ? 'Justice Active' : 'Justice Passive', event.at, event.skillName);
}

/** Applies the shared Justice hit contract with specialization-selected options. */
export function reactToJusticeHitWithOptions(
  context: GuardianResolverContext,
  event: GuardianResolverEvent,
  { hitContext }: JusticeHitDependencies = {},
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
    state.justiceArmed = false;
    applyJusticeBurn(context, event, {
      active: true,
      skillId,
      skillName,
      passiveBurnDuration
    });
    return;
  }

  if (!retainsPassive && event.at < Number(state.virtueReadyAt.justice || 0)) return;

  state.justiceHitCount += 1;
  const triggerHits = Number(
    hasTrait(context, GUARDIAN_TRAIT_IDS.PERMEATING_WRATH)
      ? guardianBalanceProfile(context, PROFILE.permeatingWrath)?.threshold || 3
      : guardianBalanceProfile(context, PROFILE.justice)?.threshold || 5
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
