import { professionCoreState } from '../../../../platform/engine/profession/state.js';
import { isInternalCooldownReady } from '../../../../../../kernel/core/clock.js';
import { advanceCriticalProc, criticalOpportunity } from '../../../../platform/combat/critical-procs.js';
import { isGw2PlayerActorEvent } from '../../../../platform/combat/state/event-ownership.js';
import { MESMER_TRAIT_IDS as TRAIT } from '../data/ids.js';
import type { SchedulerState, SimulationEvent } from '../../../../platform/engine/types.js';
import type {
  MesmerAddTraitProc,
  MesmerConfig,
  MesmerEmitDerivedEvent,
  MesmerExpectedProcCandidate,
  MesmerExpectedProcTracker,
  MesmerRuntime,
  MesmerRuntimeState
} from '../types.js';

interface ExpectedProcTrackerOptions {
  readonly state: SchedulerState<MesmerRuntimeState>;
  readonly config: MesmerConfig;
  readonly traits: ReadonlySet<number>;
  readonly criticalChance: (event: SimulationEvent) => number;
  readonly emitEvent: MesmerEmitDerivedEvent;
  readonly boonDuration: (boon: string, baseDuration: number) => number;
  readonly addTraitProc: MesmerAddTraitProc;
  readonly balanceProfile: MesmerRuntime['balanceProfile'];
}

/**
 * Materializes shared Mesmer critical traits from deterministic expected
 * frequency or stochastic hit facts.
 */
export function createExpectedProcTracker({
  state,
  config,
  traits,
  criticalChance,
  emitEvent,
  boonDuration,
  addTraitProc,
  balanceProfile
}: ExpectedProcTrackerOptions): Readonly<MesmerExpectedProcTracker> {
  const profileEffect = (id: number, type: string, index = 0) =>
    balanceProfile(id)?.effects?.filter((effect) => effect.type === type)[index];
  const stochastic = config.randomness?.mode === 'stochastic';

  // Turn sampled or accumulated expected criticals into one ICD-bound Master
  // Fencer activation, then emit its distinct self and allied Fury applications.
  const materializeMasterFencer = (event: SimulationEvent, chance: number): void => {
    if (
      !traits.has(TRAIT.MASTER_FENCER) ||
      !isGw2PlayerActorEvent(event) ||
      !(Number(event.coefficient) > 0) ||
      event.noCrit === true ||
      event.canCrit === false
    ) {
      return;
    }

    const core = professionCoreState(state);
    const tracker = { progress: core.masterFencerProgress, readyAt: 0 };
    const application = advanceCriticalProc(
      criticalOpportunity(chance, typeof event.didCrit === 'boolean' ? event.didCrit : undefined),
      {
        id: 'mesmer.core.master-fencer',
        at: event.at,
        stochastic
      },
      tracker
    );
    core.masterFencerProgress = tracker.progress;

    const readyAt = Number(core.traitReadyAt[TRAIT.MASTER_FENCER] || 0);
    // Master Fencer historically consumes expected threshold crossings during
    // its ICD, so cooldown gating remains after the shared progress advance.
    if (!application || !isInternalCooldownReady(event.at, readyAt)) return;

    const profile = balanceProfile(TRAIT.MASTER_FENCER);
    core.traitReadyAt[TRAIT.MASTER_FENCER] = event.at + Number(profile?.internalCooldown || 8);
    addTraitProc('Master Fencer', event.at, event.skillName, '8s self fury, 4s allied fury');
    const furyEffects = (profile?.effects || []).filter((effect) => effect.type === 'boon');
    for (const [index, application] of [
      { recipients: 'self' as const, duration: 8 },
      { recipients: 'allies' as const, duration: 4 }
    ].entries()) {
      const effect = furyEffects[index];
      emitEvent(event, {
        type: 'buff',
        at: event.at,
        source: 'Trait',
        sourceId: TRAIT.MASTER_FENCER,
        actorType: 'player',
        skillId: TRAIT.MASTER_FENCER,
        skillName: 'Master Fencer',
        name: `Master Fencer — ${application.recipients} fury`,
        kind: 'fury',
        duration: boonDuration(String(effect?.boon || 'fury'), Number(effect?.duration ?? application.duration)),
        stacks: Number(effect?.stacks || 1),
        recipients: application.recipients,
        affectsSelf: application.recipients === 'self',
        ...(application.recipients === 'allies'
          ? {
              maximumRecipients: Number(effect?.maximumRecipients || 4)
            }
          : {})
      });
    }
  };

  // Feed one critical observation through Master Fencer and illusion-only
  // Sharper Images while preserving fractional progress in deterministic mode.
  const materializeCriticalTraits = (event: SimulationEvent): void => {
    const chance = Number(criticalChance(event) || 0);
    materializeMasterFencer(event, chance);
    if (!traits.has(TRAIT.SHARPER_IMAGES) || (event.source !== 'Clone' && event.source !== 'Phantasm')) return;

    const core = professionCoreState(state);
    const tracker = { progress: core.sharperImagesProgress, readyAt: 0 };
    const application = advanceCriticalProc(
      criticalOpportunity(chance, typeof event.didCrit === 'boolean' ? event.didCrit : undefined),
      {
        id: 'mesmer.core.sharper-images',
        at: event.at,
        stochastic
      },
      tracker
    );
    core.sharperImagesProgress = tracker.progress;
    if (!application) return;
    const procCount = application.quantity;

    emitEvent(event, {
      type: 'condition',
      at: event.at,
      name: `${event.name} — Sharper Images`,
      skillName: event.skillName,
      condition: 'Bleeding',
      duration: Number(profileEffect(TRAIT.SHARPER_IMAGES, 'condition')?.duration || 5),
      stacks: procCount * Number(profileEffect(TRAIT.SHARPER_IMAGES, 'condition')?.stacks || 1),
      source: 'Player',
      sourceId: TRAIT.SHARPER_IMAGES,
      actorType: 'player'
    });
    addTraitProc(
      'Sharper Images',
      event.at,
      event.skillName,
      `${procCount} critical-hit proc${procCount === 1 ? '' : 's'}`
    );
  };

  return Object.freeze({
    process(candidate: MesmerExpectedProcCandidate): void {
      materializeCriticalTraits(candidate.event);
    }
  });
}
