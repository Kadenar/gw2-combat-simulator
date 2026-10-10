import { prepareGw2BuffCompanionCandidates } from '#gw2/platform/combat/state/allied-players.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { armSkillFlip } from '#gw2/platform/execution/skill-flips.js';
import type { NativeResolvedDamageDetails } from '#gw2/platform/profession-definition/module-types.js';
import { composeRuntimeHooks, type RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { OBSERVABLE_EVENT_HANDLER } from '#gw2/platform/resolver/handler-registry.js';
import { mesmerBuffPolicies, mesmerEffectStates } from '#gw2/professions/mesmer/core/effect-state.js';
import { completeMesmerCast, mesmerCastDelivery } from '#gw2/professions/mesmer/core/execution/cast-lifecycle.js';
import { mesmerAvailability } from '#gw2/professions/mesmer/core/mechanics/availability.js';
import { scheduleChaosStormPoison } from '#gw2/professions/mesmer/core/mechanics/chaos-storm.js';
import { applyMesmerClarity, consumeMesmerClarity } from '#gw2/professions/mesmer/core/mechanics/clarity.js';
import {
  mesmerConditionApplied,
  mesmerControlAccepted,
  mesmerCritical,
  mesmerStrikeResolved
} from '#gw2/professions/mesmer/core/mechanics/combat-boundaries.js';
import {
  armMesmerSkillFlip,
  exhaustMesmerMantra,
  extendMesmerParentRecharge,
  prepareMesmerMantra
} from '#gw2/professions/mesmer/core/mechanics/flips.js';
import { mesmerIllusionHooks } from '#gw2/professions/mesmer/core/mechanics/illusions/lifecycle.js';
import { armMimic, completeMimicCast } from '#gw2/professions/mesmer/core/mechanics/mimic.js';
import { mesmerMaximumAmmo, mesmerRechargeWork } from '#gw2/professions/mesmer/core/mechanics/recharge.js';
import { detonateInspiringImagery, expireInspiringImagery } from '#gw2/professions/mesmer/core/mechanics/rifle.js';
import {
  applyMesmerSignetReset,
  restartSignetIllusionsPassive,
  signetIllusionsPulse
} from '#gw2/professions/mesmer/core/mechanics/signets.js';
import { scheduleMesmerTrackedHits } from '#gw2/professions/mesmer/core/mechanics/tracked-hits.js';
import { completeAxesConfusion, scheduleAxesClones } from '#gw2/professions/mesmer/core/skills/weapons/axe.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import type { MesmerRuntime, MesmerRuntimeState } from '#gw2/professions/mesmer/types.js';

/** Completion tasks apply state at the authored boundary, including committed shortened animations. */
function complete(runtime: MesmerRuntime, cast: RuntimeCast<MesmerSkill>): void {
  completeMesmerCast(runtime, cast, cast.skill);
  completeMimicCast(runtime, cast);
}

export const mesmerCoreHooks: RuntimeHooks<MesmerRuntimeState, MesmerSkill> = composeRuntimeHooks<
  MesmerRuntimeState,
  MesmerSkill
>([
  mesmerIllusionHooks,
  {
    buffPolicies: mesmerBuffPolicies,
    observeEffects: mesmerEffectStates,
    sideEffectHandlers: {
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
          runtime.profession.core.castDetails.get(context.cast.id)!.clarityConsumed = consumeMesmerClarity(
            runtime,
            context.cast.start
          );
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
      'mesmer.tracked-hit'(runtime, context) {
        if (context.kind !== 'effect') return;
        scheduleMesmerTrackedHits(runtime, context.skill, [context.trigger.event.at]);
      }
    },
    initialize(runtime) {
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
    // Cancellation refunds reserved shatter resources and clears the same cast-local bookkeeping.
    onCastCancel: complete,
    // Successful non-channel completion is commitment; animation tails carry only their authored packets.
    onCastCommit: complete,
    // Clone attacks and the signet's passive continue indefinitely after their enabling cast.
    backgroundTasks: ['mesmer.signet-illusions-passive'],
    tasks: {
      'mesmer.signet-illusions-passive': signetIllusionsPulse,
      'mesmer.core.imagery-expire': (runtime, data) =>
        expireInspiringImagery(runtime, (data as { cast: RuntimeCast<MesmerSkill> }).cast),
      'mesmer.core.chaos-storm-poison': (runtime, data) =>
        scheduleChaosStormPoison(runtime, (data as { cast: RuntimeCast<MesmerSkill> }).cast),
      'mesmer.core.restart-signet-illusions-passive': (runtime) => restartSignetIllusionsPassive(runtime, runtime.time),
      'mesmer.core.relock-signet-ether'(runtime, data) {
        const cast = (data as { cast: RuntimeCast<MesmerSkill> }).cast;
        const readyAt = runtime.time + cast.rechargeWork / runtime.cooldownController.rate(cast.skill);
        if (readyAt > (runtime.cooldownController.readyAt(cast.skill.id) ?? 0))
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
        const critical = (details as NativeResolvedDamageDetails).hitContext!.critical;
        runtime.fireTrigger(mesmerCritical, {
          event: { ...event, didCrit: critical.didCrit },
          chance: critical.chance
        });
        runtime.fireTrigger(mesmerStrikeResolved, { event });
      },
      'condition.applied'(runtime, event) {
        runtime.fireTrigger(mesmerConditionApplied, { event });
      },
      'control.resolved': (runtime, event) => runtime.fireTrigger(mesmerControlAccepted, { event })
    }
  }
]);
