import type { RuntimeCast, RuntimeProfession } from '#gw2/platform/simulation/runtime-state.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { MesmerRuntimeState } from '#gw2/professions/mesmer/types.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import {
  requireBalanceProfileFromContext,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import {
  completeTroubadourPhantasm,
  troubadourAvailability,
  troubadourEndurance
} from '#gw2/professions/mesmer/specializations/troubadour/mechanics/instrument-rules.js';
import { initializeTroubadourRuntime } from '#gw2/professions/mesmer/specializations/troubadour/mechanics/runtime.js';
import {
  scheduleTroubadourPerformance,
  completeTroubadourPerformance,
  resolveCrescendo
} from '#gw2/professions/mesmer/specializations/troubadour/mechanics/instruments.js';
import { withMesmerCastEmission } from '#gw2/professions/mesmer/core/execution/cast-lifecycle.js';
import { troubadourState } from '#gw2/professions/mesmer/specializations/troubadour/state.js';
import { resolveTroubadourTale } from '#gw2/professions/mesmer/specializations/troubadour/mechanics/tales.js';
import { observeSyncopateEvent } from '#gw2/professions/mesmer/specializations/troubadour/traits/syncopate.js';
import { mesmerMechanicsFor } from '#gw2/professions/mesmer/core/mechanics/runtime.js';
import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';

/** Instruments commit notes on completion; delayed waves and accepted disables retain their own timing. */
export const troubadourLive: Partial<RuntimeProfession<MesmerRuntimeState>> = {
  initialize: initializeTroubadourRuntime,
  endurance: troubadourEndurance,
  availability: troubadourAvailability,
  modifyEffects(runtime, cast, effects) {
    return mesmerMechanicsFor(runtime).instruments[Number(cast.skill.id)] || cast.skill.id === ID.CRESCENDO
      ? []
      : effects;
  },
  onCastStart(runtime, cast) {
    scheduleTroubadourPerformance(runtime, cast, cast.skill as MesmerSkill);
  },
  onCastComplete(runtime, cast) {
    completeTroubadourPerformance(runtime, cast, cast.skill as MesmerSkill);
    completeTroubadourPhantasm(runtime, cast);
  },
  prepareEvent(runtime, event) {
    // Method of Madness is an actual completed-heal proc; its queued consequence does not reserve a future hit.
    if (event.type === 'proc' && event.sourceId === 'Method of Madness')
      runtime.schedule('mesmer.syncopate', event.at, event);
    return event;
  },
  tasks: {
    'mesmer.crescendo'(runtime, data) {
      const cast = data as RuntimeCast;
      withMesmerCastEmission(runtime, cast, cast.skill as MesmerSkill, () =>
        resolveCrescendo(runtime, cast, cast.skill as MesmerSkill, cast.fullEnd)
      );
    },
    'mesmer.instrument-expire'(runtime, data) {
      const { instrument, expiresAt } = data as { instrument: string; expiresAt: number };
      // Each performance expires only its own window, including shorter replacements.
      const state = troubadourState.from(runtime);
      if (state.instruments[instrument] === expiresAt) delete state.instruments[instrument];
    },
    'mesmer.syncopate': (runtime, data) => observeSyncopateEvent(runtime, data as Gw2ResolverEvent),
    'mesmer.troubadour.resolve-tale'(runtime, data) {
      const cast = (data as { cast: RuntimeCast }).cast;
      resolveTroubadourTale({
        context: runtime,
        skill: cast.skill as MesmerSkill,
        at: runtime.time,
        castStart: cast.start,
        activationId: cast.id
      });
    },
    'mesmer.troubadour.dodge'(runtime, data) {
      const cast = (data as { cast: RuntimeCast }).cast;
      runtime.endurance.spend(Number(cast.skill.resourceCost ?? 50));
      const mechanics = mesmerMechanicsFor(runtime);
      if (!mechanics.traits.has(TRAIT.MAYHEM)) return;
      const flute = mechanics.skillsById.get(ID.FLUSTERING_FLUTE);
      if (!flute || !runtime.cooldowns.has(flute.id)) return;
      runtime.cooldownController.reduceSkillRecharge(
        flute,
        balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.MAYHEM), 'rechargeReduction'),
        runtime.time
      );
      mechanics.addTraitProc('Mayhem', runtime.time, cast.skill.name);
    }
  },
  eventHandlers: {
    // Executed commitments supply historical cast-start and isolated attribute queries in both output modes.
    'mesmer.instrument': (runtime, event) => {
      runtime.history.push(event);
    }
  },
  reactions: { 'control.resolved': observeSyncopateEvent }
};
