import { mesmerMechanicsFor } from '#gw2/professions/mesmer/core/mechanics/runtime.js';
/** Owns imperative Core Mesmer Illusions trait effects. */
import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import {
  requireBalanceProfileFromContext,
  requireEffect,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { isGw2PlayerActorEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { missesTarget } from '#gw2/platform/combat/state/targets.js';
import { buildResolverCondition } from '#gw2/platform/resolver/packets.js';
import type { SimulationEvent } from '#gw2/platform/engine/events/events.js';
import type { MesmerMechanics, MesmerRuntime } from '#gw2/professions/mesmer/types.js';
import type { MesmerShatterResolution } from '#gw2/professions/mesmer/core/mechanics/shatter-types.js';

import type { MesmerConditionApplication } from '#gw2/professions/mesmer/data/types.js';

type CryOfPainContext = Pick<MesmerMechanics, 'traits' | 'balanceProfile'>;

/** Applies Fragmentation conditions once per native impact, inheriting hit timing and cancellation. */
export function triggerMasterOfFragmentation(context: MesmerRuntime, event: SimulationEvent): void {
  if (
    !mesmerMechanicsFor(context).traits.has(TRAIT.MASTER_OF_FRAGMENTATION) ||
    event.type !== 'damage' ||
    !isGw2PlayerActorEvent(event) ||
    event.sourceId !== event.skillId ||
    missesTarget(event)
  )
    return;
  const drum = event.skillId === ID.DEAFENING_DRUM;
  if (
    !drum &&
    ![ID.CRY_OF_FRUSTRATION, ID.REWINDER, ID.BLADESONG_SORROW, ID.FLUSTERING_FLUTE].some((id) => id === event.skillId)
  )
    return;
  const masterOfFragmentationProfile = requireBalanceProfileFromContext(context, TRAIT.MASTER_OF_FRAGMENTATION);
  const effect = requireEffect(masterOfFragmentationProfile, 'condition', drum ? 'Weakness' : 'Cripple');
  if (!effect) return;
  context.emitDerived(
    event,
    buildResolverCondition({
      actorType: 'player',
      at: event.at,
      source: 'Trait',
      sourceId: TRAIT.MASTER_OF_FRAGMENTATION,
      skillId: event.skillId,
      skillName: event.skillName,
      condition: drum ? 'Weakness' : 'Cripple',
      duration: Number(effect.duration),
      stacks: Number(effect.stacks)
    })
  );
}

/** Adds The Pledge only to the skill's player Burning, inheriting its timing and excluding summon or trait procs. */
export function triggerThePledge(context: MesmerRuntime, event: SimulationEvent): void {
  if (
    !mesmerMechanicsFor(context).traits.has(TRAIT.THE_PLEDGE) ||
    event.type !== 'condition' ||
    event.condition !== 'Burning' ||
    !isGw2PlayerActorEvent(event) ||
    event.sourceId !== event.skillId ||
    (event.skillId !== ID.PHANTASMAL_MAGE && event.skillId !== ID.THE_PRESTIGE)
  )
    return;
  const thePledgeProfile = requireBalanceProfileFromContext(context, TRAIT.THE_PLEDGE);
  const effect = requireEffect(thePledgeProfile, 'condition', 'Burning');
  if (!effect) return;
  // Separate Burning applications preserve the total, including any fractional final stack.
  const stacks = Number(effect.stacks);
  for (let index = 0; index < Math.ceil(stacks); index += 1) {
    context.emitDerived(
      event,
      buildResolverCondition({
        actorType: 'player',
        at: event.at,
        source: 'Trait',
        sourceId: TRAIT.THE_PLEDGE,
        skillId: event.skillId,
        skillName: event.skillName,
        condition: 'Burning',
        duration: Number(effect.duration),
        stacks: Math.min(1, stacks - index)
      })
    );
  }
}

/** Returns Cry of Pain's Confusion override before the owning shatter emits packets. */
export function applyCryOfPain(
  context: CryOfPainContext,
  condition: MesmerConditionApplication | undefined
): MesmerConditionApplication | undefined {
  if (!context.traits.has(TRAIT.CRY_OF_PAIN)) return condition;
  const cryOfPainProfile = requireBalanceProfileFromContext(context, TRAIT.CRY_OF_PAIN);
  const effect = requireEffect(cryOfPainProfile, 'condition', 'Confusion');
  return effect ? { ...effect, summonKind: undefined, name: effect.condition! } : condition;
}

/** Emits Compounding Power stacks and its proc record at the owning lifecycle position. */
export function triggerCompoundingPower(
  context: Readonly<Pick<MesmerMechanics, 'traits' | 'addEvent' | 'addTraitProc' | 'balanceProfile'>>,
  at: number,
  count: number,
  sourceSkill: string,
  detail: string
): void {
  if (!context.traits.has(TRAIT.COMPOUNDING_POWER) || count <= 0) return;
  const compoundingPowerProfile = requireBalanceProfileFromContext(context, TRAIT.COMPOUNDING_POWER);
  const duration = balanceProfileNumber(compoundingPowerProfile, 'durationMultiplier');
  for (let index = 0; index < count; index += 1) {
    context.addEvent({
      type: 'buff',
      // Simultaneous resource gains create simultaneous independent stacks.
      at,
      kind: 'compounding',
      stacks: 1,
      duration
    });
  }

  context.addTraitProc('Compounding Power', at, sourceSkill, detail);
}

/** Applies Maim the Disillusioned to the first-strike groups reported by the shatter resolver. */
export function triggerMaimTheDisillusioned(
  context: Readonly<Pick<MesmerMechanics, 'traits' | 'addCondition' | 'addTraitProc' | 'balanceProfile'>>,
  resolution: MesmerShatterResolution
): void {
  if (!resolution.traitHits.length || !context.traits.has(TRAIT.MAIM_THE_DISILLUSIONED)) return;
  const maimTheDisillusionedProfile = requireBalanceProfileFromContext(context, TRAIT.MAIM_THE_DISILLUSIONED);
  const effect = requireEffect(maimTheDisillusionedProfile, 'condition', 'Torment');
  if (!effect) return;
  const maim = {
    name: String(effect.condition),
    duration: Number(effect.duration),
    stacks: Number(effect.stacks)
  };
  for (const hit of resolution.traitHits) {
    if (hit.count <= 0) continue;
    context.addCondition(
      resolution.skill.name,
      hit.at,
      { ...maim, stacks: maim.stacks * hit.count },
      'Player',
      `${resolution.skill.name} — Maim the Disillusioned`,
      { metadata: { shatterTraitEligible: true } }
    );
  }

  context.addTraitProc('Maim the Disillusioned', resolution.at, resolution.skill.name);
}

/** Returns the profile-owned Phantasmal Haste speed before phantasm packet times are derived. */
export function phantasmalHasteSpeed(context: CryOfPainContext): number {
  return context.traits.has(TRAIT.PHANTASMAL_HASTE)
    ? balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.PHANTASMAL_HASTE), 'quicknessCastMultiplier')
    : 1;
}
