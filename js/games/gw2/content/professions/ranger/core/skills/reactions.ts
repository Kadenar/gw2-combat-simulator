/** Owns Core Ranger skill-armed hit reactions that are not trait-line definitions. */
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { enqueueOrdered } from '#kernel/events/queue.js';
import { gw2ResolverBoonDuration } from '#gw2/platform/resolver/boon-duration.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/content/professions/ranger/data/ids.js';
import { rangerPetCompanionId } from '#gw2/content/professions/ranger/core/mechanics/pets.js';
import {
  isPetStrike,
  isPlayerStrike,
  petDerivedConditionMetadata
} from '#gw2/content/professions/ranger/core/mechanics/resolution-helpers.js';
import type { RangerResolverContext, RangerResolverEvent } from '#gw2/content/professions/ranger/types.js';
import {
  rangerBalanceProfile,
  rangerBalanceProfileEffect,
  RANGER_CORE_BALANCE_PROFILE_IDS as PROFILE
} from '#gw2/content/professions/ranger/core/profiles.js';

function profileEffect(context: unknown, id: number | string, type: string, index = 0) {
  return rangerBalanceProfileEffect(rangerBalanceProfile(context, id), type, index);
}

export function triggerPoisonousStrikes(context: RangerResolverContext, event: RangerResolverEvent): void {
  const state = professionCoreState(context);
  if (event.at > state.poisonousStrikesExpiresAt) {
    state.poisonousStrikesCharges = 0;
  }

  if (state.poisonousStrikesCharges <= 0 || !isPetStrike(event) || !(Number(event.coefficient) > 0)) {
    return;
  }

  state.poisonousStrikesCharges -= 1;
  const poison = profileEffect(context, PROFILE.poisonousStrikes, 'condition');
  enqueueOrdered(context.queue, {
    ...petDerivedConditionMetadata(context, event),
    type: 'condition',
    at: event.at,
    source: 'ranger-pet',
    sourceId: ID.DOUBLE_ARC,
    actorType: 'summon',
    skillId: ID.DOUBLE_ARC,
    skillName: 'Poisonous Strikes',
    name: 'Poisonous Strikes - Poisoned',
    condition: 'Poisoned',
    duration: Number(poison?.duration ?? 6),
    stacks: Number(poison?.stacks ?? 1),
    triggeredBy: event.skillName
  });
}

export function triggerSharpeningStone(context: RangerResolverContext, event: RangerResolverEvent): void {
  const state = professionCoreState(context);
  if (event.at > state.sharpeningStoneExpiresAt) {
    state.sharpeningStoneCharges = 0;
  }

  if (state.sharpeningStoneCharges <= 0 || !isPlayerStrike(event) || !(Number(event.coefficient) > 0)) {
    return;
  }

  state.sharpeningStoneCharges -= 1;
  const bleeding = profileEffect(context, PROFILE.sharpeningStone, 'condition');
  enqueueOrdered(context.queue, {
    type: 'condition',
    at: event.at,
    source: 'ranger',
    sourceId: ID.SHARPENING_STONE,
    actorType: 'effect',
    ownerActorType: 'player',
    skillId: ID.SHARPENING_STONE,
    skillName: 'Sharpening Stone',
    name: 'Sharpening Stone - Bleeding',
    condition: 'Bleeding',
    duration: Number(bleeding?.duration ?? 8),
    stacks: Number(bleeding?.stacks ?? 1),
    triggeredBy: event.skillName
  });
}

// Mirror the active Strength of the Pack proc between Ranger and companion hits
// while enforcing its event and cooldown guards.
export function triggerStrengthOfThePack(context: RangerResolverContext, event: RangerResolverEvent): void {
  if (!isPlayerStrike(event)) return;
  const active = (context.boons.get('strength-of-the-pack') || []).some(
    (application) => application.affectsSelf !== false && application.at <= event.at && application.expiresAt > event.at
  );
  if (!active) return;
  const might = profileEffect(context, PROFILE.strengthOfThePack, 'boon');
  enqueueOrdered(context.queue, {
    type: 'buff',
    at: event.at,
    source: 'ranger',
    sourceId: ID.STRENGTH_OF_THE_PACK,
    actorType: 'effect',
    skillId: ID.STRENGTH_OF_THE_PACK,
    skillName: '"Strength of the Pack!"',
    name: '"Strength of the Pack!" - Might',
    kind: String(might?.boon || 'might'),
    duration: gw2ResolverBoonDuration(context, event, String(might?.boon || 'might'), Number(might?.duration ?? 8)),
    stacks: Number(might?.stacks ?? 1),
    affectsSelf: false,
    affectsSummons: true,
    maximumRecipients: 5,
    companionIds: [rangerPetCompanionId(context)],
    triggeredBy: event.skillName
  });
}
