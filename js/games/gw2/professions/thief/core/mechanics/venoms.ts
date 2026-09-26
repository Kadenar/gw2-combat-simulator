import { buildResolverCondition } from '#gw2/platform/resolver/packets.js';
import { activeChargeGrants, consumeCharge, grantChargePool } from '#gw2/platform/combat/resources/charges.js';
import { requireBalanceProfileFromContext, effectNumber } from '#gw2/platform/engine/skills/balance-profiles.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
import { THIEF_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/thief/core/profiles.js';
import type { BalanceProfile, ConditionEffect, SkillId } from '#gw2/platform/engine/skills/types.js';
import type { ThiefResolverContext, ThiefResolverEvent } from '#gw2/professions/thief/types.js';
import type { ThiefCoreState } from '#gw2/professions/thief/core/state.js';

export interface VenomDefinition {
  readonly skillId: SkillId;
  readonly skillName: string;
  readonly kind: string;
  readonly profileId: SkillId;
}

export const VENOMS: readonly VenomDefinition[] = Object.freeze([
  {
    skillId: ID.SPIDER_VENOM,
    skillName: 'Spider Venom',
    kind: 'spider-venom',
    profileId: PROFILE.spiderVenomProc
  },
  {
    skillId: ID.SKALE_VENOM,
    skillName: 'Skale Venom',
    kind: 'skale-venom',
    profileId: PROFILE.skaleVenomProc
  },
  {
    skillId: ID.DEVOURER_VENOM,
    skillName: 'Devourer Venom',
    kind: 'devourer-venom',
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
export function refreshVenomCharges(state: ThiefCoreState, at: number): void {
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
  const state = professionCoreState(context) as ThiefCoreState;
  refreshVenomCharges(state, event.at);
  let procCount = 0;
  for (const venom of VENOMS) {
    const batch = state.venomChargeBatches[String(venom.skillId)]?.find((entry) => entry.charges > 0);
    if (!consumeCharge(batch, event.at)) continue;
    procCount += 1;
    const profile = requireBalanceProfileFromContext(context, venom.profileId);
    const effects = conditionEffects(profile);
    for (let effectIndex = 0; effectIndex < effects.length; effectIndex += 1) {
      const effect = effects[effectIndex];
      context.applyCondition(
        buildResolverCondition({
          at: event.at,
          source: 'thief',
          sourceId: venom.skillId,
          actorType: 'player',
          skillId: venom.skillId,
          skillName: venom.skillName,
          name: `${venom.skillName} — ${effect.condition}`,
          condition: String(effect.condition),
          stacks: effectNumber(profile, effect, 'stacks'),
          duration: effectNumber(profile, effect, 'duration'),
          activationId: event.activationId || `${event.skillId}:${event.at}`,
          triggeredBy: event.skillName,
          metadata: { venomProcEffectIndex: effectIndex }
        })
      );
    }
  }

  return procCount;
}
