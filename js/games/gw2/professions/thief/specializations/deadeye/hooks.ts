import { maximumDeadeyeMalice } from '#gw2/professions/thief/specializations/deadeye/traits/behavior.js';

import { refundMaliciousTacticalStrike } from '#gw2/professions/thief/specializations/deadeye/skills/index.js';
import { deadeyeCastFacts } from '#gw2/professions/thief/specializations/deadeye/state.js';
import {
  applyMaleficentSeven,
  grantBeQuickOrBeKilled,
  grantFireForEffect,
  grantOneInTheChamber,
  grantSilentScope,
  initialMalice,
  restoreMaliciousIntent,
  STOLEN_SKILLS,
  stolenSkillGrant
} from '#gw2/professions/thief/specializations/deadeye/traits/behavior.js';

import { criticalOpportunity } from '#gw2/platform/combat/critical-procs.js';
import { canonicalTime } from '#kernel/core/clock.js';

import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import { boundedNumber } from '#kernel/core/numeric.js';

import type { SkillId } from '#gw2/platform/skills/types.js';
import type { Gw2HitResolutionContext } from '#gw2/platform/resolver/hit-resolution.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { RuntimeProfession } from '#gw2/platform/profession-definition/runtime-contract.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';
import { buildThiefCondition, deferThiefCompletion } from '#gw2/professions/thief/core/events.js';
import { grantThiefInitiative } from '#gw2/professions/thief/core/mechanics/resources.js';
import { completeThiefSteal } from '#gw2/professions/thief/core/mechanics/steal.js';
import { emitThiefStealTraits } from '#gw2/professions/thief/core/traits/steal.js';
import { deadeyeCastAvailability } from '#gw2/professions/thief/specializations/deadeye/mechanics/availability.js';
import { DEADEYE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/thief/specializations/deadeye/profiles.js';
import { deadeyeState } from '#gw2/professions/thief/specializations/deadeye/state.js';
import type { ThiefRuntimeState, ThiefSkill } from '#gw2/professions/thief/types.js';

const DEADEYE_COMPLETE = 'thief.deadeye-complete';
const DEADEYE_MARK_EXPIRY = 'thief.deadeye-mark-expire';

// A malicious attack's damage bonus uses the malice it was cast with, even after its first hit spends it.
const maliceSnapshots = new WeakMap<object, Map<string, number>>();

function marked(runtime: ThiefRuntime, at = runtime.time): boolean {
  const state = deadeyeState.from(runtime);
  return Boolean(state.markedTargetId) && state.markExpiresAt > at;
}

/**
 * Marking a target refreshes the mark; re-marking the same live target adds to its malice instead of resetting it.
 * The mark also grants Deadeye's stolen skills and schedules its own expiry.
 */
function completeDeadeyesMark(runtime: ThiefRuntime, cast: RuntimeCast<ThiefSkill>): void {
  const state = deadeyeState.from(runtime);
  emitThiefStealTraits(runtime, cast);
  const remarking = state.markedTargetId === 'primary-target' && state.markExpiresAt > runtime.time;
  state.markedTargetId = 'primary-target';
  state.markExpiresAt = canonicalTime(
    runtime.time +
      balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.resources), 'durationMultiplier')
  );
  state.markGeneration += 1;
  state.malice = remarking
    ? Math.min(state.maximumMalice, state.malice + initialMalice(runtime))
    : initialMalice(runtime);
  if (!remarking) state.maleficentSevenTriggered = false;
  applyMaleficentSeven(runtime, cast);
  const grant = stolenSkillGrant(runtime);
  completeThiefSteal(runtime, grant.skillIds, grant.forcedSkillId);
  grantBeQuickOrBeKilled(runtime, cast);

  runtime.schedule(DEADEYE_MARK_EXPIRY, state.markExpiresAt, { generation: state.markGeneration });
}

/** Mark expiry resets malice; a stale expiry from an earlier mark is ignored. */
function expireDeadeyesMark(runtime: ThiefRuntime, data: unknown): void {
  const state = deadeyeState.from(runtime);
  if ((data as { generation: number }).generation !== state.markGeneration || runtime.time < state.markExpiresAt)
    return;
  state.markedTargetId = null;
  state.markExpiresAt = 0;
  state.malice = 0;
  state.maleficentSevenTriggered = false;
}

/** Torment from a malicious finisher scales with the malice it was cast with. */
function maliceTorment(
  runtime: ThiefRuntime,
  cast: RuntimeCast<ThiefSkill>,
  profileId: SkillId,
  malice: number,
  trait: boolean
) {
  const profile = requireBalanceProfileFromContext(runtime, profileId);
  const torment = requireEffect(profile, 'condition', 'Torment');
  if (!torment) return;
  runtime.effects.emit({
    kind: 'packet',
    event: buildThiefCondition(cast.skill, {
      at: runtime.time,
      ...(trait ? { source: 'Trait', name: 'Malicious Ashen Assault — Torment' } : {}),
      activationId: cast.id,
      condition: String(torment.condition),
      duration:
        effectNumber(profile, torment, 'duration') + malice * balanceProfileNumber(profile, 'durationMultiplier'),
      stacks: effectNumber(profile, torment, 'stacks')
    })
  });
}

/** Cross-skill dodge and cantrip traits retain their post-packet completion order. */
function completeDeadeyeCast(runtime: ThiefRuntime, cast: RuntimeCast<ThiefSkill>): void {
  const skill = cast.skill;

  grantFireForEffect(runtime, cast);
  // Silent Scope: a dodge above the malice threshold grants one out-of-stealth stealth attack.
  grantSilentScope(runtime, cast);

  if (!(skill.categories || []).includes('Cantrip')) return;
  // One in the Chamber refreshes the stolen skill on every cantrip, replacing any stored choice.
  grantOneInTheChamber(runtime);
}

/**
 * The first landed strike of a marked activation resolves malice once: a malicious attack spends it (Tactical Strike
 * refunds endurance first), while an initiative attack gains malice plus a bonus for each critical hit.
 */
function reactDeadeyeMalice(runtime: ThiefRuntime, event: Gw2ResolverEvent, hit?: Gw2HitResolutionContext): void {
  if (event.actorType !== 'player' || !(Number(event.coefficient) > 0) || typeof event.activationId !== 'string')
    return;
  if (event.offTarget === true || !marked(runtime)) return;
  // A returned axe belongs to the recall activation; it must never consume malice as a new stealth attack.
  const skill = runtime.helpers.skillsById.get(
    Number(event.metadata?.recallSkillId ?? event.skillId ?? event.sourceId)
  );
  if (!skill) return;
  const initiativeAttack = skill.type === 'Weapon' && (skill.initiativeCost || 0) > 0 && !skill.stealthAttack;
  if (!skill.malicious && !initiativeAttack) return;
  const state = deadeyeState.from(runtime);
  if (state.maliceResolvedActivations[event.activationId]) return;
  state.maliceResolvedActivations[event.activationId] = true;
  if (skill.malicious) {
    refundMaliciousTacticalStrike(runtime, event);
    state.malice = 0;
    state.maleficentSevenTriggered = false;
    restoreMaliciousIntent(runtime);

    return;
  }

  const criticals = hit
    ? criticalOpportunity(hit.critEligible ? hit.critical.chance : 0, hit.critical.didCrit).sampledCriticals
    : 0;
  const resources = requireBalanceProfileFromContext(runtime, PROFILE.resources);
  state.malice = Math.min(
    state.maximumMalice,
    state.malice +
      balanceProfileNumber(resources, 'resourceGain') +
      criticals * balanceProfileNumber(resources, 'playerStacks')
  );
  applyMaleficentSeven(runtime, null);
}

/** Deadeye hooks: the mark and malice, malicious attacks, stolen skills, Mercy, Shadow Flare, and cantrip traits. */
export const deadeyeHooks: Partial<RuntimeProfession<ThiefRuntimeState, ThiefSkill>> = {
  /** Initialize only damage-relevant form and scaling state for one assumed occurrence. */
  prepareDamageState(runtime, _skill, inputs) {
    const state = deadeyeState.from(runtime);
    const malice = Number(inputs.malice ?? 0);
    if (!Number.isInteger(malice) || malice > state.maximumMalice)
      throw new RangeError('Malice exceeds the selected build maximum.');
    state.malice = malice;
    state.markedTargetId = 'target';
    state.markExpiresAt = Infinity;
  },

  sideEffectHandlers: {
    'thief.clear-revealed'(runtime) {
      runtime.profession.core.revealedUntil = Math.min(runtime.profession.core.revealedUntil, runtime.time);
    },
    'thief.deadeyes-mark'(runtime, context) {
      if (context.kind === 'cast') completeDeadeyesMark(runtime, context.cast);
    },
    'thief.mercy'(runtime) {
      // Consume live commitment-time malice before refunding the selected profile's amount.
      const state = deadeyeState.from(runtime);
      const malice = Math.max(0, state.malice || 0);
      state.malice = 0;
      state.maleficentSevenTriggered = false;
      const mercy = requireBalanceProfileFromContext(runtime, PROFILE.mercy);
      grantThiefInitiative(
        runtime,
        balanceProfileNumber(mercy, 'resourceGain') + malice * balanceProfileNumber(mercy, 'attributePerStack')
      );
    },
    'thief.sneak-torment'(runtime, context) {
      if (context.kind === 'cast')
        maliceTorment(
          runtime,
          context.cast,
          PROFILE.maliciousSneakAttack,
          deadeyeCastFacts.get(context.cast)?.malice ?? 0,
          false
        );
    },
    'thief.ashen-torment'(runtime, context) {
      if (context.kind === 'cast')
        maliceTorment(
          runtime,
          context.cast,
          PROFILE.maliciousAshenAssault,
          deadeyeCastFacts.get(context.cast)?.malice ?? 0,
          true
        );
    }
  },

  initialize(runtime) {
    const state = deadeyeState.from(runtime);
    // The selected trait owns its replacement cap; otherwise use Deadeye's base resource cap.
    state.maximumMalice = maximumDeadeyeMalice(runtime);
    state.malice = Math.min(state.malice, state.maximumMalice);
  },
  availability: (runtime, skill) =>
    deadeyeCastAvailability(runtime.profession.core.availableFlips, skill, runtime.time),
  onCastStart(runtime, cast) {
    const skill = cast.skill;
    const state = deadeyeState.from(runtime);
    if (!skill.malicious && !STOLEN_SKILLS.has(skill.id)) return;
    const malice = boundedNumber(state.malice, 0, 0, state.maximumMalice);
    deadeyeCastFacts.set(cast, {
      malice,
      // Poison, quickness, and duration scaling apply only against a live mark and a hit target.
      markedMalice: cast.command.offTarget !== true && marked(runtime) ? malice : 0
    });
    if (skill.malicious) {
      let snapshots = maliceSnapshots.get(runtime);
      if (!snapshots) maliceSnapshots.set(runtime, (snapshots = new Map()));
      snapshots.set(cast.id, malice);
    }
  },
  onCastCommit(runtime, cast) {
    // Completion carries the accepted malice and stealth facts across the detached cast-task boundary.
    deferThiefCompletion(runtime, DEADEYE_COMPLETE, cast);
    deadeyeCastFacts.delete(cast);
  },
  reactions: {
    'damage.resolving'(runtime, event) {
      const snapshot = maliceSnapshots.get(runtime)?.get(String(event.activationId));
      return snapshot == null ? undefined : { deadeyeMaliceSnapshot: snapshot };
    },
    'damage.resolved'(runtime, event, details) {
      reactDeadeyeMalice(runtime, event, (details as { hitContext?: Gw2HitResolutionContext }).hitContext);
    }
  },
  tasks: {
    [DEADEYE_COMPLETE](runtime, data) {
      const { cast } = data as { cast: RuntimeCast<ThiefSkill> };
      completeDeadeyeCast(runtime, cast);
    },
    [DEADEYE_MARK_EXPIRY]: expireDeadeyesMark
  }
};
