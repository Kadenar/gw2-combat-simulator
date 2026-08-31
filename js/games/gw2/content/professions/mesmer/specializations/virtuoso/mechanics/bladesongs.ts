import { mesmerRuntimeFor } from '#gw2/content/professions/mesmer/core/mechanics/runtime.js';
import { applyCryOfPain } from '#gw2/content/professions/mesmer/core/traits/index.js';
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

/** Resolves Virtuoso Bladesong packets and reports their actual impact timing to shared shatter traits. */
export function resolveBladesong(
  context: MesmerCastContext,
  { skill, shatter, at, castStart, spent }: MesmerShatterResolverRequest
): readonly MesmerShatterTraitHit[] {
  const runtime = mesmerRuntimeFor(context);
  const packetTicks = () => {
    const ticks = shatter.ticks?.[spent];
    if (!ticks?.length) throw new TypeError(`${skill.name} requires explicit strike ticks for ${spent} blades.`);
    return ticks;
  };

  const addBladeDamage = (ticks: readonly { readonly atMs: number; readonly coefficient: number }[]) =>
    runtime.addDamage(
      skill,
      at,
      {
        ticks,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        source: 'Player',
        weaponStrengthProfileId: 'nonweapon.profession-mechanic'
      },
      { shatter: true, shatterTraitEligible: true, blade: true }
    );

  if (shatter.kind === 'blade-power') {
    const ticks = packetTicks();
    addBladeDamage(ticks);
    return ticks.map((tick) => ({ at: at + tick.atMs / 1000, count: 1 }));
  }

  if (shatter.kind === 'blade-confusion') {
    const baseConfusion = conditionFromProfile(context, shatter.balanceProfileId || skill.id, {
      name: 'Confusion',
      duration: 3,
      stacks: 1
    });
    const confusion = applyCryOfPain(runtime, baseConfusion);
    const duration = Number(confusion.duration || 0);
    const stacks = Number(confusion.stacks || 1);
    const ticks = packetTicks();

    addBladeDamage(ticks);
    runtime.addCondition(skill.name, at, {
      name: 'Confusion',
      duration,
      ticks: ticks.map((tick) => ({
        atMs: tick.atMs,
        condition: 'Confusion',
        duration,
        stacks
      })),
      timingAnchor: 'castStart',
      timingScale: 'fixed'
    });
    return ticks.map((tick) => ({ at: at + tick.atMs / 1000, count: 1 }));
  }

  if (shatter.kind === 'blade-control') {
    const damageAt = shatter.damageAtMs == null ? at : castStart + Number(shatter.damageAtMs) / 1000;
    runtime.addDamage(
      skill,
      damageAt,
      {
        coefficient: shatter.coefficients[spent],
        hits: 1,
        source: 'Player',
        weaponStrengthProfileId: 'nonweapon.profession-mechanic'
      },
      { shatter: true, shatterTraitEligible: true, blade: true }
    );
    return [{ at: damageAt, count: 1 }];
  }

  if (shatter.kind === 'blade-requiem') {
    const ticks = packetTicks();
    addBladeDamage(ticks);
    return ticks.map((tick) => ({ at: at + tick.atMs / 1000, count: 1 }));
  }

  if (shatter.kind === 'blade-defense') {
    return [{ at, count: 1 }];
  }

  throw new Error(`Unsupported Bladesong kind: ${shatter.kind}.`);
}
