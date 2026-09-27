import { rangerEvent } from '#gw2/professions/ranger/core/events.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import { buildResolverBuff } from '#gw2/platform/resolver/packets.js';
import { queueResolverBoon } from '#gw2/platform/resolver/boons.js';
/** Owns Core Ranger Beastmastery command and companion-attack trait behavior. */
import {
  requireBalanceProfileFromContext,
  requireEffect,
  effectNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';

import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import {
  GW2_STANDARD_BOONS,
  buffApplicationStacks,
  buffMatchesAudience,
  isDurationStackingBoon,
  remainingDurationStackSeconds,
  durationStackingBoonCapSeconds
} from '#gw2/platform/combat/boons.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import { rangerPetCompanionId } from '#gw2/professions/ranger/core/mechanics/pets.js';
import { eventSkill } from '#gw2/professions/ranger/core/mechanics/resolution-helpers.js';
import type { RangerRuntime, RangerResolverContext, RangerSkill } from '#gw2/professions/ranger/types.js';
import { RANGER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/ranger/core/profiles.js';
import { boundedNumber } from '#kernel/core/numeric.js';

// Snapshot the Ranger's configured and still-active boons at command completion,
// then mirror their current duration and stacks to the active companion only.
export function applyRangerCommandTraits(context: RangerRuntime, skill: RangerSkill): void {
  if (!professionCoreState(context).petActive || !hasTrait(context, TRAIT.RESOUNDING_TIMBRE)) return;

  for (const kind of GW2_STANDARD_BOONS) {
    const configured = context.config.boons?.[kind];
    const permanent = kind === 'might' ? boundedNumber(configured, 0, 0, 25) : configured ? 1 : 0;
    const applications = context.boons.get(kind) ?? [];
    const maximum = kind === 'might' || kind === 'stability' ? 25 : 1;
    const stacks = Math.min(
      maximum,
      permanent + buffApplicationStacks(applications, kind, context.time, maximum, { ordered: true })
    );
    if (!stacks) continue;
    // Duration boons copy their accumulated pool; intensity boons retain their longest live expiry.
    const duration =
      permanent > 0
        ? 3600
        : isDurationStackingBoon(kind)
          ? remainingDurationStackSeconds(applications, context.time, {
              includes: (application) => buffMatchesAudience(application, 'all'),
              maximum: durationStackingBoonCapSeconds(kind),
              ordered: true
            })
          : Math.max(
              0,
              ...applications
                .filter((application) => application.at <= context.time && buffMatchesAudience(application, 'all'))
                .map((application) => application.expiresAt - context.time)
            );
    context.emitProcedural(
      rangerEvent(
        {
          at: context.time,
          source: 'Trait',
          sourceId: TRAIT.RESOUNDING_TIMBRE,
          actorType: 'effect',
          skillId: TRAIT.RESOUNDING_TIMBRE,
          skillName: 'Resounding Timbre',
          name: `Resounding Timbre - ${kind}`,
          kind,
          duration,
          stacks,
          audience: {
            recipients: 'summons' as const,
            affectsSelf: false,
            maximumRecipients: 1,
            eligibleCompanionIds: [rangerPetCompanionId(context)]
          },
          triggeredBy: skill.name
        },
        'buff'
      )
    );
  }
}

// Trigger Go for the Throat from its qualifying Ranger or pet event and apply the
// profile-owned companion strike with stable ownership.
export function triggerGoForTheThroat(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  const state = professionCoreState(context);
  const skill = eventSkill(context, event);
  const beastSkillId = state.activePetSkillIds.at(-1);
  if (
    event.skillId !== beastSkillId ||
    !skill?.petSkill ||
    skill.petFamilySkill ||
    !hasTrait(context, TRAIT.GO_FOR_THE_THROAT)
  ) {
    return;
  }

  const profile = requireBalanceProfileFromContext(context, PROFILE.goForTheThroat);
  const lesserSicEm = requireEffect(profile, 'buff', 'lesser-sic-em-pet');
  // The pet cooldown gates only the pet buff, so a removed buff leaves it ready.
  if (!lesserSicEm || !context.procs.claim(PROFILE.goForTheThroat, 'ranger.core.goForTheThroatPet', event.at)) return;
  const duration = effectNumber(profile, lesserSicEm, 'duration');
  context.recordProc(
    'trait',
    'Lesser "Sic \'Em!"',
    event.at,
    event.skillName,
    `${duration}s, +40% pet strike damage`,
    context.helpers.skillsById?.get(ID.LESSER_SIC_EM)?.icon || context.helpers.skillsById?.get(ID.SIC_EM)?.icon || ''
  );
  queueResolverBoon(
    context,
    event,
    buildResolverBuff({
      at: event.at,
      source: 'Trait',
      sourceId: ID.LESSER_SIC_EM,
      actorType: 'effect',
      skillId: ID.LESSER_SIC_EM,
      skillName: 'Lesser "Sic \'Em!"',

      kind: String(lesserSicEm.kind),
      duration,
      stacks: effectNumber(profile, lesserSicEm, 'stacks'),
      audience: {
        recipients: 'summons' as const,
        affectsSelf: false,
        maximumRecipients: 1,
        eligibleCompanionIds: [rangerPetCompanionId(context)]
      },
      triggeredBy: event.skillName
    })
  );
}
