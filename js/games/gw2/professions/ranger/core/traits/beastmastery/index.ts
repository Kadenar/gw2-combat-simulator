import { WEAPON, RECIPIENT, ACTOR, BOON, CONDITION } from '#gw2/platform/constants.js';
import { boonKey, GW2_STANDARD_BOONS } from '#gw2/platform/combat/boons.js';
import { onTriggerPoint } from '#gw2/platform/profession-definition/trigger-rules.js';
// Profile materialization owns ordinary payload fields; local handlers retain admission and delivery context.
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { skillForEvent } from '#gw2/platform/combat/query/runtime-query.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { emitTraitProfile, invokeTraitSkill } from '#gw2/platform/profession-definition/trait-emission.js';

import { professionCoreState, readProfessionSpecializationState } from '#gw2/platform/profession-definition/state.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import type { TriggerPointInput } from '#gw2/platform/profession-definition/trigger-points.js';
import { compileProfessionRules } from '#gw2/platform/profession-definition/trigger-rules.js';
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import {
  balanceNumberFromContext,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect,
  requireSkillFromContext
} from '#gw2/platform/skills/balance-profiles.js';
import { buildRangerPacket } from '#gw2/professions/ranger/core/events.js';
import {
  castCompleted,
  commandApplied,
  mergedBeastHit,
  mergedCommandApplied,
  strike
} from '#gw2/professions/ranger/core/mechanics/trigger-points.js';
import { rangerPetCompanionId } from '#gw2/professions/ranger/core/mechanics/pet-attributes.js';
import { rangerProfileEffectRequest } from '#gw2/professions/ranger/core/mechanics/resolution-helpers.js';
import { activeBuff, beastmodeActive, rangerPetEvent } from '#gw2/professions/ranger/core/traits/modifier-queries.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import type {
  RangerResolverContext,
  RangerRuntime,
  RangerRuntimeState,
  RangerSkill
} from '#gw2/professions/ranger/types.js';

/** Owns Resounding Timbre's live tuning and trait behavior. */
export const resoundingTimbre = defineTrait({
  triggers: [
    onTriggerPoint(mergedCommandApplied, {
      run: (runtime, input: TriggerPointInput<typeof mergedCommandApplied>) =>
        applyMergedResoundingTimbre(runtime, input.skill, input.at)
    }),
    onTriggerPoint(commandApplied, {
      run: (runtime, input: TriggerPointInput<typeof commandApplied>) =>
        applyRangerCommandTraits(runtime, input.skill, input.at)
    }),
    onTriggerPoint(castCompleted, {
      when: (_runtime, input: TriggerPointInput<typeof castCompleted>) =>
        Boolean(input.skill.categories?.includes('Command')),
      run: (runtime, input: TriggerPointInput<typeof castCompleted>) =>
        applyRangerCommandTraits(runtime, input.skill, input.at)
    })
  ],
  id: TRAIT.RESOUNDING_TIMBRE,
  name: 'Resounding Timbre',
  balance: {
    duration: 2
  }
});

/** Owns Go for the Throat's live tuning and trait behavior. */
export const goForTheThroat = defineTrait({
  triggers: [
    onTriggerPoint(mergedBeastHit, {
      run: (runtime, input: TriggerPointInput<typeof mergedBeastHit>) =>
        triggerMergedGoForTheThroat(runtime, input.event)
    }),
    onTriggerPoint(strike, {
      run: (runtime, input: TriggerPointInput<typeof strike>) => triggerGoForTheThroat(runtime, input.event)
    })
  ],
  id: TRAIT.GO_FOR_THE_THROAT,
  name: 'Go for the Throat',

  modifierRules: [
    {
      order: 31,
      requiresSelection: false,
      id: 'ranger.lesser-sic-em-pet',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: (context) =>
        1 +
        Number(
          requireEffect(requireSkillFromContext(context, ID.LESSER_SIC_EM), 'buff', 'lesser-sic-em-pet')!
            .damageIncreasePerStack
        ),
      when: (context) => rangerPetEvent(context) && activeBuff(context, 'lesser-sic-em-pet')
    },
    {
      // Accepted player grants survive deselection and unmerging, within their Soulbeast owner.
      order: 103,
      requiresSelection: false,
      id: 'ranger.lesser-sic-em-player',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: (context) =>
        1 +
        Number(
          requireEffect(requireSkillFromContext(context, ID.LESSER_SIC_EM), 'buff', 'lesser-sic-em')!
            .damageIncreasePerStack
        ),
      when: (context) =>
        (context.runtime
          ? readProfessionSpecializationState(context.runtime.profession, 'Soulbeast') != null
          : context.config?.specialization === 'Soulbeast') && activeBuff(context, 'lesser-sic-em')
    }
  ]
});

/** Owns Honed Axes's live tuning and trait behavior. */
export const honedAxes = defineTrait({
  id: TRAIT.HONED_AXES,
  name: 'Honed Axes',
  balance: {
    weaponAttributeBonus: 240,
    attributeBonus: 120,
    rechargeMultiplier: 0.8
  },
  rechargeRules: [
    {
      order: 1,
      when: (_runtime, skill) => skill.weapon === WEAPON.AXE,
      multiplier: { profile: TRAIT.HONED_AXES, field: 'rechargeMultiplier' }
    }
  ],
  attributes: ({ balanceContext: profileContext, loadout, weaponSet }) => {
    const weapons = weaponSet === 2 ? loadout.alternateWeapons : loadout.weapons;
    return {
      attributeEffects: [
        {
          kind: 'flat',
          to: 'Ferocity',
          amount: balanceNumberFromContext(
            profileContext,
            TRAIT.HONED_AXES,
            weapons.includes(WEAPON.AXE) ? 'weaponAttributeBonus' : 'attributeBonus'
          ),
          feedsConversions: 'none'
        }
      ]
    };
  }
});

/** Owns Pack Alpha's live tuning and trait behavior. */
export const packAlpha = defineTrait({
  id: TRAIT.PACK_ALPHA,
  name: 'Pack Alpha',
  balance: {
    attributeBonus: 150,
    weaponAttributeBonus: 300,
    rechargeMultiplier: 0.8
  },
  rechargeRules: [
    {
      order: 5,
      when: (_runtime, skill) => Boolean(skill.petSkill),
      multiplier: { profile: TRAIT.PACK_ALPHA, field: 'rechargeMultiplier' }
    }
  ],
  attributes: ({ balanceContext, loadout, runtime }) => ({
    attributeEffects: ['Power', 'Condition Damage', 'Precision', 'Toughness', 'Vitality'].map((to) => ({
      kind: 'flat' as const,
      to,
      amount: balanceNumberFromContext(balanceContext, TRAIT.PACK_ALPHA, 'attributeBonus'),
      feedsConversions: 'none',
      enabled: runtime ? beastmodeActive({ runtime, time: 0 }) : loadout.merged
    }))
  })
});

/** Owns Pet's Prowess's live tuning and trait behavior. */
export const petsProwess = defineTrait({
  id: TRAIT.PETS_PROWESS,
  name: "Pet's Prowess",
  balance: {
    attributeBonus: 300
  },
  attributes: ({ balanceContext: profileContext, loadout, runtime }) => {
    return {
      attributeEffects: [
        {
          kind: 'flat',
          to: 'Ferocity',
          amount: balanceNumberFromContext(profileContext, TRAIT.PETS_PROWESS, 'attributeBonus'),
          feedsConversions: 'none',
          enabled: runtime ? beastmodeActive({ runtime, time: 0 }) : loadout.merged
        }
      ]
    };
  }
});

/** Owns Wilting Strike's live tuning and trait behavior. */
export const wiltingStrike = defineTrait({
  triggers: [
    onTriggerPoint(mergedBeastHit, {
      run: (runtime, input: TriggerPointInput<typeof mergedBeastHit>) =>
        triggerMergedWiltingStrike(runtime, input.event)
    })
  ],
  id: TRAIT.WILTING_STRIKE,
  name: 'Wilting Strike',
  balance: {
    effects: [{ name: CONDITION.WEAKNESS, type: 'condition', condition: CONDITION.WEAKNESS, duration: 4, stacks: 1 }]
  }
});

/** Owns Go for the Eyes's live tuning and trait behavior. */
export const goForTheEyes = defineTrait({
  triggers: [
    onTriggerPoint(mergedBeastHit, {
      run: (runtime, input: TriggerPointInput<typeof mergedBeastHit>) => triggerMergedGoForTheEyes(runtime, input.event)
    })
  ],
  id: TRAIT.GO_FOR_THE_EYES,
  name: 'Go for the Eyes',
  balance: {
    internalCooldown: 12,
    effects: [
      {
        name: 'Blind',
        type: 'condition',
        condition: CONDITION.BLINDNESS,
        stacks: 1,
        duration: 5
      }
    ]
  }
});

/** Owns Bestial Rage's live tuning and trait behavior. */
export const bestialRage = defineTrait({
  id: TRAIT.BESTIAL_RAGE,
  name: 'Bestial Rage',
  balance: {
    internalCooldown: 0.25,
    effects: [
      { name: boonKey(BOON.MIGHT), type: 'boon', boon: BOON.MIGHT, duration: 8, stacks: 5 },
      { name: boonKey(BOON.FURY), type: 'boon', boon: BOON.FURY, duration: 3, stacks: 1 }
    ]
  }
});

/** Owns the ursine and porcine pet strike bonus. */
export const beastlyWarden = defineTrait({
  id: TRAIT.BEASTLY_WARDEN,
  name: 'Beastly Warden',
  // Eligible pets snapshot this strike multiplier with their independent combat attributes.
  balance: { damageMultiplier: 1.67 }
});

/** Owns Loud Whistle's live tuning and trait behavior. */
export const loudWhistle = defineTrait({
  id: TRAIT.LOUD_WHISTLE,
  name: 'Loud Whistle',
  // Trait balance is the single tuning source for modifiers and presentation.
  balance: { damageMultiplier: 1.15, playerDamageMultiplier: 1.1 },
  modifierRules: [
    {
      order: 34,
      id: 'ranger.loud-whistle-pet',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: (context) => balanceNumberFromContext(context, TRAIT.LOUD_WHISTLE, 'damageMultiplier'),
      when: (context) => rangerPetEvent(context)
    },
    {
      // The selected Core trait grants its player bonus only during active Soulbeast merging.
      order: 100,
      id: 'ranger.loud-whistle-player',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: (context) => balanceNumberFromContext(context, TRAIT.LOUD_WHISTLE, 'playerDamageMultiplier'),
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && beastmodeActive(context)
    }
  ]
});

/** Core trait executes at Soulbeast's established control-reaction boundary. */
export const bestialRageControl = compileProfessionRules<RangerRuntimeState>({
  traitTriggers: [
    {
      trait: TRAIT.BESTIAL_RAGE,
      emit: TRAIT.BESTIAL_RAGE,
      on: 'control.resolved',
      cooldown: 'profile',
      // Only the surviving boon effects can activate this trait's control proc.
      when: (runtime) =>
        [boonKey(BOON.MIGHT), boonKey(BOON.FURY)].some((effectName) =>
          Boolean(requireEffect(requireBalanceProfileFromContext(runtime, TRAIT.BESTIAL_RAGE), 'boon', effectName))
        ),
      effects: (effect) =>
        (effect.type === 'boon' || effect.type === 'buff') &&
        (effect.name === boonKey(BOON.MIGHT) || effect.name === boonKey(BOON.FURY)),
      attribution: (_runtime, event) => ({
        skillId: TRAIT.BESTIAL_RAGE,
        skillName: 'Bestial Rage',
        name: 'Bestial Rage',
        triggeredBy: event.skillName,
        ...(event.metadata?.triggeredByAlly
          ? {
              audience: {
                recipients: RECIPIENT.PARTY,
                alliedPlayerIndex: event.metadata.triggeredByAlly,
                affectsSelf: false,
                maximumRecipients: 1,
                eligibleCompanionIds: []
              },
              metadata: { triggeredByAlly: event.metadata.triggeredByAlly }
            }
          : {})
      })
    }
  ]
}).reactions!['control.resolved']!;

// Snapshot the Ranger's configured and still-active boons at command completion,
// then mirror their current duration and stacks to the active companion only.
function applyRangerCommandTraits(
  context: RangerRuntime | RangerResolverContext,
  skill: Pick<RangerSkill, 'name'>,
  at: number
): void {
  if (!professionCoreState(context).pet) return;

  for (const kind of GW2_STANDARD_BOONS) {
    // The shared live query owns boon pools; this trait owns their unchanged-duration copy to the active pet.
    const { stacks, duration } = context.combat.boonSnapshot(kind, at, { actor: ACTOR.PLAYER });

    if (!stacks) continue;

    // Copied durations already include the original caster's boon duration.
    context.effects.emit({
      kind: 'packet',
      event: buildRangerPacket(
        {
          at,
          source: 'Trait',
          sourceId: TRAIT.RESOUNDING_TIMBRE,
          actorType: ACTOR.EFFECT,
          skillId: TRAIT.RESOUNDING_TIMBRE,
          skillName: 'Resounding Timbre',
          name: `Resounding Timbre - ${kind}`,
          kind,
          duration,
          fixedDuration: true,
          stacks,
          audience: {
            recipients: RECIPIENT.SUMMONS,
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

// A qualifying beast hit invokes the skill's companion buff with the current pet as its recipient.
function triggerGoForTheThroat(context: RangerRuntime, event: Gw2ResolverEvent): void {
  const state = professionCoreState(context);
  const skill = skillForEvent(context.helpers, event);
  const beastSkillId = state.activePetSkillIds.at(-1);

  if (event.skillId !== beastSkillId || !skill?.petSkill || skill.petFamilySkill) {
    return;
  }

  const profile = context.helpers.skillsById.get(ID.LESSER_SIC_EM)!;
  const lesserSicEm = requireEffect(profile, 'buff', 'lesser-sic-em-pet');

  // The pet cooldown gates only the pet buff, so a removed buff leaves it ready.
  if (!lesserSicEm || context.cooldownController.isOnCooldown(profile.id, context.time)) return;

  context.cooldownController.startRecharge(profile, context.time);
  const duration = effectNumber(profile, lesserSicEm, 'duration');
  context.effects.emit({
    attribution: { source: 'Trait', sourceId: TRAIT.GO_FOR_THE_THROAT, actorType: ACTOR.EFFECT },
    kind: 'announcement',
    announcement: {
      type: 'trait',
      name: 'Lesser "Sic \'Em!"',
      at: event.at,
      sourceSkill: event.skillName,
      detail: `${duration}s, +${Number((effectNumber(profile, lesserSicEm, 'damageIncreasePerStack') * 100).toFixed(6))}% pet strike damage`,
      icon: profile.icon
    }
  });
  invokeTraitSkill(context, TRAIT.GO_FOR_THE_THROAT, profile.id, event, {
    effect: { type: 'buff', name: 'lesser-sic-em-pet' },
    durationContext: event,
    attribution: {
      audience: {
        recipients: RECIPIENT.SUMMONS,
        affectsSelf: false,
        maximumRecipients: 1,
        eligibleCompanionIds: [rangerPetCompanionId(context)]
      }
    }
  });
  // Lesser Sic 'Em is a command too: its accepted proc copies boons at the beast skill's impact.
  context.fireTrigger(commandApplied, { skill: { name: 'Lesser "Sic \'Em!"' }, at: event.at });
}

/** Runs once on the accepted first hit of the merged Beast ability. */
function triggerMergedGoForTheThroat(context: RangerRuntime, event: Gw2ResolverEvent): void {
  const profile = context.helpers.skillsById.get(ID.LESSER_SIC_EM)!;
  // Merged Soulbeasts receive only the player's buff; the pet variant has no recipient here.
  const lesserSicEm = requireEffect(profile, 'buff', 'lesser-sic-em');

  if (lesserSicEm && !context.cooldownController.isOnCooldown(profile.id, context.time)) {
    context.cooldownController.startRecharge(profile, context.time);
    const duration = effectNumber(profile, lesserSicEm, 'duration');
    context.effects.emit({
      attribution: { source: 'Trait', sourceId: TRAIT.GO_FOR_THE_THROAT, actorType: ACTOR.EFFECT },
      kind: 'announcement',
      announcement: {
        type: 'trait',
        name: 'Lesser "Sic \'Em!"',
        at: event.at,
        sourceSkill: event.skillName,
        detail: `${duration}s, +${Number((effectNumber(profile, lesserSicEm, 'damageIncreasePerStack') * 100).toFixed(6))}% strike damage`,
        icon: profile.icon
      }
    });
    invokeTraitSkill(context, TRAIT.GO_FOR_THE_THROAT, profile.id, event, {
      effect: { type: 'buff', name: 'lesser-sic-em' }
    });
    context.fireTrigger(mergedCommandApplied, {
      skill: { id: ID.LESSER_SIC_EM, categories: ['Command'] },
      at: event.at
    });
  }
}

/** Runs once on the accepted first hit of the merged Beast ability. */
function triggerMergedGoForTheEyes(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  const profile = requireBalanceProfileFromContext(context, TRAIT.GO_FOR_THE_EYES);
  const blind = requireEffect(profile, 'condition', 'Blind');

  // The cooldown gates only the blind, so a removed blind leaves it ready.
  if (blind && context.procs.claim(TRAIT.GO_FOR_THE_EYES, 'ranger.soulbeast.goForTheEyes', event.at)) {
    emitTraitProfile(context, TRAIT.GO_FOR_THE_EYES, TRAIT.GO_FOR_THE_EYES, undefined, {
      at: event.at,
      fullEnd: event.at,
      effect: { type: 'condition', name: 'Blind' },
      attribution: {
        source: 'Trait',
        sourceId: TRAIT.GO_FOR_THE_EYES,
        actorType: ACTOR.EFFECT,
        ownerActorType: ACTOR.PLAYER,
        skillId: TRAIT.GO_FOR_THE_EYES,
        skillName: 'Go for the Eyes',
        triggeredBy: event.skillName
      },
      transform: (packet) => ({ ...packet, name: 'Go for the Eyes' + ' — ' + packet.condition })
    });
  }
}

/** Runs once on the accepted first hit of the merged Beast ability. */
function triggerMergedWiltingStrike(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  const profile = requireBalanceProfileFromContext(context, TRAIT.WILTING_STRIKE);
  const weakness = requireEffect(profile, 'condition', CONDITION.WEAKNESS);

  if (weakness)
    context.effects.emit(rangerProfileEffectRequest(event, profile, weakness, TRAIT.WILTING_STRIKE, 'Wilting Strike'));
}

/** Extends player boons for a completed command only at the merged Soulbeast boundary. */
function applyMergedResoundingTimbre(
  runtime: RangerRuntime | RangerResolverContext,
  skill: Pick<RangerSkill, 'id' | 'categories'>,
  at: number
): void {
  if (skill.categories?.includes('Command'))
    runtime.effects.emit({
      kind: 'packet',
      event: buildRangerPacket(
        {
          at,
          sourceId: TRAIT.RESOUNDING_TIMBRE,
          skillId: skill.id,
          skillName: 'Resounding Timbre',
          duration: balanceNumberFromContext(runtime, TRAIT.RESOUNDING_TIMBRE, 'duration')
        },
        'boon_extension'
      )
    });
}
