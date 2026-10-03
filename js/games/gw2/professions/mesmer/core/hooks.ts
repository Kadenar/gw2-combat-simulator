import { prepareGw2BuffCompanionCandidates } from '#gw2/platform/combat/state/allied-players.js';
import { armSkillFlip } from '#gw2/platform/engine/skills/skill-flips.js';
import type { NativeResolvedDamageDetails } from '#gw2/platform/profession-definition/module-types.js';
import { OBSERVABLE_EVENT_HANDLER } from '#gw2/platform/resolver/handler-registry.js';
import type { RuntimeCast, RuntimeProfession } from '#gw2/platform/simulation/runtime-state.js';
import { sideEffectAmount } from '#gw2/platform/simulation/side-effects.js';
import {
  commitMesmerShatter,
  completeMesmerCast,
  scheduleMesmerPhantasmEffects,
  startMesmerCast,
  mesmerCastDelivery
} from '#gw2/professions/mesmer/core/execution/cast-lifecycle.js';
import { mesmerAvailability } from '#gw2/professions/mesmer/core/mechanics/availability.js';
import { scheduleChaosStormPoison } from '#gw2/professions/mesmer/core/mechanics/chaos-storm.js';
import { applyMesmerClarity, consumeMesmerClarity } from '#gw2/professions/mesmer/core/mechanics/clarity.js';
import {
  armMesmerSkillFlip,
  exhaustMesmerMantra,
  extendMesmerParentRecharge,
  prepareMesmerMantra
} from '#gw2/professions/mesmer/core/mechanics/flips.js';
import { armMimic, completeMimicCast } from '#gw2/professions/mesmer/core/mechanics/mimic.js';
import { mesmerMaximumAmmo, mesmerRechargeWork } from '#gw2/professions/mesmer/core/mechanics/recharge.js';
import type { MesmerPendingResource } from '#gw2/professions/mesmer/core/mechanics/resource-types.js';
import { detonateInspiringImagery, expireInspiringImagery } from '#gw2/professions/mesmer/core/mechanics/rifle.js';
import { createMesmerMechanics } from '#gw2/professions/mesmer/core/mechanics/runtime-controller.js';
import { mesmerMechanicsFor, registerMesmerMechanics } from '#gw2/professions/mesmer/core/mechanics/runtime.js';
import {
  applyMesmerSignetReset,
  restartSignetIllusionsPassive,
  signetIllusionsPulse
} from '#gw2/professions/mesmer/core/mechanics/signets.js';
import { scheduleMesmerTrackedHits } from '#gw2/professions/mesmer/core/mechanics/tracked-hits.js';
import { completeAxesConfusion, scheduleAxesClones } from '#gw2/professions/mesmer/core/skills/weapons/axe.js';
import {
  applyFencersFinesse,
  triggerChaoticInterruption,
  triggerIneptitudeFromBlind,
  triggerIneptitudeFromInterrupt,
  triggerThePledge
} from '#gw2/professions/mesmer/core/traits/behavior.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import type { MesmerRuntime, MesmerRuntimeState } from '#gw2/professions/mesmer/types.js';
import { boundedNumber } from '#kernel/core/numeric.js';

/** Completion tasks apply state at the authored boundary, including committed shortened animations. */
function complete(runtime: MesmerRuntime, cast: RuntimeCast<MesmerSkill>): void {
  completeMesmerCast(runtime, cast, cast.skill);
  completeMimicCast(runtime, cast);
}

/** Core owns casts, clones, and accepted impact reactions on the shared clock. */
import { mesmerBuffPolicies, mesmerEffectStates } from '#gw2/professions/mesmer/core/effect-state.js';

export const mesmerCoreHooks: Partial<RuntimeProfession<MesmerRuntimeState, MesmerSkill>> = {
  buffPolicies: mesmerBuffPolicies,
  observeEffects: mesmerEffectStates,
  sideEffectHandlers: {
    'mesmer.shatter'(runtime, context) {
      if (context.kind === 'cast') commitMesmerShatter(runtime, context.cast);
    },
    'mesmer.arm-flip'(runtime, context) {
      if (context.kind === 'cast') armMesmerSkillFlip(runtime, context.cast);
    },
    'mesmer.prepare-mantra'(runtime) {
      prepareMesmerMantra(runtime, ID.POWER_SPIKE);
    },
    'mesmer.exhaust-mantra'(runtime, context) {
      exhaustMesmerMantra(runtime, context.skill);
    },
    'mesmer.extend-parent-recharge'(runtime, context) {
      extendMesmerParentRecharge(runtime, context.skill);
    },
    'mesmer.arm-mimic': armMimic,
    'mesmer.detonate-imagery'(runtime, context) {
      if (context.kind === 'cast') detonateInspiringImagery(runtime, context.cast);
    },
    'mesmer.axes-clones'(runtime, context) {
      if (context.kind === 'cast') scheduleAxesClones(runtime, context.cast);
    },
    'mesmer.axes-confusion'(runtime, context) {
      if (context.kind === 'cast') completeAxesConfusion(runtime, context.cast);
    },
    // Start declarations run after cast bookkeeping and before effect selection or summon preparation.
    'mesmer.consume-clarity'(runtime, context) {
      if (context.kind === 'cast')
        mesmerMechanicsFor(runtime).castDetails.get(context.cast.id)!.clarityConsumed = consumeMesmerClarity(
          runtime,
          context.cast.start
        );
    },
    'mesmer.summon-phantasm'(runtime, context) {
      if (context.kind === 'cast') scheduleMesmerPhantasmEffects(runtime, context.cast, context.skill);
    },
    'mesmer.grant-clarity'(runtime, context) {
      if (context.kind !== 'cast') return;
      const skill = context.skill;
      {
        const delivery = mesmerCastDelivery(context.cast, skill);
        runtime.effects.emit({
          ...delivery,
          kind: 'profile',
          profile: {
            ...skill,
            effects: skill.effects?.filter((effect) => effect.type === 'buff' && effect.kind === 'clarity')
          },
          at: runtime.time,
          fullEnd: runtime.time,
          attribution: {
            source: 'Player',
            sourceId: {
              ...skill,
              effects: skill.effects?.filter((effect) => effect.type === 'buff' && effect.kind === 'clarity')
            }.id,
            actorType: 'player',
            skillId: {
              ...skill,
              effects: skill.effects?.filter((effect) => effect.type === 'buff' && effect.kind === 'clarity')
            }.id,
            skillName: {
              ...skill,
              effects: skill.effects?.filter((effect) => effect.type === 'buff' && effect.kind === 'clarity')
            }.name
          },
          priority: 0
        });
      }
    },
    'mesmer.signet-reset': applyMesmerSignetReset,
    // Impact-owned illusion gains use the same clone/blade/imagery resource owner as other skills.
    'mesmer.illusion-gain'(runtime, context, action) {
      if (action.type !== 'mesmer.illusion-gain') return;
      const mechanics = mesmerMechanicsFor(runtime);
      mechanics.resources.gainResources(
        runtime.time,
        sideEffectAmount(runtime, action.amount!),
        context.skill.weapon || mechanics.activePrimaryWeapon(),
        context.skill.name,
        { kind: 'skill', sourceSkillId: context.skill.id }
      );
    },
    'mesmer.tracked-hit'(runtime, context) {
      if (context.kind !== 'effect') return;
      scheduleMesmerTrackedHits(runtime, context.skill, [context.trigger.event.at]);
    }
  },
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
        runtime.cooldownController.ensureAmmo(skill);
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
    const skill = runtime.helpers.skillsById.get(prepared.skillId ?? '');
    return prepared.type === 'damage' && skill?.blade
      ? { ...prepared, metadata: { ...prepared.metadata, blade: true } }
      : prepared;
  },
  availability: mesmerAvailability,
  rechargeWork: mesmerRechargeWork,
  maximumAmmo: mesmerMaximumAmmo,
  modifyEffects(runtime, cast, effects) {
    const skill = cast.skill;
    if (skill.phantasm)
      return effects.filter((effect) => effect.type === 'control' && effect.summonKind !== 'phantasm');
    if (mesmerMechanicsFor(runtime).shatters[skill.id] || skill.id === ID.INSPIRING_IMAGERY) return [];
    return effects.filter((effect) => !(effect.type === 'buff' && effect.kind === 'clarity'));
  },
  onCastStart(runtime, cast) {
    const skill = cast.skill;
    startMesmerCast(runtime, cast, skill);
  },
  // Cancellation refunds reserved shatter resources and clears the same cast-local bookkeeping.
  onCastCancel: complete,
  // Successful non-channel completion is commitment; animation tails carry only their authored packets.
  onCastCommit: complete,
  tasks: {
    'mesmer.flip-expire'(runtime, data) {
      const { id, identity } = data as { id: number; identity: string };
      // A replaced flip survives its predecessor's pending expiry.
      if (runtime.profession.core.availableFlips[id]?.identity === identity)
        delete runtime.profession.core.availableFlips[id];
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
      mechanics.resources.gainResources(runtime.time, count, weapon, reason, cause);
    },
    'mesmer.signet-illusions-passive': signetIllusionsPulse,
    'mesmer.core.imagery-expire': (runtime, data) =>
      expireInspiringImagery(runtime, (data as { cast: RuntimeCast<MesmerSkill> }).cast),
    'mesmer.core.chaos-storm-poison': (runtime, data) =>
      scheduleChaosStormPoison(runtime, (data as { cast: RuntimeCast<MesmerSkill> }).cast),
    'mesmer.core.restart-signet-illusions-passive': (runtime) => restartSignetIllusionsPassive(runtime, runtime.time),
    'mesmer.core.relock-signet-ether'(runtime, data) {
      const cast = (data as { cast: RuntimeCast<MesmerSkill> }).cast;
      const readyAt = runtime.time + cast.rechargeWork / runtime.cooldownController.rate(cast.skill);
      if (readyAt > (runtime.cooldowns.get(cast.skill.id) ?? 0))
        runtime.cooldownController.startRecharge(cast.skill, runtime.time, cast.rechargeWork);
    }
  },
  // Phantasm markers remain observable without applying resolver mutations.
  eventHandlers: {
    'mesmer.phantasm-summoned': OBSERVABLE_EVENT_HANDLER,
    'mesmer.phantasm-attack': OBSERVABLE_EVENT_HANDLER
  },
  reactions: {
    'buff.applied': applyMesmerClarity,
    'damage.resolved'(runtime, event, details) {
      const mechanics = mesmerMechanicsFor(runtime);
      const critical = (details as NativeResolvedDamageDetails).hitContext!.critical;
      mechanics.criticalTraits.process({ ...event, didCrit: critical.didCrit }, critical.chance);
      applyFencersFinesse(runtime, event);
    },
    'condition.applied': triggerThePledge,
    'control.resolved'(runtime, event) {
      const name = event.skillName ?? event.name ?? 'Control effect';
      triggerChaoticInterruption(runtime, event, name);
      triggerIneptitudeFromInterrupt(runtime, event);
    },
    'blind.resolved': triggerIneptitudeFromBlind
  }
};
