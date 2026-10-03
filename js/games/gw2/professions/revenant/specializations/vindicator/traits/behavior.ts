import { professionStaticRulesApplied } from '#gw2/platform/builds/attribute-provenance.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { playerHealthFraction } from '#gw2/platform/combat/query/runtime-query.js';
import { resourceAtLeast } from '#gw2/platform/combat/resources/pool.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import type { Gw2Stats } from '#gw2/platform/combat/types.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/engine/skills/balance-profiles.js';
import type { SkillSideEffect } from '#gw2/platform/simulation/side-effects.js';
import { gw2EffectExpiresAt } from '#gw2/platform/skills/timing.js';
import type { RevenantRuntime } from '#gw2/professions/revenant/core/events.js';
import { revenantRuntimeCoreState } from '#gw2/professions/revenant/core/modifiers.js';
import { REVENANT_MAXIMUM_ENDURANCE } from '#gw2/professions/revenant/core/state.js';
import { REVENANT_SKILL_IDS as ID, REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';
import { vindicatorState } from '#gw2/professions/revenant/specializations/vindicator/state.js';
import type { RevenantEnergyCostInput, RevenantSkill } from '#gw2/professions/revenant/types.js';

/** Identifies Energy Meld's Angsiyah's Trust interaction so unrelated skills keep their normal costs. */
export function energyMeldIsFree(input: RevenantEnergyCostInput, skill: RevenantSkill): boolean {
  return (
    (skill.id === ID.ENERGY_MELD || skill.id === ID.ENERGY_MELD_ID_72058) &&
    hasTrait(input.traits, TRAIT.ANGSIYANS_TRUST)
  );
}

/** Applies the trait at the mechanic's existing execution boundary. */
export function grantAngsiyansTrustEnergy(runtime: RevenantRuntime): void {
  if (hasTrait(runtime, TRAIT.ANGSIYANS_TRUST) && runtime.combatStartedAt())
    runtime.resourceController.grant(
      'energy',
      Math.max(
        0,
        balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.ANGSIYANS_TRUST), 'resourceGain')
      )
    );
}

export function modifyVindicatorAttributes(context: Gw2ModifierContext, attributes: Gw2Stats): Gw2Stats {
  const modified = { ...attributes };
  if (
    hasTrait(context, TRAIT.EMPIRE_DIVIDED) &&
    // Skip if the caller already baked static profession rules into the supplied attributes.
    !professionStaticRulesApplied(context.config) &&
    playerHealthFraction(context) > 0.5
  ) {
    // Runtime-only attributes use the same patchable bonus as the build calculator.
    modified.power =
      (modified.power || 0) +
      balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.EMPIRE_DIVIDED), 'attributeBonus');
  }

  return modified;
}

/** Applies the trait at the mechanic's existing execution boundary. */
export function renewForerunnerOfDeath(runtime: RevenantRuntime, profile: RevenantSkill, activationId: string): void {
  const state = vindicatorState.from(runtime);
  if (profile.id === ID.DEATH_DROP && hasTrait(runtime, TRAIT.FORERUNNER_OF_DEATH)) {
    const forerunner = requireBalanceProfileFromContext(runtime, TRAIT.FORERUNNER_OF_DEATH);
    const window = requireEffect(forerunner, 'buff', 'forerunner-of-death');
    // The damage window is the buff, so a removed buff opens no window.
    if (window) {
      const duration = Math.max(0, effectNumber(forerunner, window, 'duration'));
      state.forerunnerOfDeathUntil = runtime.time + duration;
      runtime.effects.emit({
        kind: 'packet',
        event: {
          ...{
            type: 'buff',
            at: runtime.time,
            source: 'revenant',
            sourceId: TRAIT.FORERUNNER_OF_DEATH,
            actorType: 'player',
            skillId: TRAIT.FORERUNNER_OF_DEATH,
            skillName: 'Forerunner of Death',
            activationId,
            name: 'Forerunner of Death',
            kind: String(window.kind),
            duration,
            stacks: effectNumber(forerunner, window, 'stacks')
          },
          fixedDuration: true
        }
      });
    }
  }
}

/** Snapshots the pre-landing damage window before its renewal. */
export function forerunnerOfDeathActive(runtime: RevenantRuntime): boolean {
  return (vindicatorState.from(runtime).forerunnerOfDeathUntil || 0) > runtime.time;
}

export function enduranceNotFull(context: Gw2ModifierContext): boolean {
  const state = revenantRuntimeCoreState(context);
  const maximum = REVENANT_MAXIMUM_ENDURANCE;
  return !resourceAtLeast(state.endurance || 0, maximum);
}

/** Applies the trait at the mechanic's existing execution boundary. */
export function armReaversCurse(runtime: RevenantRuntime): void {
  const state = vindicatorState.from(runtime);
  if (hasTrait(runtime, TRAIT.REAVERS_CURSE)) {
    const curse = requireBalanceProfileFromContext(runtime, TRAIT.REAVERS_CURSE);
    const effect = requireEffect(curse, 'buff', 'reavers-curse');
    // The armed window is the buff, so a removed buff arms nothing.
    if (effect)
      state.reaversCurseUntil = gw2EffectExpiresAt(runtime.time, Math.max(0, effectNumber(curse, effect, 'duration')));
  }
}

/** Consumes a still-valid armed landing charge, including its exact expiry boundary. */
export function consumeReaversCurse(runtime: RevenantRuntime): boolean {
  const state = vindicatorState.from(runtime);
  const reaversCurse =
    hasTrait(runtime, TRAIT.REAVERS_CURSE) && state.reaversCurseUntil > 0 && state.reaversCurseUntil >= runtime.time;
  if (reaversCurse) state.reaversCurseUntil = 0;
  return reaversCurse;
}

/** Applies the consumed landing charge only when materializing a strike packet. */
export function reaversCurseMultiplier(runtime: RevenantRuntime, armed: boolean): number {
  return armed
    ? Math.max(
        0,
        balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.REAVERS_CURSE), 'damageMultiplier')
      )
    : 1;
}

/** Overrides the dodge landing only while this grandmaster is selected. */
export function saintsShieldDodge(runtime: RevenantRuntime) {
  return hasTrait(runtime, TRAIT.SAINT_OF_ZU_HELTZER) ? ID.SAINTS_SHIELD : undefined;
}

// Song replaces the live skill's endurance reward; the two declarations are mutually exclusive.
export const energyMeldRewards: readonly SkillSideEffect[] = [
  {
    on: 'castCommit',
    when: (runtime) => !hasTrait(runtime, TRAIT.SONG_OF_ARBOREUM),
    do: { type: 'resourceGrant', resource: 'endurance', amount: { skillField: 'resourceGain' } }
  },
  {
    on: 'castCommit',
    when: (runtime) => hasTrait(runtime, TRAIT.SONG_OF_ARBOREUM),
    do: {
      type: 'resourceGrant',
      resource: 'endurance',
      amount: { profile: TRAIT.SONG_OF_ARBOREUM, field: 'resourceGain' }
    }
  }
];

/** Overrides the dodge landing only while this grandmaster is selected. */
export function imperialImpactDodge(runtime: RevenantRuntime) {
  return hasTrait(runtime, TRAIT.VASSALS_OF_THE_EMPIRE) ? ID.IMPERIAL_IMPACT : undefined;
}
