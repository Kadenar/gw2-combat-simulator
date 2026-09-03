import { mesmerConditionFromProfile, mesmerRuntimeFor } from '#gw2/professions/mesmer/core/mechanics/runtime.js';
import { applyCryOfPain, triggerBlindingDissipation } from '#gw2/professions/mesmer/core/traits/index.js';
import type {
  MesmerCastContext,
  MesmerShatterResolverRequest,
  MesmerShatterTraitHit
} from '#gw2/professions/mesmer/types.js';

/** Resolves clone-based shatter packets while keeping repeat strikes ineligible for first-strike traits. */
export function resolveCloneShatter(
  context: MesmerCastContext,
  { skill, shatter, at, spent }: MesmerShatterResolverRequest
): readonly MesmerShatterTraitHit[] {
  const runtime = mesmerRuntimeFor(context);
  const sources = spent + 1;

  const addStrikePackets = (): void => {
    const ticks = shatter.ticks?.[spent] ?? [{ atMs: 0, coefficient: Number(shatter.coefficients[spent] || 0) }];

    // Each source contributes one hit to every packet, but shatter traits are
    // attached only to the first packet as required by repeat-strike shatters.
    for (const [strikeIndex, tick] of ticks.entries()) {
      runtime.addDamage(
        skill,
        at + tick.atMs / 1000,
        {
          coefficient: tick.coefficient,
          hits: sources,
          atMs: 0,
          source: 'Player',
          weaponStrengthProfileId: 'nonweapon.profession-mechanic'
        },
        { shatter: true, shatterTraitEligible: strikeIndex === 0 }
      );
    }
  };

  if (shatter.kind === 'power') {
    addStrikePackets();
  } else if (shatter.kind === 'confusion') {
    runtime.addDamage(
      skill,
      at,
      {
        coefficient: shatter.coefficients[spent],
        hits: sources,
        atMs: 0,
        source: 'Player',
        weaponStrengthProfileId: 'nonweapon.profession-mechanic'
      },
      { shatter: true, shatterTraitEligible: true }
    );

    const baseConfusion = mesmerConditionFromProfile(context, shatter.balanceProfileId || skill.id, {
      name: 'Confusion',
      duration: 3,
      stacks: 1
    });
    const confusion = applyCryOfPain(runtime, baseConfusion);
    runtime.addCondition(
      skill.name,
      at,
      {
        ...confusion,
        stacks: sources * Number(confusion.stacks || 1)
      },
      'Player',
      '',
      { shatter: true, shatterTraitEligible: true }
    );

    triggerBlindingDissipation(runtime, skill.name, at, sources);
  } else if (shatter.kind === 'defense') {
    // Zero-coefficient packets preserve defensive shatters as hits for on-hit effects.
    runtime.addDamage(
      skill,
      at,
      {
        coefficient: shatter.coefficients[spent],
        hits: sources,
        atMs: 0,
        source: 'Player',
        weaponStrengthProfileId: 'nonweapon.profession-mechanic'
      },
      { shatter: true, shatterTraitEligible: true }
    );
  } else if (shatter.kind !== 'control') {
    throw new Error(`Unsupported clone shatter kind: ${shatter.kind}.`);
  }

  return [{ at, count: sources }];
}
