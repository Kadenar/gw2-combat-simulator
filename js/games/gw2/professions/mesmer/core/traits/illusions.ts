/** Owns imperative Core Mesmer Illusions trait effects. */
import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import { balanceProfileEffectFromContext } from '#gw2/platform/combat/state/balance-profiles.js';
import { isGw2PlayerActorEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { emitSkillCondition } from '#gw2/platform/scheduler/skill-events.js';
import type { SimulationEvent } from '#gw2/platform/engine/events/types.js';
import type {
  MesmerAddCondition,
  MesmerAddEvent,
  MesmerAddTraitProc,
  MesmerRuntime,
  MesmerSchedulerContext
} from '#gw2/professions/mesmer/types.js';
import type { MesmerShatterResolution } from '#gw2/professions/mesmer/core/mechanics/shatter-types.js';

import type { MesmerConditionApplication } from '#gw2/professions/mesmer/data/types.js';

type CryOfPainContext = Pick<MesmerRuntime, 'traits' | 'balanceProfile'>;

/** Adds The Pledge only to the skill's player Burning, inheriting its timing and excluding summon or trait procs. */
export function triggerThePledge(context: MesmerSchedulerContext, event: SimulationEvent): void {
  if (
    !context.mesmerRuntime?.traits.has(TRAIT.THE_PLEDGE) ||
    event.type !== 'condition' ||
    event.condition !== 'Burning' ||
    !isGw2PlayerActorEvent(event) ||
    event.sourceId !== event.skillId ||
    (event.skillId !== ID.PHANTASMAL_MAGE && event.skillId !== ID.THE_PRESTIGE)
  )
    return;
  const effect = balanceProfileEffectFromContext(context, TRAIT.THE_PLEDGE, 'condition');
  emitSkillCondition(context, {
    cause: event,
    at: event.at,
    source: 'Trait',
    sourceId: TRAIT.THE_PLEDGE,
    actorType: 'player',
    skillId: event.skillId,
    skillName: event.skillName,
    condition: 'Burning',
    duration: Number(effect?.duration ?? 3),
    stacks: Number(effect?.stacks ?? 2)
  });
}

interface MesmerCompoundingPowerContext {
  readonly traits: ReadonlySet<number>;
  readonly epsilon: number;
  readonly addEvent: MesmerAddEvent;
  readonly addTraitProc: MesmerAddTraitProc;
  readonly balanceProfile: MesmerRuntime['balanceProfile'];
}

export interface MesmerMaimContext {
  readonly traits: ReadonlySet<number>;
  readonly addCondition: MesmerAddCondition;
  readonly addTraitProc: MesmerAddTraitProc;
  readonly balanceProfile: MesmerRuntime['balanceProfile'];
}

/** Returns Cry of Pain's Confusion override before the owning shatter emits packets. */
export function applyCryOfPain(
  context: CryOfPainContext,
  fallback: MesmerConditionApplication
): MesmerConditionApplication {
  if (!context.traits.has(TRAIT.CRY_OF_PAIN)) return fallback;
  const effect = context.balanceProfile(TRAIT.CRY_OF_PAIN)?.effects?.find(({ type }) => type === 'condition');
  return {
    name: String(effect?.condition || fallback.name),
    duration: Number(effect?.duration ?? fallback.duration),
    stacks: Number(effect?.stacks ?? fallback.stacks)
  };
}

/** Emits Compounding Power stacks and its proc record at the owning lifecycle position. */
export function triggerCompoundingPower(
  context: MesmerCompoundingPowerContext,
  at: number,
  count: number,
  sourceSkill: string,
  detail: string
): void {
  if (!context.traits.has(TRAIT.COMPOUNDING_POWER) || count <= 0) return;
  const duration = Number(context.balanceProfile(TRAIT.COMPOUNDING_POWER)?.durationMultiplier ?? 8);
  for (let index = 0; index < count; index += 1) {
    context.addEvent({
      type: 'buff',
      at: at + index * context.epsilon,
      kind: 'compounding',
      stacks: 1,
      duration
    });
  }

  context.addTraitProc('Compounding Power', at, sourceSkill, detail);
}

/** Applies Maim the Disillusioned to the first-strike groups reported by the shatter resolver. */
export function triggerMaimTheDisillusioned(context: MesmerMaimContext, resolution: MesmerShatterResolution): void {
  if (!resolution.traitHits.length || !context.traits.has(TRAIT.MAIM_THE_DISILLUSIONED)) return;
  const effect = context
    .balanceProfile(TRAIT.MAIM_THE_DISILLUSIONED)
    ?.effects?.find(({ type }) => type === 'condition');
  const maim = {
    name: String(effect?.condition || 'Torment'),
    duration: Number(effect?.duration ?? 6),
    stacks: Number(effect?.stacks ?? 1)
  };
  for (const hit of resolution.traitHits) {
    if (hit.count <= 0) continue;
    context.addCondition(
      resolution.skill.name,
      hit.at,
      { ...maim, stacks: maim.stacks * hit.count },
      'Player',
      `${resolution.skill.name} — Maim the Disillusioned`,
      { shatter: true, shatterTraitEligible: true }
    );
  }

  context.addTraitProc('Maim the Disillusioned', resolution.at, resolution.skill.name);
}

/** Returns the profile-owned Phantasmal Haste speed before phantasm packet times are derived. */
export function phantasmalHasteSpeed(context: CryOfPainContext): number {
  return context.traits.has(TRAIT.PHANTASMAL_HASTE)
    ? Number(context.balanceProfile(TRAIT.PHANTASMAL_HASTE)?.quicknessCastMultiplier ?? 1.5)
    : 1;
}
