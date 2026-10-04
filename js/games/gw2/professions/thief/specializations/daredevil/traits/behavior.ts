import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { buildResolverCondition } from '#gw2/platform/resolver/packets.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';
import { buildThiefBuff } from '#gw2/professions/thief/core/events.js';
import { grantThiefEndurance } from '#gw2/professions/thief/core/mechanics/resources.js';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { daredevilState } from '#gw2/professions/thief/specializations/daredevil/state.js';
import type { ThiefSkill } from '#gw2/professions/thief/types.js';

// Brawler's Tenacity grants endurance when an eligible physical skill is accepted.
export const PHYSICAL_ENDURANCE: NonNullable<NonNullable<Skill['sideEffects']>> = [
  {
    on: 'castStart',
    when: (runtime) => hasTrait(runtime, TRAIT.BRAWLERS_TENACITY),
    do: {
      type: 'resourceGrant',
      resource: 'endurance',
      amount: { profile: TRAIT.BRAWLERS_TENACITY, field: 'resourceGain' }
    }
  }
];

/** Applies Endurance Thief at its established mechanical boundary. */
export function grantEnduranceThief(runtime: ThiefRuntime, cast: RuntimeCast<ThiefSkill>): void {
  if (cast.skill.id === ID.STEAL && hasTrait(runtime, TRAIT.ENDURANCE_THIEF))
    grantThiefEndurance(
      runtime,
      balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.ENDURANCE_THIEF), 'resourceGain')
    );
}

/** Applies Staff Master at its established mechanical boundary. */
export function refundStaffMaster(runtime: ThiefRuntime, cast: RuntimeCast<ThiefSkill>): void {
  const skill = cast.skill;
  const cost = skill.initiativeCost || 0;
  if (cost > 0 && skill.weapon === 'Staff' && hasTrait(runtime, TRAIT.STAFF_MASTER))
    grantThiefEndurance(
      runtime,
      cost * balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.STAFF_MASTER), 'resourceGain')
    );
}

/** Arm the next landed strike after the dodge window opens. */
export function armWeakeningStrikes(runtime: ThiefRuntime, cast: RuntimeCast<ThiefSkill>): void {
  const state = daredevilState.from(runtime);
  const skill = cast.skill;

  if (!hasTrait(runtime, TRAIT.WEAKENING_STRIKES)) return;
  const weakening = requireBalanceProfileFromContext(runtime, TRAIT.WEAKENING_STRIKES);
  // A removed Weakness cannot arm a pending grant.
  if (!requireEffect(weakening, 'condition', 'Weakness')) return;
  const duration = balanceProfileNumber(weakening, 'durationMultiplier');
  state.weakeningStrikeReady = true;
  state.weakeningStrikeExpiresAt = runtime.time + duration;
  runtime.effects.emit({
    kind: 'packet',
    event: buildThiefBuff(skill, {
      at: runtime.time,
      source: 'Trait',
      sourceId: TRAIT.WEAKENING_STRIKES,
      activationId: cast.id,
      kind: 'weakening-strikes',
      duration
    })
  });
}

/** The armed grant is consumed by the next landed player strike, never by a cast or condition tick. */
export function weakeningStrike(runtime: ThiefRuntime, event: Gw2ResolverEvent): void {
  const state = daredevilState.from(runtime);
  if (
    !state.weakeningStrikeReady ||
    state.weakeningStrikeExpiresAt <= event.at ||
    event.actorType !== 'player' ||
    !(Number(event.coefficient) > 0) ||
    event.skillId === SHARED_SKILL_IDS.DODGE
  )
    return;
  state.weakeningStrikeReady = false;
  const profile = requireBalanceProfileFromContext(runtime, TRAIT.WEAKENING_STRIKES);
  const weakness = requireEffect(profile, 'condition', 'Weakness');
  // Explicit removal suppresses this packet without restoring baseline tuning.
  if (!weakness) return;
  runtime.effects.emit({
    kind: 'packet',
    settlement: 'reaction',
    event: buildResolverCondition({
      at: event.at,
      source: 'Trait',
      actorType: 'player',
      skillId: TRAIT.WEAKENING_STRIKES,
      skillName: 'Weakening Strikes',
      activationId: event.activationId,
      triggeredBy: event.skillName,
      condition: String(weakness.condition),
      duration: effectNumber(profile, weakness, 'duration'),
      stacks: effectNumber(profile, weakness, 'stacks'),
      sourceId: TRAIT.WEAKENING_STRIKES,
      name: 'Weakening Strikes — Weakness'
    })
  });
}
