import { ACTOR, CONDITION } from '#gw2/platform/constants.js';
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { isGw2PlayerActorEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { missesTarget } from '#gw2/platform/combat/state/targets.js';
import type { EffectDelivery } from '#gw2/platform/effects/emission.js';
import { buildResolverCondition } from '#gw2/platform/effects/packet-builders.js';
import type { ConditionEffect, StrikeTick } from '#gw2/platform/effects/types.js';
import type { SimulationEvent } from '#gw2/platform/events/events.js';
import { GW2_QUICKNESS_ACTION_RATE } from '#gw2/platform/execution/cast-timing.js';
import type { MaximumAmmoContext } from '#gw2/platform/profession-definition/runtime-context.js';
import { emitTraitProfile } from '#gw2/platform/profession-definition/trait-emission.js';
import type { TraitDefinition } from '#gw2/platform/profession-definition/traits.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import type { TriggerPointInput } from '#gw2/platform/profession-definition/trigger-points.js';
import { compileRechargeRules, onTriggerPoint } from '#gw2/platform/profession-definition/trigger-rules.js';
import {
  balanceNumberFromContext,
  skillNumber,
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import { mesmerConditionApplied } from '#gw2/professions/mesmer/core/mechanics/trigger-points.js';
import { illusionSource, timedStacks } from '#gw2/professions/mesmer/core/mechanics/modifier-queries.js';
import { buildMesmerConditions, mesmerPacketOwner } from '#gw2/professions/mesmer/core/mechanics/packets.js';
import { mesmerShatterResolved } from '#gw2/professions/mesmer/core/mechanics/profession-actions.js';
import { mesmerIllusionsGained } from '#gw2/professions/mesmer/core/mechanics/resources.js';
import type { MesmerShatterResolution } from '#gw2/professions/mesmer/core/mechanics/shatter-types.js';
import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import type { MesmerEventExtra, MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import type { MesmerRuntime, MesmerRuntimeState } from '#gw2/professions/mesmer/types.js';

/** Own Compounding Power tuning alongside its runtime behavior. */
export const compoundingPower = defineTrait<MesmerSkill>({
  triggers: [
    onTriggerPoint(mesmerIllusionsGained, {
      run: (runtime: MesmerRuntime, input: TriggerPointInput<typeof mesmerIllusionsGained>) =>
        triggerCompoundingPower(runtime, input.at, input.count, input.sourceSkill, input.detail, input.delivery)
    })
  ],
  id: TRAIT.COMPOUNDING_POWER,
  name: 'Compounding Power',
  balance: {
    damageIncreasePerStack: 0.01,
    conditionDamageIncreasePerStack: 0.01,
    maximumStacks: 5,
    duration: 8
  },
  modifierRules: [
    {
      id: 'mesmer.compounding-power',
      requiresSelection: false,
      order: -2,
      conditionSampleInvariant: true,
      target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
      operation: 'damage-additive',

      amount: (context, target) => {
        // Illusion strikes use summon ownership, while their applied conditions inherit the Mesmer's outgoing modifiers.
        if (target === MODIFIER_TARGET.STRIKE_DAMAGE && illusionSource(context)) return 0;

        return (
          timedStacks(
            context,
            'compounding',
            balanceNumberFromContext(context, TRAIT.COMPOUNDING_POWER, 'duration'),
            balanceNumberFromContext(context, TRAIT.COMPOUNDING_POWER, 'maximumStacks')
          ) *
          (target === MODIFIER_TARGET.STRIKE_DAMAGE
            ? balanceNumberFromContext(context, TRAIT.COMPOUNDING_POWER, 'damageIncreasePerStack')
            : balanceNumberFromContext(context, TRAIT.COMPOUNDING_POWER, 'conditionDamageIncreasePerStack'))
        );
      }
    }
  ]
});

/** Own Cry of Pain tuning alongside its runtime behavior. */
export const cryOfPain = defineTrait<MesmerSkill>({
  id: TRAIT.CRY_OF_PAIN,
  name: 'Cry of Pain',
  balance: {
    // Bonuses augment each native F2 application, preserving the owning skill's base tuning.
    additionalStacks: 1,
    durationMultiplier: 1 / 3
  }
});

/** Own Maim the Disillusioned tuning alongside its runtime behavior. */
export const maimTheDisillusioned = defineTrait<MesmerSkill>({
  triggers: [
    onTriggerPoint(mesmerShatterResolved, {
      run: (runtime: MesmerRuntime, input: TriggerPointInput<typeof mesmerShatterResolved>) =>
        triggerMaimTheDisillusioned(runtime, { ...input.resolution, shatterTraitEligible: true })
    })
  ],
  id: TRAIT.MAIM_THE_DISILLUSIONED,
  name: 'Maim the Disillusioned',
  balance: {
    effects: [{ name: CONDITION.TORMENT, type: 'condition', condition: CONDITION.TORMENT, duration: 6, stacks: 1 }]
  }
});

/** Own Malicious Sorcery tuning alongside its runtime behavior. */
export const maliciousSorcery = defineTrait<MesmerSkill>({
  id: TRAIT.MALICIOUS_SORCERY,
  name: 'Malicious Sorcery',
  balance: { durationMultiplier: 0.25 },
  attributes: ({ balanceContext }) => ({
    traitDurations: {
      'Confusion Duration':
        100 * balanceNumberFromContext(balanceContext, TRAIT.MALICIOUS_SORCERY, 'durationMultiplier')
    }
  })
});

/** Own Master of Misdirection tuning alongside its runtime behavior. */
export const masterOfMisdirection = defineTrait<MesmerSkill>({
  id: TRAIT.MASTER_OF_MISDIRECTION,
  name: 'Master of Misdirection',
  balance: { rechargeMultiplier: 0.85 }
});

/** Own Master of Fragmentation tuning alongside its runtime behavior. */
export const masterOfFragmentation = defineTrait<MesmerSkill>({
  id: TRAIT.MASTER_OF_FRAGMENTATION,
  name: 'Master of Fragmentation',
  balance: {
    criticalChance: 0.25,
    durationExtension: 1,
    damageIncreasePerStack: 0.3,
    effects: [
      { name: CONDITION.CRIPPLED, type: 'condition', condition: CONDITION.CRIPPLED, duration: 3, stacks: 1 },
      // provisional 3s Weakness; replace when Deafening Drum's trait duration is confirmed.
      { name: CONDITION.WEAKNESS, type: 'condition', condition: CONDITION.WEAKNESS, duration: 3, stacks: 1 }
    ]
  },
  modifierRules: [
    {
      id: 'mesmer.master-of-fragmentation-critical-chance',
      target: MODIFIER_TARGET.CRITICAL_CHANCE,
      operation: 'add',
      order: -2,
      amount: (context) => balanceNumberFromContext(context, TRAIT.MASTER_OF_FRAGMENTATION, 'criticalChance'),
      // Improve every native F1 strike, including repeats, without affecting trait procs or afterimages.
      when: (context) =>
        isGw2PlayerActorEvent(context.event) &&
        context.event?.sourceId === context.event?.skillId &&
        [ID.MIND_WRACK, ID.SPLIT_SECOND, ID.BLADESONG_HARMONY, ID.LIVELY_LUTE, ID.LIVELY_LUTE_ALTERNATE].some(
          (id) => id === context.event?.skillId
        )
    }
  ],
  triggers: [
    // Native shatter impacts inherit their triggering skill while selecting only the matching condition.
    ...([CONDITION.WEAKNESS, CONDITION.CRIPPLED] as const).map<
      Extract<NonNullable<TraitDefinition['triggers']>[number], { on: 'damage.resolved' }>
    >((condition) => ({
      on: 'damage.resolved' as const,
      when: (_runtime, event) =>
        event.type === 'damage' &&
        isGw2PlayerActorEvent(event) &&
        event.sourceId === event.skillId &&
        !missesTarget(event) &&
        (condition === CONDITION.WEAKNESS
          ? event.skillId === ID.DEAFENING_DRUM
          : [ID.CRY_OF_FRUSTRATION, ID.REWINDER, ID.BLADESONG_SORROW, ID.FLUSTERING_FLUTE].some(
              (id) => id === event.skillId
            )),
      emit: TRAIT.MASTER_OF_FRAGMENTATION,
      effects: (effect) => effect.type === 'condition' && effect.name === condition,
      attribution: (_runtime, event) => ({
        actorType: ACTOR.PLAYER,
        name: `${event.skillName || TRAIT.MASTER_OF_FRAGMENTATION} — ${condition}`
      })
    }))
  ]
});

/** Phantasmal Haste selects the shared Quickness behavior without a separate tuning profile. */
export const phantasmalHaste = defineTrait<MesmerSkill>({
  id: TRAIT.PHANTASMAL_HASTE,
  name: 'Phantasmal Haste'
});

/** Own Shatter Storm tuning alongside its runtime behavior. */
export const shatterStorm = defineTrait<MesmerSkill>({
  id: TRAIT.SHATTER_STORM,
  name: 'Shatter Storm',
  balance: {
    maximumStacks: 2
  }
});

/** Own The Pledge tuning alongside its runtime behavior. */
export const thePledge = defineTrait<MesmerSkill>({
  triggers: [
    onTriggerPoint(mesmerConditionApplied, {
      run: (runtime: MesmerRuntime, input: TriggerPointInput<typeof mesmerConditionApplied>) =>
        triggerThePledge(runtime, input.event)
    })
  ],
  id: TRAIT.THE_PLEDGE,
  name: 'The Pledge',
  balance: {
    effects: [{ name: CONDITION.BURNING, type: 'condition', condition: CONDITION.BURNING, duration: 3, stacks: 2 }]
  }
});

/** Own Phantasmal Force tuning alongside its runtime behavior. */
export const phantasmalForce = defineTrait<MesmerSkill>({
  id: TRAIT.PHANTASMAL_FORCE,
  name: 'Phantasmal Force',
  // Trait balance is the single tuning source for modifiers and presentation.
  balance: { damageMultiplier: 1, damageIncreasePerStack: 0.01 },
  modifierRules: [
    {
      id: 'mesmer.phantasmal-force',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',

      factor: (context) =>
        balanceNumberFromContext(context, TRAIT.PHANTASMAL_FORCE, 'damageMultiplier') +
        context.query!.mightStacksAt(context.time, context.runtime, context.event) *
          balanceNumberFromContext(context, TRAIT.PHANTASMAL_FORCE, 'damageIncreasePerStack'),
      order: 98,
      when: (context) => context.event?.summonKind === 'phantasm'
    }
  ]
});

/** Adds The Pledge only to the skill's player Burning, inheriting its timing and excluding summon or trait procs. */
function triggerThePledge(context: MesmerRuntime, event: SimulationEvent): void {
  if (
    event.type !== 'condition' ||
    event.condition !== CONDITION.BURNING ||
    !isGw2PlayerActorEvent(event) ||
    event.sourceId !== event.skillId ||
    (event.skillId !== ID.PHANTASMAL_MAGE && event.skillId !== ID.THE_PRESTIGE)
  )
    return;

  const thePledgeProfile = requireBalanceProfileFromContext(context, TRAIT.THE_PLEDGE);
  const effect = requireEffect(thePledgeProfile, 'condition', CONDITION.BURNING);

  if (!effect) return;

  emitTraitProfile(context, TRAIT.THE_PLEDGE, TRAIT.THE_PLEDGE, event, {
    at: event.at,
    effect: { type: 'condition', name: CONDITION.BURNING },
    transform: (payload) =>
      buildResolverCondition({
        actorType: ACTOR.PLAYER,
        at: event.at,
        source: 'Trait',
        sourceId: TRAIT.THE_PLEDGE,
        skillId: event.skillId,
        skillName: event.skillName,
        condition: CONDITION.BURNING,
        duration: Number(payload.duration),
        stacks: Number(payload.stacks)
      })
  });
}

/** Augments native confusion before shatter expansion; Troubadour supplies its specialization-specific bonuses. */
export function cryOfPainConfusion(
  context: unknown,
  condition: ConditionEffect | undefined,
  flute?: MesmerSkill
): ConditionEffect | undefined {
  if (!condition || !hasTrait(context, TRAIT.CRY_OF_PAIN)) return condition;

  const profile = requireBalanceProfileFromContext(context, TRAIT.CRY_OF_PAIN);
  return {
    ...condition,
    stacks:
      (condition.stacks ?? 1) +
      (flute ? skillNumber(flute, 'cryOfPainAdditionalStacks') : balanceProfileNumber(profile, 'additionalStacks')),
    duration:
      (condition.duration ?? 0) *
      (1 +
        (flute
          ? skillNumber(flute, 'cryOfPainDurationMultiplier')
          : balanceProfileNumber(profile, 'durationMultiplier')))
  };
}

/** Emits Compounding Power stacks and its proc record at the owning lifecycle position. */
function triggerCompoundingPower(
  context: MesmerRuntime,
  at: number,
  count: number,
  sourceSkill: string,
  detail: string,
  delivery: EffectDelivery = {}
): void {
  if (count <= 0) return;

  const duration = balanceNumberFromContext(context, TRAIT.COMPOUNDING_POWER, 'duration');
  // Simultaneous gains retain independent applications under one trait activation.
  {
    const grants: readonly MesmerEventExtra[] = Array.from({ length: count }, () => ({
      kind: 'compounding',
      stacks: 1,
      duration
    }));
    const traitProfile = requireBalanceProfileFromContext(context, TRAIT.COMPOUNDING_POWER);
    const traitSource = {
      source: 'Trait',
      sourceId: TRAIT.COMPOUNDING_POWER,
      actorType: ACTOR.PLAYER,
      skillId: TRAIT.COMPOUNDING_POWER,
      skillName: traitProfile.name
    };

    if (grants.length) {
      // The announcement receipt parents each granted stack's delivery.
      const proc = context.effects.emit({
        receipt: true,
        ...delivery,
        kind: 'announcement',
        log: true,
        attribution: { ...traitSource, actorType: ACTOR.EFFECT },
        announcement: {
          type: 'trait',
          name: traitProfile.name,
          at: at,
          sourceSkill: sourceSkill,
          detail
        }
      });
      for (const grant of grants)
        context.effects.emit({
          ...delivery,
          kind: 'packet',
          cause: proc,
          event: { ...grant, ...traitSource, type: 'buff', at: at, name: traitProfile.name, sourceSkill: sourceSkill }
        });
    }
  }
}

/** Hit groups that apply Maim the Disillusioned, reported by shatters or Troubadour performances. */
export interface MaimTheDisillusionedHits extends Pick<
  MesmerShatterResolution,
  'skill' | 'at' | 'delivery' | 'traitHits'
> {
  /** Shatter hits stay eligible for shatter reactions; instruments and Crescendo are not shatters. */
  readonly shatterTraitEligible: boolean;
  /** Torment survives a committed interrupt alongside the hits that launched before it. */
  readonly persistsAfterInterrupt?: boolean;
}

/** Applies Maim the Disillusioned to shatter first-strike groups and Troubadour performance hits. */
export function triggerMaimTheDisillusioned(context: MesmerRuntime, resolution: MaimTheDisillusionedHits): void {
  if (!hasTrait(context, TRAIT.MAIM_THE_DISILLUSIONED) || !resolution.traitHits.length) return;

  const maimTheDisillusionedProfile = requireBalanceProfileFromContext(context, TRAIT.MAIM_THE_DISILLUSIONED);
  const effect = requireEffect(maimTheDisillusionedProfile, 'condition', CONDITION.TORMENT);

  if (!effect) return;

  for (const hit of resolution.traitHits) {
    if (hit.count <= 0) continue;

    buildMesmerConditions(
      context,
      resolution.skill.name,
      hit.at,
      { ...effect, stacks: Number(effect.stacks) * hit.count },
      'Player',
      'Maim the Disillusioned — Torment',
      // The caller decides shatter eligibility; the trait proc keeps its grouped hit opportunities.
      {
        skillId: resolution.skill.id,
        procType: 'trait',
        metadata: { shatterTraitEligible: resolution.shatterTraitEligible, procCount: hit.count }
      }
    ).forEach((packet) => {
      context.effects.emit({
        ...resolution.delivery,
        kind: 'packet',
        // Trait ownership survives the activating skill's attribution so previews report the torment as a trait proc.
        event: {
          ...packet,
          traitId: TRAIT.MAIM_THE_DISILLUSIONED,
          ...(resolution.persistsAfterInterrupt ? { persistsAfterInterrupt: true } : {})
        },
        owner: mesmerPacketOwner(packet),
        priority: Number(packet.priority ?? 0)
      });
    });
  }

  context.effects.emit({
    ...resolution.delivery,
    kind: 'announcement',
    log: true,
    attribution: { source: 'Trait', sourceId: TRAIT.MAIM_THE_DISILLUSIONED, actorType: ACTOR.EFFECT },
    announcement: {
      type: 'trait',
      name: 'Maim the Disillusioned',
      at: resolution.at,
      sourceSkill: resolution.skill.name,
      detail: ''
    }
  });
}

/** Selected Phantasmal Haste uses the shared Quickness rate when deriving phantasm packet times. */
export function phantasmalHasteSpeed(context: MesmerRuntime): number {
  return hasTrait(context, TRAIT.PHANTASMAL_HASTE) ? GW2_QUICKNESS_ACTION_RATE : 1;
}

/** Shatters, instruments, and Crescendo receive recharge reduction before shared flat resource reductions. */
export const masterOfMisdirectionRecharge = compileRechargeRules<MesmerRuntimeState, MesmerSkill>([
  {
    trait: TRAIT.MASTER_OF_MISDIRECTION,
    when: (_runtime, skill) => Boolean(skill.shatter || skill.instrument || skill.id === ID.CRESCENDO),
    multiplier: { profile: TRAIT.MASTER_OF_MISDIRECTION, field: 'rechargeMultiplier' }
  }
]);

/** Only native slot-one shatters and instruments receive Shatter Storm's extra charge. */
export function shatterStormMaximumAmmo(
  context: MaximumAmmoContext<object>,
  skill: MesmerSkill,
  maximum: number
): number {
  // Slot identity is authored on the selected skill; capacity selection never needs a live controller registry.
  const isSlot1 = skill.shatter?.slot === 1 || skill.instrument?.slot === 1;
  return isSlot1 && context.hasTrait(TRAIT.SHATTER_STORM)
    ? balanceProfileNumber(context.requireBalanceProfile(TRAIT.SHATTER_STORM), 'maximumStacks')
    : maximum;
}

/** Continuum duration is extended only by the currently selected Core trait. */
export function masterOfFragmentationDuration(context: MesmerRuntime): number {
  return hasTrait(context, TRAIT.MASTER_OF_FRAGMENTATION)
    ? balanceNumberFromContext(context, TRAIT.MASTER_OF_FRAGMENTATION, 'durationExtension')
    : 0;
}

/** Requiem appends one matching pulse before emission, preserving an empty or removed strike. */
export function masterOfFragmentationRequiem(context: MesmerRuntime, packets: readonly StrikeTick[]): StrikeTick[] {
  const ticks = [...packets];

  if (ticks.length && hasTrait(context, TRAIT.MASTER_OF_FRAGMENTATION)) {
    const last = ticks[ticks.length - 1];
    ticks.push({ ...last, atMs: last.atMs + masterOfFragmentationDuration(context) * 1000 });
  }

  return ticks;
}

/** Crescendo uses the trait's per-instrument coefficient only when selected. */
export function masterOfFragmentationCrescendo(context: MesmerRuntime, skill: MesmerSkill): number {
  return hasTrait(context, TRAIT.MASTER_OF_FRAGMENTATION)
    ? balanceNumberFromContext(context, TRAIT.MASTER_OF_FRAGMENTATION, 'damageIncreasePerStack')
    : skillNumber(skill, 'damageIncreasePerInstrument');
}
