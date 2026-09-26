import type { RuntimeProfession } from '#gw2/platform/simulation/runtime-state.js';
import type { NativeResolvedDamageDetails } from '#gw2/platform/profession-definition/module-types.js';
import type { MesmerRuntimeState } from '#gw2/professions/mesmer/types.js';
import {
  requireBalanceProfileFromContext,
  requireEffect,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { advanceCriticalProc, criticalOpportunity } from '#gw2/platform/combat/critical-procs.js';
import { buildResolverCondition } from '#gw2/platform/resolver/packets.js';
import { MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import { mesmerMechanicsFor } from '#gw2/professions/mesmer/core/mechanics/runtime.js';
import { initializeVirtuosoRuntime } from '#gw2/professions/mesmer/specializations/virtuoso/mechanics/runtime.js';
import { virtuosoAvailability } from '#gw2/professions/mesmer/specializations/virtuoso/mechanics/blades-and-bladesongs.js';
import { virtuosoState } from '#gw2/professions/mesmer/specializations/virtuoso/state.js';

/** Blade resources follow committed spending, accepted Bleeding, and actual shared critical outcomes. */
export const virtuosoLive: Partial<RuntimeProfession<MesmerRuntimeState>> = {
  initialize: initializeVirtuosoRuntime,
  availability: virtuosoAvailability,
  tasks: {
    'mesmer.blade-spend'(runtime, data) {
      const mechanics = mesmerMechanicsFor(runtime);
      const details = mechanics.castDetails.get(String(data));
      if (!details || details.shatterSpendCommitted) return;
      details.shatterSpent = mechanics.actions.commitReservedResources(
        runtime.time,
        Number(details.shatterSpent ?? 0),
        { activationId: String(data) }
      );
      details.shatterSpendCommitted = true;
    },
    'mesmer.infinite-forge'(runtime) {
      const mechanics = mesmerMechanicsFor(runtime);
      const profile = requireBalanceProfileFromContext(runtime, TRAIT.INFINITE_FORGE);
      mechanics.resources.gainResources(
        runtime.time,
        balanceProfileNumber(profile, 'playerStacks'),
        mechanics.activePrimaryWeapon(),
        'Infinite Forge',
        { traitId: TRAIT.INFINITE_FORGE, traitName: 'Infinite Forge' }
      );
      const interval = balanceProfileNumber(profile, 'pulseInterval');
      if (interval > 0) runtime.schedule('mesmer.infinite-forge', runtime.time + interval, undefined, undefined, -20);
    }
  },
  reactions: {
    'condition.applied'(runtime, event) {
      const mechanics = mesmerMechanicsFor(runtime);
      if (event.condition !== 'Bleeding' || !mechanics.traits.has(TRAIT.BLOODSONG)) return;
      const state = virtuosoState.from(runtime);
      state.bloodsongProgress += Number(event.stacks ?? 0);
      const profile = requireBalanceProfileFromContext(runtime, TRAIT.BLOODSONG);
      const threshold = balanceProfileNumber(profile, 'threshold');
      while (threshold > 0 && state.bloodsongProgress >= threshold - 1e-9) {
        state.bloodsongProgress -= threshold;
        mechanics.resources.queueResources(
          runtime.time,
          balanceProfileNumber(profile, 'resourceGain'),
          mechanics.activePrimaryWeapon(),
          'Bloodsong',
          { traitId: TRAIT.BLOODSONG, traitName: 'Bloodsong' }
        );
      }
    },
    'damage.resolved'(runtime, event, details) {
      const mechanics = mesmerMechanicsFor(runtime);
      const skill = mechanics.skillsById.get(event.skillId ?? '');
      if ((!event.metadata?.blade && !skill?.blade) || event.noCrit || event.canCrit === false) return;
      for (const [id, name, condition, proc] of [
        [TRAIT.DEADLY_BLADES, 'Deadly Blades', 'Vulnerability', 'mesmer.virtuoso.deadly-blades'],
        [TRAIT.JAGGED_MIND, 'Jagged Mind', 'Bleeding', 'mesmer.virtuoso.jagged-mind']
      ] as const) {
        if (!mechanics.traits.has(id) || (id === TRAIT.DEADLY_BLADES && event.actorType !== 'player')) continue;
        const effect = requireEffect(requireBalanceProfileFromContext(runtime, id), 'condition', condition);
        if (!effect) continue;
        const critical = (details as NativeResolvedDamageDetails).hitContext!.critical;
        const application = advanceCriticalProc(criticalOpportunity(critical.chance, critical.didCrit), {
          id: proc,
          at: runtime.time
        });
        if (!application) continue;
        runtime.emitDerived(
          event,
          buildResolverCondition({
            at: runtime.time,
            name: `${event.name} — ${name}`,
            skillName: event.skillName,
            parentSkillName: event.parentSkillName,
            condition,
            stacks: application.quantity * Number(effect.stacks),
            duration: Number(effect.duration),
            source: id === TRAIT.DEADLY_BLADES ? 'Trait' : event.source,
            sourceId: id,
            actorType: id === TRAIT.DEADLY_BLADES ? 'effect' : event.actorType,
            ...(id === TRAIT.DEADLY_BLADES ? { ownerActorType: 'player' as const } : {})
          })
        );
        if (id === TRAIT.JAGGED_MIND) mechanics.addTraitProc(name, runtime.time, event.skillName);
      }
    }
  }
};
