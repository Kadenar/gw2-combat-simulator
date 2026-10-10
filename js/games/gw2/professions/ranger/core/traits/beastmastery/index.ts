import { onTriggerPoint } from '#gw2/platform/profession-definition/trigger-rules.js';
// Profile materialization owns ordinary payload fields; local handlers retain admission and delivery context.
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { GW2_STANDARD_BOONS } from '#gw2/platform/combat/boons.js';
import type { Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { skillForEvent } from '#gw2/platform/combat/query/runtime-query.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { emitTraitProfile } from '#gw2/platform/profession-definition/trait-emission.js';

import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import type { TriggerPointInput } from '#gw2/platform/profession-definition/trigger-points.js';
import { compileProfessionRules } from '#gw2/platform/profession-definition/trigger-rules.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import { buildRangerPacket } from '#gw2/professions/ranger/core/events.js';
import {
  castCompleted,
  commandApplied,
  mergedBeastHit,
  mergedCommandApplied,
  strike
} from '#gw2/professions/ranger/core/mechanics/combat.js';
import { rangerPetCompanionId } from '#gw2/professions/ranger/core/mechanics/pet-attributes.js';
import {
  rangerBuffRequest,
  rangerConditionRequest
} from '#gw2/professions/ranger/core/mechanics/resolution-helpers.js';
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
    durationMultiplier: 2
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
  balance: {
    damageMultiplier: 1.4,
    playerDamageMultiplier: 1.15,
    // This produced skill recharges with the player's Alacrity; ordinary trait ICDs remain fixed.
    cooldownPolicy: 'playerRecharge',
    cooldown: 10,
    effects: [
      {
        name: 'lesser-sic-em-pet',
        type: 'buff',
        kind: 'lesser-sic-em-pet',
        duration: 8,
        stacks: 1
      },
      { name: 'lesser-sic-em', type: 'buff', kind: 'lesser-sic-em', duration: 5, stacks: 1 }
    ]
  },
  modifierRules: [
    {
      order: 31,
      requiresSelection: false,
      id: 'ranger.lesser-sic-em-pet',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.GO_FOR_THE_THROAT), 'damageMultiplier'),
      when: (context) => rangerPetEvent(context) && activeBuff(context, 'lesser-sic-em-pet')
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
      when: (_runtime, skill) => skill.weapon === 'Axe',
      multiplier: { profile: TRAIT.HONED_AXES, field: 'rechargeMultiplier' }
    }
  ],
  attributes: ({ balanceContext: profileContext, loadout, weaponSet }) => {
    const profile = requireBalanceProfileFromContext(profileContext, TRAIT.HONED_AXES);
    const weapons = weaponSet === 2 ? loadout.alternateWeapons : loadout.weapons;
    return {
      attributeEffects: [
        {
          kind: 'flat',
          to: 'Ferocity',
          amount: balanceProfileNumber(profile, weapons.includes('Axe') ? 'weaponAttributeBonus' : 'attributeBonus'),
          feedsConversions: false
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
      amount: balanceProfileNumber(
        requireBalanceProfileFromContext(balanceContext, TRAIT.PACK_ALPHA),
        'attributeBonus'
      ),
      feedsConversions: false,
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
    const profile = requireBalanceProfileFromContext(profileContext, TRAIT.PETS_PROWESS);
    return {
      attributeEffects: [
        {
          kind: 'flat',
          to: 'Ferocity',
          amount: balanceProfileNumber(profile, 'attributeBonus'),
          feedsConversions: false,
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
    effects: [{ name: 'Weakness', type: 'condition', condition: 'Weakness', duration: 4, stacks: 1 }]
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
        condition: 'Blindness',
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
      { name: 'might', type: 'boon', boon: 'might', duration: 8, stacks: 5 },
      { name: 'fury', type: 'boon', boon: 'fury', duration: 3, stacks: 1 }
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
      factor: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.LOUD_WHISTLE), 'damageMultiplier'),
      when: (context) => rangerPetEvent(context)
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
        ['might', 'fury'].some((effectName) =>
          Boolean(requireEffect(requireBalanceProfileFromContext(runtime, TRAIT.BESTIAL_RAGE), 'boon', effectName))
        ),
      effects: (effect) =>
        (effect.type === 'boon' || effect.type === 'buff') && (effect.name === 'might' || effect.name === 'fury'),
      attribution: (_runtime, event) => ({
        skillId: TRAIT.BESTIAL_RAGE,
        skillName: 'Bestial Rage',
        name: 'Bestial Rage',
        triggeredBy: event.skillName,
        ...(event.metadata?.triggeredByAlly
          ? {
              audience: {
                recipients: 'party' as const,
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

/** Installs the Core trait at Soulbeast's existing modifier boundary. */
export const loudWhistleMergedModifier: Gw2ModifierRule = {
  order: 100,
  id: 'ranger.loud-whistle-player',
  target: MODIFIER_TARGET.STRIKE_DAMAGE,
  operation: 'multiply',
  factor: (context) =>
    balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.LOUD_WHISTLE), 'playerDamageMultiplier'),
  when: (context) =>
    isGw2PlayerModifierOwnedEvent(context.event) && beastmodeActive(context) && hasTrait(context, TRAIT.LOUD_WHISTLE)
};

/** Installs the Core trait at Soulbeast's existing modifier boundary. */
export const goForTheThroatMergedModifier: Gw2ModifierRule = {
  order: 103,
  id: 'ranger.lesser-sic-em-player',
  target: MODIFIER_TARGET.STRIKE_DAMAGE,
  operation: 'multiply',
  factor: (context) =>
    balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.GO_FOR_THE_THROAT), 'playerDamageMultiplier'),
  when: (context) => activeBuff(context, 'lesser-sic-em')
};

// Snapshot the Ranger's configured and still-active boons at command completion,
// then mirror their current duration and stacks to the active companion only.
function applyRangerCommandTraits(
  context: RangerRuntime | RangerResolverContext,
  skill: Pick<RangerSkill, 'name'>,
  at: number
): void {
  if (!professionCoreState(context).petActive) return;

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
function triggerGoForTheThroat(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  const state = professionCoreState(context);
  const skill = skillForEvent(context.helpers, event);
  const beastSkillId = state.activePetSkillIds.at(-1);
  if (event.skillId !== beastSkillId || !skill?.petSkill || skill.petFamilySkill) {
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
  emitTraitProfile(context, TRAIT.GO_FOR_THE_THROAT, TRAIT.GO_FOR_THE_THROAT, undefined, {
    at: event.at,
    fullEnd: event.at,
    effect: { type: 'buff', name: 'lesser-sic-em-pet' },
    durationContext: event,
    attribution: {
      source: 'Trait',
      sourceId: TRAIT.GO_FOR_THE_THROAT,
      actorType: 'effect',
      skillId: ID.LESSER_SIC_EM,
      skillName: 'Lesser "Sic \'Em!"',
      audience: {
        recipients: 'summons' as const,
        affectsSelf: false,
        maximumRecipients: 1,
        eligibleCompanionIds: [rangerPetCompanionId(context)]
      },
      triggeredBy: event.skillName,
      name: 'Lesser "Sic \'Em!"'
    },
    transform: (packet) => ({ ...packet, duration: duration })
  });
  // Lesser Sic 'Em is a command too: its accepted proc copies boons at the beast skill's impact.
  context.fireTrigger(commandApplied, { skill: { name: 'Lesser "Sic \'Em!"' }, at: event.at });
}

/** Runs once on the accepted first hit of the merged Beast ability. */
function triggerMergedGoForTheThroat(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  {
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
      context.fireTrigger(mergedCommandApplied, {
        skill: { id: ID.LESSER_SIC_EM, categories: ['Command'] },
        at: event.at
      });
    }
  }
}

/** Runs once on the accepted first hit of the merged Beast ability. */
function triggerMergedGoForTheEyes(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  {
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
          actorType: 'effect',
          ownerActorType: 'player',
          skillId: TRAIT.GO_FOR_THE_EYES,
          skillName: 'Go for the Eyes',
          triggeredBy: event.skillName
        },
        transform: (packet) => ({ ...packet, name: 'Go for the Eyes' + ' — ' + packet.condition })
      });
    }
  }
}

/** Runs once on the accepted first hit of the merged Beast ability. */
function triggerMergedWiltingStrike(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  {
    const profile = requireBalanceProfileFromContext(context, TRAIT.WILTING_STRIKE);
    const weakness = requireEffect(profile, 'condition', 'Weakness');
    if (weakness)
      context.effects.emit(rangerConditionRequest(event, profile, weakness, TRAIT.WILTING_STRIKE, 'Wilting Strike'));
  }
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
          duration: balanceProfileNumber(
            requireBalanceProfileFromContext(runtime, TRAIT.RESOUNDING_TIMBRE),
            'durationMultiplier'
          )
        },
        'boon_extension'
      )
    });
}
