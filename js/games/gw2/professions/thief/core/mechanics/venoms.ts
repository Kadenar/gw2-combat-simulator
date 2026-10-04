import { gw2AlliedPlayerProcTimeline } from '#gw2/platform/combat/state/allied-players.js';
import { buildResolverCondition } from '#gw2/platform/resolver/packets.js';

import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext
} from '#gw2/platform/skills/balance-profiles.js';
import { buildThiefCondition } from '#gw2/professions/thief/core/events.js';
import { THIEF_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/thief/core/profiles.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';

import { activeChargeGrants, consumeCharge, grantChargePool } from '#gw2/platform/combat/resources/charges.js';
import type { ConditionEffect } from '#gw2/platform/effects/types.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import type { BalanceProfile, SkillId } from '#gw2/platform/skills/types.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';
import type { ThiefCoreState } from '#gw2/professions/thief/core/state.js';
import type { ThiefResolverContext, ThiefResolverEvent, ThiefSkill } from '#gw2/professions/thief/types.js';

interface VenomDefinition {
  readonly skillId: SkillId;
  readonly skillName: string;
  readonly profileId: SkillId;
}

export const VENOMS: readonly VenomDefinition[] = Object.freeze([
  {
    skillId: ID.SPIDER_VENOM,
    skillName: 'Spider Venom',
    profileId: PROFILE.spiderVenomProc
  },
  {
    skillId: ID.SKALE_VENOM,
    skillName: 'Skale Venom',
    profileId: PROFILE.skaleVenomProc
  },
  {
    skillId: ID.DEVOURER_VENOM,
    skillName: 'Devourer Venom',
    profileId: PROFILE.devourerVenomProc
  }
]);

export function venomForSkill(skillId: SkillId): VenomDefinition | undefined {
  return VENOMS.find((venom) => venom.skillId === skillId);
}

export function conditionEffects(profile: BalanceProfile): readonly ConditionEffect[] {
  return (profile.effects || []).filter((effect): effect is ConditionEffect => effect.type === 'condition');
}

/** Keep each grant's expiry and spend older charges before newer applications. */
function refreshVenomCharges(state: ThiefCoreState, at: number): void {
  for (const [skillId, batches] of Object.entries(state.venomChargeBatches)) {
    state.venomChargeBatches[skillId] = activeChargeGrants(batches, at);
  }
}

/** Add a fresh grant; a trait cap can limit new charges without deleting stacked utility grants. */
export function addVenomCharges(
  state: ThiefCoreState,
  skillId: SkillId,
  at: number,
  charges: number,
  duration: number,
  cap = Infinity
): void {
  const venom = venomForSkill(skillId);
  if (!venom) return;
  refreshVenomCharges(state, at);
  const pool = { grants: state.venomChargeBatches };
  grantChargePool(pool, String(skillId), at, charges, duration, cap);
}

/** Consumes one charge from every active venom on a player strike and applies each venom's complete proc packet. */
export function applyActiveVenoms(context: ThiefResolverContext, event: ThiefResolverEvent): number {
  if (event.actorType !== 'player' || !(Number(event.coefficient) > 0)) return 0;
  const state = professionCoreState(context);
  refreshVenomCharges(state, event.at);
  let procCount = 0;
  for (const venom of VENOMS) {
    const batch = state.venomChargeBatches[String(venom.skillId)]?.find((entry) => entry.charges > 0);
    if (!consumeCharge(batch, event.at)) continue;
    procCount += 1;
    emitVenom(context, event, venom);
  }

  return procCount;
}

/** One venom charge reuses its condition payload without a qualifying hit or charge grant. */
export function emitVenom(context: ThiefResolverContext, event: ThiefResolverEvent, venom: VenomDefinition): void {
  const profile = requireBalanceProfileFromContext(context, venom.profileId);
  const effects = conditionEffects(profile);
  for (let effectIndex = 0; effectIndex < effects.length; effectIndex += 1) {
    const effect = effects[effectIndex];
    context.effects.emit({
      kind: 'packet',
      settlement: 'reaction',
      event: buildResolverCondition({
        at: event.at,
        source: 'thief',
        sourceId: venom.skillId,
        actorType: 'player',
        skillId: venom.skillId,
        skillName: venom.skillName,
        // A venom charge owns its condition damage independently of the attack that consumes it.
        procType: 'profession',
        icon: context.helpers.skillsById.get(venom.skillId)?.icon,
        name: `${venom.skillName} — ${effect.condition}`,
        condition: String(effect.condition),
        stacks: effectNumber(profile, effect, 'stacks'),
        duration: effectNumber(profile, effect, 'duration'),
        activationId: event.activationId || `${event.skillId}:${event.at}`,
        triggeredBy: event.skillName,
        metadata: { venomProcEffectIndex: effectIndex }
      })
    });
  }
}

/** Arms the caster's finite venom charges and queues each assumed ally's bounded proc sequence. */
export function activateVenom(runtime: ThiefRuntime, cast: RuntimeCast<ThiefSkill>): void {
  const venom = venomForSkill(cast.skill.id);
  if (!venom) return;
  const core = runtime.profession.core;
  const at = runtime.time;
  const profile = requireBalanceProfileFromContext(runtime, venom.profileId);
  const maximumStacks = balanceProfileNumber(profile, 'maximumStacks');
  const duration = balanceProfileNumber(profile, 'durationMultiplier');
  addVenomCharges(core, cast.skill.id, at, maximumStacks, duration);
  // Recasts queue behind remaining ally charges, keeping one proc per assumed strike.
  const alliedStart = Math.max(at, core.venomAllyLastProcAt[String(cast.skill.id)] ?? at);
  const alliedProcs = gw2AlliedPlayerProcTimeline(runtime.config, {
    start: alliedStart,
    duration: Math.max(0, at + duration - alliedStart),
    maximumPerAlly: maximumStacks
  });
  if (alliedProcs.length)
    core.venomAllyLastProcAt[String(cast.skill.id)] = Math.max(...alliedProcs.map((proc) => proc.at));
  const packets = conditionEffects(profile).map((effect) => ({
    effect,
    stacks: effectNumber(profile, effect, 'stacks'),
    duration: effectNumber(profile, effect, 'duration')
  }));
  for (const proc of alliedProcs)
    for (const [effectIndex, { effect, stacks, duration: conditionDuration }] of packets.entries())
      runtime.effects.emit({
        kind: 'packet',
        event: buildThiefCondition(null, {
          at: proc.at,
          skillId: venom.skillId,
          skillName: venom.skillName,
          name: `${venom.skillName} — Ally ${proc.allyIndex} ${effect.condition}`,
          condition: String(effect.condition),
          stacks,
          duration: conditionDuration,
          activationId: `${cast.id}:ally:${proc.allyIndex}:${proc.procIndex}`,
          metadata: { triggeredByAlly: proc.allyIndex, venomProcEffectIndex: effectIndex }
        })
      });
}
