import { professionStaticRulesApplied } from '#gw2/platform/builds/attribute-provenance.js';
import { GW2_STANDARD_BOONS } from '#gw2/platform/combat/boons.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import type { Gw2NumericStatKey } from '#gw2/platform/combat/query/combat-query.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import { buildResolverBuff } from '#gw2/platform/resolver/packets.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import { buildRangerPacket } from '#gw2/professions/ranger/core/events.js';
import { rangerPetBaseAttributes } from '#gw2/professions/ranger/core/mechanics/pet-profiles.js';
import { rangerPetCompanionId } from '#gw2/professions/ranger/core/mechanics/pets.js';
import { rangerPetByName } from '#gw2/professions/ranger/core/state.js';
import {
  eventSkill,
  rangerBuffRequest,
  rangerConditionRequest
} from '#gw2/professions/ranger/core/mechanics/resolution-helpers.js';
import { weaponSetIncludes } from '#gw2/professions/ranger/core/traits/modifier-queries.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import type {
  RangerModifierContext,
  RangerResolverContext,
  RangerRuntime,
  RangerSkill
} from '#gw2/professions/ranger/types.js';

/** Owns Core Ranger Beastmastery command and companion-attack trait behavior. */

/** Snapshot the family-specific strike bonus so launched pet attacks retain it across swaps. */
export function beastlyWardenPetDamageMultiplier(context: RangerRuntime | RangerResolverContext): number {
  const family = rangerPetByName(professionCoreState(context).activePet).family;
  return hasTrait(context, TRAIT.BEASTLY_WARDEN) && (family === 'ursine' || family === 'porcine')
    ? balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.BEASTLY_WARDEN), 'damageMultiplier')
    : 1;
}

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
