/** Owns Core Retribution control and Resolution-dependent strike reactions. */
import type { SimulationEvent } from '#gw2/platform/engine/events/events.js';
import { tryConsumeProcCooldown } from '#gw2/platform/combat/procs.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { gw2SchedulerBoonDuration } from '#gw2/platform/execution/gw2-policy/policy.js';
import { emitSkillBuff, emitSkillCondition } from '#gw2/platform/execution/gw2-policy/skill-events.js';
import { REVENANT_CORE_BALANCE_PROFILE_IDS } from '#gw2/professions/revenant/core/profiles.js';
import {
  requireBalanceProfileFromContext,
  requireEffect,
  effectNumber,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import type { RevenantSchedulerContext, RevenantSkill } from '#gw2/professions/revenant/types.js';

/** Applies Dwarven Battle Training Weakness to each observed control event. */
export function applyDwarvenBattleTraining(context: RevenantSchedulerContext, event: SimulationEvent): void {
  if (event.type !== 'control' || !hasTrait(context.config, TRAIT.DWARVEN_BATTLE_TRAINING)) return;
  const profile = requireBalanceProfileFromContext(context, REVENANT_CORE_BALANCE_PROFILE_IDS.dwarvenBattleTraining);
  const condition = requireEffect(profile, 'condition', 'Weakness');
  if (!condition) return;
  const conditionName = String(condition.condition);
  emitSkillCondition(context, {
    cause: event,
    at: event.at,
    skillId: TRAIT.DWARVEN_BATTLE_TRAINING,
    skillName: 'Dwarven Battle Training',
    name: `Dwarven Battle Training — ${conditionName}`,
    condition: conditionName,
    stacks: effectNumber(profile, condition, 'stacks'),
    duration: effectNumber(profile, condition, 'duration')
  });
}

/** Grants Vicious Reprisal Might from qualifying strikes while Resolution is active. */
export function applyViciousReprisal(context: RevenantSchedulerContext, event: SimulationEvent): void {
  const state = professionCoreState(context);
  if (!hasTrait(context.config, TRAIT.VICIOUS_REPRISAL) || !context.hasBuff('resolution', event.at)) {
    return;
  }

  const profile = requireBalanceProfileFromContext(context, REVENANT_CORE_BALANCE_PROFILE_IDS.viciousReprisal);
  const boon = requireEffect(profile, 'boon', 'might');
  // The cooldown gates only might, so a removed boon leaves it ready.
  if (!boon) return;
  const sourceSkill =
    context.catalog.skillsById.get(event.skillId ?? '') ||
    ({ id: TRAIT.VICIOUS_REPRISAL, name: 'Vicious Reprisal' } as RevenantSkill);
  // Arm the scheduler-owned claim before its boon can trigger another reaction.
  if (
    !tryConsumeProcCooldown(
      state.traitProcReadyAt,
      'viciousReprisal',
      event.at,
      balanceProfileNumber(profile, 'cooldown')
    )
  )
    return;
  emitSkillBuff(context, {
    cause: event,
    at: event.at,
    source: 'revenant',
    sourceId: TRAIT.VICIOUS_REPRISAL,
    actorType: 'player',
    skillId: TRAIT.VICIOUS_REPRISAL,
    skillName: 'Vicious Reprisal',
    name: 'Vicious Reprisal — might',
    kind: String(boon.boon),
    duration: gw2SchedulerBoonDuration(
      context,
      sourceSkill,
      String(boon.boon),
      effectNumber(profile, boon, 'duration')
    ),
    stacks: effectNumber(profile, boon, 'stacks')
  });
}
