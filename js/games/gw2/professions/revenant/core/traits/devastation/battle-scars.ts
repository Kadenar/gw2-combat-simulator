import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { addTimedStacks } from '#gw2/platform/combat/resources/timed-stacks.js';
import { buildResolverCondition } from '#gw2/platform/effects/packet-builders.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import type { RevenantRuntime } from '#gw2/professions/revenant/core/events.js';
import { REVENANT_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/revenant/core/profiles.js';
import { REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';
import type { RevenantSkill } from '#gw2/professions/revenant/types.js';
import { EPSILON } from '#kernel/core/clock.js';

/** Runs the trait at its original ordered mechanic boundary. */
export function completeBattleScarred(runtime: RevenantRuntime, cast: RuntimeCast<RevenantSkill>): void {
  const skill = cast.skill;
  if (skill.slot === 'Heal' && hasTrait(runtime, TRAIT.BATTLE_SCARRED)) {
    const profile = requireBalanceProfileFromContext(runtime, TRAIT.BATTLE_SCARRED);
    const buff = requireEffect(profile, 'buff', 'battle-scars');
    if (buff)
      grantBattleScars(runtime, {
        stacks: effectNumber(profile, buff, 'stacks'),
        sourceId: TRAIT.BATTLE_SCARRED,
        sourceName: 'Battle Scarred',
        duration: effectNumber(profile, buff, 'duration')
      });
  }
}

/** Runs the trait at its original ordered mechanic boundary. */
export function reactDanceOfDeath(runtime: RevenantRuntime, event: Gw2ResolverEvent): void {
  if (event.condition === 'Vulnerability' && hasTrait(runtime, TRAIT.DANCE_OF_DEATH))
    grantBattleScars(runtime, {
      stacks: event.stacks || 0,
      sourceId: TRAIT.DANCE_OF_DEATH,
      sourceName: 'Dance of Death',
      cause: event
    });
}

/** Expose Defenses applies its opening Vulnerability on the first landed in-combat strike. */
export function exposeDefenses(runtime: RevenantRuntime, event: Gw2ResolverEvent): void {
  const core = runtime.profession.core;
  if (core.exposeDefensesUsed || !runtime.combatStartedAt() || !hasTrait(runtime, TRAIT.EXPOSE_DEFENSES)) return;
  const profile = requireBalanceProfileFromContext(runtime, TRAIT.EXPOSE_DEFENSES);
  const condition = requireEffect(profile, 'condition', 'Vulnerability');
  // The one-use opener belongs to its packet, so a removed packet leaves it unspent.
  if (!condition) return;
  core.exposeDefensesUsed = true;
  const name = String(condition.condition);
  runtime.effects.emit({
    kind: 'packet',
    cause: event,
    event: buildResolverCondition({
      at: runtime.time,
      source: 'revenant',
      sourceId: TRAIT.EXPOSE_DEFENSES,
      actorType: 'player',
      skillId: TRAIT.EXPOSE_DEFENSES,
      skillName: 'Expose Defenses',
      name: `Expose Defenses — ${name}`,
      condition: name,
      stacks: effectNumber(profile, condition, 'stacks'),
      duration: effectNumber(profile, condition, 'duration')
    })
  });
}

/** Adds expiring Battle Scars up to the shared cap and publishes only the stacks actually granted. */
function grantBattleScars(
  runtime: RevenantRuntime,
  {
    stacks,
    sourceId,
    sourceName,
    duration: authored,
    cause = null
  }: {
    readonly stacks: number;
    readonly sourceId: SkillId;
    readonly sourceName: string;
    readonly duration?: number;
    readonly cause?: Gw2ResolverEvent | null;
  }
): void {
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.battleScars);
  let duration = authored;
  // Grants without their own duration inherit the core buff's; removing that buff leaves them nothing to grant.
  if (duration === undefined) {
    const buff = requireEffect(profile, 'buff', 'battle-scars');
    if (!buff) return;
    duration = effectNumber(profile, buff, 'duration');
  }

  duration = Math.max(0, duration);
  const core = runtime.profession.core;
  const { expiries, added } = addTimedStacks(
    core.battleScars,
    stacks,
    runtime.time,
    duration,
    balanceProfileNumber(profile, 'maximumStacks')
  );
  core.battleScars = expiries;
  if (!added) return;
  runtime.effects.emit({
    kind: 'packet',
    event: {
      type: 'buff',
      at: runtime.time,
      source: 'revenant',
      sourceId,
      actorType: 'player',
      skillId: sourceId,
      skillName: sourceName,
      name: `${sourceName} — Battle Scars`,
      kind: 'battle-scars',
      duration,
      stacks: added
    },
    cause
  });
}

// Catch Thrill of Combat up to this hit, retaining only grants that can still be active under the shared cap.
export function thrillOfCombat(runtime: RevenantRuntime, event: Gw2ResolverEvent): void {
  if (!hasTrait(runtime, TRAIT.THRILL_OF_COMBAT)) return;
  const core = runtime.profession.core;
  const battleScars = requireBalanceProfileFromContext(runtime, PROFILE.battleScars);
  const profile = requireBalanceProfileFromContext(runtime, TRAIT.THRILL_OF_COMBAT);
  const buff = requireEffect(profile, 'buff', 'battle-scars');
  // The cadence exists only to grant this buff, so a removed buff neither grants nor advances it.
  if (!buff) return;
  const interval = Math.max(EPSILON, balanceProfileNumber(profile, 'cooldown'));
  const duration = Math.max(0, effectNumber(profile, buff, 'duration'));
  const maximum = balanceProfileNumber(battleScars, 'maximumStacks');
  if (core.nextThrillOfCombatAt == null) core.nextThrillOfCombatAt = (core.combatBeganAt ?? runtime.time) + interval;
  const next = core.nextThrillOfCombatAt;
  if (!Number.isFinite(next) || next > runtime.time + EPSILON) return;
  const elapsed = Math.floor((runtime.time - next + EPSILON) / interval) + 1;
  let granted = 0;
  for (let index = Math.max(0, elapsed - Math.ceil(duration / interval)); index < elapsed; index += 1) {
    const result = addTimedStacks(core.battleScars, 1, next + index * interval, duration, maximum);
    core.battleScars = result.expiries;
    granted += result.added;
  }

  core.nextThrillOfCombatAt = next + elapsed * interval;
  if (!granted) return;
  runtime.effects.emit({
    kind: 'packet',
    event: {
      type: 'buff',
      at: runtime.time,
      source: 'revenant',
      actorType: 'player',
      sourceId: TRAIT.THRILL_OF_COMBAT,
      skillId: TRAIT.THRILL_OF_COMBAT,
      skillName: 'Thrill of Combat',
      name: 'Thrill of Combat — Battle Scars',
      kind: 'battle-scars',
      duration,
      stacks: granted
    },
    cause: event
  });
}
