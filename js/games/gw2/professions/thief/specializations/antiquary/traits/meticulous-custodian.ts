import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { buildResolverCondition } from '#gw2/platform/resolver/packets.js';
import type { RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';
import { emitThiefDamage } from '#gw2/professions/thief/core/events.js';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { ANTIQUARY_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/thief/specializations/antiquary/profiles.js';
import type { ThiefResolverContext, ThiefResolverEvent, ThiefSkill } from '#gw2/professions/thief/types.js';

// Meticulous Custodian boosts the base strike coefficient of each artifact to its "enhanced" value; factors below are enhanced/base
export const METICULOUS_ARTIFACT_STRIKE_IDS = new Set<number>([
  ID.METAL_LEGION_GUITAR,
  ID.MISTBURN_MORTAR,
  ID.CHAK_SHIELD,
  ID.SUMMON_KRYPTIS_TURRET,
  ID.HOLO_DANCER_DECOY
]);

// Return the Meticulous Custodian strike multiplier only for the artifact and
// active identity window that owns the queried packet.
export function meticulousArtifactStrikeFactor(
  context: Gw2ModifierContext,
  _target: unknown,
  parameters: Readonly<Record<string, number>>
): number {
  const event = context.event;
  if (event?.skillId === ID.METAL_LEGION_GUITAR) {
    return event.metadata?.packetKind === 'thief.metal-legion-guitar-final-smash'
      ? parameters.guitarFinalFactor
      : parameters.guitarFactor;
  }

  if (event?.skillId === ID.MISTBURN_MORTAR) return parameters.mortarFactor;
  if (event?.skillId === ID.CHAK_SHIELD) return parameters.chakFactor;
  if (event?.skillId === ID.SUMMON_KRYPTIS_TURRET) {
    return parameters.kryptisFactor;
  }

  if (event?.skillId === ID.HOLO_DANCER_DECOY) return parameters.holoFactor;
  return 1;
}

/** Identity lifetimes use the live Meticulous profile at commitment. */
export function artifactWindow(runtime: ThiefRuntime): {
  windows: ReturnType<typeof requireBalanceProfileFromContext>;
  duration: number;
} {
  const windows = requireBalanceProfileFromContext(runtime, PROFILE.artifactWindows);
  const duration = balanceProfileNumber(
    windows,
    hasTrait(runtime, TRAIT.METICULOUS_CUSTODIAN) ? 'maximumStacks' : 'durationMultiplier'
  );
  return { windows, duration };
}

/** Applies meticulous custodian at the original artifact boundary. */
export function applyMeticulousChakShield(runtime: ThiefRuntime, cast: RuntimeCast): void {
  const skill = cast.skill as ThiefSkill;
  if (skill.id === ID.CHAK_SHIELD && hasTrait(runtime, TRAIT.METICULOUS_CUSTODIAN)) {
    const profile = requireBalanceProfileFromContext(runtime, TRAIT.METICULOUS_CUSTODIAN);
    const strike = requireEffect(profile, 'strike', 'Meticulous Custodian');
    if (strike)
      emitThiefDamage(runtime, null, {
        at: runtime.time,
        sourceId: skill.id,
        skillId: skill.id,
        skillName: skill.name,
        activationId: cast.id,
        name: 'Chak Shield',
        coefficient: effectNumber(profile, strike, 'coefficient'),
        hits: effectNumber(profile, strike, 'hits')
      });
  }
}

/** Resolve the selected Surfer packet profile at every occurrence, as before migration. */
export function forgedSurferProfile(runtime: ThiefRuntime) {
  return requireBalanceProfileFromContext(
    runtime,
    hasTrait(runtime, TRAIT.METICULOUS_CUSTODIAN) ? PROFILE.forgedSurferMeticulous : PROFILE.forgedSurfer
  );
}

/** Kryptis has its separate enhanced identity lifetime. */
export function meticulousKryptisDuration(runtime: ThiefRuntime): number {
  const windows = requireBalanceProfileFromContext(runtime, PROFILE.artifactWindows);
  return balanceProfileNumber(windows, hasTrait(runtime, TRAIT.METICULOUS_CUSTODIAN) ? 'threshold' : 'minimumStacks');
}

// Add Meticulous Custodian's Burning only to the Sun Crystal strike packet,
// excluding its declarative condition-only packets.
export function applyMeticulousSunCrystal(context: ThiefResolverContext, event: ThiefResolverEvent): void {
  if (
    event.actorType !== 'player' ||
    event.skillId !== ID.ZEPHYRITE_SUN_CRYSTAL ||
    event.coefficient == null || // condition-only packets have no coefficient; burning fires on the strike hit
    !hasTrait(context.config, TRAIT.METICULOUS_CUSTODIAN)
  )
    return;
  const sunCrystalMeticulousProfile = requireBalanceProfileFromContext(context, PROFILE.sunCrystalMeticulous);
  const burning = requireEffect(sunCrystalMeticulousProfile, 'condition', 'Burning');
  // Explicit removal suppresses this packet without restoring baseline tuning.
  if (!burning) return;
  context.applyCondition(
    buildResolverCondition({
      at: event.at,
      source: 'thief',
      sourceId: ID.ZEPHYRITE_SUN_CRYSTAL,
      actorType: 'player',
      skillId: ID.ZEPHYRITE_SUN_CRYSTAL,
      skillName: 'Zephyrite Sun Crystal',
      name: 'Zephyrite Sun Crystal - Meticulous Burning',
      // Preserve trait provenance so the already-enhanced duration is not multiplied again.
      triggeredBy: event.skillName,
      condition: String(burning.condition),
      stacks: effectNumber(sunCrystalMeticulousProfile, burning, 'stacks'),
      duration: effectNumber(sunCrystalMeticulousProfile, burning, 'duration')
    })
  );
}
