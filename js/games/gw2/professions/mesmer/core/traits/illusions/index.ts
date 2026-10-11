import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { isGw2PlayerActorEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { missesTarget } from '#gw2/platform/combat/state/targets.js';
import type { EffectDelivery } from '#gw2/platform/effects/emission.js';
import { buildResolverCondition } from '#gw2/platform/effects/packet-builders.js';
import type { ConditionEffect, StrikeTick } from '#gw2/platform/effects/types.js';
import type { SimulationEvent } from '#gw2/platform/events/events.js';
import type { MaximumAmmoContext } from '#gw2/platform/profession-definition/runtime-context.js';
import { emitTraitProfile } from '#gw2/platform/profession-definition/trait-emission.js';
import type { TraitDefinition } from '#gw2/platform/profession-definition/traits.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import type { TriggerPointInput } from '#gw2/platform/profession-definition/trigger-points.js';
import { compileRechargeRules, onTriggerPoint } from '#gw2/platform/profession-definition/trigger-rules.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { BalanceProfile } from '#gw2/platform/skills/types.js';
import { mesmerConditionApplied } from '#gw2/professions/mesmer/core/mechanics/combat-boundaries.js';
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
    durationMultiplier: 8
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
            balanceProfileNumber(
              requireBalanceProfileFromContext(context, TRAIT.COMPOUNDING_POWER),
              'durationMultiplier'
            ),
            balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.COMPOUNDING_POWER), 'maximumStacks')
          ) *
          (target === MODIFIER_TARGET.STRIKE_DAMAGE
            ? balanceProfileNumber(
                requireBalanceProfileFromContext(context, TRAIT.COMPOUNDING_POWER),
                'damageIncreasePerStack'
              )
            : balanceProfileNumber(
                requireBalanceProfileFromContext(context, TRAIT.COMPOUNDING_POWER),
                'conditionDamageIncreasePerStack'
              ))
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
    // This replaces the shatter's confusion package rather than emitting an independently owned proc.
    damagePreviewAttribution: 'skill',
    effects: [{ name: 'Confusion', type: 'condition', condition: 'Confusion', duration: 4, stacks: 2 }]
  }
});

/** Own Maim the Disillusioned tuning alongside its runtime behavior. */
export const maimTheDisillusioned = defineTrait<MesmerSkill>({
  triggers: [
    onTriggerPoint(mesmerShatterResolved, {
      run: (runtime: MesmerRuntime, input: TriggerPointInput<typeof mesmerShatterResolved>) =>
        triggerMaimTheDisillusioned(runtime, input.resolution)
    })
  ],
  id: TRAIT.MAIM_THE_DISILLUSIONED,
  name: 'Maim the Disillusioned',
  balance: {
    effects: [{ name: 'Torment', type: 'condition', condition: 'Torment', duration: 6, stacks: 1 }]
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
        100 *
        balanceProfileNumber(
          requireBalanceProfileFromContext(balanceContext, TRAIT.MALICIOUS_SORCERY),
          'durationMultiplier'
        )
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
    durationMultiplier: 1,
    damageIncreasePerStack: 0.3,
    effects: [
      { name: 'Crippled', type: 'condition', condition: 'Crippled', duration: 3, stacks: 1 },
      // provisional 3s Weakness; replace when Deafening Drum's trait duration is confirmed.
      { name: 'Weakness', type: 'condition', condition: 'Weakness', duration: 3, stacks: 1 }
    ]
  },
  modifierRules: [
    {
      id: 'mesmer.master-of-fragmentation-critical-chance',
      target: MODIFIER_TARGET.CRITICAL_CHANCE,
      operation: 'add',
      order: -2,
      amount: (context) =>
        balanceProfileNumber(
          requireBalanceProfileFromContext(context, TRAIT.MASTER_OF_FRAGMENTATION),
          'criticalChance'
        ),
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
    ...(['Weakness', 'Crippled'] as const).map<
      Extract<NonNullable<TraitDefinition['triggers']>[number], { on: 'damage.resolved' }>
    >((condition) => ({
      on: 'damage.resolved' as const,
      when: (_runtime, event) =>
        event.type === 'damage' &&
        isGw2PlayerActorEvent(event) &&
        event.sourceId === event.skillId &&
        !missesTarget(event) &&
        (condition === 'Weakness'
          ? event.skillId === ID.DEAFENING_DRUM
          : [ID.CRY_OF_FRUSTRATION, ID.REWINDER, ID.BLADESONG_SORROW, ID.FLUSTERING_FLUTE].some(
              (id) => id === event.skillId
            )),
      emit: TRAIT.MASTER_OF_FRAGMENTATION,
      effects: (effect) => effect.type === 'condition' && effect.name === condition,
      attribution: (_runtime, event) => ({
        actorType: 'player',
        name: `${event.skillName || TRAIT.MASTER_OF_FRAGMENTATION} — ${condition}`
      })
    }))
  ]
});

/** Own Phantasmal Haste tuning alongside its runtime behavior. */
export const phantasmalHaste = defineTrait<MesmerSkill>({
  id: TRAIT.PHANTASMAL_HASTE,
  name: 'Phantasmal Haste',
  balance: {
    quicknessCastMultiplier: 1.5
  }
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
    effects: [{ name: 'Burning', type: 'condition', condition: 'Burning', duration: 3, stacks: 2 }]
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
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.PHANTASMAL_FORCE), 'damageMultiplier') +
        context.query!.mightStacksAt(context.time, context.runtime, context.event) *
          balanceProfileNumber(
            requireBalanceProfileFromContext(context, TRAIT.PHANTASMAL_FORCE),
            'damageIncreasePerStack'
          ),
      order: 98,
      when: (context) => context.event?.summonKind === 'phantasm'
    }
  ]
});

/** Adds The Pledge only to the skill's player Burning, inheriting its timing and excluding summon or trait procs. */
function triggerThePledge(context: MesmerRuntime, event: SimulationEvent): void {
  if (
    event.type !== 'condition' ||
    event.condition !== 'Burning' ||
    !isGw2PlayerActorEvent(event) ||
    event.sourceId !== event.skillId ||
    (event.skillId !== ID.PHANTASMAL_MAGE && event.skillId !== ID.THE_PRESTIGE)
  )
    return;
  const thePledgeProfile = requireBalanceProfileFromContext(context, TRAIT.THE_PLEDGE);
  const effect = requireEffect(thePledgeProfile, 'condition', 'Burning');
  if (!effect) return;
  emitTraitProfile(context, TRAIT.THE_PLEDGE, TRAIT.THE_PLEDGE, event, {
    at: event.at,
    effect: { type: 'condition', name: 'Burning' },
    transform: (payload) =>
      buildResolverCondition({
        actorType: 'player',
        at: event.at,
        source: 'Trait',
        sourceId: TRAIT.THE_PLEDGE,
        skillId: event.skillId,
        skillName: event.skillName,
        condition: 'Burning',
        duration: Number(payload.duration),
        stacks: Number(payload.stacks)
      })
  });
}

/** Returns Cry of Pain's Confusion override before the owning shatter emits packets. */
export function cryOfPainConfusion(
  context: MesmerRuntime,
  condition: ConditionEffect | undefined
): ConditionEffect | undefined {
  if (!hasTrait(context, TRAIT.CRY_OF_PAIN)) return condition;
  const cryOfPainProfile = requireBalanceProfileFromContext(context, TRAIT.CRY_OF_PAIN);
  const effect = requireEffect(cryOfPainProfile, 'condition', 'Confusion');
  return effect ?? condition;
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
  const compoundingPowerProfile = requireBalanceProfileFromContext(context, TRAIT.COMPOUNDING_POWER);
  const duration = balanceProfileNumber(compoundingPowerProfile, 'durationMultiplier');
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
      actorType: 'player' as const,
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
        attribution: { ...traitSource, actorType: 'effect' },
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

/** Applies Maim the Disillusioned to the first-strike groups reported by the shatter resolver. */
function triggerMaimTheDisillusioned(context: MesmerRuntime, resolution: MesmerShatterResolution): void {
  if (!resolution.traitHits.length) return;
  const maimTheDisillusionedProfile = requireBalanceProfileFromContext(context, TRAIT.MAIM_THE_DISILLUSIONED);
  const effect = requireEffect(maimTheDisillusionedProfile, 'condition', 'Torment');
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
      // Preserve shatter ownership for reactions while naming the separate trait and its grouped hit opportunities.
      {
        skillId: resolution.skill.id,
        procType: 'trait',
        metadata: { shatterTraitEligible: true, procCount: hit.count }
      }
    ).forEach((packet) => {
      context.effects.emit({
        ...resolution.delivery,
        kind: 'packet',
        event: packet,
        owner: mesmerPacketOwner(packet),
        priority: Number(packet.priority ?? 0)
      });
    });
  }

  context.effects.emit({
    ...resolution.delivery,
    kind: 'announcement',
    log: true,
    attribution: { source: 'Trait', sourceId: TRAIT.MAIM_THE_DISILLUSIONED, actorType: 'effect' },
    announcement: {
      type: 'trait',
      name: 'Maim the Disillusioned',
      at: resolution.at,
      sourceSkill: resolution.skill.name,
      detail: ''
    }
  });
}

/** Returns the profile-owned Phantasmal Haste speed before phantasm packet times are derived. */
export function phantasmalHasteSpeed(context: MesmerRuntime): number {
  return hasTrait(context, TRAIT.PHANTASMAL_HASTE)
    ? balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.PHANTASMAL_HASTE), 'quicknessCastMultiplier')
    : 1;
}

/** Shatter and instrument recharge is multiplied before shared flat resource reductions. */
export const masterOfMisdirectionRecharge = compileRechargeRules<MesmerRuntimeState, MesmerSkill>([
  {
    trait: TRAIT.MASTER_OF_MISDIRECTION,
    when: (_runtime, skill) => Boolean(skill.shatter || skill.instrument),
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
    ? balanceProfileNumber(
        requireBalanceProfileFromContext(context, TRAIT.MASTER_OF_FRAGMENTATION),
        'durationMultiplier'
      )
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
export function masterOfFragmentationCrescendo(context: MesmerRuntime, profile: BalanceProfile): number {
  return hasTrait(context, TRAIT.MASTER_OF_FRAGMENTATION)
    ? balanceProfileNumber(
        requireBalanceProfileFromContext(context, TRAIT.MASTER_OF_FRAGMENTATION),
        'damageIncreasePerStack'
      )
    : balanceProfileNumber(profile, 'damageIncreasePerStack');
}
