/** Owns imperative Core Mesmer Illusions trait effects. */
import { MESMER_TRAIT_IDS as TRAIT } from '#gw2/content/professions/mesmer/data/ids.js';
import type {
  MesmerAddCondition,
  MesmerAddEvent,
  MesmerAddTraitProc,
  MesmerRuntime,
  MesmerShatterResolution
} from '#gw2/content/professions/mesmer/types.js';

import type { MesmerConditionApplication } from '#gw2/content/professions/mesmer/data/types.js';

type CryOfPainContext = Pick<MesmerRuntime, 'traits' | 'balanceProfile'>;

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
  const duration = Number(context.balanceProfile(TRAIT.COMPOUNDING_POWER)?.durationMultiplier || 8);
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
    ? Number(context.balanceProfile(TRAIT.PHANTASMAL_HASTE)?.quicknessCastMultiplier || 1.5)
    : 1;
}
