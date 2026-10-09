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
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import { compileRechargeRules } from '#gw2/platform/profession-definition/trigger-rules.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { MesmerQueueResources } from '#gw2/professions/mesmer/core/mechanics/illusions/types.js';
import { illusionSource, timedStacks } from '#gw2/professions/mesmer/core/mechanics/modifier-queries.js';
import { mesmerPacketOwner } from '#gw2/professions/mesmer/core/mechanics/packets.js';
import { MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import type { MesmerEventExtra, MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
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
  id: TRAIT.INEPTITUDE,
  name: 'Ineptitude',
  balance: {
    internalCooldown: 3,
    effects: [{ name: 'Confusion', type: 'condition', condition: 'Confusion', duration: 5, stacks: 2 }]
  }
});

/** Master Fencer shares active tuning with its ordered imperative reactions. */
export const masterFencer = defineTrait<MesmerSkill>({
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
  id: TRAIT.BLINDING_DISSIPATION,
  name: 'Blinding Dissipation',
  balance: {
    effects: [{ name: 'Blindness', type: 'condition', condition: 'Blindness', stacks: 1, duration: 3 }]
  }
});

/** Mirage invokes this reward only after its dodge has granted cloak. */
export const deceptiveEvasion = defineTrait<MesmerSkill>({ id: TRAIT.DECEPTIVE_EVASION, name: 'Deceptive Evasion' });

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

export interface MesmerDuelingCriticalContext {
  readonly state: MesmerRuntime;
}

// Attach Ineptitude's Confusion to a qualifying blindness application through
// the resolver condition hook, preserving causal attribution.
function applyIneptitudeConfusion(context: MesmerResolverContext, event: MesmerResolverEvent, detail: string): void {
  if (!hasTrait(context, TRAIT.INEPTITUDE)) return;
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
  context.effects.emit({
    kind: 'packet',
    settlement: 'reaction',
    event: buildResolverCondition({
      at: event.at,
      name: `${event.skillName} — Ineptitude`,
      skillName: event.skillName,
      condition: String(effect.condition),
      duration: Number(effect.duration),
      stacks: Number(effect.stacks) * count,
      source: 'Player',
      sourceId: TRAIT.INEPTITUDE,
      actorType: 'player'
    })
  });
}

/** Applies the interrupt half of Ineptitude with its defiant-target interval. */
export function triggerIneptitudeFromInterrupt(context: MesmerResolverContext, event: MesmerResolverEvent): void {
  if (!context.config.target?.activatingSkills || !hasTrait(context, TRAIT.INEPTITUDE)) return;
  const ineptitudeProfile = requireBalanceProfileFromContext(context, TRAIT.INEPTITUDE);
  // A removed Confusion packet owns no interrupt cooldown.
  if (!requireEffect(ineptitudeProfile, 'condition', 'Confusion')) return;
  const defiant = Boolean(context.config.target.defiant);
  // Non-defiant interrupts remain unlimited; defiant targets claim before Confusion can react.
  if (defiant && !context.procs.claim(TRAIT.INEPTITUDE, 'mesmer.core.ineptitude', event.at)) return;

  applyIneptitudeConfusion(context, { ...event, count: defiant ? 1 : event.count }, 'interrupt → blind → confusion');
}

/** Applies the direct-blind half of Ineptitude without an internal cooldown. */
export function triggerIneptitudeFromBlind(context: MesmerResolverContext, event: MesmerResolverEvent): void {
  applyIneptitudeConfusion(context, event, 'blind → confusion');
}

/** Emits Blinding Dissipation after the owning shatter has materialized its Confusion. */
export function triggerBlindingDissipation(
  context: MesmerRuntime,
  skillName: string,
  at: number,
  count: number,
  delivery: EffectDelivery = {}
): void {
  if (!hasTrait(context, TRAIT.BLINDING_DISSIPATION)) return;
  const profile = requireBalanceProfileFromContext(context, TRAIT.BLINDING_DISSIPATION);
  const effect = requireEffect(profile, 'condition', 'Blindness');
  if (!effect) return;
  {
    const packet = buildResolverCondition({
      at,
      skillName,
      name: 'Blinding Dissipation',
      source: 'Trait',
      sourceId: TRAIT.BLINDING_DISSIPATION,
      actorType: 'effect',
      ownerActorType: 'player',
      condition: 'Blindness',
      stacks: Number(effect.stacks) * count,
      duration: Number(effect.duration)
    });
    context.effects.emit({
      ...delivery,
      kind: 'packet',
      event: packet,
      owner: mesmerPacketOwner(packet),
      priority: 0
    });
  }

  context.effects.emit({
    ...delivery,
    kind: 'announcement',
    log: true,
    attribution: { source: 'Trait', sourceId: TRAIT.BLINDING_DISSIPATION, actorType: 'effect' },
    announcement: { type: 'trait', name: 'Blinding Dissipation', at: at, sourceSkill: skillName, detail: '' }
  });
}

/** Emits one Fencer's Finesse stack after each eligible resolved sword hit. */
function emitFencersFinesseStacks(context: MesmerRuntime, skill: MesmerSkill, at: number, announce: boolean): void {
  if (!hasTrait(context, TRAIT.FENCERS_FINESSE) || skill.weapon !== 'Sword') {
    return;
  }

  const fencersFinesseProfile = requireBalanceProfileFromContext(context, TRAIT.FENCERS_FINESSE);
  // The profile supplies stack lifetime; the attribute modifier owns the cap.
  const duration = balanceProfileNumber(fencersFinesseProfile, 'durationMultiplier');
  {
    const grants: readonly MesmerEventExtra[] = [
      {
        // The triggering sword packet resolves before its same-time stack.
        priority: 5,
        kind: 'fencer',
        stacks: 1,
        duration
      }
    ];
    const traitProfile = requireBalanceProfileFromContext(context, TRAIT.FENCERS_FINESSE);
    const traitSource = {
      source: 'Trait',
      sourceId: TRAIT.FENCERS_FINESSE,
      actorType: 'player' as const,
      skillId: TRAIT.FENCERS_FINESSE,
      skillName: traitProfile.name
    };
    const options: { detail?: string; announce?: boolean } = { announce };
    if (grants.length) {
      const proc =
        options.announce !== false
          ? context.effects.emit({
              receipt: true,
              kind: 'announcement',
              log: true,
              attribution: { ...traitSource, actorType: 'effect' },
              announcement: {
                type: 'trait',
                name: traitProfile.name,
                at: at,
                sourceSkill: skill.name,
                detail: options.detail ?? ''
              }
            })
          : undefined;
      for (const grant of grants)
        context.effects.emit({
          kind: 'packet',
          cause: proc,
          event: { ...grant, ...traitSource, type: 'buff', at: at, name: traitProfile.name, sourceSkill: skill.name }
        });
    }
  }
}

/** Materializes Master Fencer before later critical-hit trait effects. */
export function triggerMasterFencer(
  context: MesmerDuelingCriticalContext,
  event: SimulationEvent,
  chance: number
): void {
  if (
    !hasTrait(context.state, TRAIT.MASTER_FENCER) ||
    !isGw2PlayerActorEvent(event) ||
    !(Number(event.coefficient) > 0) ||
    event.canCrit === false
  ) {
    return;
  }

  // One resolved owner supplies both fury effects and the ICD for this proc attempt.
  const masterFencerProfile = requireBalanceProfileFromContext(context.state, TRAIT.MASTER_FENCER);
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
    !context.state.procs.claimCooldown(
      TRAIT.MASTER_FENCER,
      event.at,
      balanceProfileNumber(masterFencerProfile, 'internalCooldown')
    )
  )
    return;
  // Record one canonical proc as the cause of both grants so the log can summarize their resolved durations.
  const proc = context.state.effects.emit({
    receipt: true,
    kind: 'announcement',
    cause: event,
    log: true,
    attribution: { source: 'Trait', sourceId: TRAIT.MASTER_FENCER, actorType: 'effect' },
    announcement: { type: 'trait', at: event.at, name: masterFencerProfile.name, sourceSkill: event.skillName }
  });
  for (const effect of furyEffects) {
    context.state.effects.emit({
      kind: 'packet',
      cause: proc,
      event: {
        type: 'buff',
        at: event.at,
        source: 'Trait',
        sourceId: TRAIT.MASTER_FENCER,
        actorType: 'player',
        skillId: TRAIT.MASTER_FENCER,
        skillName: 'Master Fencer',
        name: `Master Fencer — ${effect.audience?.recipients ?? 'self'} fury`,
        kind: 'fury',
        duration: effect.duration,
        stacks: Number(effect.stacks),
        audience: effect.audience
      }
    });
  }
}

/** Materializes Sharper Images for clone and phantasm critical observations. */
export function triggerSharperImages(
  context: MesmerDuelingCriticalContext,
  event: SimulationEvent,
  chance: number
): void {
  if (!hasTrait(context.state, TRAIT.SHARPER_IMAGES) || !['clone', 'phantasm'].includes(event.summonKind || '')) {
    return;
  }

  const sharperImagesProfile = requireBalanceProfileFromContext(context.state, TRAIT.SHARPER_IMAGES);
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

  context.state.effects.emit({
    kind: 'packet',
    cause: event,
    event: {
      type: 'condition',
      at: event.at,
      name: `${event.name} — Sharper Images`,
      skillName: event.skillName,
      condition: 'Bleeding',
      duration: Number(effect.duration),
      stacks: procCount * Number(effect.stacks),
      source: 'Player',
      sourceId: TRAIT.SHARPER_IMAGES,
      actorType: 'player'
    }
  });
  context.state.effects.emit({
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

/** Resolve the sword reward after the shared critical observation and before later elite reactions. */
export function applyFencersFinesse(runtime: MesmerRuntime, event: SimulationEvent): void {
  const skill = runtime.helpers.skillsById.get(event.skillId ?? '');
  if (!skill) return;
  if (event.summonKind !== 'clone')
    emitFencersFinesseStacks(runtime, skill, event.at, Number(event.hitIndex ?? 1) === 1);
}

/** Queue the dodge reward through the caller's resource owner after Mirage grants cloak. */
export function triggerDeceptiveEvasion(runtime: MesmerRuntime, queueResources: MesmerQueueResources): void {
  if (!hasTrait(runtime, TRAIT.DECEPTIVE_EVASION)) return;
  queueResources(
    runtime.time,
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

/** Master Fencer must resolve before Sharper Images observes the same critical hit. */
export function triggerMesmerCriticalTraits(
  context: MesmerDuelingCriticalContext,
  event: SimulationEvent,
  chance: number
): void {
  triggerMasterFencer(context, event, chance);
  triggerSharperImages(context, event, chance);
}
