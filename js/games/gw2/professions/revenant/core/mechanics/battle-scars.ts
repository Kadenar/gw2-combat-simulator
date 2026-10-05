import { consumeNewestStacks } from '#gw2/platform/combat/resources/timed-stacks.js';
import {
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import { buildResolverStrike } from '#gw2/platform/resolver/packets.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { RevenantRuntime } from '#gw2/professions/revenant/core/events.js';
import { REVENANT_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/revenant/core/profiles.js';

/** One active Battle Scar becomes a life siphon on a landed player strike. */
export function consumeBattleScar(runtime: RevenantRuntime, event: Gw2ResolverEvent): void {
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.battleScars);
  const strike = requireEffect(profile, 'strike', 'Battle Scars — Life Siphon');
  // Scars are spent only to deliver the siphon, so a removed strike leaves them in place.
  if (!strike) return;
  const core = runtime.profession.core;
  const { expiries, consumed } = consumeNewestStacks(core.battleScars, 1, runtime.time);
  core.battleScars = expiries;
  if (!consumed) return;
  emitBattleScar(runtime, event);
}

/** Resolve one scar without requiring a prior grant or consuming another attack. */
export function emitBattleScar(runtime: RevenantRuntime, event: Gw2ResolverEvent): void {
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.battleScars);
  const strike = requireEffect(profile, 'strike', 'Battle Scars — Life Siphon');
  if (!strike) return;
  runtime.effects.emit({
    kind: 'packet',
    cause: event,
    event: buildResolverStrike({
      at: runtime.time,
      source: 'revenant',
      sourceId: 'revenant.battle-scars',
      actorType: 'effect',
      skillId: 'revenant.battle-scars',
      skillName: 'Battle Scars',
      // Several grants feed the same scar pool, whose siphon is independent of the consuming attack.
      procType: 'profession',
      name: 'Battle Scars — Life Siphon',
      coefficient: 0,
      damageKind: strike.damageKind,
      flatStrikeBase: effectNumber(profile, strike, 'flatStrikeBase'),
      flatStrikePowerCoeff: effectNumber(profile, strike, 'flatStrikePowerCoeff'),
      canCrit: false,
      skillWeapon: 'Unequipped'
    })
  });
}
