import {
  maliceGained,
  maliceSpent,
  deadeyeCastCompleted
} from '#gw2/professions/thief/specializations/deadeye/mechanics/boundaries.js';
import { claimActivation } from '#gw2/platform/combat/procs/activation-claims.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { maximumDeadeyeMalice } from '#gw2/professions/thief/specializations/deadeye/traits/behavior.js';

import { refundMaliciousTacticalStrike } from '#gw2/professions/thief/specializations/deadeye/skills/index.js';
import { deadeyeCastFacts } from '#gw2/professions/thief/specializations/deadeye/state.js';
import { STOLEN_SKILLS, stolenSkillGrant } from '#gw2/professions/thief/specializations/deadeye/traits/behavior.js';

import { criticalOpportunity } from '#gw2/platform/combat/procs/critical.js';

import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';

import type { Gw2HitResolutionContext } from '#gw2/platform/resolver/hit-resolution.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';
import { deferThiefCompletion } from '#gw2/professions/thief/core/events.js';
import { storeThiefStolenSkillChoices } from '#gw2/professions/thief/core/mechanics/steal.js';
import { deadeyeCastAvailability } from '#gw2/professions/thief/specializations/deadeye/mechanics/availability.js';
import { DEADEYE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/thief/specializations/deadeye/profiles.js';
import { deadeyeState } from '#gw2/professions/thief/specializations/deadeye/state.js';
import type { ThiefConfig, ThiefRuntimeState, ThiefSkill } from '#gw2/professions/thief/types.js';

import {
  DEADEYE_MARK_EXPIRY,
  deadeyeSkillSideEffectHandlers,
  expireDeadeyesMark
} from '#gw2/professions/thief/specializations/deadeye/skills/behavior.js';

const DEADEYE_COMPLETE = 'thief.deadeye-complete';

// A malicious attack's damage bonus uses the malice it was cast with, even after its first hit spends it.
const maliceSnapshots = new WeakMap<object, Map<string, number>>();

function marked(runtime: ThiefRuntime, at = runtime.time): boolean {
  const state = deadeyeState.from(runtime);
  return Boolean(state.markedTargetId) && state.markExpiresAt > at;
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
  if (!claimActivation(state.deadeyeActivationClaims, 'thief.deadeye.malice', event.activationId)) return;
  if (skill.malicious) {
    refundMaliciousTacticalStrike(runtime, event);
    runtime.resourceController.replace('malice', 0);
    state.maleficentSevenTriggered = false;
    runtime.fireTrigger(maliceSpent, {});

    return;
  }

  const criticals = hit
    ? criticalOpportunity(hit.critEligible ? hit.critical.chance : 0, hit.critical.didCrit).sampledCriticals
    : 0;
  const resources = requireBalanceProfileFromContext(runtime, PROFILE.resources);
  runtime.resourceController.grant(
    'malice',
    balanceProfileNumber(resources, 'resourceGain') + criticals * balanceProfileNumber(resources, 'playerStacks')
  );
  runtime.fireTrigger(maliceGained, { cast: null });
}

/** Deadeye hooks: the mark and malice, malicious attacks, stolen skills, Mercy, Shadow Flare, and cantrip traits. */
export const deadeyeHooks: RuntimeHooks<ThiefRuntimeState, ThiefSkill> = {
  // Pre-steal grants the selected stolen-skill pool without marking a target, gaining malice, or firing steal traits.
  initialize(runtime) {
    if ((runtime.config as ThiefConfig).initialPreSteal !== 1) return;
    const grant = stolenSkillGrant(runtime);
    storeThiefStolenSkillChoices(runtime, grant.skillIds, grant.forcedSkillId);
  },
  // Malice has no passive recovery; only accepted mark and hit transactions earn its cycle rewards.
  resources: {
    malice: {
      kind: 'continuous',
      state: (runtime) => deadeyeState.from(runtime).malice,
      maximum: maximumDeadeyeMalice,
      initial: () => 0,
      recovery: () => 0
    }
  },
  /** Initialize only damage-relevant form and scaling state for one assumed occurrence. */
  prepareDamageState(runtime, _skill, inputs) {
    const state = deadeyeState.from(runtime);
    const malice = Number(inputs.malice ?? 0);
    if (!Number.isInteger(malice) || malice < 0 || malice > state.malice.maximum)
      throw new RangeError('Malice exceeds the selected build maximum.');
    runtime.resourceController.replace('malice', malice);
    state.markedTargetId = 'target';
    state.markExpiresAt = Infinity;
  },

  sideEffectHandlers: deadeyeSkillSideEffectHandlers,

  availability: (runtime, skill) =>
    deadeyeCastAvailability(runtime.profession.core.availableFlips, skill, runtime.time),
  onCastStart(runtime, cast) {
    const skill = cast.skill;
    if (!skill.malicious && !STOLEN_SKILLS.has(skill.id)) return;

    const malice = runtime.resourceController.value('malice');
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
      runtime.fireTrigger(deadeyeCastCompleted, { cast });
    },
    [DEADEYE_MARK_EXPIRY]: expireDeadeyesMark
  }
};
