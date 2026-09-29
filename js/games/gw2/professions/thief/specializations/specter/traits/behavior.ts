import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import type { Gw2ResolvedStats } from '#gw2/platform/combat/query/combat-query.js';
import { gw2AlliedPlayerAssumptions, gw2AlliedPlayerProcTimeline } from '#gw2/platform/combat/state/allied-players.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { gw2PrimaryWeapon } from '#gw2/platform/equipment/weapons/loadout.js';
import { buildResolverStrike } from '#gw2/platform/resolver/packets.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';
import { emitThiefBuff, emitThiefCondition } from '#gw2/professions/thief/core/events.js';
import { THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { specterState } from '#gw2/professions/thief/specializations/specter/state.js';

/** Siphon's additive force gain is resolved before Improvisation's multiplier. */
export function amplifiedSiphoningGain(runtime: ThiefRuntime): number {
  return hasTrait(runtime, TRAIT.AMPLIFIED_SIPHONING)
    ? balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.AMPLIFIED_SIPHONING), 'resourceGain')
    : 0;
}

export const DARK_SENTRY = 'thief.specter-dark-sentry';

export const ROT_WALLOW_VENOM_ICON =
  'https://render.guildwars2.com/file/0F0B6509C8D5023D949153929E02FD2195AF63FE/2503654.png';

/** Barrier on allies arms Dark Sentry's per-ally venom and its queued allied Torment. */
export function applyDarkSentry(runtime: ThiefRuntime, data: unknown): void {
  const party = gw2AlliedPlayerAssumptions(runtime.config);
  const profile = requireBalanceProfileFromContext(runtime, TRAIT.DARK_SENTRY);
  const venom = requireEffect(profile, 'buff', 'rot-wallow-venom');
  if (!venom) return;
  // Claim only validated, distinct allies after confirming that venom can be granted.
  const allies = [
    ...new Set(
      ((data as { allyIndices?: readonly number[] }).allyIndices ?? [])
        .map(Number)
        .filter((ally) => Number.isInteger(ally) && ally >= 1 && ally <= party.count)
    )
  ].filter((ally) => runtime.procs.claim(TRAIT.DARK_SENTRY, `thief.specter.darkSentry:${ally}`, runtime.time));
  if (!allies.length) return;
  const torment = requireEffect(profile, 'condition', 'Torment');
  const venomDuration = effectNumber(profile, venom, 'duration');
  emitThiefBuff(runtime, null, {
    at: runtime.time,
    source: 'Trait',
    sourceId: TRAIT.DARK_SENTRY,
    skillId: TRAIT.DARK_SENTRY,
    skillName: 'Dark Sentry',
    name: 'Rot Wallow Venom',
    icon: ROT_WALLOW_VENOM_ICON,
    kind: 'rot-wallow-venom',
    duration: venomDuration,
    stacks: effectNumber(profile, venom, 'stacks'),
    audience: { recipients: 'party', affectsSelf: false, maximumRecipients: allies.length },
    fixedDuration: true
  });
  if (!torment) return;
  // The next allied strike must fit the grant, including the shared allied expiry boundary.
  for (const proc of gw2AlliedPlayerProcTimeline(runtime.config, {
    start: runtime.time,
    duration: venomDuration,
    maximumPerAlly: 1
  }))
    if (allies.includes(proc.allyIndex))
      emitThiefCondition(runtime, null, {
        at: proc.at,
        source: 'Trait',
        skillId: TRAIT.DARK_SENTRY,
        skillName: 'Rot Wallow Venom',
        name: `Rot Wallow Venom - Ally ${proc.allyIndex} Torment`,
        icon: ROT_WALLOW_VENOM_ICON,
        condition: String(torment.condition),
        stacks: effectNumber(profile, torment, 'stacks'),
        duration: effectNumber(profile, torment, 'duration'),
        metadata: { triggeredByAlly: proc.allyIndex }
      });
}

/**
 * Each applied player Torment grants Shadow Force outside the shroud and one life siphon per stack, whether or not
 * the shroud is active.
 */
export function applyLarcenousTorment(runtime: ThiefRuntime, application: Gw2ResolverEvent): void {
  if (
    application.condition !== 'Torment' ||
    application.actorType !== 'player' ||
    !hasTrait(runtime, TRAIT.LARCENOUS_TORMENT)
  )
    return;
  const stacks = Math.max(0, Math.trunc(application.stacks || 0));
  const profile = requireBalanceProfileFromContext(runtime, TRAIT.LARCENOUS_TORMENT);
  const strike = requireEffect(profile, 'strike', 'Larcenous Torment');
  if (strike)
    for (let stack = 1; stack <= stacks; stack += 1)
      runtime.emitDerived(
        application,
        buildResolverStrike({
          at: runtime.time,
          source: 'Trait',
          sourceId: TRAIT.LARCENOUS_TORMENT,
          actorType: 'effect',
          ownerActorType: 'player',
          skillId: TRAIT.LARCENOUS_TORMENT,
          skillName: 'Larcenous Torment',
          name: 'Larcenous Torment - Life Siphon',
          flatStrikeBase: effectNumber(profile, strike, 'flatStrikeBase'),
          flatStrikePowerCoeff: effectNumber(profile, strike, 'flatStrikePowerCoeff'),
          canCrit: false,
          damageKind: 'life-steal',
          triggeredBy: application.skillName
        })
      );
  if (!specterState.from(runtime).shadowShroudActive && stacks > 0)
    runtime.resourceController.grant('shadowForce', stacks * balanceProfileNumber(profile, 'resourceGain'));
}

/** Reconcile this trait's live bonus at its original attribute phase. */
export function applySecondOpinionAttributes(
  context: Gw2ModifierContext,
  result: { -readonly [K in keyof Gw2ResolvedStats]: Gw2ResolvedStats[K] }
): void {
  const gearConditionDamage = context.config?.stats?.conditionDamage || 0;
  if (hasTrait(context, TRAIT.SECOND_OPINION)) {
    const secondOpinionProfile = requireBalanceProfileFromContext(context, TRAIT.SECOND_OPINION);
    result.healingPower =
      (result.healingPower || 0) +
      gearConditionDamage * balanceProfileNumber(secondOpinionProfile, 'attributeConversion');
    result.conditionDamage =
      (result.conditionDamage || 0) +
      balanceProfileNumber(secondOpinionProfile, 'attributeBonus') +
      (wieldingScepter(context) ? balanceProfileNumber(secondOpinionProfile, 'attributePerStack') : 0);
  }
}

// Second Opinion grants an extra +90 condition damage only while wielding Scepter in the active set.
export function wieldingScepter(context: Gw2ModifierContext): boolean {
  const activeSet = Number(context.runtime?.activeWeaponSet) === 2 ? 2 : 1;
  return gw2PrimaryWeapon(context.config, activeSet) === 'Scepter';
}

/** Reconcile this trait's live bonus at its original attribute phase. */
export function applyStrengthOfShadowsAttributes(
  context: Gw2ModifierContext,
  result: { -readonly [K in keyof Gw2ResolvedStats]: Gw2ResolvedStats[K] }
): void {
  const gearVitality = context.config?.stats?.vitality || 0;
  if (hasTrait(context, TRAIT.STRENGTH_OF_SHADOWS)) {
    const strengthOfShadowsProfile = requireBalanceProfileFromContext(context, TRAIT.STRENGTH_OF_SHADOWS);
    result.expertise =
      (result.expertise || 0) + gearVitality * balanceProfileNumber(strengthOfShadowsProfile, 'attributeConversion');
  }
}
