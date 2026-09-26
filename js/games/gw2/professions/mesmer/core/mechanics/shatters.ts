import { mesmerConditionFromProfile, mesmerMechanicsFor } from '#gw2/professions/mesmer/core/mechanics/runtime.js';
import { emitMesmerEffects } from '#gw2/professions/mesmer/core/events.js';
import { applyCryOfPain, triggerBlindingDissipation } from '#gw2/professions/mesmer/core/traits/index.js';
import type { MesmerRuntime } from '#gw2/professions/mesmer/types.js';
import type {
  MesmerShatterResolverRequest,
  MesmerShatterTraitHit
} from '#gw2/professions/mesmer/core/mechanics/shatter-types.js';

/** Resolves clone-based shatter packets while keeping repeat strikes ineligible for first-strike traits. */
export function resolveCloneShatter(
  context: MesmerRuntime,
  { skill, shatter, at, spent, castStart }: MesmerShatterResolverRequest
): readonly MesmerShatterTraitHit[] {
  const runtime = mesmerMechanicsFor(context);
  const sources = spent + 1;
  const strike = shatter.strikes[spent];

  const addStrikePackets = (): void => {
    if (!strike) return;
    const ticks = strike.ticks ?? [{ atMs: strike.atMs ?? 0, coefficient: strike.coefficient }];

    // Each source contributes one hit to every packet, but shatter traits are
    // attached only to the first packet as required by repeat-strike shatters.
    for (const [strikeIndex, tick] of ticks.entries()) {
      runtime.addDamage(
        skill,
        at + tick.atMs / 1000,
        {
          ...strike,
          name: undefined,
          summonKind: undefined,
          ticks: undefined,
          coefficient: tick.coefficient,
          hits: sources,
          atMs: 0,
          source: 'Player',
          weaponStrengthProfileId: 'nonweapon.profession-mechanic'
        },
        { metadata: { shatterTraitEligible: strikeIndex === 0 } }
      );
    }
  };

  if (shatter.kind === 'power') {
    addStrikePackets();
  } else if (shatter.kind === 'confusion') {
    if (strike)
      runtime.addDamage(
        skill,
        at,
        {
          ...strike,
          name: undefined,
          summonKind: undefined,
          hits: sources,
          atMs: 0,
          source: 'Player',
          weaponStrengthProfileId: 'nonweapon.profession-mechanic'
        },
        { metadata: { shatterTraitEligible: true } }
      );

    const baseConfusion = mesmerConditionFromProfile(context, shatter.balanceProfileId || skill.id, 'Confusion');
    const confusion = applyCryOfPain(runtime, baseConfusion);
    if (confusion)
      runtime.addCondition(
        skill.name,
        at,
        {
          ...confusion,
          stacks: sources * Number(confusion.stacks ?? 1)
        },
        'Player',
        '',
        { metadata: { shatterTraitEligible: true } }
      );

    triggerBlindingDissipation(runtime, skill.name, at, sources);
  } else if (shatter.kind === 'defense') {
    // An authored zero still hits; a removed packet cannot trigger hit traits.
    if (strike)
      runtime.addDamage(
        skill,
        at,
        {
          ...strike,
          name: undefined,
          summonKind: undefined,
          hits: sources,
          atMs: 0,
          source: 'Player',
          weaponStrengthProfileId: 'nonweapon.profession-mechanic'
        },
        { metadata: { shatterTraitEligible: true } }
      );
  } else if (shatter.kind === 'control') {
    // The resolved spend supplies player plus clone applications; no cast-completion observation substitutes for them.
    emitMesmerEffects(
      context,
      {
        ...skill,
        effects: (skill.effects || []).map((effect) => ({ ...effect, applications: sources }))
      },
      castStart,
      at
    );
  } else {
    throw new Error(`Unsupported clone shatter kind: ${shatter.kind}.`);
  }

  return strike || shatter.kind === 'control' ? [{ at, count: sources }] : [];
}
