/** Owns Core Retribution control and Resolution-dependent strike reactions. */
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { isInternalCooldownReady } from '#kernel/core/clock.js';
import { REVENANT_TRAIT_IDS as TRAIT } from '#gw2/content/professions/revenant/data/ids.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { gw2SchedulerBoonDuration } from '#gw2/platform/scheduler/policy.js';
import { emitSkillBuff, emitSkillCondition } from '#gw2/platform/scheduler/skill-events.js';
import { REVENANT_CORE_BALANCE_PROFILE_IDS } from '#gw2/content/professions/revenant/core/skills/index.js';
import {
  requireRevenantBalanceProfile as balanceProfile,
  requireRevenantEffect as profileEffect
} from '#gw2/content/professions/revenant/core/traits/profile-access.js';
import type {
  RevenantSchedulerContext,
  RevenantSimulationEvent,
  RevenantSkill
} from '#gw2/content/professions/revenant/types.js';

/** Applies Dwarven Battle Training Weakness to each observed control event. */
export function applyDwarvenBattleTraining(context: RevenantSchedulerContext, event: RevenantSimulationEvent): void {
  if (event.type !== 'control' || !hasTrait(context.config, TRAIT.DWARVEN_BATTLE_TRAINING)) return;
  const condition = profileEffect(
    balanceProfile(context, REVENANT_CORE_BALANCE_PROFILE_IDS.dwarvenBattleTraining),
    'condition'
  );
  const conditionName = String(condition.condition || 'Weakness');
  emitSkillCondition(context, {
    cause: event,
    at: event.at,
    source: 'revenant',
    sourceId: TRAIT.DWARVEN_BATTLE_TRAINING,
    actorType: 'player',
    skillId: TRAIT.DWARVEN_BATTLE_TRAINING,
    skillName: 'Dwarven Battle Training',
    name: `Dwarven Battle Training — ${conditionName}`,
    condition: conditionName,
    stacks: Number(condition.stacks || 0),
    duration: Number(condition.duration || 0)
  });
}

/** Grants Vicious Reprisal Might from qualifying strikes while Resolution is active. */
export function applyViciousReprisal(context: RevenantSchedulerContext, event: RevenantSimulationEvent): void {
  const state = professionCoreState(context);
  if (
    !hasTrait(context.config, TRAIT.VICIOUS_REPRISAL) ||
    !context.hasBuff('resolution', event.at) ||
    !isInternalCooldownReady(event.at, Number(state.traitProcReadyAt.viciousReprisal || 0))
  ) {
    return;
  }

  const profile = balanceProfile(context, REVENANT_CORE_BALANCE_PROFILE_IDS.viciousReprisal);
  const boon = profileEffect(profile, 'boon');
  const sourceSkill =
    context.catalog.skillsById.get(event.skillId ?? '') ||
    ({ id: TRAIT.VICIOUS_REPRISAL, name: 'Vicious Reprisal' } as RevenantSkill);
  state.traitProcReadyAt.viciousReprisal = event.at + Number(profile.cooldown || 0);
  emitSkillBuff(context, {
    cause: event,
    at: event.at,
    source: 'revenant',
    sourceId: TRAIT.VICIOUS_REPRISAL,
    actorType: 'player',
    skillId: TRAIT.VICIOUS_REPRISAL,
    skillName: 'Vicious Reprisal',
    name: 'Vicious Reprisal — might',
    kind: String(boon.boon || 'might'),
    duration: gw2SchedulerBoonDuration(context, sourceSkill, String(boon.boon || 'might'), Number(boon.duration || 0)),
    stacks: Number(boon.stacks || 0)
  });
}
