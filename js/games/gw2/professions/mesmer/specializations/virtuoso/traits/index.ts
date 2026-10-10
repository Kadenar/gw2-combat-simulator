import { onTriggerPoint } from '#gw2/platform/profession-definition/trigger-rules.js';
import {
  mesmerPhantasmPreparing,
  type MesmerPhantasmAdmission
} from '#gw2/professions/mesmer/core/mechanics/illusions/phantasms.js';
import { phantasmalBladesDamage } from '#gw2/professions/mesmer/specializations/virtuoso/traits/behavior.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { advanceCriticalProc, criticalOpportunity } from '#gw2/platform/combat/procs/critical.js';
import { buffActive } from '#gw2/platform/combat/query/runtime-query.js';
import { advanceCounter } from '#gw2/platform/combat/resources/counters.js';
import { isGw2PlayerActorEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { buildResolverCondition } from '#gw2/platform/effects/packet-builders.js';
import type { SimulationEvent } from '#gw2/platform/events/events.js';
import type { NativeResolvedDamageDetails } from '#gw2/platform/profession-definition/module-types.js';
import { emitTraitProfile } from '#gw2/platform/profession-definition/trait-emission.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import type { TriggerPointInput } from '#gw2/platform/profession-definition/trigger-points.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { MesmerTraitDamage } from '#gw2/professions/mesmer/core/mechanics/illusions/types.js';
import { illusionSource } from '#gw2/professions/mesmer/core/mechanics/modifier-queries.js';
import { mesmerShatterCompleted } from '#gw2/professions/mesmer/core/mechanics/profession-actions.js';
import type { MesmerShatterResolution } from '#gw2/professions/mesmer/core/mechanics/shatter-types.js';
import { mesmerTraitDamageProfile } from '#gw2/professions/mesmer/core/profiles.js';
import { MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import type { MesmerEventExtra, MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import { createMesmerIllusionRewards, mesmerActivePrimaryWeapon } from '#gw2/professions/mesmer/family-resources.js';
import {
  virtuosoBladeCritical,
  virtuosoInitialized
} from '#gw2/professions/mesmer/specializations/virtuoso/mechanics/combat-boundaries.js';
import { virtuosoState } from '#gw2/professions/mesmer/specializations/virtuoso/state.js';
import type { MesmerRuntime } from '#gw2/professions/mesmer/types.js';

/** Deadly Blades shares patched tuning with its existing packet and resource boundaries. */
export const deadlyBlades = defineTrait<MesmerSkill>({
  triggers: [
    onTriggerPoint(virtuosoBladeCritical, {
      run: (runtime: MesmerRuntime, input: TriggerPointInput<typeof virtuosoBladeCritical>) =>
        applyBladeCritical(
          runtime,
          input.event,
          input.details,
          TRAIT.DEADLY_BLADES,
          'Deadly Blades',
          'Vulnerability',
          'mesmer.virtuoso.deadly-blades'
        )
    }),
    onTriggerPoint(mesmerShatterCompleted, {
      run: (runtime: MesmerRuntime, input: TriggerPointInput<typeof mesmerShatterCompleted>) =>
        resolveDeadlyBlades(runtime, input.resolution)
    })
  ],
  id: TRAIT.DEADLY_BLADES,
  name: 'Deadly Blades',
  balance: {
    durationMultiplier: 7,
    effects: [{ name: 'Vulnerability', type: 'condition', condition: 'Vulnerability', duration: 5, stacks: 1 }]
  },
  modifierRules: [
    {
      id: 'mesmer.deadly-blades',
      requiresSelection: false,
      target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
      operation: 'damage-additive',
      parameters: { strikeBonus: 0.05, conditionBonus: 0.1 },
      amount: (_context, target, parameters) =>
        target === MODIFIER_TARGET.CONDITION_DAMAGE ? parameters.conditionBonus : parameters.strikeBonus,
      when: (context) => !illusionSource(context) && buffActive(context, 'deadly-blades')
    }
  ]
});

/** Jagged Mind shares patched tuning with its existing packet and resource boundaries. */
export const jaggedMind = defineTrait<MesmerSkill>({
  triggers: [
    onTriggerPoint(virtuosoBladeCritical, {
      run: (runtime: MesmerRuntime, input: TriggerPointInput<typeof virtuosoBladeCritical>) =>
        applyBladeCritical(
          runtime,
          input.event,
          input.details,
          TRAIT.JAGGED_MIND,
          'Jagged Mind',
          'Bleeding',
          'mesmer.virtuoso.jagged-mind'
        )
    })
  ],
  id: TRAIT.JAGGED_MIND,
  name: 'Jagged Mind',
  balance: {
    effects: [{ name: 'Bleeding', type: 'condition', condition: 'Bleeding', duration: 4, stacks: 1 }]
  }
});

/** Bloodsong shares patched tuning with its existing packet and resource boundaries. */
export const bloodsong = defineTrait<MesmerSkill>({
  id: TRAIT.BLOODSONG,
  name: 'Bloodsong',
  balance: {
    threshold: 5,
    resourceGain: 1
  },
  modifierRules: [
    {
      id: 'mesmer.bloodsong',
      target: MODIFIER_TARGET.CONDITION_DAMAGE,
      operation: 'multiply',
      factor: 1.25,
      order: 100,
      when: (context) => context.condition === 'Bleeding'
    }
  ],
  triggers: [
    {
      on: 'condition.applied',
      run(runtime, event) {
        if (event.condition !== 'Bleeding') return;
        const state = virtuosoState.from(runtime);
        const profile = requireBalanceProfileFromContext(runtime, TRAIT.BLOODSONG);
        const threshold = balanceProfileNumber(profile, 'threshold');
        // The resolver dispatches each stack individually; reset before rewarding so the next application starts a new cycle.
        const progress = advanceCounter(state.bloodsongProgress, 1, threshold, threshold > 0 ? 'reset' : 'retain');
        state.bloodsongProgress = progress.value;
        if (threshold <= 0 || !progress.reached) return;
        createMesmerIllusionRewards(runtime).queueResources(
          runtime.time,
          balanceProfileNumber(profile, 'resourceGain'),
          mesmerActivePrimaryWeapon(runtime),
          'Bloodsong',
          { traitId: TRAIT.BLOODSONG, traitName: 'Bloodsong' }
        );
      }
    }
  ]
});

/** The proc owns its baseline attack; the shared phantasm lifecycle supplies the conversion boundary. */
const phantasmalBlade: MesmerTraitDamage = {
  coefficient: 0.7,
  hits: 1
};

export const phantasmalBlades = defineTrait<MesmerSkill>({
  id: TRAIT.PHANTASMAL_BLADES,
  name: 'Phantasmal Blades',
  // Capture the surviving bonus payload per summon batch without changing intrinsic blade conversion.
  triggers: [
    onTriggerPoint(mesmerPhantasmPreparing, {
      run(runtime, admission: MesmerPhantasmAdmission) {
        const damage = phantasmalBladesDamage(runtime);
        if (damage.type === 'strike')
          admission.bonusStrike = {
            name: 'Phantasmal Blade',
            traitId: TRAIT.PHANTASMAL_BLADES,
            traitName: 'Phantasmal Blades',
            damage
          };
      }
    })
  ],
  profiles: [mesmerTraitDamageProfile(TRAIT.PHANTASMAL_BLADES, 'Phantasmal Blades', phantasmalBlade)]
});

/** Keep the rounded build conversion separate from live Fury and direct-simulation attribute adjustments. */
export const quietIntensity = defineTrait<MesmerSkill>({
  id: TRAIT.QUIET_INTENSITY,
  name: 'Quiet Intensity',
  balance: { phantasmCriticalChance: 0.15, criticalChance: 0.15, vitalityConversion: 0.1 },
  modifierRules: [
    {
      id: 'mesmer.quiet-intensity-critical-chance',
      target: MODIFIER_TARGET.CRITICAL_CHANCE,
      operation: 'add',
      amount: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.QUIET_INTENSITY), 'criticalChance'),
      when: (context) =>
        !illusionSource(context) && Boolean(context.query?.furyActiveAt(context.time, context.runtime, context.event))
    }
  ],
  buildAttributes: (_common, { balanceContext, build }) => {
    const profile = requireBalanceProfileFromContext(balanceContext, TRAIT.QUIET_INTENSITY);
    return {
      attributeEffects: [
        {
          kind: 'conversion',
          from: 'Vitality',
          to: 'Ferocity',
          multiplier: balanceProfileNumber(profile, 'vitalityConversion'),
          rounding: 'round',
          input: 'common'
        }
      ],
      traitCriticalChance: build.assumptions?.fury !== false ? 100 * balanceProfileNumber(profile, 'criticalChance') : 0
    };
  }
});

/** Targets are always nearby in this simulation; only player strikes receive this multiplier. */
export const mentalFocus = defineTrait<MesmerSkill>({
  id: TRAIT.MENTAL_FOCUS,
  name: 'Mental Focus',
  modifierRules: [
    {
      id: 'mesmer.mental-focus',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: 1.05,
      // Apply after the blade-specific multiplier, as in the original collector.
      order: 101,
      when: (context) => isGw2PlayerActorEvent(context.event)
    }
  ]
});

/** Sharpening Sorrow shares patched tuning with its existing packet and resource boundaries. */
export const sharpeningSorrow = defineTrait<MesmerSkill>({
  id: TRAIT.SHARPENING_SORROW,
  name: 'Sharpening Sorrow',
  balance: {
    expertiseBonus: 150
  },
  buildAttributes: (_common, { balanceContext, build }) => ({
    attributeEffects: [
      {
        kind: 'flat',
        to: 'Expertise',
        amount: balanceProfileNumber(
          requireBalanceProfileFromContext(balanceContext, TRAIT.SHARPENING_SORROW),
          'expertiseBonus'
        ),
        feedsConversions: false,
        enabled: build.assumptions?.fury !== false
      }
    ]
  })
});

/** Infinite Forge shares patched tuning with its existing packet and resource boundaries. */
export const infiniteForge = defineTrait<MesmerSkill>({
  triggers: [
    onTriggerPoint(virtuosoInitialized, { run: startInfiniteForge }),
    onTriggerPoint(mesmerShatterCompleted, {
      run: (runtime: MesmerRuntime, input: TriggerPointInput<typeof mesmerShatterCompleted>) =>
        resolveInfiniteForgeRefund(runtime, input.resolution)
    })
  ],
  id: TRAIT.INFINITE_FORGE,
  name: 'Infinite Forge',
  balance: {
    pulseInterval: 3,
    threshold: 5,
    playerStacks: 1,
    resourceGain: 2
  },
  modifierRules: [
    {
      id: 'mesmer.infinite-forge',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: 1.07,
      order: 100,
      when: (context) => Boolean(context.event?.metadata?.blade)
    }
  ],
  lifetime: {
    tasks: {
      'mesmer.infinite-forge'(runtime) {
        const profile = requireBalanceProfileFromContext(runtime, TRAIT.INFINITE_FORGE);
        createMesmerIllusionRewards(runtime).gainResources(
          runtime.time,
          balanceProfileNumber(profile, 'playerStacks'),
          mesmerActivePrimaryWeapon(runtime),
          'Infinite Forge',
          { traitId: TRAIT.INFINITE_FORGE, traitName: 'Infinite Forge' }
        );
        const interval = balanceProfileNumber(profile, 'pulseInterval');
        if (interval > 0) runtime.schedule('mesmer.infinite-forge', runtime.time + interval, undefined, undefined, -20);
      }
    }
  }
});

/** Collect the eight implemented Virtuoso trait owners. */
export const virtuosoTraits = [
  quietIntensity,
  mentalFocus,
  sharpeningSorrow,
  deadlyBlades,
  jaggedMind,
  bloodsong,
  phantasmalBlades,
  infiniteForge
];

/** Activates Deadly Blades only after a successfully resolved Virtuoso Bladesong. */
function resolveDeadlyBlades(context: MesmerRuntime, resolution: MesmerShatterResolution): void {
  const at = resolution.at;
  const deadlyBladesProfile = requireBalanceProfileFromContext(context, TRAIT.DEADLY_BLADES);
  {
    const grants: readonly MesmerEventExtra[] = [
      {
        // Deadly Blades starts after the Bladesong's same-time resolution work.
        priority: 5,
        kind: 'deadly-blades',
        stacks: 1,
        duration: balanceProfileNumber(deadlyBladesProfile, 'durationMultiplier')
      }
    ];
    const traitProfile = requireBalanceProfileFromContext(context, TRAIT.DEADLY_BLADES);
    const traitSource = {
      source: 'Trait',
      sourceId: TRAIT.DEADLY_BLADES,
      actorType: 'player' as const,
      skillId: TRAIT.DEADLY_BLADES,
      skillName: traitProfile.name
    };
    {
      const proc = context.effects.emit({
        receipt: true,
        ...resolution.delivery,
        kind: 'announcement',
        log: true,
        attribution: { ...traitSource, actorType: 'effect' },
        announcement: { type: 'trait', name: traitProfile.name, at: at, sourceSkill: resolution.skill.name, detail: '' }
      });
      for (const grant of grants)
        context.effects.emit({
          ...resolution.delivery,
          kind: 'packet',
          cause: proc,
          event: {
            ...grant,
            ...traitSource,
            type: 'buff',
            at: at,
            name: traitProfile.name,
            sourceSkill: resolution.skill.name
          }
        });
    }
  }
}

/** Refunds blades only after a completed Bladesong commits the configured maximum-spend threshold. */
function resolveInfiniteForgeRefund(context: MesmerRuntime, resolution: MesmerShatterResolution): void {
  if (
    resolution.spent <
    balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.INFINITE_FORGE), 'threshold')
  ) {
    return;
  }

  const infiniteForgeProfile = requireBalanceProfileFromContext(context, TRAIT.INFINITE_FORGE);
  createMesmerIllusionRewards(context).queueResources(
    resolution.at,
    balanceProfileNumber(infiniteForgeProfile, 'resourceGain'),
    mesmerActivePrimaryWeapon(context),
    'Infinite Forge refund',
    {
      traitId: TRAIT.INFINITE_FORGE,
      traitName: 'Infinite Forge'
    }
  );
}

/** Start the passive only after Virtuoso has installed its blade lifecycle; pulses schedule their own successor. */
function startInfiniteForge(context: MesmerRuntime): void {
  {
    const interval = balanceProfileNumber(
      requireBalanceProfileFromContext(context, TRAIT.INFINITE_FORGE),
      'pulseInterval'
    );
    if (interval > 0) context.schedule('mesmer.infinite-forge', interval, undefined, undefined, -20);
  }
}

/** Blade critical rewards preserve Deadly Blades before Jagged Mind and each packet's original actor ownership. */
function applyBladeCritical(
  runtime: MesmerRuntime,
  event: SimulationEvent,
  details: NativeResolvedDamageDetails,
  id: number,
  name: string,
  condition: string,
  proc: string
): void {
  const skill = runtime.helpers.skillsById.get(event.skillId ?? '');
  if ((!event.metadata?.blade && !skill?.blade) || event.canCrit === false) return;

  if (id === TRAIT.DEADLY_BLADES && event.actorType !== 'player') return;
  const effect = requireEffect(requireBalanceProfileFromContext(runtime, id), 'condition', condition);
  if (!effect) return;
  const critical = details.hitContext!.critical;
  const application = advanceCriticalProc(criticalOpportunity(critical.chance, critical.didCrit), {
    id: proc,
    at: runtime.time
  });
  if (!application) return;
  emitTraitProfile(runtime, id, id, event, {
    at: runtime.time,
    effect: { type: 'condition', name: condition },
    transform: (payload) =>
      buildResolverCondition({
        at: runtime.time,
        name: `${event.name} — ${name}`,
        skillName: event.skillName,
        parentSkillName: event.parentSkillName,
        condition,
        stacks: application.quantity * Number(payload.stacks),
        duration: Number(payload.duration),
        source: id === TRAIT.DEADLY_BLADES ? 'Trait' : event.source,
        sourceId: id,
        actorType: id === TRAIT.DEADLY_BLADES ? 'effect' : event.actorType,
        ...(id === TRAIT.DEADLY_BLADES ? { ownerActorType: 'player' as const } : {})
      })
  });
  if (id === TRAIT.JAGGED_MIND)
    runtime.effects.emit({
      kind: 'announcement',
      log: true,
      attribution: { source: 'Trait', sourceId: id, actorType: 'effect' },
      announcement: { type: 'trait', name: name, at: runtime.time, sourceSkill: event.skillName, detail: '' }
    });
}
