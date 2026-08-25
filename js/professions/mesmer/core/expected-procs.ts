import { professionCoreState } from '../../../platform/engine/profession/state.js';
import { isInternalCooldownReady } from '../../../platform/engine/core/clock.js';
import { isGw2PlayerActorEvent } from '../../../platform/gw2/combat/state/event-ownership.js';
import { MESMER_TRAIT_IDS as TRAIT } from '../data/ids.js';
import type { SchedulerState, SimulationEvent } from '../../../platform/engine/types.js';
import type {
  MesmerAddTraitProc,
  MesmerConfig,
  MesmerEmitDerivedEvent,
  MesmerExpectedProcCandidate,
  MesmerExpectedProcTracker,
  MesmerRuntime,
  MesmerRuntimeState
} from '../types.js';

const PROC_PROGRESS_TOLERANCE = 1e-9;

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
  const sampledCritical = (event: SimulationEvent): boolean => {
    if (typeof event.didCrit !== 'boolean') {
      throw new Error(
        `Missing sampled critical outcome for Mesmer event ${String(event.skillName || event.name || event.sourceId)}.`
      );
    }

    return event.didCrit;
  };

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
    const criticals = stochastic
      ? sampledCritical(event)
        ? 1
        : 0
      : Math.floor((core.masterFencerProgress += chance) + PROC_PROGRESS_TOLERANCE);
    if (!stochastic && criticals > 0) core.masterFencerProgress -= criticals;

    const readyAt = Number(core.traitReadyAt[TRAIT.MASTER_FENCER] || 0);
    if (criticals <= 0 || !isInternalCooldownReady(event.at, readyAt)) return;

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

  const materializeCriticalTraits = (event: SimulationEvent): void => {
    const chance = Number(criticalChance(event) || 0);
    materializeMasterFencer(event, chance);
    if (!traits.has(TRAIT.SHARPER_IMAGES) || (event.source !== 'Clone' && event.source !== 'Phantasm')) return;

    let procCount = 0;
    if (stochastic) {
      procCount = sampledCritical(event) ? 1 : 0;
    } else {
      professionCoreState(state).sharperImagesProgress += chance;
      procCount = Math.floor(professionCoreState(state).sharperImagesProgress + PROC_PROGRESS_TOLERANCE);
    }

    if (procCount <= 0) return;
    if (!stochastic) professionCoreState(state).sharperImagesProgress -= procCount;

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
