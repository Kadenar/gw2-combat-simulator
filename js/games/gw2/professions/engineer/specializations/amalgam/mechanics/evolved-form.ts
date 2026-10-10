import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import { buildEngineerPackets } from '#gw2/professions/engineer/core/events.js';
import { AMALGAM_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/engineer/specializations/amalgam/profiles.js';
import {
  AMALGAM_MORPH_KIND_BY_SKILL_ID,
  type AmalgamMorphKind
} from '#gw2/professions/engineer/specializations/amalgam/selection-policy.js';
import { amalgamState } from '#gw2/professions/engineer/specializations/amalgam/state.js';
import { applyAmalgamStrain } from '#gw2/professions/engineer/specializations/amalgam/skills/evolved-state-skills.js';
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { defineTriggerPoint } from '#gw2/platform/profession-definition/trigger-points.js';
import { ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import type { EngineerRuntime, EngineerSkill } from '#gw2/professions/engineer/types.js';

/** A committed Morph; its protocol kind is captured from the accepted skill. */
export interface AmalgamMorph {
  readonly skill: EngineerSkill;
  readonly morphKind: AmalgamMorphKind | undefined;
  readonly at: number;
}

/** The committed Morph tail: Willing Host, then protection, then the protocol strain, then New Genes boons. */
export const amalgamMorphed = defineTriggerPoint<AmalgamMorph>('engineer.amalgam-morphed', [
  TRAIT.WILLING_HOST,
  TRAIT.HARDENED_CHROME,
  TRAIT.SILVER_LINING,
  TRAIT.NEW_GENES
]);

/** An accepted Evolve, fired after Evolve has granted its own strains. */
export interface AmalgamEvolution {
  readonly at: number;
}

/** Symbiotic Synergy silently resets Morph recharge before Hardened Chrome grants its longer protection. */
export const amalgamEvolved = defineTriggerPoint<AmalgamEvolution>('engineer.amalgam-evolved', [
  TRAIT.SYMBIOTIC_SYNERGY,
  TRAIT.HARDENED_CHROME
]);

/** Resolves the equipped protocol IDs to unique stable Morph kinds for strain application. */
function selectedMorphKinds(context: EngineerRuntime): Set<AmalgamMorphKind> {
  return new Set(
    amalgamState
      .from(context)
      .selectedMorphSkillIds.map((id) => AMALGAM_MORPH_KIND_BY_SKILL_ID.get(id))
      .filter((kind): kind is AmalgamMorphKind => Boolean(kind))
  );
}

/** Schedules six one-second Thorns Retaliation pulses when damaging-field uptime is explicitly assumed. */
export function scheduleThornsRetaliation(context: EngineerRuntime, skill: EngineerSkill, at: number): void {
  // Build assumptions reach combat through the canonical runtime field; absent uptime grants no retaliation.
  if (!context.config.professionAssumptions?.inDamagingField) return;
  const morphsProfile = requireBalanceProfileFromContext(context, PROFILE.morphs);
  const hits = balanceProfileNumber(morphsProfile, 'maximumStacks');
  const interval = balanceProfileNumber(morphsProfile, 'pulseInterval');
  for (let index = 0; index < hits; index += 1) {
    const morphsAmalgamMorphsStrike = requireEffect(morphsProfile, 'strike', 'Amalgam Morphs');
    if (morphsAmalgamMorphsStrike) {
      buildEngineerPackets('damage', {
        at: at + index * interval,
        source: 'engineer',
        sourceId: skill.id,
        actorType: 'player',
        skillId: skill.id,
        skillName: skill.name,
        name: 'Thorns Retaliation',
        coefficient: effectNumber(morphsProfile, morphsAmalgamMorphsStrike, 'coefficient'),
        hits: 1,
        hitIndex: index + 1,
        totalHits: hits,
        // Retaliation shares the initial Morph hit's strength; utility strength understates its half-coefficient damage.
        skillWeapon: 'Profession mechanic'
      }).forEach((packet) => context.effects.emit({ kind: 'packet', event: packet }));
    }
  }
}

/** Activates Plasmatic State with its first strike. */
export function activatePlasmaticState(context: EngineerRuntime): void {
  const at = context.time;
  const plasmaticStateProfile = requireBalanceProfileFromContext(context, PROFILE.plasmaticState);
  amalgamState.from(context).plasmaticStateUntil = Math.max(
    amalgamState.from(context).plasmaticStateUntil,
    at + balanceProfileNumber(plasmaticStateProfile, 'durationMultiplier')
  );
}

/** Activates Evolved, grants selected strains, and resolves Evolve trait interactions. */
export function evolveAmalgam(context: EngineerRuntime): void {
  const at = context.time;
  const state = amalgamState.from(context);
  const selected = selectedMorphKinds(context);
  const evolveProfile = requireBalanceProfileFromContext(context, PROFILE.evolve);
  state.evolvedUntil = at + balanceProfileNumber(evolveProfile, 'durationMultiplier');

  // Silver Lining moves strains to Morph; otherwise Evolve grants every selected protocol's strain itself.
  if (!hasTrait(context.traits, TRAIT.SILVER_LINING))
    for (const morphKind of selected) applyAmalgamStrain(context, morphKind, at);
  context.fireTrigger(amalgamEvolved, { at });
}
