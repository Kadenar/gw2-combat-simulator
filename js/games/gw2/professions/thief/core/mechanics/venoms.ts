import { emitThiefStateSnapshot } from '#gw2/professions/thief/state.js';
import { balanceProfileFromContext } from '#gw2/platform/combat/state/balance-profiles.js';
import { emitSkillCondition } from '#gw2/platform/scheduler/skill-events.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
import { gw2AlliedPlayerProcTimeline } from '#gw2/platform/combat/state/allied-players.js';
import { THIEF_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/thief/core/profiles.js';
import type { ConditionEffect, SkillId } from '#gw2/platform/engine/skills/types.js';
import type {
  ThiefCastContext,
  ThiefCoreState,
  ThiefResolverContext,
  ThiefResolverEvent,
  ThiefSkill
} from '#gw2/professions/thief/types.js';

type VenomNumberField =
  | 'spiderVenomCharges'
  | 'spiderVenomExpiresAt'
  | 'spiderVenomGeneration'
  | 'skaleVenomCharges'
  | 'skaleVenomExpiresAt'
  | 'skaleVenomGeneration'
  | 'devourerVenomCharges'
  | 'devourerVenomExpiresAt'
  | 'devourerVenomGeneration';

interface VenomDefinition {
  readonly skillId: SkillId;
  readonly skillName: string;
  readonly kind: string;
  readonly profileId: SkillId;
  readonly chargesField: VenomNumberField;
  readonly expiresAtField: VenomNumberField;
  readonly generationField: VenomNumberField;
}

const VENOMS: readonly VenomDefinition[] = Object.freeze([
  {
    skillId: ID.SPIDER_VENOM,
    skillName: 'Spider Venom',
    kind: 'spider-venom',
    profileId: PROFILE.spiderVenomProc,
    chargesField: 'spiderVenomCharges',
    expiresAtField: 'spiderVenomExpiresAt',
    generationField: 'spiderVenomGeneration'
  },
  {
    skillId: ID.SKALE_VENOM,
    skillName: 'Skale Venom',
    kind: 'skale-venom',
    profileId: PROFILE.skaleVenomProc,
    chargesField: 'skaleVenomCharges',
    expiresAtField: 'skaleVenomExpiresAt',
    generationField: 'skaleVenomGeneration'
  },
  {
    skillId: ID.DEVOURER_VENOM,
    skillName: 'Devourer Venom',
    kind: 'devourer-venom',
    profileId: PROFILE.devourerVenomProc,
    chargesField: 'devourerVenomCharges',
    expiresAtField: 'devourerVenomExpiresAt',
    generationField: 'devourerVenomGeneration'
  }
]);

function venomForSkill(skillId: SkillId): VenomDefinition | undefined {
  return VENOMS.find((venom) => venom.skillId === skillId);
}

function conditionEffects(context: unknown, venom: VenomDefinition): readonly ConditionEffect[] {
  return (balanceProfileFromContext(context, venom.profileId)?.effects || []).filter(
    (effect): effect is ConditionEffect => effect.type === 'condition'
  );
}

/** Arms the caster's finite venom charges and schedules each assumed ally's same bounded proc sequence. */
export function activateVenom(context: ThiefCastContext, skill: ThiefSkill): void {
  const venom = venomForSkill(skill.id);
  if (!venom) return;
  const state = professionCoreState(context) as ThiefCoreState;
  const at = context.effectiveEnd;
  const profile = balanceProfileFromContext(context, venom.profileId);
  const maximumStacks = Number(profile?.maximumStacks || 0);
  const duration = Number(profile?.durationMultiplier || 24);
  state[venom.chargesField] = maximumStacks;
  state[venom.expiresAtField] = at + duration;
  state[venom.generationField] += 1;
  const effects = conditionEffects(context, venom);
  const alliedProcs = gw2AlliedPlayerProcTimeline(context.config, {
    start: at,
    duration,
    maximumPerAlly: maximumStacks
  });
  for (const proc of alliedProcs) {
    for (let effectIndex = 0; effectIndex < effects.length; effectIndex += 1) {
      const effect = effects[effectIndex];
      emitSkillCondition(context, {
        at: proc.at,
        source: 'thief',
        sourceId: venom.skillId,
        actorType: 'player',
        skillId: venom.skillId,
        skillName: venom.skillName,
        name: `${venom.skillName} — Ally ${proc.allyIndex} ${effect.condition}`,
        condition: String(effect.condition),
        stacks: Number(effect.stacks || 1),
        duration: Number(effect.duration || 0),
        activationId: `${context.reservationId}:ally:${proc.allyIndex}:${proc.procIndex}`,
        triggeredByAlly: proc.allyIndex,
        venomProcEffectIndex: effectIndex
      });
    }
  }

  emitThiefStateSnapshot(context, at, venom.kind);
}

/** Consumes one charge from every active venom on a player strike and applies each venom's complete proc packet. */
export function applyActiveVenoms(context: ThiefResolverContext, event: ThiefResolverEvent): number {
  if (event.actorType !== 'player' || !(Number(event.coefficient) > 0)) return 0;
  const state = professionCoreState(context) as ThiefCoreState;
  let procCount = 0;
  for (const venom of VENOMS) {
    if (state[venom.chargesField] <= 0 || state[venom.expiresAtField] <= event.at) continue;
    state[venom.chargesField] -= 1;
    procCount += 1;
    const effects = conditionEffects(context, venom);
    for (let effectIndex = 0; effectIndex < effects.length; effectIndex += 1) {
      const effect = effects[effectIndex];
      context.applyCondition({
        type: 'condition',
        at: event.at,
        source: 'thief',
        sourceId: venom.skillId,
        actorType: 'player',
        skillId: venom.skillId,
        skillName: venom.skillName,
        name: `${venom.skillName} — ${effect.condition}`,
        condition: String(effect.condition),
        stacks: Number(effect.stacks || 1),
        duration: Number(effect.duration || 0),
        activationId: event.activationId || `${event.skillId}:${event.at}`,
        triggeredBy: event.skillName,
        venomProcEffectIndex: effectIndex
      });
    }
  }

  return procCount;
}
