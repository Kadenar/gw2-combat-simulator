import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { timedEffectState, type EffectState } from '#gw2/platform/combat/effect-state.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import { balanceNumber, requireSkill, skillNumber } from '#gw2/platform/skills/balance-profiles.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { antiquaryState } from '#gw2/professions/thief/specializations/antiquary/state.js';

/** Report the same damage windows and unspent artifact charges that combat uses. */
export function antiquaryEffectStates(runtime: MechanicQueriesOf<ThiefRuntime>): EffectState[] {
  const state = antiquaryState.from(runtime.profession);
  const effects: EffectState[] = [];

  if (hasTrait(runtime, TRAIT.COMBAT_HIGH)) {
    effects.push(
      timedEffectState(
        'combat-high',
        state.combatHighExpirations.map((expiresAt) => ({
          stacks: 1,
          expiresAt: Number.isFinite(expiresAt) ? expiresAt : null
        })),
        balanceNumber(runtime.helpers, TRAIT.COMBAT_HIGH, 'maximumStacks'),
        { name: 'Combat High' }
      )
    );
  }

  // The turret bonus applies only while both the player buff and the target mark are active.
  for (const [kind, name, deadline] of [
    ['exhilarating-ephemera', 'Exhilarating Ephemera', state.antiquaryDamageUntil],
    ['kryptis-turret', 'Kryptis Turret', Math.min(state.kryptisDamageUntil, state.antiquaryKryptisTargetUntil)]
  ] as const) {
    if (deadline > 0)
      effects.push(
        timedEffectState(kind, [{ stacks: 1, expiresAt: Number.isFinite(deadline) ? deadline : null }], 1, { name })
      );
  }

  // Mortar has a charge count per grant. Only Guitar and Shield cap the total across grants.
  for (const [kind, name, grants, cappedSkill] of [
    ['mistburn-mortar-charges', 'Mistburn Mortar charges', state.mistburn.grants, null],
    [
      'metal-legion-guitar-charges',
      'Metal Legion Guitar charges',
      state.antiquaryGuitarCharges,
      ID.METAL_LEGION_GUITAR
    ],
    ['chak-shield-charges', 'Chak Shield charges', state.chakInitiativeRefunds, ID.CHAK_SHIELD]
  ] as const) {
    if (!grants.length) continue;

    effects.push(
      timedEffectState(
        kind,
        grants.map(({ count, expiresAt }) => ({ stacks: count, expiresAt })),
        cappedSkill === null ? null : skillNumber(requireSkill(runtime.helpers, cappedSkill), 'maximumStacks'),
        { name }
      )
    );
  }

  return effects;
}
