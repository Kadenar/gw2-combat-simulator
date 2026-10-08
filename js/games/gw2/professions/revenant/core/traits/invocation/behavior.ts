import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import type { SkillEffect } from '#gw2/platform/effects/types.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import type { RevenantRuntime } from '#gw2/professions/revenant/core/events.js';
import { REVENANT_CORE_CALL_BY_LEGEND } from '#gw2/professions/revenant/core/skills/legend-call-skills.js';
import {
  REVENANT_SKILL_IDS as ID,
  REVENANT_LEGEND_IDS as LEGEND,
  REVENANT_TRAIT_IDS as TRAIT
} from '#gw2/professions/revenant/data/ids.js';
import { REVENANT_ELITE_INVOCATIONS } from '#gw2/professions/revenant/family-state.js';
import type { RevenantSkill } from '#gw2/professions/revenant/types.js';

/** Samples pre-swap Energy before the legend reset is applied. */
export function chargedMistsEnergy(
  runtime: RevenantRuntime,
  cast: RuntimeCast<RevenantSkill>,
  previous: number
): number {
  const chargedMists = hasTrait(runtime, TRAIT.CHARGED_MISTS)
    ? requireBalanceProfileFromContext(runtime, TRAIT.CHARGED_MISTS)
    : undefined;
  const energy = Math.min(
    100,
    chargedMists && Math.floor(previous) <= balanceProfileNumber(chargedMists, 'threshold')
      ? balanceProfileNumber(chargedMists, 'resourceGain')
      : cast.skill.resourceGain || 0
  );
  return energy;
}

/** Runs the trait at its original ordered mechanic boundary. */
export function invokeInvokersRage(runtime: RevenantRuntime): void {
  if (hasTrait(runtime, TRAIT.INVOKERS_RAGE)) {
    const invocationProfile = requireBalanceProfileFromContext(runtime, TRAIT.INVOKERS_RAGE);
    runtime.effects.emit({
      kind: 'profile',
      profile: invocationProfile,
      effects: invocationProfile.effects,
      attribution: (effect) => ({
        activationId: `legend-invocation:${TRAIT.INVOKERS_RAGE}:${runtime.time}`,
        source: 'Trait',
        sourceId: TRAIT.INVOKERS_RAGE,
        actorType: effect.actorType || 'player',
        skillId: invocationProfile.id,
        skillName: invocationProfile.name
      }),
      skillWeaponFallback: 'Unequipped'
    });
  }
}

/** Runs the trait at its original ordered mechanic boundary. */
export function invokeSongOfTheMists(runtime: RevenantRuntime): void {
  const core = runtime.profession.core;
  const legendId =
    core.activeLegendId === LEGEND.ENTITY
      ? core.selectedLegendIds.find((id) => id !== LEGEND.ENTITY)
      : core.activeLegendId;
  const elite = legendId ? REVENANT_ELITE_INVOCATIONS[legendId] : undefined;

  if (legendId && hasTrait(runtime, TRAIT.SONG_OF_THE_MISTS)) {
    // Calls share catalog mechanics while retaining the invocation trait as their triggering source.
    const song = runtime.helpers.skillsById.get(elite?.song ?? REVENANT_CORE_CALL_BY_LEGEND[legendId]);
    if (song)
      runtime.effects.emit({
        kind: 'profile',
        profile: song,
        effects: song.effects ?? [],
        attribution: (effect) => ({
          activationId: `legend-invocation:${TRAIT.SONG_OF_THE_MISTS}:${runtime.time}`,
          source: 'revenant',
          sourceId: TRAIT.SONG_OF_THE_MISTS,
          actorType: effect.actorType || 'player',
          skillId: song.id,
          skillName: song.name
        }),
        skillWeaponFallback: 'Unequipped',
        cause: null
      });
  }
}

/** Core emits the invocation packets; Kalla additionally grants two Fervor stacks for Song of the Mists. */
export function grantRenegadeInvocationFervor(
  runtime: RevenantRuntime,
  grantFervor: (runtime: RevenantRuntime, source: { sourceId: SkillId; sourceName: string }) => void
): void {
  if (runtime.profession.core.activeLegendId !== LEGEND.RENEGADE || !runtime.combatStartedAt()) return;
  const song = runtime.helpers.skillsById.get(ID.CALL_OF_THE_RENEGADE);
  if (!hasTrait(runtime, TRAIT.SONG_OF_THE_MISTS) || !song) return;
  for (let index = 0; index < 2; index += 1)
    grantFervor(runtime, { sourceId: TRAIT.SONG_OF_THE_MISTS, sourceName: song.name });
}

/** Core emits the invocation packets; Alliance additionally restores the Song skill's authored endurance. */
export function grantAllianceInvocationEndurance(runtime: RevenantRuntime): void {
  if (runtime.profession.core.activeLegendId !== LEGEND.ALLIANCE || !runtime.combatStartedAt()) return;
  const song = runtime.helpers.skillsById.get(ID.CALL_OF_THE_ALLIANCE);
  if (!hasTrait(runtime, TRAIT.SONG_OF_THE_MISTS) || !song) return;
  runtime.endurance.grant(song.resourceGain || 0);
}

/** Runs the trait at its original ordered mechanic boundary. */
export function invokeSpiritBoon(runtime: RevenantRuntime): void {
  const core = runtime.profession.core;
  const legendId =
    core.activeLegendId === LEGEND.ENTITY
      ? core.selectedLegendIds.find((id) => id !== LEGEND.ENTITY)
      : core.activeLegendId;
  const elite = legendId ? REVENANT_ELITE_INVOCATIONS[legendId] : undefined;
  const matchesLegend = (effect: SkillEffect) => elite != null || effect.metadata?.legendId === legendId;
  if (legendId && hasTrait(runtime, TRAIT.SPIRIT_BOON)) {
    const invocationProfile = requireBalanceProfileFromContext(runtime, elite?.spiritBoon ?? TRAIT.SPIRIT_BOON);
    runtime.effects.emit({
      kind: 'profile',
      profile: invocationProfile,
      effects: invocationProfile.effects?.filter(matchesLegend),
      attribution: (effect) => ({
        activationId: `legend-invocation:${TRAIT.SPIRIT_BOON}:${runtime.time}`,
        source: 'Trait',
        sourceId: TRAIT.SPIRIT_BOON,
        actorType: effect.actorType || 'player',
        skillId: invocationProfile.id,
        skillName: invocationProfile.name
      }),
      skillWeaponFallback: 'Unequipped'
    });
  }
}
