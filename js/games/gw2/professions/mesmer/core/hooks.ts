import type { RuntimeCast, RuntimeProfession } from '#gw2/platform/simulation/runtime-state.js';
import type { NativeResolvedDamageDetails } from '#gw2/platform/profession-definition/module-types.js';
import type { SimulationEventBase } from '#gw2/platform/engine/events/events.js';
import type { MesmerRuntime, MesmerRuntimeState } from '#gw2/professions/mesmer/types.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import type { MesmerPendingResource } from '#gw2/professions/mesmer/core/mechanics/resource-types.js';
import { boundedNumber } from '#kernel/core/numeric.js';
import { armSkillFlip } from '#gw2/platform/engine/skills/skill-flips.js';
import { prepareGw2BuffCompanionCandidates } from '#gw2/platform/combat/state/allied-players.js';
import { cancelledBeforeInterruptCommit } from '#gw2/platform/execution/effect-adapter.js';
import { isGw2PlayerActorEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { createMesmerMechanics } from '#gw2/professions/mesmer/core/mechanics/runtime-controller.js';
import { mesmerMechanicsFor, registerMesmerMechanics } from '#gw2/professions/mesmer/core/mechanics/runtime.js';
import {
  completeMesmerCast,
  startMesmerCast,
  settleMesmerSkillFlips,
  scheduleMesmerPhantasmEffects,
  withMesmerCastEmission
} from '#gw2/professions/mesmer/core/execution/cast-lifecycle.js';
import { completeMimicCast } from '#gw2/professions/mesmer/core/mechanics/mimic.js';
import { mesmerAvailability } from '#gw2/professions/mesmer/core/mechanics/availability.js';
import { mesmerRechargeWork, mesmerMaximumAmmo } from '#gw2/professions/mesmer/core/mechanics/recharge.js';
import { mesmerCoreEventHandlers, mesmerCoreEventReactions } from '#gw2/professions/mesmer/core/mechanics/reactions.js';
import { emitMesmerEffects, emitMesmerPacket } from '#gw2/professions/mesmer/core/events.js';
import { restartSignetIllusionsPassive, signetIllusionsPulse } from '#gw2/professions/mesmer/core/mechanics/signets.js';
import { expireInspiringImagery } from '#gw2/professions/mesmer/core/mechanics/rifle.js';
import { scheduleChaosStormPoison } from '#gw2/professions/mesmer/core/mechanics/chaos-storm.js';
import { scheduleMesmerTrackedHits } from '#gw2/professions/mesmer/core/mechanics/tracked-hits.js';
import {
  emitFencersFinesseStacks,
  recordFencersFinesseProc,
  triggerChaoticInterruption,
  triggerDazzling,
  triggerMasterOfFragmentation,
  triggerThePledge
} from '#gw2/professions/mesmer/core/traits/index.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';

/** Completion tasks apply state at the authored boundary, including committed shortened animations. */
function complete(runtime: MesmerRuntime, cast: RuntimeCast): void {
  completeMesmerCast(runtime, cast, cast.skill as MesmerSkill);
  completeMimicCast(runtime, cast);
}

/** Core owns casts, clones, and accepted impact reactions on the shared clock. */
export const mesmerCoreHooks: Partial<RuntimeProfession<MesmerRuntimeState>> = {
  initialize(runtime) {
    const mechanics = createMesmerMechanics(runtime);
    registerMesmerMechanics(runtime, mechanics);
    mechanics.resources.gainResources(
      0,
      boundedNumber(runtime.config.initialResource ?? 0, 0, 0, mechanics.resourceDefinition.maximum),
      mechanics.activePrimaryWeapon(),
      'initial',
      { kind: 'initial' }
    );
    for (const skill of runtime.helpers.skills) {
      if (skill.armedAtStart && skill.flipParentId && Number(skill.ammo) > 0) {
        armSkillFlip(runtime.profession.core.availableFlips, skill.id, 0);
        runtime.cooldownController.ensureAmmo(skill, 0);
      }
    }

    if (!runtime.combatStartPending) restartSignetIllusionsPassive(runtime, 0);
  },
  onCombatStart(runtime) {
    if (runtime.hasExplicitCombatStart) restartSignetIllusionsPassive(runtime, runtime.time);
  },
  prepareEvent(runtime, event) {
    const prepared = prepareGw2BuffCompanionCandidates(
      event,
      runtime.profession.core.clones.map((clone) => `mesmer.clone:${clone.id}`)
    );
    const skill = runtime.helpers.skillsById.get(prepared.skillId ?? '') as MesmerSkill | undefined;
    return prepared.type === 'damage' && skill?.blade
      ? { ...prepared, metadata: { ...prepared.metadata, blade: true } }
      : prepared;
  },
  availability: mesmerAvailability,
  rechargeWork: mesmerRechargeWork,
  maximumAmmo: mesmerMaximumAmmo,
  modifyEffects(runtime, cast, effects) {
    const skill = cast.skill as MesmerSkill;
    if (skill.phantasm)
      return effects.filter((effect) => effect.type === 'control' && effect.summonKind !== 'phantasm');
    if (mesmerMechanicsFor(runtime).shatters[skill.id] || skill.id === ID.INSPIRING_IMAGERY) return [];
    return effects;
  },
  onCastStart(runtime, cast) {
    const skill = cast.skill as MesmerSkill;
    startMesmerCast(runtime, cast, skill);
    if (skill.phantasm) scheduleMesmerPhantasmEffects(runtime, cast, skill);
    withMesmerCastEmission(runtime, cast, skill, () => {
      if (skill.id === ID.AXES_OF_SYMMETRY)
        mesmerMechanicsFor(runtime).skillEffects.scheduleSpecial(skill, cast.fullEnd, cast.start);
      if (skill.id === ID.MENTAL_COLLAPSE && mesmerMechanicsFor(runtime).castDetails.get(cast.id)?.clarityConsumed)
        emitMesmerEffects(
          runtime,
          { ...skill, effects: (skill.clarityEffects ?? []) as MesmerSkill['effects'] },
          cast.start,
          cast.fullEnd
        );
    });
  },
  onCastComplete(runtime, cast) {
    const cancelled = cancelledBeforeInterruptCommit(cast.skill, cast.start, cast.fullEnd, cast.effectiveEnd);
    // A committed block exposes its flip when the animation ends, before any delayed completion packets.
    if (!cancelled) settleMesmerSkillFlips(runtime, cast, cast.skill as MesmerSkill, runtime.time);
    if (!cancelled && cast.fullEnd > runtime.time) runtime.schedule('mesmer.cast-complete', cast.fullEnd, cast);
    else complete(runtime, cast);
    if (cancelledBeforeInterruptCommit(cast.skill, cast.start, cast.fullEnd, cast.effectiveEnd)) return;
    // Authored mechanic deadlines enqueue live work; they never apply future state while materializing a cast.
    for (const trigger of (cast.skill as MesmerSkill).mesmerTasks ?? []) {
      const scale =
        trigger.timingScale === 'cast' && Number(cast.skill.castTimeMs) > 0
          ? ((cast.fullEnd - cast.start) * 1000) / Number(cast.skill.castTimeMs)
          : 1;
      const at =
        (trigger.timingAnchor === 'castStart' ? cast.start : cast.fullEnd) + (Number(trigger.atMs ?? 0) * scale) / 1000;
      runtime.schedule(trigger.type, at, { cast, trigger });
    }
  },
  tasks: {
    'mesmer.flip-expire'(runtime, data) {
      const { id, identity } = data as { id: number; identity: string };
      // A replaced flip survives its predecessor's pending expiry.
      if (runtime.profession.core.availableFlips[id]?.identity === identity)
        delete runtime.profession.core.availableFlips[id];
    },
    'mesmer.cast-complete': (runtime, data) => complete(runtime, data as RuntimeCast),
    'mesmer.packet': (runtime, data) => {
      emitMesmerPacket(runtime, data as SimulationEventBase);
    },
    'mesmer.clone-attack'(runtime, data) {
      const id = Number(data);
      const next = mesmerMechanicsFor(runtime).cloneAttackScheduler.handleTask(id, runtime.time);
      if (next != null)
        runtime.schedule('mesmer.clone-attack', next, id, { id: `mesmer.clone:${id}`, generation: 0 }, -50);
    },
    'mesmer.resource-gain'(runtime, data) {
      const { count, weapon, reason, cause } = data as MesmerPendingResource;
      const mechanics = mesmerMechanicsFor(runtime);
      const skill = mechanics.skillsById.get(cause?.sourceSkillId ?? '');
      if (
        mechanics.resourceDefinition.singular === 'clone' &&
        mechanics.actions.currentResource() >= mechanics.resourceDefinition.maximum &&
        skill?.maxCloneEffects?.length
      ) {
        for (const effect of skill.maxCloneEffects)
          mechanics.addCondition(skill.name, runtime.time, { ...effect, name: effect.condition }, 'Player');
      } else mechanics.resources.gainResources(runtime.time, count, weapon, reason, cause);
    },
    'mesmer.signet-illusions-passive': signetIllusionsPulse,
    'mesmer.core.imagery-expire': (runtime, data) =>
      expireInspiringImagery(runtime, (data as { cast: RuntimeCast }).cast),
    'mesmer.core.chaos-storm-poison': (runtime, data) =>
      scheduleChaosStormPoison(runtime, (data as { cast: RuntimeCast }).cast),
    'mesmer.core.restart-signet-illusions-passive': (runtime) => restartSignetIllusionsPassive(runtime, runtime.time),
    'mesmer.core.relock-signet-ether'(runtime, data) {
      const cast = (data as { cast: RuntimeCast }).cast;
      const readyAt = runtime.time + cast.rechargeWork / runtime.cooldownController.rate(cast.skill, runtime.time);
      if (readyAt > Number(runtime.cooldowns.get(cast.skill.id) ?? 0))
        runtime.cooldownController.startRecharge(cast.skill, runtime.time, cast.rechargeWork);
    }
  },
  eventHandlers: mesmerCoreEventHandlers,
  reactions: {
    'damage.resolved'(runtime, event, details) {
      const mechanics = mesmerMechanicsFor(runtime);
      const critical = (details as NativeResolvedDamageDetails).hitContext!.critical;
      mechanics.criticalTraits.process({ ...event, didCrit: critical.didCrit }, critical.chance);
      triggerMasterOfFragmentation(runtime, event);
      const skill = mechanics.skillsById.get(event.skillId ?? '');
      if (!skill) return;
      const first = event.summonKind === 'clone' ? Infinity : emitFencersFinesseStacks(mechanics, skill, [event.at], 1);
      if (Number(event.hitIndex ?? 1) === 1) recordFencersFinesseProc(mechanics, skill, first);
      if (isGw2PlayerActorEvent(event) && event.sourceId === skill.id && skill.trackedHitDamage)
        scheduleMesmerTrackedHits(runtime, mechanics.addDamage, skill, [event.at]);
    },
    'condition.applied': triggerThePledge,
    'control.resolved'(runtime, event) {
      const name = String(event.skillName ?? event.name ?? 'Control effect');
      triggerDazzling(runtime, event, Number(event.skillId), name);
      triggerChaoticInterruption(runtime, event, name);
      mesmerCoreEventReactions.control(runtime, event);
    },
    'blind.resolved': mesmerCoreEventReactions.blind
  }
};
