import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import { buildResolverCondition, buildResolverBuff } from '#gw2/platform/resolver/packets.js';

/** Owns Core Ranger skill-armed hit reactions that are not trait-line definitions. */

import {
  requireBalanceProfileFromContext,
  requireEffect,
  effectNumber
} from '#gw2/platform/skills/balance-profiles.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import { rangerPetCompanionId } from '#gw2/professions/ranger/core/mechanics/pets.js';
import { isPlayerStrike } from '#gw2/professions/ranger/core/mechanics/resolution-helpers.js';
import type { RangerResolverContext } from '#gw2/professions/ranger/types.js';
import { RANGER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/ranger/core/profile-ids.js';

// Mirror the active Strength of the Pack proc between Ranger and companion hits
// while enforcing its event and cooldown guards.
export function triggerStrengthOfThePack(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  if (!isPlayerStrike(event)) return;
  // Only the Ranger's own live Strength of the Pack window arms the proc.
  const kind = 'strength-of-the-pack';
  if (context.combat.activeBuffStacks(kind, event.at, 1) === 0) return;
  const profile = requireBalanceProfileFromContext(context, PROFILE.strengthOfThePack);
  const might = requireEffect(profile, 'boon', 'might');
  if (!might) return;
  context.effects.emit({
    kind: 'packet',
    event: buildResolverBuff({
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
    }),
    durationContext: event
  });
}

/** Add Stalker's Strike's bonus poison only against movement-impaired targets. */
export function triggerStalkersStrike(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  const skill = context.helpers.skillsById.get(event.skillId!)!;
  // The base packet owns its own Poison; the impaired-target profile owns only the additional application.
  const profile = requireBalanceProfileFromContext(context, PROFILE.stalkersStrikeImpaired);
  const poison = requireEffect(profile, 'condition', 'Poisoned');
  if (!poison) return;
  context.effects.emit({
    kind: 'packet',
    event: buildResolverCondition({
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
  });
}
