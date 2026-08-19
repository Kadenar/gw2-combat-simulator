import { isInternalCooldownReady } from '../../engine/clock.js';
import type { SchedulerContext, SimulationEvent } from '../../engine/types.js';
import { SIGIL_PROCS } from '../gear-data.js';
import { isGw2PlayerActorEvent } from '../event-ownership.js';
import {
  createSigilConditionEvent,
  createSigilStrikeEvent,
  GW2_SCHEDULER_SIGIL_PREDICTION,
  isResolverCriticalSigil
} from '../sigil-proc-events.js';
import type { Gw2Config, Gw2SigilProc } from '../types.js';
import type { MaterializerProfessionState, MaterializerState } from './materializer-state.js';

export type SigilTrigger = 'crit' | 'swap' | 'control' | 'strike';

export interface SigilCapabilities {
  readonly anyProc: boolean;
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

interface SigilTriggerRule {
  weaponSet(event: SimulationEvent, state: MaterializerState): number;
  sourceSkill(event: SimulationEvent): string;
}

const SIGIL_PROC_LOOKUP = SIGIL_PROCS as Readonly<Record<string, Gw2SigilProc>>;

const TRIGGER_RULES: Readonly<Record<SigilTrigger, SigilTriggerRule>> = Object.freeze({
  crit: {
    weaponSet: (_event, state) => state.activeWeaponSet,
    sourceSkill: (event) => event.skillName || ''
  },
  swap: {
    // Swap effects belong to the set that becomes active. A synthetic
    // sigil_swap can state its set without mutating the observed state.
    weaponSet: (event, state) =>
      Number(event.weaponSet) === 2 ? 2 : Number(event.weaponSet) === 1 ? 1 : state.activeWeaponSet,
    sourceSkill: (event) => event.skillName || 'Swap Weapons'
  },
  control: {
    weaponSet: (_event, state) => state.activeWeaponSet,
    sourceSkill: (event) => event.skillName || ''
  },
  strike: {
    weaponSet: (_event, state) => state.activeWeaponSet,
    sourceSkill: (event) => event.skillName || ''
  }
});

function activeSigilNames(config: Gw2Config, weaponSet: number): readonly string[] {
  return config.sigilSets?.[Math.max(1, weaponSet) - 1]?.names || [];
}

export function sigilCapabilities(config: Gw2Config): SigilCapabilities {
  const names = new Set(
    (config.sigilSets || []).flatMap((set) => set?.names || []).filter((name) => SIGIL_PROC_LOOKUP[name])
  );
  return Object.freeze({
    anyProc: names.size > 0,
    critical: [...names].some((name) => SIGIL_PROC_LOOKUP[name].trigger === 'crit'),
    swap: [...names].some((name) => SIGIL_PROC_LOOKUP[name].trigger === 'swap'),
    strike: [...names].some((name) => SIGIL_PROC_LOOKUP[name].trigger === 'strike')
  });
}

export function createSigilProcEngine(config: Gw2Config, state: MaterializerState): Readonly<SigilProcEngine> {
  const sigilReady = (name: string, at: number): boolean =>
    isInternalCooldownReady(at, state.sigil.readyAt.get(name) || 0);

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
    resources.endurance = Math.min(maximum, current + amount);
    resources.enduranceUpdatedAt = cause.at;
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
      const rule = TRIGGER_RULES[trigger];
      const weaponSet = rule.weaponSet(event, state);
      const sourceSkill = rule.sourceSkill(event);

      for (const name of activeSigilNames(config, weaponSet)) {
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
