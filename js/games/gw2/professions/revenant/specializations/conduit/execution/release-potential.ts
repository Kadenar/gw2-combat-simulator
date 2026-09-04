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
import type { SchedulerRecord } from '#gw2/platform/engine/execution/types.js';
import type { RevenantCastContext, RevenantSchedulerContext, RevenantSkill } from '#gw2/professions/revenant/types.js';

function effectiveAffinity(context: RevenantSchedulerContext): number {
  // Kinetic Insight contributes a virtual +2 to affinity for scaling calculations without mutating actual state.
  const bonus = hasTrait(context, TRAIT.KINETIC_INSIGHT) ? 2 : 0;
  const affinityProfile = balanceProfileById(context, CONDUIT_BALANCE_PROFILE_IDS.affinity);
  return Math.min(
    Math.max(1, Number(affinityProfile?.maximumStacks || 1)),
    Number(conduitState.from(context).affinity || 0) + bonus
  );
}

function targetsHit(context: RevenantCastContext, maximum = 5): number {
  // Command-level override takes priority so per-skill target counts can differ from the global config value.
  return Math.max(
    1,
    Math.min(
      maximum,
      Math.trunc(
        Number(
          (context.command as unknown as SchedulerRecord).targetsHit ??
            context.config.targetsHit ??
            context.config.targetCount ??
            1
        )
      )
    )
  );
}

/** Resolves the active Release Potential variant from affinity and legends. */
export function castReleasePotential(context: RevenantCastContext, skill: RevenantSkill): void {
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
          stacks: Number(effect.stacks || 1)
        });
      }

      break;
    case ID.RELEASE_POTENTIAL_DERVISH: {
      const impactAt = effectAt(context, strike);
      emitSkillDamage(context, skill, {
        at: impactAt,
        coefficient: strikeCoefficient(strike),
        skillWeapon: conduitSkillWeapon(context, skill),
        canCrit: null
      });
      const bleeding = conditions.find((effect) => effect.metadata?.legendId === LEGEND.DEMON);
      const bleedingTick = firstConditionTick(bleeding, 'Bleeding');
      if (hasLegend(context, LEGEND.DEMON) || allLegendEffects) {
        emitSkillCondition(context, skill, {
          at: impactAt,
          condition: String(bleedingTick?.condition || 'Bleeding'),
          stacks: Number(bleedingTick?.stacks || 1),
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
            stacks: Number(effect.stacks || 1)
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
      const torment = conditions.find((effect) => effect.target !== 'self');
      const selfTorment = conditions.find((effect) => effect.target === 'self');
      const tormentTick = firstConditionTick(torment, 'Torment');
      const selfTormentTick = firstConditionTick(selfTorment, 'Torment');
      emitSkillCondition(context, skill, {
        at: impactAt,
        condition: String(tormentTick?.condition || 'Torment'),
        stacks: Number(tormentTick?.stacks || 1),
        duration: Number(tormentTick?.duration || 0) * (1 + affinity * Number(torment?.durationPerAffinity || 0))
      });
      // Self-torment duration decreases with higher affinity (more skill = less self-harm); clamped to 0 at max.
      const selfDuration =
        Number(selfTormentTick?.duration || 0) *
        Math.max(0, 1 - affinity * Number(selfTorment?.durationReductionPerAffinity || 0));
      // One self-condition entry per target hit; Hex Eater Vortex then consumes entries to scale its projectiles.
      const count = targetsHit(context);
      for (let index = 0; index < count; index += 1) {
        professionCoreState(context).selfConditions.push({
          condition: String(selfTormentTick?.condition || 'Torment'),
          stacks: Number(selfTormentTick?.stacks || 1),
          at: impactAt,
          expiresAt: impactAt + selfDuration,
          sourceId: skill.id,
          skillName: skill.name
        });
      }

      const control = (skill.effects || []).find((effect) => effect.type === 'control');
      emitSkillControl(context, skill, {
        at: effectAt(context, control),
        controlKind: String(control?.controlKind || 'daze'),
        duration: Number(control?.duration || 0)
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
          canCrit: null
        });
      }

      // Conditions land with the final hit; both share the same affinity-scaled duration formula.
      for (const effect of conditions) {
        if (effect.type !== 'condition') continue;
        for (const tick of conditionEffectTicks(effect)) {
          emitSkillCondition(context, skill, {
            at: effectAt(context, effect, tick.atMs),
            condition: tick.condition,
            stacks: Number(tick.stacks || 1),
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
