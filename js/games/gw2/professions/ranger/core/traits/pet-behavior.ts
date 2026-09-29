import { professionStaticRulesApplied } from '#gw2/platform/builds/attribute-provenance.js';
import {
  buffApplicationStacks,
  buffMatchesAudience,
  durationStackingBoonCapSeconds,
  GW2_STANDARD_BOONS,
  isDurationStackingBoon,
  remainingDurationStackSeconds
} from '#gw2/platform/combat/boons.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import type { Gw2NumericStatKey } from '#gw2/platform/combat/query/combat-query.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { queueResolverBoon } from '#gw2/platform/resolver/boons.js';
import { buildResolverBuff } from '#gw2/platform/resolver/packets.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import { rangerEvent } from '#gw2/professions/ranger/core/events.js';
import { rangerPetBaseAttributes } from '#gw2/professions/ranger/core/mechanics/pet-profiles.js';
import { rangerPetCompanionId } from '#gw2/professions/ranger/core/mechanics/pets.js';
import {
  eventSkill,
  queueProfileBuff,
  queueProfileCondition
} from '#gw2/professions/ranger/core/mechanics/resolution-helpers.js';
import { weaponSetIncludes } from '#gw2/professions/ranger/core/traits/modifier-queries.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import type {
  RangerModifierContext,
  RangerResolverContext,
  RangerRuntime,
  RangerSkill
} from '#gw2/professions/ranger/types.js';
import { boundedNumber } from '#kernel/core/numeric.js';

/** Owns Core Ranger Beastmastery command and companion-attack trait behavior. */

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

  const profile = requireBalanceProfileFromContext(context, TRAIT.GO_FOR_THE_THROAT);
  const lesserSicEm = requireEffect(profile, 'buff', 'lesser-sic-em-pet');
  // The pet cooldown gates only the pet buff, so a removed buff leaves it ready.
  if (!lesserSicEm || !context.procs.claim(TRAIT.GO_FOR_THE_THROAT, 'ranger.core.goForTheThroatPet', event.at)) return;
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

/** Reconciles the live weapon bonus against the calculated weapon baseline. */
export function honedAxesAttributeDelta(context: Gw2ModifierContext): number {
  if (!hasTrait(context, TRAIT.HONED_AXES)) return 0;
  const activeSet = Number(context.runtime?.activeWeaponSet) === 2 ? 2 : 1;
  const calculatedWeaponSet = Number(context.config?.attributeProvenance?.calculatedWeaponSet) === 2 ? 2 : 1;
  const profile = requireBalanceProfileFromContext(context, TRAIT.HONED_AXES);
  return (
    balanceProfileNumber(
      profile,
      weaponSetIncludes(context, activeSet, ['Axe']) ? 'weaponAttributeBonus' : 'attributeBonus'
    ) -
    (professionStaticRulesApplied(context.config)
      ? balanceProfileNumber(
          profile,
          weaponSetIncludes(context, calculatedWeaponSet, ['Axe']) ? 'weaponAttributeBonus' : 'attributeBonus'
        )
      : 0)
  );
}

/** Adds the trait's independent-pet attributes before packets snapshot them. */
export function applyPackAlphaPet(
  context: RangerRuntime | RangerResolverContext,
  attributes: {
    -readonly [K in keyof ReturnType<typeof rangerPetBaseAttributes>]: ReturnType<typeof rangerPetBaseAttributes>[K];
  }
): void {
  if (hasTrait(context, TRAIT.PACK_ALPHA)) {
    const packAlphaProfile = requireBalanceProfileFromContext(context, TRAIT.PACK_ALPHA);
    const bonus = balanceProfileNumber(packAlphaProfile, 'weaponAttributeBonus');
    attributes.power += bonus;
    attributes.precision += bonus;
    attributes.toughness += bonus;
    attributes.vitality += bonus;
    attributes.conditionDamage += bonus;
  }
}

/** Adds the trait's independent-pet attributes before packets snapshot them. */
export function applyHonedAxesPet(
  context: RangerRuntime | RangerResolverContext,
  attributes: {
    -readonly [K in keyof ReturnType<typeof rangerPetBaseAttributes>]: ReturnType<typeof rangerPetBaseAttributes>[K];
  }
): void {
  if (hasTrait(context, TRAIT.HONED_AXES)) {
    const honedAxesProfile = requireBalanceProfileFromContext(context, TRAIT.HONED_AXES);
    attributes.ferocity += balanceProfileNumber(honedAxesProfile, 'attributeBonus');
  }
}

/** Adds the trait's independent-pet attributes before packets snapshot them. */
export function applyPetsProwessPet(
  context: RangerRuntime | RangerResolverContext,
  attributes: {
    -readonly [K in keyof ReturnType<typeof rangerPetBaseAttributes>]: ReturnType<typeof rangerPetBaseAttributes>[K];
  }
): void {
  if (hasTrait(context, TRAIT.PETS_PROWESS)) {
    const petsProwessProfile = requireBalanceProfileFromContext(context, TRAIT.PETS_PROWESS);
    attributes.ferocity += balanceProfileNumber(petsProwessProfile, 'attributeBonus');
  }
}

/** Pet autonomous recharge uses Pack Alpha at scheduling, before action-rate scaling. */
export function packAlphaPetRecharge(context: RangerRuntime): number {
  return hasTrait(context, TRAIT.PACK_ALPHA)
    ? balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.PACK_ALPHA), 'rechargeMultiplier')
    : 1;
}

/** Reconciles the merged trait bonus at Soulbeast's existing static/live boundary. */
export function applyPackAlphaMerged(
  context: RangerModifierContext,
  adjust: (attribute: Gw2NumericStatKey, amount: number) => void,
  direction: number
): void {
  if (hasTrait(context, TRAIT.PACK_ALPHA)) {
    for (const attribute of PACK_ALPHA_RUNTIME_ATTRIBUTES) {
      const packAlphaProfile = requireBalanceProfileFromContext(context, TRAIT.PACK_ALPHA);
      adjust(attribute, direction * balanceProfileNumber(packAlphaProfile, 'attributeBonus'));
    }
  }
}

/** Reconciles the merged trait bonus at Soulbeast's existing static/live boundary. */
export function applyPetsProwessMerged(
  context: RangerModifierContext,
  adjust: (attribute: Gw2NumericStatKey, amount: number) => void,
  direction: number
): void {
  if (hasTrait(context, TRAIT.PETS_PROWESS)) {
    const petsProwessProfile = requireBalanceProfileFromContext(context, TRAIT.PETS_PROWESS);
    adjust('ferocity', direction * balanceProfileNumber(petsProwessProfile, 'attributeBonus'));
  }
}

const PACK_ALPHA_RUNTIME_ATTRIBUTES = ['power', 'conditionDamage', 'precision', 'toughness', 'vitality'] as const;

/** Runs once on the accepted first hit of the merged Beast ability. */
export function triggerMergedGoForTheThroat(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  if (hasTrait(context, TRAIT.GO_FOR_THE_THROAT)) {
    const profile = requireBalanceProfileFromContext(context, TRAIT.GO_FOR_THE_THROAT);
    // Merged Soulbeasts receive only the player's buff; the pet variant has no recipient here.
    const lesserSicEm = requireEffect(profile, 'buff', 'lesser-sic-em');
    if (lesserSicEm && context.procs.claim(TRAIT.GO_FOR_THE_THROAT, 'ranger.soulbeast.goForTheThroat', event.at)) {
      const duration = effectNumber(profile, lesserSicEm, 'duration');
      context.recordProc(
        'trait',
        'Lesser "Sic \'Em!"',
        event.at,
        event.skillName,
        `${duration}s, +15% strike damage`,
        context.helpers.skillsById?.get(ID.LESSER_SIC_EM)?.icon ||
          context.helpers.skillsById?.get(ID.SIC_EM)?.icon ||
          ''
      );
      queueProfileBuff(context, event, profile, lesserSicEm, 'Lesser "Sic \'Em!"', ID.LESSER_SIC_EM);
    }
  }
}

/** Runs once on the accepted first hit of the merged Beast ability. */
export function triggerMergedGoForTheEyes(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  if (hasTrait(context, TRAIT.GO_FOR_THE_EYES)) {
    const profile = requireBalanceProfileFromContext(context, TRAIT.GO_FOR_THE_EYES);
    const blind = requireEffect(profile, 'blind', 'Blind');
    // The cooldown gates only the blind, so a removed blind leaves it ready.
    if (blind && context.procs.claim(TRAIT.GO_FOR_THE_EYES, 'ranger.soulbeast.goForTheEyes', event.at)) {
      context.queue.enqueue({
        type: 'blind',
        at: event.at,
        source: 'Trait',
        sourceId: TRAIT.GO_FOR_THE_EYES,
        actorType: 'effect',
        skillId: TRAIT.GO_FOR_THE_EYES,
        skillName: 'Go for the Eyes',
        duration: effectNumber(profile, blind, 'duration'),
        triggeredBy: event.skillName
      });
    }
  }
}

/** Runs once on the accepted first hit of the merged Beast ability. */
export function triggerMergedWiltingStrike(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  if (hasTrait(context, TRAIT.WILTING_STRIKE)) {
    const profile = requireBalanceProfileFromContext(context, TRAIT.WILTING_STRIKE);
    const weakness = requireEffect(profile, 'condition', 'Weakness');
    if (weakness) queueProfileCondition(context, event, profile, weakness, TRAIT.WILTING_STRIKE, 'Wilting Strike');
  }
}

/** Extends player boons for a completed command only at the merged Soulbeast boundary. */
export function applyMergedResoundingTimbre(runtime: RangerRuntime, skill: RangerSkill): void {
  if (skill.categories?.includes('Command') && hasTrait(runtime, TRAIT.RESOUNDING_TIMBRE))
    runtime.emit(
      rangerEvent(
        {
          at: runtime.time,
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
    );
}
