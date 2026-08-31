import { mesmerRuntimeFor } from '#gw2/content/professions/mesmer/core/mechanics/runtime.js';
import { applyCryOfPain, triggerBlindingDissipation } from '#gw2/content/professions/mesmer/core/traits/index.js';
import type {
  MesmerCastContext,
  MesmerConditionApplication,
  MesmerShatterResolverRequest,
  MesmerShatterTraitHit
} from '#gw2/content/professions/mesmer/types.js';

function conditionFromProfile(
  context: MesmerCastContext,
  id: number | string,
  fallback: MesmerConditionApplication
): MesmerConditionApplication {
  const effect = mesmerRuntimeFor(context)
    .balanceProfile(id)
    ?.effects?.find(({ type }) => type === 'condition');
  return {
    name: String(effect?.condition || fallback.name),
    duration: Number(effect?.duration ?? fallback.duration),
    stacks: Number(effect?.stacks ?? fallback.stacks)
  };
}

/** Resolves clone-based shatter packets while keeping repeat strikes ineligible for first-strike traits. */
export function resolveCloneShatter(
  context: MesmerCastContext,
  { skill, shatter, at, spent }: MesmerShatterResolverRequest
): readonly MesmerShatterTraitHit[] {
  const runtime = mesmerRuntimeFor(context);
  const sources = spent + 1;
  const strikesPerSource = Math.max(1, Number(shatter.hitsPerSource ?? 1));

  const addStrikePackets = (): void => {
    const coefficient = Number(shatter.coefficients[spent] || 0) / strikesPerSource;
    const interval = Number(shatter.strikeIntervalMs || 0) / 1000;

    // Each source contributes one hit to every packet, but shatter traits are
    // attached only to the first packet as required by repeat-strike shatters.
    for (let strikeIndex = 0; strikeIndex < strikesPerSource; strikeIndex += 1) {
      runtime.addDamage(
        skill,
        at + strikeIndex * interval,
        {
          coefficient,
          hits: sources,
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
        source: 'Player',
        weaponStrengthProfileId: 'nonweapon.profession-mechanic'
      },
      { shatter: true, shatterTraitEligible: true }
    );

    const baseConfusion = conditionFromProfile(context, shatter.balanceProfileId || skill.id, {
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
