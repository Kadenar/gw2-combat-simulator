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
import { applyAmalgamEvolveTraits } from '#gw2/professions/engineer/specializations/amalgam/traits/behavior.js';
import type { EngineerRuntime, EngineerSkill } from '#gw2/professions/engineer/types.js';

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

  applyAmalgamEvolveTraits(context, selected);
}
