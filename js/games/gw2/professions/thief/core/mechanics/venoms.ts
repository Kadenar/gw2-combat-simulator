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

interface VenomDefinition {
  readonly skillId: SkillId;
  readonly skillName: string;
  readonly kind: string;
  readonly profileId: SkillId;
}

const VENOMS: readonly VenomDefinition[] = Object.freeze([
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

function venomForSkill(skillId: SkillId): VenomDefinition | undefined {
  return VENOMS.find((venom) => venom.skillId === skillId);
}

function conditionEffects(context: unknown, venom: VenomDefinition): readonly ConditionEffect[] {
  return (balanceProfileFromContext(context, venom.profileId)?.effects || []).filter(
    (effect): effect is ConditionEffect => effect.type === 'condition'
  );
}

/** Keep each grant's expiry and spend older charges before newer applications. */
export function refreshVenomCharges(state: ThiefCoreState, at: number): void {
  for (const [skillId, batches] of Object.entries(state.venomChargeBatches)) {
    const active = batches.filter((batch) => batch.expiresAt > at && batch.charges > 0);
    active.sort((a, b) => a.expiresAt - b.expiresAt);
    state.venomChargeBatches[skillId] = active;
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
  const batches = (state.venomChargeBatches[String(skillId)] ??= []);
  const remaining = batches.reduce((sum, batch) => sum + batch.charges, 0);
  const added = Math.max(0, Math.min(charges, cap - remaining));
  if (!added) return;
  state.venomGeneration += 1;
  batches.push({
    generation: state.venomGeneration,
    charges: added,
    expiresAt: at + duration
  });
  refreshVenomCharges(state, at);
}

/** Arms the caster's finite venom charges and schedules each assumed ally's same bounded proc sequence. */
export function activateVenom(context: ThiefCastContext, skill: ThiefSkill): void {
  const venom = venomForSkill(skill.id);
  if (!venom) return;
  const state = professionCoreState(context) as ThiefCoreState;
  const at = context.effectiveEnd;
  const profile = balanceProfileFromContext(context, venom.profileId);
  const maximumStacks = Number(profile?.maximumStacks || 0);
  const duration = Number(profile?.durationMultiplier ?? 24);
  addVenomCharges(state, skill.id, at, maximumStacks, duration);
  const effects = conditionEffects(context, venom);
  // Recasts queue behind remaining ally charges, keeping one proc per assumed strike.
  const alliedStart = Math.max(at, state.venomAllyLastProcAt[String(skill.id)] ?? at);
  const alliedProcs = gw2AlliedPlayerProcTimeline(context.config, {
    start: alliedStart,
    duration: Math.max(0, at + duration - alliedStart),
    maximumPerAlly: maximumStacks
  });
  if (alliedProcs.length) {
    state.venomAllyLastProcAt[String(skill.id)] = Math.max(...alliedProcs.map((proc) => proc.at));
  }

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
        stacks: Number(effect.stacks ?? 1),
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
  refreshVenomCharges(state, event.at);
  let procCount = 0;
  for (const venom of VENOMS) {
    const batch = state.venomChargeBatches[String(venom.skillId)]?.find((entry) => entry.charges > 0);
    if (!batch) continue;
    batch.charges -= 1;
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
        stacks: Number(effect.stacks ?? 1),
        duration: Number(effect.duration || 0),
        activationId: event.activationId || `${event.skillId}:${event.at}`,
        triggeredBy: event.skillName,
        venomProcEffectIndex: effectIndex
      });
    }
  }

  return procCount;
}
