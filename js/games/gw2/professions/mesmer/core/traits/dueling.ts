import type { MesmerRuntime } from '#gw2/professions/mesmer/types.js';
import { buildResolverCondition } from '#gw2/platform/resolver/packets.js';
/** Owns imperative Core Mesmer Dueling trait effects. */
import {
  requireBalanceProfileFromContext,
  requireEffect,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { isInternalCooldownReady } from '#kernel/core/clock.js';
import { tryConsumeProcCooldown } from '#gw2/platform/combat/procs.js';
import { advanceCriticalProc, criticalOpportunity } from '#gw2/platform/combat/critical-procs.js';
import { isGw2PlayerActorEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import type { SimulationEvent } from '#gw2/platform/engine/events/events.js';
import { MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';

import type {
  MesmerAddEvent,
  MesmerAddTraitProc,
  MesmerEmitDerivedEvent,
  MesmerResolverContext,
  MesmerResolverEvent,
  MesmerMechanics
} from '#gw2/professions/mesmer/types.js';

import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';

export interface MesmerDuelingCriticalContext {
  readonly state: MesmerRuntime;
  readonly traits: ReadonlySet<number>;
  readonly emitEvent: MesmerEmitDerivedEvent;
  readonly boonDuration: (boon: string, baseDuration: number) => number;
  readonly addTraitProc: MesmerAddTraitProc;
  readonly balanceProfile: MesmerMechanics['balanceProfile'];
}

interface FencersFinesseContext {
  readonly traits: ReadonlySet<number>;
  readonly addEvent: MesmerAddEvent;
  readonly addTraitProc: MesmerAddTraitProc;
}

type BlindingDissipationContext = Pick<MesmerMechanics, 'traits' | 'addEvent' | 'addTraitProc'>;

// Attach Ineptitude's Confusion to a qualifying blindness application through
// the resolver condition hook, preserving causal attribution.
function applyIneptitudeConfusion(context: MesmerResolverContext, event: MesmerResolverEvent, detail: string): void {
  if (!context.traits.has(TRAIT.INEPTITUDE)) return;
  const count = Math.max(1, Math.trunc(Number(event.count || 1)));
  const ineptitudeProfile = requireBalanceProfileFromContext(context, TRAIT.INEPTITUDE);
  const effect = requireEffect(ineptitudeProfile, 'condition', 'Confusion');
  if (!effect) return;
  context.recordProc(
    'trait',
    'Ineptitude',
    event.at,
    event.skillName,
    count > 1 ? `${detail}, ${count} strikes` : detail
  );
  // Resolve Ineptitude immediately so nested condition hooks observe the
  // confusion application during the originating blind/control reaction, with explicit player attribution.
  context.applyCondition(
    buildResolverCondition({
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
  );
}

/** Applies the interrupt half of Ineptitude with its defiant-target interval. */
export function triggerIneptitudeFromInterrupt(context: MesmerResolverContext, event: MesmerResolverEvent): void {
  if (!context.traits.has(TRAIT.INEPTITUDE)) return;
  const ineptitudeProfile = requireBalanceProfileFromContext(context, TRAIT.INEPTITUDE);
  // A removed Confusion packet owns no interrupt cooldown.
  if (!requireEffect(ineptitudeProfile, 'condition', 'Confusion')) return;
  const defiant = Boolean(context.config.target?.defiant);
  if (defiant && !isInternalCooldownReady(event.at, context.profession.core.ineptitudeReadyAt)) return;
  if (defiant) {
    context.profession.core.ineptitudeReadyAt = event.at + balanceProfileNumber(ineptitudeProfile, 'internalCooldown');
  }

  applyIneptitudeConfusion(context, { ...event, count: defiant ? 1 : event.count }, 'interrupt → blind → confusion');
}

/** Applies the direct-blind half of Ineptitude without an internal cooldown. */
export function triggerIneptitudeFromBlind(context: MesmerResolverContext, event: MesmerResolverEvent): void {
  applyIneptitudeConfusion(context, event, 'blind → confusion');
}

/** Emits Blinding Dissipation after the owning shatter has materialized its Confusion. */
export function triggerBlindingDissipation(
  context: BlindingDissipationContext,
  skillName: string,
  at: number,
  count: number
): void {
  if (!context.traits.has(TRAIT.BLINDING_DISSIPATION)) return;
  context.addEvent({ type: 'blind', at, skillName, count });
  context.addTraitProc('Blinding Dissipation', at, skillName);
}

/** Emits Fencer's Finesse stacks at the materialized sword-hit cadence. */
export function emitFencersFinesseStacks(
  context: FencersFinesseContext & Pick<MesmerMechanics, 'balanceProfile'>,
  skill: MesmerSkill,
  hitTimes: readonly number[],
  hits: number | undefined
): number {
  if (!context.traits.has(TRAIT.FENCERS_FINESSE) || skill.weapon !== 'Sword' || hitTimes.length === 0) {
    return Infinity;
  }

  const fencersFinesseProfile = requireBalanceProfileFromContext(context, TRAIT.FENCERS_FINESSE);
  // Stack lifetime and cap come from the selected trait profile.
  const duration = balanceProfileNumber(fencersFinesseProfile, 'durationMultiplier');
  const maximum = balanceProfileNumber(fencersFinesseProfile, 'maximumStacks');
  const hitCount = Math.max(1, Math.trunc(Number(hits || 1)));
  if (hitTimes.length === hitCount) {
    for (const hitAt of hitTimes) {
      context.addEvent({
        type: 'buff',
        at: hitAt,
        // The triggering sword packet resolves before its same-time stack.
        priority: 5,
        kind: 'fencer',
        stacks: 1,
        duration
      });
    }

    return Math.min(...hitTimes);
  }

  context.addEvent({
    type: 'buff',
    at: hitTimes[0],
    priority: 5,
    kind: 'fencer',
    stacks: Math.min(maximum, hitCount),
    duration
  });
  return hitTimes[0];
}

/** Records one Fencer's Finesse proc after all qualifying hit groups are scheduled. */
export function recordFencersFinesseProc(
  context: FencersFinesseContext,
  skill: MesmerSkill,
  firstTriggerAt: number
): void {
  if (Number.isFinite(firstTriggerAt)) {
    context.addTraitProc("Fencer's Finesse", firstTriggerAt, skill.name);
  }
}

/** Materializes Master Fencer before later critical-hit trait effects. */
export function triggerMasterFencer(
  context: MesmerDuelingCriticalContext,
  event: SimulationEvent,
  chance: number
): void {
  if (
    !context.traits.has(TRAIT.MASTER_FENCER) ||
    !isGw2PlayerActorEvent(event) ||
    !(Number(event.coefficient) > 0) ||
    event.noCrit === true ||
    event.canCrit === false
  ) {
    return;
  }

  // One resolved owner supplies both fury effects and the ICD for this proc attempt.
  const core = professionCoreState(context.state);
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
    !tryConsumeProcCooldown(
      core.traitReadyAt,
      TRAIT.MASTER_FENCER,
      event.at,
      balanceProfileNumber(masterFencerProfile, 'internalCooldown')
    )
  )
    return;
  context.addTraitProc('Master Fencer', event.at, event.skillName, '8s self fury, 4s allied fury');
  for (const effect of furyEffects) {
    context.emitEvent(event, {
      type: 'buff',
      at: event.at,
      source: 'Trait',
      sourceId: TRAIT.MASTER_FENCER,
      actorType: 'player',
      skillId: TRAIT.MASTER_FENCER,
      skillName: 'Master Fencer',
      name: `Master Fencer — ${effect.audience?.recipients ?? 'self'} fury`,
      kind: 'fury',
      duration: context.boonDuration(String(effect.boon), Number(effect.duration)),
      stacks: Number(effect.stacks),
      audience: effect.audience
    });
  }
}

/** Materializes Sharper Images for clone and phantasm critical observations. */
export function triggerSharperImages(
  context: MesmerDuelingCriticalContext,
  event: SimulationEvent,
  chance: number
): void {
  if (!context.traits.has(TRAIT.SHARPER_IMAGES) || !['clone', 'phantasm'].includes(String(event.summonKind || ''))) {
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

  context.emitEvent(event, {
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
  });
  context.addTraitProc(
    'Sharper Images',
    event.at,
    event.skillName,
    `${procCount} critical-hit proc${procCount === 1 ? '' : 's'}`
  );
}
