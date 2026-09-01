/** Owns imperative Core Mesmer Dueling trait effects. */
import {
  balanceProfileFromContext,
  balanceProfileEffect,
  balanceProfileValueFromContext
} from '#gw2/platform/combat/state/balance-profiles.js';
import { isInternalCooldownReady } from '#kernel/core/clock.js';
import { advanceCriticalProc, criticalOpportunity } from '#gw2/platform/combat/critical-procs.js';
import { isGw2PlayerActorEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import type { SchedulerState, SimulationEvent } from '#gw2/platform/engine/types.js';
import { MESMER_TRAIT_IDS as TRAIT } from '#gw2/content/professions/mesmer/data/ids.js';

import type {
  MesmerAddEvent,
  MesmerAddTraitProc,
  MesmerEmitDerivedEvent,
  MesmerResolverContext,
  MesmerResolverEvent,
  MesmerRuntime
} from '#gw2/content/professions/mesmer/types.js';
import type { MesmerRuntimeState } from '#gw2/content/professions/mesmer/state/types.js';

import type { MesmerSkill } from '#gw2/content/professions/mesmer/data/types.js';

export interface MesmerDuelingCriticalContext {
  readonly state: SchedulerState<MesmerRuntimeState>;
  readonly traits: ReadonlySet<number>;
  readonly stochastic: boolean;
  readonly emitEvent: MesmerEmitDerivedEvent;
  readonly boonDuration: (boon: string, baseDuration: number) => number;
  readonly addTraitProc: MesmerAddTraitProc;
  readonly balanceProfile: MesmerRuntime['balanceProfile'];
}

interface FencersFinesseContext {
  readonly traits: ReadonlySet<number>;
  readonly epsilon: number;
  readonly addEvent: MesmerAddEvent;
  readonly addTraitProc: MesmerAddTraitProc;
}

type BlindingDissipationContext = Pick<MesmerRuntime, 'traits' | 'addEvent' | 'addTraitProc'>;

// Attach Ineptitude's Confusion to a qualifying blindness application through
// the resolver condition hook, preserving causal attribution.
function applyIneptitudeConfusion(context: MesmerResolverContext, event: MesmerResolverEvent, detail: string): void {
  if (!context.traits.has(TRAIT.INEPTITUDE)) return;
  const count = Math.max(1, Math.trunc(Number(event.count || 1)));
  const effect = balanceProfileEffect(balanceProfileFromContext(context, TRAIT.INEPTITUDE), 'condition');
  context.recordProc(
    'trait',
    'Ineptitude',
    event.at,
    event.skillName,
    count > 1 ? `${detail}, ${count} strikes` : detail
  );
  // Resolve Ineptitude immediately so nested condition hooks observe the
  // confusion application during the originating blind/control reaction.
  context.applyCondition({
    type: 'condition',
    at: event.at,
    name: `${event.skillName} — Ineptitude`,
    skillName: event.skillName,
    condition: String(effect?.condition || 'Confusion'),
    duration: Number(effect?.duration || 5),
    stacks: Number(effect?.stacks || 2) * count,
    source: 'Player'
  });
}

/** Applies the interrupt half of Ineptitude with its defiant-target interval. */
export function triggerIneptitudeFromInterrupt(context: MesmerResolverContext, event: MesmerResolverEvent): void {
  if (!context.traits.has(TRAIT.INEPTITUDE)) return;
  const defiant = Boolean(context.config.target?.defiant);
  if (defiant && !isInternalCooldownReady(event.at, context.profession.ineptitudeReadyAt)) return;
  if (defiant) {
    context.profession.ineptitudeReadyAt =
      event.at + balanceProfileValueFromContext(context, TRAIT.INEPTITUDE, 'internalCooldown', 3);
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
  context: FencersFinesseContext,
  skill: MesmerSkill,
  hitTimes: readonly number[],
  hits: number | undefined
): number {
  if (!context.traits.has(TRAIT.FENCERS_FINESSE) || skill.weapon !== 'Sword' || hitTimes.length === 0) {
    return Infinity;
  }

  const hitCount = Math.max(1, Math.trunc(Number(hits || 1)));
  if (hitTimes.length === hitCount) {
    for (const hitAt of hitTimes) {
      context.addEvent({
        type: 'buff',
        at: hitAt + context.epsilon,
        kind: 'fencer',
        stacks: 1,
        duration: 6
      });
    }

    return Math.min(...hitTimes) + context.epsilon;
  }

  context.addEvent({
    type: 'buff',
    at: hitTimes[0] + context.epsilon,
    kind: 'fencer',
    stacks: Math.min(10, hitCount),
    duration: 6
  });
  return hitTimes[0] + context.epsilon;
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

  const core = professionCoreState(context.state);
  const tracker = { progress: core.masterFencerProgress, readyAt: 0 };
  const application = advanceCriticalProc(
    criticalOpportunity(chance, typeof event.didCrit === 'boolean' ? event.didCrit : undefined),
    {
      id: 'mesmer.core.master-fencer',
      at: event.at,
      stochastic: context.stochastic
    },
    tracker
  );
  core.masterFencerProgress = tracker.progress;

  const readyAt = Number(core.traitReadyAt[TRAIT.MASTER_FENCER] || 0);
  // Master Fencer historically consumes expected threshold crossings during
  // its ICD, so cooldown gating remains after the shared progress advance.
  if (!application || !isInternalCooldownReady(event.at, readyAt)) return;

  const profile = context.balanceProfile(TRAIT.MASTER_FENCER);
  core.traitReadyAt[TRAIT.MASTER_FENCER] = event.at + Number(profile?.internalCooldown || 8);
  context.addTraitProc('Master Fencer', event.at, event.skillName, '8s self fury, 4s allied fury');
  const furyEffects = (profile?.effects || []).filter((effect) => effect.type === 'boon');
  for (const [index, application] of [
    { audience: { recipients: 'self' as const }, duration: 8 },
    { audience: { recipients: 'party' as const }, duration: 4 }
  ].entries()) {
    const effect = furyEffects[index];
    context.emitEvent(event, {
      type: 'buff',
      at: event.at,
      source: 'Trait',
      sourceId: TRAIT.MASTER_FENCER,
      actorType: 'player',
      skillId: TRAIT.MASTER_FENCER,
      skillName: 'Master Fencer',
      name: `Master Fencer — ${application.audience.recipients} fury`,
      kind: 'fury',
      duration: context.boonDuration(String(effect?.boon || 'fury'), Number(effect?.duration ?? application.duration)),
      stacks: Number(effect?.stacks || 1),
      audience: effect?.audience ?? application.audience
    });
  }
}

/** Materializes Sharper Images for clone and phantasm critical observations. */
export function triggerSharperImages(
  context: MesmerDuelingCriticalContext,
  event: SimulationEvent,
  chance: number
): void {
  if (!context.traits.has(TRAIT.SHARPER_IMAGES) || (event.source !== 'Clone' && event.source !== 'Phantasm')) {
    return;
  }

  const core = professionCoreState(context.state);
  const tracker = { progress: core.sharperImagesProgress, readyAt: 0 };
  const application = advanceCriticalProc(
    criticalOpportunity(chance, typeof event.didCrit === 'boolean' ? event.didCrit : undefined),
    {
      id: 'mesmer.core.sharper-images',
      at: event.at,
      stochastic: context.stochastic
    },
    tracker
  );
  core.sharperImagesProgress = tracker.progress;
  if (!application) return;
  const procCount = application.quantity;
  const effect = context.balanceProfile(TRAIT.SHARPER_IMAGES)?.effects?.find(({ type }) => type === 'condition');

  context.emitEvent(event, {
    type: 'condition',
    at: event.at,
    name: `${event.name} — Sharper Images`,
    skillName: event.skillName,
    condition: 'Bleeding',
    duration: Number(effect?.duration || 5),
    stacks: procCount * Number(effect?.stacks || 1),
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
