import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import { buildResolverCondition, buildResolverBuff } from '#gw2/platform/resolver/packets.js';
import { queueResolverBoon } from '#gw2/platform/resolver/boons.js';
import { consumeCharge, expireCharges } from '#gw2/platform/combat/resources/charges.js';
/** Owns Core Ranger skill-armed hit reactions that are not trait-line definitions. */
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { consumeOldestStacks } from '#gw2/platform/combat/resources/timed-stacks.js';
import {
  requireBalanceProfileFromContext,
  requireEffect,
  effectNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import { rangerPetCompanionId } from '#gw2/professions/ranger/core/mechanics/pets.js';
import {
  eventSkill,
  queueBleeding,
  stalkersStrikeTargetImpaired,
  isPetStrike,
  isPlayerStrike,
  petDerivedConditionMetadata
} from '#gw2/professions/ranger/core/mechanics/resolution-helpers.js';
import type { RangerResolverContext } from '#gw2/professions/ranger/types.js';
import { RANGER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/ranger/core/profiles.js';

export function triggerPoisonousStrikes(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  const state = professionCoreState(context);
  // Pet and merged-player routes share one grant, including its inclusive final hit.
  expireCharges(state.poisonousStrikes, event.at, true);

  if (!isPetStrike(event) || !(Number(event.coefficient) > 0)) return;
  const profile = requireBalanceProfileFromContext(context, PROFILE.poisonousStrikes);
  const poison = requireEffect(profile, 'condition', 'Poisoned');
  // The charges exist only to deliver poison, so a removed packet leaves them unspent.
  if (!poison || !consumeCharge(state.poisonousStrikes, event.at, 0, true)) return;
  context.queue.enqueue(
    buildResolverCondition({
      ...petDerivedConditionMetadata(context, event),

      at: event.at,
      source: 'ranger-pet',
      sourceId: ID.DOUBLE_ARC,
      actorType: 'summon',
      skillId: ID.DOUBLE_ARC,
      skillName: 'Poisonous Strikes',
      name: 'Poisonous Strikes - Poisoned',
      condition: String(poison.condition),
      duration: effectNumber(profile, poison, 'duration'),
      stacks: effectNumber(profile, poison, 'stacks'),
      triggeredBy: event.skillName
    })
  );
}

export function triggerSharpeningStone(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  const state = professionCoreState(context);
  const eligible = isPlayerStrike(event) && Number(event.coefficient) > 0;
  const profile = eligible ? requireBalanceProfileFromContext(context, PROFILE.sharpeningStone) : undefined;
  const bleeding = profile && requireEffect(profile, 'condition', 'Bleeding');
  // Grants sort by expiry: spend the earliest deadline, and still prune on ineligible hits. Grants exist only to
  // deliver bleeding, so a removed packet only prunes them.
  const { expiries, consumed } = consumeOldestStacks(state.sharpeningStoneExpirations, bleeding ? 1 : 0, event.at);
  state.sharpeningStoneExpirations = expiries;
  if (!consumed || !profile || !bleeding) return;
  context.queue.enqueue(
    buildResolverCondition({
      at: event.at,
      source: 'ranger',
      sourceId: ID.SHARPENING_STONE,
      actorType: 'effect',
      ownerActorType: 'player',
      skillId: ID.SHARPENING_STONE,
      skillName: 'Sharpening Stone',
      name: 'Sharpening Stone - Bleeding',
      condition: String(bleeding.condition),
      duration: effectNumber(profile, bleeding, 'duration'),
      stacks: effectNumber(profile, bleeding, 'stacks'),
      triggeredBy: event.skillName
    })
  );
}

// Mirror the active Strength of the Pack proc between Ranger and companion hits
// while enforcing its event and cooldown guards.
export function triggerStrengthOfThePack(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  if (!isPlayerStrike(event)) return;
  const active = (context.boons.get('strength-of-the-pack') || []).some(
    (application) =>
      application.resolvedAudience.includesSelf && application.at <= event.at && application.expiresAt > event.at
  );
  if (!active) return;
  const profile = requireBalanceProfileFromContext(context, PROFILE.strengthOfThePack);
  const might = requireEffect(profile, 'boon', 'might');
  if (!might) return;
  queueResolverBoon(
    context,
    event,
    buildResolverBuff({
      at: event.at,
      source: 'ranger',
      sourceId: ID.STRENGTH_OF_THE_PACK,
      actorType: 'effect',
      skillId: ID.STRENGTH_OF_THE_PACK,
      skillName: '"Strength of the Pack!"',
      name: '"Strength of the Pack!" - Might',
      kind: String(might.boon),
      duration: effectNumber(profile, might, 'duration'),
      stacks: effectNumber(profile, might, 'stacks'),
      audience: {
        recipients: 'summons' as const,
        affectsSelf: false,
        maximumRecipients: 5,
        eligibleCompanionIds: [rangerPetCompanionId(context)]
      },
      triggeredBy: event.skillName
    })
  );
}

/** Add Stalker's Strike's bonus poison only against movement-impaired targets. */
export function triggerStalkersStrike(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  const skill = eventSkill(context, event);
  if (skill?.id === ID.STALKERS_STRIKE && stalkersStrikeTargetImpaired(context.config, event.at, context)) {
    // The base packet owns its own Poison; the impaired-target profile owns only the additional application.
    const profile = requireBalanceProfileFromContext(context, PROFILE.stalkersStrikeImpaired);
    const poison = requireEffect(profile, 'condition', 'Poisoned');
    if (!poison) return;
    context.queue.enqueue(
      buildResolverCondition({
        at: event.at,
        source: 'ranger',
        sourceId: skill.id,
        actorType: 'player',
        skillId: skill.id,
        skillName: skill.name,
        name: `${skill.name} — Poisoned`,
        condition: String(poison.condition),
        duration: effectNumber(profile, poison, 'duration'),
        stacks: effectNumber(profile, poison, 'stacks'),
        activationId: event.activationId
      })
    );
  }
}

/** Consume one live Blood Thirst charge per qualifying hit, excluding its arming skill and exact expiry. */
export function triggerBloodThirst(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  const state = professionCoreState(context);
  expireCharges(state.bloodThirst, event.at);
  if (event.sourceId === ID.CRIPPLING_SHOT) return;
  const profile = requireBalanceProfileFromContext(context, PROFILE.bloodThirst);
  const bleeding = requireEffect(profile, 'condition', 'Bleeding');
  // Charges exist only to deliver bleeding, so a removed packet leaves them unspent.
  if (bleeding && consumeCharge(state.bloodThirst, event.at)) {
    queueBleeding(
      context,
      event,
      effectNumber(profile, bleeding, 'duration'),
      ID.CRIPPLING_SHOT,
      'Blood Thirst',
      effectNumber(profile, bleeding, 'stacks')
    );
  }
}
