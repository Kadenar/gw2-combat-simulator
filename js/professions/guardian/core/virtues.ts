import { professionCoreState } from '../../../platform/engine/profession/state.js';
/**
 * @fileoverview Implements shared Guardian virtue validation, activation and
 * refresh events, plus the reusable resolver-time Justice burning contract.
 */

import { isGw2PlayerActorEvent } from '../../../platform/gw2/event-ownership.js';
import { hasTrait } from '../../../platform/gw2/trait-state.js';
import { GUARDIAN_SKILL_IDS, GUARDIAN_TRAIT_IDS } from '../data/ids.js';
import { emitGuardianEvent } from './events.js';
import { GUARDIAN_CORE_BALANCE_PROFILE_IDS as PROFILE, guardianBalanceProfile } from './profiles.js';
import type { SkillId } from '../../../platform/engine/types.js';
import type { Gw2ConditionResolution } from '../../../platform/gw2/types.js';
import type {
  GuardianCastContext,
  GuardianPrecastContext,
  GuardianResolverContext,
  GuardianResolverEvent,
  GuardianSkill,
  GuardianVirtue
} from '../types.js';

interface JusticeHitDependencies {
  readonly hitContext?: object;
  readonly applyCondition?: Gw2ConditionResolution['applyCondition'];
}

const VIRTUES_BY_SLOT: readonly (GuardianVirtue | null)[] = Object.freeze([null, 'justice', 'resolve', 'courage']);

/**
 * Allows only the F1-F3 virtue variants belonging to the selected
 * specialization. Non-virtue skills return no opinion.
 *
 * @param {GuardianPrecastContext} context Cast-validation context.
 * @param {GuardianSkill} skill Candidate skill.
 * @returns {boolean|undefined} Whether the relevant virtue is valid.
 */
export function validateVirtueCast(context: GuardianPrecastContext, skill: GuardianSkill): boolean | undefined {
  if (!skill.categories?.includes('Virtue') || !/^Profession_[1-3]$/.test(String(skill.slot || ''))) return;
  return true;
}

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
    passiveReadyAt
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
 * @param {Gw2ConditionResolution["applyCondition"]} applyCondition Condition
 * application helper.
 * @param {{ readonly active: boolean }} options Justice trigger options.
 * @returns {void}
 */
function applyJusticeBurn(
  context: GuardianResolverContext,
  event: GuardianResolverEvent,
  applyCondition: Gw2ConditionResolution['applyCondition'],
  {
    active,
    skillId = GUARDIAN_SKILL_IDS.JUSTICE,
    skillName = 'Virtue of Justice'
  }: {
    readonly active: boolean;
    readonly skillId?: SkillId;
    readonly skillName?: string;
  }
): void {
  const justice = guardianBalanceProfile(context, PROFILE.justice);
  const burn = justice?.effects?.find(
    (effect) => effect.type === 'condition' && effect.packetLabel === (active ? 'active' : 'passive')
  );
  const sourceId = active ? 'guardian.justice-active' : 'guardian.justice-passive';
  applyCondition(context, {
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
    duration: Number(burn?.duration || (active ? 2 : 1.2))
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
  { hitContext, applyCondition }: JusticeHitDependencies = {},
  {
    retainsPassive = false,
    skillId = GUARDIAN_SKILL_IDS.JUSTICE,
    skillName = 'Virtue of Justice'
  }: {
    readonly retainsPassive?: boolean;
    readonly skillId?: SkillId;
    readonly skillName?: string;
  } = {}
): void {
  if (
    !hitContext ||
    typeof applyCondition !== 'function' ||
    !isGw2PlayerActorEvent(event) ||
    !(Number(event.coefficient) > 0)
  )
    return;

  const state = professionCoreState(context);
  if (state.justiceActiveArmed) {
    state.justiceActiveArmed = false;
    state.justiceArmed = false;
    applyJusticeBurn(context, event, applyCondition, {
      active: true,
      skillId,
      skillName
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
  applyJusticeBurn(context, event, applyCondition, {
    active: false,
    skillId,
    skillName
  });
}
