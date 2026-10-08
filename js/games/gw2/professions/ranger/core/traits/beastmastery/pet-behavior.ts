import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { GW2_STANDARD_BOONS } from '#gw2/platform/combat/boons.js';
import { skillForEvent } from '#gw2/platform/combat/query/runtime-query.js';
import { buildResolverBuff } from '#gw2/platform/effects/packet-builders.js';
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import { buildRangerPacket } from '#gw2/professions/ranger/core/events.js';
import { rangerPetCompanionId } from '#gw2/professions/ranger/core/mechanics/pet-attributes.js';
import {
  rangerBuffRequest,
  rangerConditionRequest
} from '#gw2/professions/ranger/core/mechanics/resolution-helpers.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import type { RangerResolverContext, RangerRuntime, RangerSkill } from '#gw2/professions/ranger/types.js';

// Snapshot the Ranger's configured and still-active boons at command completion,
// then mirror their current duration and stacks to the active companion only.
export function applyRangerCommandTraits(
  context: RangerRuntime | RangerResolverContext,
  skill: Pick<RangerSkill, 'name'>,
  at: number
): void {
  if (!professionCoreState(context).petActive || !hasTrait(context, TRAIT.RESOUNDING_TIMBRE)) return;

  for (const kind of GW2_STANDARD_BOONS) {
    // The shared live query owns boon pools; this trait owns their unchanged-duration copy to the active pet.
    const { stacks, duration } = context.combat.boonSnapshot(kind, at, { actor: 'player' });
    if (!stacks) continue;
    // Copied durations already include the original caster's boon duration.
    context.effects.emit({
      kind: 'packet',
      event: buildRangerPacket(
        {
          at,
          source: 'Trait',
          sourceId: TRAIT.RESOUNDING_TIMBRE,
          actorType: 'effect',
          skillId: TRAIT.RESOUNDING_TIMBRE,
          skillName: 'Resounding Timbre',
          name: `Resounding Timbre - ${kind}`,
          kind,
          duration,
          fixedDuration: true,
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
    });
  }
}

// Trigger Go for the Throat from its qualifying Ranger or pet event and apply the
// profile-owned companion strike with stable ownership.
export function triggerGoForTheThroat(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  const state = professionCoreState(context);
  const skill = skillForEvent(context.helpers, event);
  const beastSkillId = state.activePetSkillIds.at(-1);
  if (
    event.skillId !== beastSkillId ||
    !skill?.petSkill ||
    skill.petFamilySkill ||
    !hasTrait(context, TRAIT.GO_FOR_THE_THROAT)
  ) {
    return;
  }

  const profile = requireBalanceProfileFromContext(context, TRAIT.GO_FOR_THE_THROAT);
  const lesserSicEm = requireEffect(profile, 'buff', 'lesser-sic-em-pet');
  // The pet cooldown gates only the pet buff, so a removed buff leaves it ready.
  if (!lesserSicEm || !context.procs.claim(TRAIT.GO_FOR_THE_THROAT, 'ranger.core.goForTheThroatPet', event.at)) return;
  const duration = effectNumber(profile, lesserSicEm, 'duration');
  context.effects.emit({
    attribution: { source: 'Trait', sourceId: TRAIT.GO_FOR_THE_THROAT, actorType: 'effect' },
    kind: 'announcement',
    announcement: {
      type: 'trait',
      name: 'Lesser "Sic \'Em!"',
      at: event.at,
      sourceSkill: event.skillName,
      detail: `${duration}s, +40% pet strike damage`,
      icon:
        context.helpers.skillsById.get(ID.LESSER_SIC_EM)?.icon || context.helpers.skillsById.get(ID.SIC_EM)?.icon || ''
    }
  });
  context.effects.emit({
    kind: 'packet',
    event: buildResolverBuff({
      at: event.at,
      source: 'Trait',
      // The trait owns the grant while the lesser command keeps its skill identity and artwork.
      sourceId: TRAIT.GO_FOR_THE_THROAT,
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
    }),
    durationContext: event
  });
  // Lesser Sic 'Em is a command too: its accepted proc copies boons at the beast skill's impact.
  applyRangerCommandTraits(context, { name: 'Lesser "Sic \'Em!"' }, event.at);
}

/** Runs once on the accepted first hit of the merged Beast ability. */
export function triggerMergedGoForTheThroat(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  if (hasTrait(context, TRAIT.GO_FOR_THE_THROAT)) {
    const profile = requireBalanceProfileFromContext(context, TRAIT.GO_FOR_THE_THROAT);
    // Merged Soulbeasts receive only the player's buff; the pet variant has no recipient here.
    const lesserSicEm = requireEffect(profile, 'buff', 'lesser-sic-em');
    if (lesserSicEm && context.procs.claim(TRAIT.GO_FOR_THE_THROAT, 'ranger.soulbeast.goForTheThroat', event.at)) {
      const duration = effectNumber(profile, lesserSicEm, 'duration');
      context.effects.emit({
        attribution: { source: 'Trait', sourceId: TRAIT.GO_FOR_THE_THROAT, actorType: 'effect' },
        kind: 'announcement',
        announcement: {
          type: 'trait',
          name: 'Lesser "Sic \'Em!"',
          at: event.at,
          sourceSkill: event.skillName,
          detail: `${duration}s, +15% strike damage`,
          icon:
            context.helpers.skillsById.get(ID.LESSER_SIC_EM)?.icon ||
            context.helpers.skillsById.get(ID.SIC_EM)?.icon ||
            ''
        }
      });
      context.effects.emit(rangerBuffRequest(event, profile, lesserSicEm, 'Lesser "Sic \'Em!"', ID.LESSER_SIC_EM));
      applyMergedResoundingTimbre(context, { id: ID.LESSER_SIC_EM, categories: ['Command'] }, event.at);
    }
  }
}

/** Runs once on the accepted first hit of the merged Beast ability. */
export function triggerMergedGoForTheEyes(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  if (hasTrait(context, TRAIT.GO_FOR_THE_EYES)) {
    const profile = requireBalanceProfileFromContext(context, TRAIT.GO_FOR_THE_EYES);
    const blind = requireEffect(profile, 'condition', 'Blind');
    // The cooldown gates only the blind, so a removed blind leaves it ready.
    if (blind && context.procs.claim(TRAIT.GO_FOR_THE_EYES, 'ranger.soulbeast.goForTheEyes', event.at)) {
      context.effects.emit({
        kind: 'packet',
        event: {
          type: 'condition',
          condition: 'Blindness',
          stacks: effectNumber(profile, blind, 'stacks'),
          duration: effectNumber(profile, blind, 'duration'),
          at: event.at,
          source: 'Trait',
          sourceId: TRAIT.GO_FOR_THE_EYES,
          actorType: 'effect',
          ownerActorType: 'player',
          skillId: TRAIT.GO_FOR_THE_EYES,
          skillName: 'Go for the Eyes',
          triggeredBy: event.skillName
        }
      });
    }
  }
}

/** Runs once on the accepted first hit of the merged Beast ability. */
export function triggerMergedWiltingStrike(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  if (hasTrait(context, TRAIT.WILTING_STRIKE)) {
    const profile = requireBalanceProfileFromContext(context, TRAIT.WILTING_STRIKE);
    const weakness = requireEffect(profile, 'condition', 'Weakness');
    if (weakness)
      context.effects.emit(rangerConditionRequest(event, profile, weakness, TRAIT.WILTING_STRIKE, 'Wilting Strike'));
  }
}

/** Extends player boons for a completed command only at the merged Soulbeast boundary. */
export function applyMergedResoundingTimbre(
  runtime: RangerRuntime | RangerResolverContext,
  skill: Pick<RangerSkill, 'id' | 'categories'>,
  at: number
): void {
  if (skill.categories?.includes('Command') && hasTrait(runtime, TRAIT.RESOUNDING_TIMBRE))
    runtime.effects.emit({
      kind: 'packet',
      event: buildRangerPacket(
        {
          at,
          sourceId: TRAIT.RESOUNDING_TIMBRE,
          skillId: skill.id,
          skillName: 'Resounding Timbre',
          duration: balanceProfileNumber(
            requireBalanceProfileFromContext(runtime, TRAIT.RESOUNDING_TIMBRE),
            'durationMultiplier'
          )
        },
        'boon_extension'
      )
    });
}
