import { mesmerConditionFromProfile, mesmerMechanicsFor } from '#gw2/professions/mesmer/core/mechanics/runtime.js';
import { emitMesmerEffects } from '#gw2/professions/mesmer/core/events.js';
import { applyCryOfPain } from '#gw2/professions/mesmer/core/traits/index.js';
import { MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import {
  requireBalanceProfileFromContext,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import type { MesmerRuntime } from '#gw2/professions/mesmer/types.js';
import type {
  MesmerShatterResolverRequest,
  MesmerShatterTraitHit
} from '#gw2/professions/mesmer/core/mechanics/shatter-types.js';
import type { AvailabilityResult } from '#gw2/platform/execution/types.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';

/** Resolves Virtuoso Bladesong packets and reports their actual impact timing to shared shatter traits. */
export function resolveBladesong(
  context: MesmerRuntime,
  { skill, shatter, at, castStart, spent }: MesmerShatterResolverRequest
): readonly MesmerShatterTraitHit[] {
  const runtime = mesmerMechanicsFor(context);
  const strike = shatter.strikes[spent];
  const packetTicks = () => strike?.ticks ?? [];

  const addBladeDamage = (ticks: readonly { readonly atMs: number; readonly coefficient: number }[]) =>
    strike
      ? runtime.addDamage(
          skill,
          at,
          {
            ...strike,
            name: undefined,
            summonKind: undefined,
            ...(ticks.length ? { ticks } : {}),
            timingAnchor: 'castStart',
            timingScale: 'fixed',
            source: 'Player',
            weaponStrengthProfileId: 'nonweapon.profession-mechanic'
          },
          { metadata: { shatterTraitEligible: true, blade: true } }
        )
      : [];

  if (shatter.kind === 'blade-power') {
    const ticks = packetTicks();
    return addBladeDamage(ticks).map((event) => ({ at: event.at, count: 1 }));
  }

  if (shatter.kind === 'blade-confusion') {
    const baseConfusion = mesmerConditionFromProfile(context, shatter.balanceProfileId || skill.id, 'Confusion');
    const confusion = applyCryOfPain(runtime, baseConfusion);
    const ticks = packetTicks();

    const hits = addBladeDamage(ticks);
    if (confusion)
      runtime.addCondition(skill.name, at, {
        name: 'Confusion',
        duration: confusion.duration,
        ticks: (strike?.ticks?.map((tick) => tick.atMs) ?? shatter.conditionAtMs?.[spent] ?? []).map((atMs) => ({
          atMs,
          condition: 'Confusion',
          duration: Number(confusion.duration),
          stacks: Number(confusion.stacks)
        })),
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      });
    return hits.map((event) => ({ at: event.at, count: 1 }));
  }

  if (shatter.kind === 'blade-control') {
    // A blade cannot impact before the activation has actually committed its resource spend.
    const damageAt = Math.max(at, castStart + Number(shatter.damageAtMs || 0) / 1000);
    if (strike)
      runtime.addDamage(
        skill,
        damageAt,
        {
          ...strike,
          name: undefined,
          summonKind: undefined,
          hits: 1,
          source: 'Player',
          weaponStrengthProfileId: 'nonweapon.profession-mechanic'
        },
        { metadata: { shatterTraitEligible: true, blade: true } }
      );
    emitMesmerEffects(context, skill, castStart, damageAt);
    return strike ? [{ at: damageAt, count: 1 }] : [];
  }

  if (shatter.kind === 'blade-requiem') {
    const ticks = [...packetTicks()];
    // Fragmentation extends the spinning blades by one pulse with the same damage as the last pulse.
    if (ticks.length && runtime.traits.has(TRAIT.MASTER_OF_FRAGMENTATION)) {
      const last = ticks[ticks.length - 1];
      const masterOfFragmentationProfile = requireBalanceProfileFromContext(context, TRAIT.MASTER_OF_FRAGMENTATION);
      ticks.push({
        ...last,
        atMs: last.atMs + balanceProfileNumber(masterOfFragmentationProfile, 'durationMultiplier') * 1000
      });
    }

    return addBladeDamage(ticks).map((event) => ({ at: event.at, count: 1 }));
  }

  if (shatter.kind === 'blade-defense') {
    return strike ? [{ at, count: 1 }] : [];
  }

  throw new Error(`Unsupported Bladesong kind: ${shatter.kind}.`);
}

/** Requires at least one stocked blade before a Virtuoso bladesong can begin. */
export function virtuosoAvailability(context: MesmerRuntime, skill: MesmerSkill): AvailabilityResult {
  if (!mesmerMechanicsFor(context).shatters[skill.id] || mesmerMechanicsFor(context).actions.currentResource() >= 1) {
    return { ready: true };
  }

  return {
    ready: false,
    retryAt: null,
    code: 'mesmer.no-blades',
    reason: `${skill.name} requires at least one blade.`
  };
}
