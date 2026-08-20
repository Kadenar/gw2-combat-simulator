import { MESMER_TRAIT_IDS as TRAIT } from '../data/ids.js';
import { mesmerRuntimeFor } from './runtime.js';
import type {
  MesmerCastContext,
  MesmerConditionApplication,
  MesmerShatterResolverRequest,
  MesmerShatterTraitHit
} from '../types.js';

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

/** Resolves clone-based Core and Chronomancer shatter packets while reporting their shared-trait hit count. */
export function resolveCloneShatter(
  context: MesmerCastContext,
  { skill, shatter, at, spent }: MesmerShatterResolverRequest
): readonly MesmerShatterTraitHit[] {
  const runtime = mesmerRuntimeFor(context);
  const sources = spent + 1;
  const hits = sources * Number(shatter.hitsPerSource ?? 1);

  if (shatter.kind === 'power') {
    runtime.addDamage(
      skill,
      at,
      {
        coefficient: shatter.coefficients[spent],
        hits,
        source: 'Player',
        weaponStrengthProfileId: 'nonweapon.profession-mechanic'
      },
      { shatter: true }
    );
  } else if (shatter.kind === 'confusion') {
    runtime.addDamage(
      skill,
      at,
      {
        coefficient: shatter.coefficients[spent],
        hits,
        source: 'Player',
        weaponStrengthProfileId: 'nonweapon.profession-mechanic'
      },
      { shatter: true }
    );

    const baseConfusion = conditionFromProfile(context, shatter.balanceProfileId || skill.id, {
      name: 'Confusion',
      duration: 3,
      stacks: 1
    });
    const confusion = runtime.traits.has(TRAIT.CRY_OF_PAIN)
      ? conditionFromProfile(context, TRAIT.CRY_OF_PAIN, baseConfusion)
      : baseConfusion;
    runtime.addCondition(skill.name, at, {
      ...confusion,
      stacks: sources * Number(confusion.stacks || 1)
    });

    if (runtime.traits.has(TRAIT.BLINDING_DISSIPATION)) {
      runtime.addEvent({
        type: 'blind',
        at,
        skillName: skill.name,
        count: sources
      });
      runtime.addTraitProc('Blinding Dissipation', at, skill.name);
    }
  } else if (shatter.kind === 'defense') {
    // Zero-coefficient packets preserve defensive shatters as hits for on-hit effects.
    runtime.addDamage(
      skill,
      at,
      {
        coefficient: shatter.coefficients[spent],
        hits,
        source: 'Player',
        weaponStrengthProfileId: 'nonweapon.profession-mechanic'
      },
      { shatter: true }
    );
  } else if (shatter.kind !== 'control') {
    throw new Error(`Unsupported clone shatter kind: ${shatter.kind}.`);
  }

  return [{ at, count: sources }];
}
