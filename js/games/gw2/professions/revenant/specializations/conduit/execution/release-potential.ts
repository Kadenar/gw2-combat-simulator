/**
 * Owns Release Potential variant selection and packet materialization.
 * Handler registration lives in sibling `index.ts`.
 */
import { conduitState } from '#gw2/professions/revenant/specializations/conduit/state.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import {
  emitSkillBuff,
  emitSkillCondition,
  emitSkillControl,
  emitSkillDamage
} from '#gw2/platform/scheduler/skill-events.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { conditionEffectTicks, strikeEffectTicks } from '#gw2/platform/engine/effects/timelines.js';
import { balanceProfileFromContext as balanceProfileById } from '#gw2/platform/combat/state/balance-profiles.js';
import {
  REVENANT_LEGEND_IDS as LEGEND,
  REVENANT_SKILL_IDS as ID,
  REVENANT_TRAIT_IDS as TRAIT
} from '#gw2/professions/revenant/data/ids.js';
import { CONDUIT_BALANCE_PROFILE_IDS } from '#gw2/professions/revenant/specializations/conduit/profiles.js';
import {
  conduitEffectAt as effectAt,
  conduitFirstConditionTick as firstConditionTick,
  conduitHasLegend as hasLegend,
  conduitSkillWeapon,
  conduitStrikeCoefficient as strikeCoefficient
} from '#gw2/professions/revenant/specializations/conduit/execution/helpers.js';
import type {
  RevenantCastContext,
  RevenantScheduledTask,
  RevenantSchedulerContext,
  RevenantSkill
} from '#gw2/professions/revenant/types.js';
import { boundedInteger } from '#kernel/core/numeric.js';

/** Resolve enemy and self Torment from impact-time affinity, including swaps during the windup. */
export function handleMesmerReleaseConditions(
  context: RevenantSchedulerContext,
  task: RevenantScheduledTask<{ targetsHit: number; activationId: string }>
): void {
  if (!task.payload) return;
  const skill = context.catalog.skillsById.get(ID.RELEASE_POTENTIAL_MESMER);
  if (!skill) return;
  const affinity = effectiveAffinity(context);
  const conditions = skill.effects?.filter((effect) => effect.type === 'condition') || [];
  const torment = conditions.find((effect) => effect.target !== 'self');
  const selfTorment = conditions.find((effect) => effect.target === 'self');
  const tormentTick = firstConditionTick(torment, 'Torment');
  const selfTormentTick = firstConditionTick(selfTorment, 'Torment');
  emitSkillCondition(context, {
    skill,
    at: task.at,
    activationId: task.payload.activationId,
    condition: String(tormentTick?.condition || 'Torment'),
    stacks: Number(tormentTick?.stacks ?? 1),
    duration: Number(tormentTick?.duration || 0) * (1 + affinity * Number(torment?.durationPerAffinity || 0))
  });
  const selfDuration =
    Number(selfTormentTick?.duration || 0) *
    Math.max(0, 1 - affinity * Number(selfTorment?.durationReductionPerAffinity || 0));
  for (let index = 0; index < task.payload.targetsHit; index += 1) {
    professionCoreState(context).selfConditions.push({
      condition: String(selfTormentTick?.condition || 'Torment'),
      stacks: Number(selfTormentTick?.stacks ?? 1),
      at: task.at,
      expiresAt: task.at + selfDuration,
      sourceId: skill.id,
      skillName: skill.name
    });
  }
}

function effectiveAffinity(context: RevenantSchedulerContext): number {
  // Kinetic Insight contributes a virtual +2 to affinity for scaling calculations without mutating actual state.
  const bonus = hasTrait(context, TRAIT.KINETIC_INSIGHT) ? 2 : 0;
  const affinityProfile = balanceProfileById(context, CONDUIT_BALANCE_PROFILE_IDS.affinity);
  return Math.min(
    Math.max(1, Number(affinityProfile?.maximumStacks ?? 1)),
    Number(conduitState.from(context).affinity || 0) + bonus
  );
}

function targetsHit(context: RevenantCastContext, maximum = 5): number {
  // Command-level override takes priority so per-skill target counts can differ from the global config value.
  return boundedInteger(
    context.command.targetsHit ?? context.config.targetsHit ?? context.config.targetCount ?? 1,
    1,
    1,
    maximum
  );
}

/** Resolves the active Release Potential variant from affinity and legends. */
export function castReleasePotential(context: RevenantCastContext, skill: RevenantSkill): void {
  // Procedural releases obey the same commit boundary as declarative skills instead of emitting cancelled damage.
  if (context.action.cancelled === true) return;
  const affinity = effectiveAffinity(context);
  // At affinity ≥ 3 the skill gains effects from all equipped legends even if they are not currently active.
  const affinityProfile = balanceProfileById(context, CONDUIT_BALANCE_PROFILE_IDS.affinity);
  const allLegendEffects = affinity >= Math.max(0, Number(affinityProfile?.minimumStacks || 0));
  const strike = (skill.effects || []).find((effect) => effect.type === 'strike');
  const conditions = (skill.effects || []).filter((effect) => effect.type === 'condition');
  const boons = (skill.effects || []).filter((effect) => effect.type === 'boon');
  switch (skill.id) {
    case ID.RELEASE_POTENTIAL_MONK:
      for (const effect of boons) {
        if (effect.type !== 'boon' || !effect.boon) continue;
        emitSkillBuff(context, skill, {
          at: context.effectiveEnd,
          name: `${skill.name} — ${effect.boon}`,
          kind: effect.boon,
          duration: Number(effect.duration || 0),
          stacks: Number(effect.stacks ?? 1)
        });
      }

      break;
    case ID.RELEASE_POTENTIAL_DERVISH: {
      const impactAt = effectAt(context, strike);
      emitSkillDamage(context, skill, {
        at: impactAt,
        coefficient: strikeCoefficient(strike),
        skillWeapon: conduitSkillWeapon(context, skill),
        // The conjured scythe uses sword-strength damage on either equipped weapon set.
        weaponStrengthProfileId: 'weapon.sword',
        canCrit: null
      });
      const bleeding = conditions.find((effect) => effect.metadata?.legendId === LEGEND.DEMON);
      const bleedingTick = firstConditionTick(bleeding, 'Bleeding');
      if (hasLegend(context, LEGEND.DEMON) || allLegendEffects) {
        emitSkillCondition(context, {
          skill,
          at: impactAt,
          condition: String(bleedingTick?.condition || 'Bleeding'),
          stacks: Number(bleedingTick?.stacks ?? 1),
          duration: Number(bleedingTick?.duration || 0)
        });
      }

      if (hasLegend(context, LEGEND.CENTAUR) || allLegendEffects) {
        for (const effect of boons.filter((candidate) => candidate.metadata?.legendId === LEGEND.CENTAUR)) {
          if (effect.type !== 'boon' || !effect.boon) continue;
          emitSkillBuff(context, skill, {
            at: impactAt,
            name: `${skill.name} — ${effect.boon}`,
            kind: effect.boon,
            duration: Number(effect.duration || 0),
            stacks: Number(effect.stacks ?? 1)
          });
        }
      }

      break;
    }

    case ID.RELEASE_POTENTIAL_MESMER: {
      const impactAt = effectAt(context, strike);
      emitSkillDamage(context, skill, {
        at: impactAt,
        coefficient: strikeCoefficient(strike),
        skillWeapon: conduitSkillWeapon(context, skill),
        canCrit: null
      });
      context.tasks.schedule({
        type: 'revenant.release-mesmer-conditions',
        at: impactAt,
        payload: { targetsHit: targetsHit(context), activationId: context.reservationId }
      });

      const control = (skill.effects || []).find((effect) => effect.type === 'control');
      emitSkillControl(context, skill, {
        at: effectAt(context, control),
        controlKind: String(control?.controlKind || 'daze')
      });
      break;
    }

    case ID.RELEASE_POTENTIAL_ASSASSIN: {
      const ticks = strike?.type === 'strike' ? strikeEffectTicks(strike) : [];
      for (const [index, tick] of ticks.entries()) {
        emitSkillDamage(context, skill, {
          at: context.start + Number(tick.atMs || 0) / 1000,
          coefficient: Number(tick.coefficient || 0),
          hitIndex: index + 1,
          totalHits: ticks.length,
          skillWeapon: conduitSkillWeapon(context, skill),
          // Assassin shockwaves use profession-mechanic strength independently of the equipped weapon.
          weaponStrengthProfileId: 'nonweapon.profession-mechanic',
          canCrit: null
        });
      }

      // Conditions land with the final hit; both share the same affinity-scaled duration formula.
      for (const effect of conditions) {
        if (effect.type !== 'condition') continue;
        for (const tick of conditionEffectTicks(effect)) {
          emitSkillCondition(context, {
            skill,
            at: effectAt(context, effect, tick.atMs),
            condition: tick.condition,
            stacks: Number(tick.stacks ?? 1),
            duration: Number(tick.duration || 0) * (1 + affinity * Number(effect.durationPerAffinity || 0))
          });
        }
      }

      break;
    }

    case ID.RELEASE_POTENTIAL_WARRIOR:
      emitSkillDamage(context, skill, {
        at: context.effectiveEnd,
        coefficient: strikeCoefficient(strike),
        skillWeapon: conduitSkillWeapon(context, skill),
        canCrit: null
      });
      break;
    default:
      break;
  }
}
