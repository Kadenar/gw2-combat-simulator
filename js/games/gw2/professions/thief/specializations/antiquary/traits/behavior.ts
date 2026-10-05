import type { ThiefSkill } from '#gw2/professions/thief/types.js';
import { purgeExpiredStacks } from '#gw2/platform/combat/resources/timed-stacks.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { advanceCounter } from '#gw2/platform/combat/resources/counters.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';
import { buildThiefBuff } from '#gw2/professions/thief/core/events.js';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import type { ThiefArtifactSlot } from '#gw2/professions/thief/specializations/antiquary/state.js';
import { antiquaryState } from '#gw2/professions/thief/specializations/antiquary/state.js';

/** Combat High replaces its stacks with staggered expiries, losing one stack per interval. */
export function grantCombatHigh(runtime: ThiefRuntime): void {
  if (!hasTrait(runtime, TRAIT.COMBAT_HIGH)) return;
  const profile = requireBalanceProfileFromContext(runtime, TRAIT.COMBAT_HIGH);
  const maximum = Math.max(0, Math.trunc(balanceProfileNumber(profile, 'maximumStacks')));
  const interval = balanceProfileNumber(profile, 'pulseInterval');
  const expiresAt = runtime.time + balanceProfileNumber(profile, 'durationMultiplier');
  antiquaryState.from(runtime).combatHighExpirations =
    interval > 0
      ? purgeExpiredStacks(
          Array.from({ length: maximum }, (_, index) => expiresAt - index * interval),
          runtime.time
        )
      : [];
}

/** Applies enterprising aristocrat at the original artifact boundary. */
export function applyEnterprisingAristocrat(runtime: ThiefRuntime): void {
  if (hasTrait(runtime, TRAIT.ENTERPRISING_ARISTOCRAT)) {
    const initiativeGain = balanceProfileNumber(
      requireBalanceProfileFromContext(runtime, TRAIT.ENTERPRISING_ARISTOCRAT),
      'resourceGain'
    );
    if (initiativeGain > 0) runtime.resourceController.grant('initiative', initiativeGain);
  }
}

/** Applies exhilarating ephemera at the original artifact boundary. */
export function applyExhilaratingEphemera(runtime: ThiefRuntime): void {
  const state = antiquaryState.from(runtime);
  if (hasTrait(runtime, TRAIT.EXHILARATING_EPHEMERA)) {
    const profile = requireBalanceProfileFromContext(runtime, TRAIT.EXHILARATING_EPHEMERA);
    const remaining = Math.max(0, (state.antiquaryDamageUntil || 0) - runtime.time);
    state.antiquaryDamageUntil =
      runtime.time +
      Math.min(
        balanceProfileNumber(profile, 'maximumStacks'),
        remaining + balanceProfileNumber(profile, 'durationMultiplier')
      );
  }
}

/** Possessive Hoarder grants the artifact family's boon plus Alacrity. */
export function applyPossessiveHoarder(
  runtime: ThiefRuntime,
  cast: RuntimeCast<ThiefSkill>,
  slot: ThiefArtifactSlot | undefined
): void {
  if (!hasTrait(runtime, TRAIT.POSSESSIVE_HOARDER)) return;
  const profile = requireBalanceProfileFromContext(runtime, TRAIT.POSSESSIVE_HOARDER);
  const boons = [
    ...(slot?.kind === 'offensive' ? [requireEffect(profile, 'boon', 'might')] : []),
    ...(slot?.kind === 'defensive' ? [requireEffect(profile, 'boon', 'protection')] : []),
    requireEffect(profile, 'boon', 'alacrity')
  ];
  for (const effect of boons) {
    if (!effect) continue;
    const boon = String(effect.boon);
    runtime.effects.emit({
      kind: 'packet',
      event: buildThiefBuff(cast.skill, {
        at: runtime.time,
        sourceId: 'Possessive Hoarder',
        activationId: cast.id,
        name: 'Possessive Hoarder',
        kind: boon,
        boon,
        duration: effectNumber(profile, effect, 'duration'),
        stacks: effectNumber(profile, effect, 'stacks')
      })
    });
  }
}

/** Reads accumulated spending without consuming it; only an in-combat threshold check can request a pilfer. */
export function prodigiousPincherReady(runtime: ThiefRuntime): boolean {
  return (
    runtime.combatStartedAt() &&
    hasTrait(runtime, TRAIT.PRODIGIOUS_PINCHER) &&
    advanceCounter(
      antiquaryState.from(runtime).initiativeSpentSincePilfer,
      0,
      balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.PRODIGIOUS_PINCHER), 'threshold'),
      'retain'
    ).reached
  );
}

/** Only Swipe pilfers receive Prolific Plunderer's extra use. */
export function prolificPlundererUses(runtime: ThiefRuntime, source: string): number {
  return source === 'swipe' && hasTrait(runtime, TRAIT.PROLIFIC_PLUNDERER)
    ? balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.PROLIFIC_PLUNDERER), 'resourceGain')
    : 0;
}

/** Repeat Ransacker follows the artifact identity grant. */
export function applyRepeatRansacker(runtime: ThiefRuntime): void {
  const swipe = runtime.helpers.skillsById.get(ID.SKRITT_SWIPE);
  if (swipe && hasTrait(runtime, TRAIT.REPEAT_RANSACKER))
    runtime.cooldownController.reduceSkillRecharge(
      swipe,
      balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.REPEAT_RANSACKER), 'rechargeReduction'),
      runtime.time
    );
}

/** Scoundrel's Luck refreshes to its cap only when its internal cooldown is ready, so charges never bank. */
export function grantScoundrelsLuck(runtime: ThiefRuntime): void {
  const state = antiquaryState.from(runtime);
  if (
    !hasTrait(runtime, TRAIT.SCOUNDRELS_LUCK) ||
    !runtime.procs.claim(TRAIT.SCOUNDRELS_LUCK, 'thief.antiquary.scoundrelsLuck', runtime.time)
  )
    return;
  const profile = requireBalanceProfileFromContext(runtime, TRAIT.SCOUNDRELS_LUCK);
  state.scoundrelsLuck = balanceProfileNumber(profile, 'maximumStacks');
}

/** Spend an already-earned Luck charge without requiring current selection. */
export function consumeScoundrelsLuck(runtime: ThiefRuntime): boolean {
  const state = antiquaryState.from(runtime);
  if (!(state.scoundrelsLuck > 0)) return false;
  state.scoundrelsLuck -= 1;
  return true;
}
