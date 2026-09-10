import type { SchedulerContext } from '#gw2/platform/engine/execution/types.js';
import type { SimulationEvent } from '#gw2/platform/engine/events/types.js';
import { SIGIL_PROCS } from '#gw2/platform/equipment/sigils/catalog.js';
import { isGw2PlayerActorEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { grantEndurance } from '#gw2/platform/combat/resources/endurance.js';
import { gw2SigilSet } from '#gw2/platform/combat/query/runtime-rules.js';
import {
  createSigilConditionEvent,
  createSigilStrikeEvent,
  GW2_SCHEDULER_SIGIL_PREDICTION,
  isResolverCriticalSigil,
  isSigilInternalCooldownReady
} from '#gw2/platform/equipment/sigils/proc-events.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import type { Gw2SigilProc } from '#gw2/platform/equipment/types.js';
import type { MaterializerProfessionState, MaterializerState } from '#gw2/platform/scheduler/materializer-state.js';

export type SigilTrigger = 'crit' | 'swap' | 'control' | 'strike';

export interface SigilCapabilities {
  readonly critical: boolean;
  readonly swap: boolean;
  readonly strike: boolean;
}

export interface SigilProcEngine {
  materialize(trigger: SigilTrigger, context: SchedulerContext, event: SimulationEvent, cause?: SimulationEvent): void;
  consumeDoom(context: SchedulerContext, event: SimulationEvent): void;
}

interface SigilEffectContext {
  readonly context: SchedulerContext;
  readonly cause: SimulationEvent;
  readonly name: string;
  readonly proc: Gw2SigilProc;
  readonly sourceSkill: string;
  readonly schedulerPrediction: boolean;
}

type SigilEffectHandler = (effect: SigilEffectContext) => void;

const SIGIL_PROC_LOOKUP = SIGIL_PROCS as Readonly<Record<string, Gw2SigilProc>>;

export function sigilCapabilities(config: Gw2Config): SigilCapabilities {
  const names = new Set(
    (config.sigilSets || []).flatMap((set) => set?.names || []).filter((name) => SIGIL_PROC_LOOKUP[name])
  );
  return Object.freeze({
    critical: [...names].some((name) => SIGIL_PROC_LOOKUP[name].trigger === 'crit'),
    swap: [...names].some((name) => SIGIL_PROC_LOOKUP[name].trigger === 'swap'),
    strike: [...names].some((name) => SIGIL_PROC_LOOKUP[name].trigger === 'strike')
  });
}

export function createSigilProcEngine(config: Gw2Config, state: MaterializerState): Readonly<SigilProcEngine> {
  const sigilReady = (name: string, at: number): boolean =>
    isSigilInternalCooldownReady(at, state.sigil.readyAt.get(name) || 0);

  const armSigil = (name: string, at: number, cooldown: number): void => {
    state.sigil.readyAt.set(name, at + cooldown);
  };

  const emitProc: SigilEffectHandler = ({ context, cause, name, sourceSkill, schedulerPrediction }) => {
    if (schedulerPrediction) return;
    context.emitDerived(cause, {
      type: 'proc',
      procType: 'sigil',
      at: cause.at,
      name: `Sigil of ${name}`,
      sourceSkill,
      source: 'Sigil',
      sourceId: `sigil.${name.toLowerCase()}`,
      actorType: 'effect',
      icon: SIGIL_PROC_LOOKUP[name]?.icon || ''
    });
  };

  const emitCondition: SigilEffectHandler = ({ context, cause, name, proc, sourceSkill, schedulerPrediction }) => {
    context.emitDerived(cause, {
      ...createSigilConditionEvent(name, proc, sourceSkill),
      at: cause.at,
      ...(schedulerPrediction ? { schedulerPrediction: GW2_SCHEDULER_SIGIL_PREDICTION } : {})
    });
  };

  const emitStrike: SigilEffectHandler = ({ context, cause, name, proc, sourceSkill, schedulerPrediction }) => {
    context.emitDerived(cause, {
      ...createSigilStrikeEvent(name, proc, sourceSkill),
      at: cause.at,
      ...(schedulerPrediction ? { schedulerPrediction: GW2_SCHEDULER_SIGIL_PREDICTION } : {})
    });
  };

  const restoreEndurance: SigilEffectHandler = ({ context, cause, name, proc }) => {
    const profession = state.profession;
    if (!profession) return;
    const resources = (
      profession.core && typeof profession.core === 'object' ? profession.core : profession
    ) as MaterializerProfessionState;
    const maximum = Number(resources.maximumEndurance);
    const current = Number(resources.endurance);
    if (!Number.isFinite(maximum) || !Number.isFinite(current)) return;
    const amount = Math.max(0, Number(proc.amount || 0));
    Object.assign(
      resources,
      grantEndurance(
        {
          endurance: current,
          enduranceUpdatedAt: Number(resources.enduranceUpdatedAt ?? cause.at)
        },
        amount,
        cause.at,
        maximum
      )
    );
    context.emitDerived(cause, {
      type: 'resource',
      at: cause.at,
      name: `Sigil of ${name} — endurance`,
      resource: 'endurance',
      amount,
      source: 'Sigil',
      sourceId: `sigil.${name.toLowerCase()}`,
      actorType: 'effect'
    });
  };

  const applySeverance: SigilEffectHandler = ({ context, cause, proc }) => {
    state.sigil.severanceUntil = Math.max(state.sigil.severanceUntil, cause.at + Number(proc.duration));
    context.emitDerived(cause, {
      type: 'buff',
      at: cause.at,
      kind: 'sigil-severance',
      stacks: 1,
      duration: proc.duration,
      source: 'Sigil',
      sourceId: 'sigil.severance',
      actorType: 'effect'
    });
  };

  const effectHandlers: Readonly<Record<string, SigilEffectHandler>> = Object.freeze({
    strike: (effect) => {
      emitStrike(effect);
      emitProc(effect);
    },
    condition: (effect) => {
      emitCondition(effect);
      emitProc(effect);
    },
    'strike-condition': (effect) => {
      emitStrike(effect);
      if (effect.proc.condition) emitCondition(effect);
      emitProc(effect);
    },
    endurance: (effect) => {
      restoreEndurance(effect);
      emitProc(effect);
    },
    severance: (effect) => {
      applySeverance(effect);
      emitProc(effect);
    },
    'next-hit-condition': () => {
      // Doom records its output on the consuming hit, not on this arm.
      state.sigil.doomPending = true;
    }
  });

  const procOnly: SigilEffectHandler = (effect) => emitProc(effect);

  return Object.freeze({
    materialize(trigger: SigilTrigger, context: SchedulerContext, event: SimulationEvent, cause = event) {
      // Synthetic swaps may name a destination without changing the active set; other triggers use live state.
      const destination = Number(event.weaponSet);
      const weaponSet =
        trigger === 'swap' && (destination === 1 || destination === 2) ? destination : state.activeWeaponSet;
      const sourceSkill = event.skillName || (trigger === 'swap' ? 'Swap Weapons' : '');

      for (const name of gw2SigilSet(config, weaponSet).names || []) {
        const proc = SIGIL_PROC_LOOKUP[name];
        if (proc?.trigger !== trigger || !sigilReady(name, event.at)) continue;
        armSigil(name, event.at, proc.cooldown);
        const schedulerPrediction = trigger === 'crit' && isResolverCriticalSigil(name);
        (effectHandlers[proc.effect] || procOnly)({
          context,
          cause,
          name,
          proc,
          sourceSkill,
          schedulerPrediction
        });
      }
    },

    consumeDoom(context: SchedulerContext, event: SimulationEvent) {
      if (!state.sigil.doomPending || !isGw2PlayerActorEvent(event) || !(Number(event.coefficient) > 0)) {
        return;
      }

      state.sigil.doomPending = false;
      const effect = {
        context,
        cause: event,
        name: 'Doom',
        proc: SIGIL_PROC_LOOKUP.Doom,
        sourceSkill: event.skillName || '',
        schedulerPrediction: false
      };
      emitCondition(effect);
      emitProc(effect);
    }
  });
}
