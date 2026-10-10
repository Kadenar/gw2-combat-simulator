import { onTriggerPoint } from '#gw2/platform/profession-definition/trigger-rules.js';
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import type { Gw2ModifierContext, Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { advanceCriticalProc, criticalOpportunity } from '#gw2/platform/combat/procs/critical.js';
import { targetConditionActive, targetHealthBelow } from '#gw2/platform/combat/query/runtime-query.js';
import { isGw2PlayerActorEvent } from '#gw2/platform/combat/state/event-ownership.js';
import type { EffectDelivery } from '#gw2/platform/effects/emission.js';
import { buildResolverCondition } from '#gw2/platform/effects/packet-builders.js';
import { gw2ActivePrimaryWeapon } from '#gw2/platform/equipment/weapons/loadout.js';
import type { SimulationEvent } from '#gw2/platform/events/events.js';
import { emitTraitProfile } from '#gw2/platform/profession-definition/trait-emission.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import type { TriggerPointInput } from '#gw2/platform/profession-definition/trigger-points.js';
import { compileRechargeRules } from '#gw2/platform/profession-definition/trigger-rules.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import {
  mesmerConditionApplied,
  mesmerControlAccepted,
  mesmerCritical,
  mesmerEvaded,
  mesmerStrikeResolved
} from '#gw2/professions/mesmer/core/mechanics/combat-boundaries.js';
import { illusionSource, timedStacks } from '#gw2/professions/mesmer/core/mechanics/modifier-queries.js';
import { cloneShatterMaterialized } from '#gw2/professions/mesmer/core/mechanics/shatters.js';
import { MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import { createMesmerIllusionRewards } from '#gw2/professions/mesmer/family-resources.js';
import type {
  MesmerResolverContext,
  MesmerResolverEvent,
  MesmerRuntime,
  MesmerRuntimeState
} from '#gw2/professions/mesmer/types.js';

function superiorityComplexTargetControlled(context: Gw2ModifierContext): boolean {
  return ['Fear', 'Taunt'].some((condition) => targetConditionActive(context, condition));
}

function superiorityComplexFactor(context: Gw2ModifierContext): number {
  const superiorityComplexProfile = requireBalanceProfileFromContext(context, TRAIT.SUPERIORITY_COMPLEX);
  // Only supported control conditions and target health qualify; generic disable state is not simulated.
  return superiorityComplexTargetControlled(context) ||
    targetHealthBelow(context, balanceProfileNumber(superiorityComplexProfile, 'threshold'))
    ? balanceProfileNumber(superiorityComplexProfile, 'lowHealthOrDisabledFactor')
    : balanceProfileNumber(superiorityComplexProfile, 'highHealthFactor');
}

/** Fencer's Finesse shares active tuning with its ordered imperative reactions. */
export const fencersFinesse = defineTrait<MesmerSkill>({
  triggers: [
    onTriggerPoint(mesmerStrikeResolved, {
      run: (runtime: MesmerRuntime, input: TriggerPointInput<typeof mesmerStrikeResolved>) =>
        applyFencersFinesse(runtime, input.event)
    })
  ],
  id: TRAIT.FENCERS_FINESSE,
  name: "Fencer's Finesse",
  balance: {
    attributePerStack: 15,
    maximumStacks: 10,
    durationMultiplier: 6,
    rechargeMultiplier: 0.8
  }
});

/** Ineptitude shares active tuning with its ordered imperative reactions. */
export const ineptitude = defineTrait<MesmerSkill>({
  triggers: [
    onTriggerPoint(mesmerConditionApplied, {
      when: (_runtime: unknown, input: TriggerPointInput<typeof mesmerConditionApplied>) =>
        input.event.condition === 'Blindness',
      run: (runtime: MesmerRuntime, input: TriggerPointInput<typeof mesmerConditionApplied>) =>
        triggerIneptitudeFromBlind(runtime, input.event)
    }),
    onTriggerPoint(mesmerControlAccepted, {
      run: (runtime: MesmerRuntime, input: TriggerPointInput<typeof mesmerControlAccepted>) =>
        triggerIneptitudeFromInterrupt(runtime, input.event)
    })
  ],
  id: TRAIT.INEPTITUDE,
  name: 'Ineptitude',
  balance: {
    internalCooldown: 3,
    effects: [{ name: 'Confusion', type: 'condition', condition: 'Confusion', duration: 5, stacks: 2 }]
  }
});

/** Master Fencer shares active tuning with its ordered imperative reactions. */
export const masterFencer = defineTrait<MesmerSkill>({
  triggers: [
    onTriggerPoint(mesmerCritical, {
      run: (runtime: MesmerRuntime, input: TriggerPointInput<typeof mesmerCritical>) =>
        triggerMasterFencer(runtime, input.event, input.chance)
    })
  ],
  id: TRAIT.MASTER_FENCER,
  name: 'Master Fencer',
  balance: {
    internalCooldown: 8,
    effects: [
      {
        type: 'boon',
        name: 'Self Fury',
        audience: { recipients: 'self' },
        boon: 'fury',
        duration: 8,
        stacks: 1
      },
      {
        type: 'boon',
        name: 'Allied Fury',
        boon: 'fury',
        duration: 4,
        stacks: 1,
        // Personal Fury is separate, leaving all four recipient slots for allies.
        audience: { recipients: 'party', maximumRecipients: 4, affectsSelf: false }
      }
    ]
  }
});

/** Sharper Images shares active tuning with its ordered imperative reactions. */
export const sharperImages = defineTrait<MesmerSkill>({
  triggers: [
    onTriggerPoint(mesmerCritical, {
      run: (runtime: MesmerRuntime, input: TriggerPointInput<typeof mesmerCritical>) =>
        triggerSharperImages(runtime, input.event, input.chance)
    })
  ],
  id: TRAIT.SHARPER_IMAGES,
  name: 'Sharper Images',
  balance: {
    effects: [{ name: 'Bleeding', type: 'condition', condition: 'Bleeding', duration: 5, stacks: 1 }]
  }
});

/** Phantasmal Fury shares active tuning with its ordered imperative reactions. */
export const phantasmalFury = defineTrait<MesmerSkill>({
  id: TRAIT.PHANTASMAL_FURY,
  name: 'Phantasmal Fury',
  balance: {
    criticalChance: 0.25
  },
  modifierRules: [
    {
      id: 'mesmer.phantasmal-fury-critical-chance',
      target: MODIFIER_TARGET.CRITICAL_CHANCE,
      operation: 'add',
      order: -1,
      amount: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.PHANTASMAL_FURY), 'criticalChance'),
      when: (context) => context.event?.summonKind === 'phantasm'
    }
  ]
});

/** Superiority Complex shares active tuning with its ordered imperative reactions. */
export const superiorityComplex = defineTrait<MesmerSkill>({
  id: TRAIT.SUPERIORITY_COMPLEX,
  name: 'Superiority Complex',
  balance: {
    highHealthFactor: 1.15,
    lowHealthOrDisabledFactor: 1.25,
    threshold: 0.5
  },
  modifierRules: [
    {
      id: 'mesmer.superiority-complex',
      target: MODIFIER_TARGET.CRITICAL_DAMAGE,
      operation: 'multiply',

      factor: superiorityComplexFactor,
      when: (context) => !illusionSource(context)
    }
  ]
});

/** Blindness follows the native confusion shatter packets at their existing emission boundary. */
export const blindingDissipation = defineTrait<MesmerSkill>({
  triggers: [
    onTriggerPoint(cloneShatterMaterialized, {
      run: (runtime: MesmerRuntime, input: TriggerPointInput<typeof cloneShatterMaterialized>) =>
        triggerBlindingDissipation(runtime, input.skillName, input.at, input.count, input.delivery)
    })
  ],
  id: TRAIT.BLINDING_DISSIPATION,
  name: 'Blinding Dissipation',
  balance: {
    effects: [{ name: 'Blindness', type: 'condition', condition: 'Blindness', stacks: 1, duration: 3 }]
  }
});

/** Mirage invokes this reward only after its dodge has granted cloak. */
export const deceptiveEvasion = defineTrait<MesmerSkill>({
  triggers: [
    onTriggerPoint(mesmerEvaded, {
      run: (runtime: MesmerRuntime, input: TriggerPointInput<typeof mesmerEvaded>) =>
        triggerDeceptiveEvasion(runtime, input.at)
    })
  ],
  id: TRAIT.DECEPTIVE_EVASION,
  name: 'Deceptive Evasion'
});

/** Only the player's resolved critical hits grant Vigor; illusion critical hits never claim the cooldown. */
export const criticalInfusion = defineTrait<MesmerSkill>({
  id: TRAIT.CRITICAL_INFUSION,
  name: 'Critical Infusion',
  balance: {
    internalCooldown: 10,
    effects: [{ type: 'boon', name: 'vigor', boon: 'vigor', duration: 5, stacks: 1 }]
  },
  triggers: [
    {
      on: 'damage.resolved',
      emit: TRAIT.CRITICAL_INFUSION,
      cooldown: 'profile',
      when: (_runtime, event, details) =>
        event.actorType === 'player' &&
        (details.hitContext?.damage ?? 0) > 0 &&
        Boolean(details.hitContext?.critEligible && details.hitContext.critical.didCrit)
    }
  ]
});

/** Only Virtuoso registers this extra Phantasmal Fury contribution; Quiet Intensity supplies its active tuning. */
export const virtuosoPhantasmalFuryRule: Gw2ModifierRule = {
  id: 'mesmer.virtuoso.phantasmal-fury-critical-chance',
  target: MODIFIER_TARGET.CRITICAL_CHANCE,
  operation: 'add',
  amount: (context) =>
    balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.QUIET_INTENSITY), 'phantasmCriticalChance'),
  when: (context) => context.event?.summonKind === 'phantasm' && hasTrait(context, TRAIT.PHANTASMAL_FURY)
};

// Attach Ineptitude's Confusion to a qualifying blindness application through
// the resolver condition hook, preserving causal attribution.
function applyIneptitudeConfusion(context: MesmerResolverContext, event: MesmerResolverEvent, detail: string): void {
  const count = Math.max(1, Math.trunc(event.count || 1));
  const ineptitudeProfile = requireBalanceProfileFromContext(context, TRAIT.INEPTITUDE);
  const effect = requireEffect(ineptitudeProfile, 'condition', 'Confusion');
  if (!effect) return;
  context.effects.emit({
    kind: 'announcement',
    announcement: {
      type: 'trait',
      name: 'Ineptitude',
      at: event.at,
      sourceSkill: event.skillName,
      detail: count > 1 ? `${detail}, ${count} strikes` : detail
    }
  });
  // Resolve Ineptitude immediately so nested condition hooks observe the
  // confusion application during the originating blind/control reaction, with explicit player attribution.
  emitTraitProfile(context, TRAIT.INEPTITUDE, TRAIT.INEPTITUDE, undefined, {
    at: event.at,
    settlement: 'reaction',
    effect: { type: 'condition', name: 'Confusion' },
    transform: (payload) =>
      buildResolverCondition({
        at: event.at,
        name: `${event.skillName} — Ineptitude`,
        skillName: event.skillName,
        condition: String(payload.condition),
        duration: Number(payload.duration),
        stacks: Number(payload.stacks) * count,
        source: 'Player',
        sourceId: TRAIT.INEPTITUDE,
        actorType: 'player'
      })
  });
}

/** Applies the interrupt half of Ineptitude with its defiant-target interval. */
function triggerIneptitudeFromInterrupt(context: MesmerResolverContext, event: MesmerResolverEvent): void {
  if (!context.config.target?.activatingSkills) return;
  const ineptitudeProfile = requireBalanceProfileFromContext(context, TRAIT.INEPTITUDE);
  // A removed Confusion packet owns no interrupt cooldown.
  if (!requireEffect(ineptitudeProfile, 'condition', 'Confusion')) return;
  const defiant = Boolean(context.config.target.defiant);
  // Non-defiant interrupts remain unlimited; defiant targets claim before Confusion can react.
  if (defiant && !context.procs.claim(TRAIT.INEPTITUDE, 'mesmer.core.ineptitude', event.at)) return;

  applyIneptitudeConfusion(context, { ...event, count: defiant ? 1 : event.count }, 'interrupt → blind → confusion');
}

/** Applies the direct-blind half of Ineptitude without an internal cooldown. */
function triggerIneptitudeFromBlind(context: MesmerResolverContext, event: MesmerResolverEvent): void {
  applyIneptitudeConfusion(context, event, 'blind → confusion');
}

/** Emits Blinding Dissipation after the owning shatter has materialized its Confusion. */
function triggerBlindingDissipation(
  context: MesmerRuntime,
  skillName: string,
  at: number,
  count: number,
  delivery: EffectDelivery = {}
): void {
  const profile = requireBalanceProfileFromContext(context, TRAIT.BLINDING_DISSIPATION);
  const effect = requireEffect(profile, 'condition', 'Blindness');
  if (!effect) return;
  // Shatter Blindness keeps its effect actor while using the shared profile payload path.
  emitTraitProfile(context, TRAIT.BLINDING_DISSIPATION, TRAIT.BLINDING_DISSIPATION, delivery.cause ?? undefined, {
    ...delivery,
    at,
    priority: 0,
    effect: { type: 'condition', name: 'Blindness' },
    transform: (payload) =>
      buildResolverCondition({
        at,
        skillName,
        name: 'Blinding Dissipation',
        source: 'Trait',
        sourceId: TRAIT.BLINDING_DISSIPATION,
        actorType: 'effect',
        ownerActorType: 'player',
        condition: 'Blindness',
        stacks: Number(payload.stacks) * count,
        duration: Number(payload.duration)
      })
  });

  context.effects.emit({
    ...delivery,
    kind: 'announcement',
    log: true,
    attribution: { source: 'Trait', sourceId: TRAIT.BLINDING_DISSIPATION, actorType: 'effect' },
    announcement: { type: 'trait', name: 'Blinding Dissipation', at: at, sourceSkill: skillName, detail: '' }
  });
}

/** Materializes Master Fencer before later critical-hit trait effects. */
function triggerMasterFencer(context: MesmerRuntime, event: SimulationEvent, chance: number): void {
  if (!isGw2PlayerActorEvent(event) || !(Number(event.coefficient) > 0) || event.canCrit === false) {
    return;
  }

  // One resolved owner supplies both fury effects and the ICD for this proc attempt.
  const masterFencerProfile = requireBalanceProfileFromContext(context, TRAIT.MASTER_FENCER);
  const furyEffects = ['Self Fury', 'Allied Fury'].flatMap((name) => {
    const effect = requireEffect(masterFencerProfile, 'boon', name);
    return effect ? [effect] : [];
  });
  if (!furyEffects.length) return;
  const application = advanceCriticalProc(
    criticalOpportunity(chance, typeof event.didCrit === 'boolean' ? event.didCrit : undefined),
    {
      id: 'mesmer.core.master-fencer',
      at: event.at
    }
  );
  // Only the canonical critical outcome can claim Master Fencer's cooldown.
  if (!application) return;

  if (
    !context.procs.claimCooldown(
      TRAIT.MASTER_FENCER,
      event.at,
      balanceProfileNumber(masterFencerProfile, 'internalCooldown')
    )
  )
    return;
  // Record one canonical proc as the cause of both grants so the log can summarize their resolved durations.
  const proc = context.effects.emit({
    receipt: true,
    kind: 'announcement',
    cause: event,
    log: true,
    attribution: { source: 'Trait', sourceId: TRAIT.MASTER_FENCER, actorType: 'effect' },
    announcement: { type: 'trait', at: event.at, name: masterFencerProfile.name, sourceSkill: event.skillName }
  });
  // Keep both recipient applications under one announcement while the profile owns their payloads.
  emitTraitProfile(context, TRAIT.MASTER_FENCER, TRAIT.MASTER_FENCER, proc, {
    at: event.at,
    effects: (effect) => effect.type === 'boon' && furyEffects.includes(effect),
    transform: (payload, effect) => ({
      type: 'buff',
      at: event.at,
      source: 'Trait',
      sourceId: TRAIT.MASTER_FENCER,
      actorType: 'player',
      skillId: TRAIT.MASTER_FENCER,
      skillName: 'Master Fencer',
      name: `Master Fencer — ${effect.audience?.recipients ?? 'self'} fury`,
      kind: 'fury',
      duration: payload.duration,
      stacks: Number(payload.stacks),
      audience: effect.audience
    })
  });
}

/** Materializes Sharper Images for clone and phantasm critical observations. */
function triggerSharperImages(context: MesmerRuntime, event: SimulationEvent, chance: number): void {
  if (!['clone', 'phantasm'].includes(event.summonKind || '')) {
    return;
  }

  const sharperImagesProfile = requireBalanceProfileFromContext(context, TRAIT.SHARPER_IMAGES);
  const effect = requireEffect(sharperImagesProfile, 'condition', 'Bleeding');
  if (!effect) return;
  const application = advanceCriticalProc(
    criticalOpportunity(chance, typeof event.didCrit === 'boolean' ? event.didCrit : undefined),
    {
      id: 'mesmer.core.sharper-images',
      at: event.at
    }
  );
  if (!application) return;
  const procCount = application.quantity;

  emitTraitProfile(context, TRAIT.SHARPER_IMAGES, TRAIT.SHARPER_IMAGES, event, {
    at: event.at,
    effect: { type: 'condition', name: 'Bleeding' },
    transform: (payload) => ({
      type: 'condition',
      at: event.at,
      name: `${event.name} — Sharper Images`,
      skillName: event.skillName,
      condition: 'Bleeding',
      duration: Number(payload.duration),
      stacks: procCount * Number(payload.stacks),
      source: 'Player',
      sourceId: TRAIT.SHARPER_IMAGES,
      actorType: 'player'
    })
  });
  context.effects.emit({
    kind: 'announcement',
    log: true,
    attribution: { source: 'Trait', sourceId: TRAIT.SHARPER_IMAGES, actorType: 'effect' },
    announcement: {
      type: 'trait',
      name: 'Sharper Images',
      at: event.at,
      sourceSkill: event.skillName,
      detail: `${procCount} critical-hit proc${procCount === 1 ? '' : 's'}`
    }
  });
}

/** Read fixed stack tuning with the parent query cache while the applied stacks remain live. */
export function prepareFencersFinesse(context: Gw2ModifierContext) {
  const profile = requireBalanceProfileFromContext(context, TRAIT.FENCERS_FINESSE);
  return {
    duration: balanceProfileNumber(profile, 'durationMultiplier'),
    maximum: balanceProfileNumber(profile, 'maximumStacks'),
    perStack: balanceProfileNumber(profile, 'attributePerStack')
  };
}

/** Applied sword stacks retain their contribution even if the current selection changes. */
export function fencersFinesseFerocity(
  context: Gw2ModifierContext,
  facts: ReturnType<typeof prepareFencersFinesse>
): number {
  return timedStacks(context, 'fencer', facts.duration, facts.maximum) * facts.perStack;
}

/** Queue the dodge reward through the caller's resource owner after Mirage grants cloak. */
function triggerDeceptiveEvasion(runtime: MesmerRuntime, at: number): void {
  createMesmerIllusionRewards(runtime).queueResources(
    at,
    1,
    gw2ActivePrimaryWeapon(runtime.config, runtime.activeWeaponSet === 1 ? 1 : 2) || '',
    'Deceptive Evasion',
    {
      traitId: TRAIT.DECEPTIVE_EVASION,
      traitName: 'Deceptive Evasion'
    }
  );
}

/** Apply the sword multiplier alongside shatter recharge before any flat resource reduction. */
export const fencersFinesseRecharge = compileRechargeRules<MesmerRuntimeState, MesmerSkill>([
  {
    trait: TRAIT.FENCERS_FINESSE,
    when: (_runtime, skill) => skill.weapon === 'Sword',
    multiplier: { profile: TRAIT.FENCERS_FINESSE, field: 'rechargeMultiplier' }
  }
]);

/** Sword strikes grant one live scalar-tuned stack after critical rewards; only the first hit announces the proc. */
function applyFencersFinesse(runtime: MesmerRuntime, event: SimulationEvent): void {
  const skill = runtime.helpers.skillsById.get(event.skillId ?? '');
  if (!skill || skill.weapon !== 'Sword' || event.summonKind === 'clone') return;
  const profile = requireBalanceProfileFromContext(runtime, TRAIT.FENCERS_FINESSE);
  const traitSource = {
    source: 'Trait',
    sourceId: TRAIT.FENCERS_FINESSE,
    actorType: 'player' as const,
    skillId: TRAIT.FENCERS_FINESSE,
    skillName: profile.name
  };
  const proc =
    Number(event.hitIndex ?? 1) === 1
      ? runtime.effects.emit({
          receipt: true,
          kind: 'announcement',
          log: true,
          attribution: { ...traitSource, actorType: 'effect' },
          announcement: { type: 'trait', name: profile.name, at: event.at, sourceSkill: skill.name, detail: '' }
        })
      : undefined;
  // Finesse is a runtime stack backed by scalar tuning, not a balance-profile payload.
  runtime.effects.emit({
    kind: 'packet',
    cause: proc,
    event: {
      priority: 5,
      kind: 'fencer',
      stacks: 1,
      duration: balanceProfileNumber(profile, 'durationMultiplier'),
      ...traitSource,
      type: 'buff',
      at: event.at,
      name: profile.name,
      sourceSkill: skill.name
    }
  });
}
