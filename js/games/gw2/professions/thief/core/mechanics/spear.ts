import { replaceThiefBuff } from '#gw2/professions/thief/core/mechanics/buffs.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import { buildResolverCondition } from '#gw2/platform/effects/packet-builders.js';

import { denySkillCast } from '#gw2/platform/execution/availability.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { THIEF_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/thief/core/profiles.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
import { spearChainStageForSkill } from '#gw2/professions/thief/data/spear-chain-stages.js';

import type { AvailabilityResult } from '#gw2/platform/execution/availability.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';
import type { ThiefSkill } from '#gw2/professions/thief/types.js';

const SPEAR_STEALTH_SKILLS = new Set<SkillId>([ID.ASHEN_ASSAULT]);

/** Spear stages advance on committed attacks; Distracting Throw after a finisher arms its damage window. */
export function updateSpearChain(runtime: ThiefRuntime, skill: ThiefSkill): void {
  const core = runtime.profession.core;
  const stage = spearChainStageForSkill(skill.id);
  if (stage != null) {
    core.spearChainStage = (stage + 1) % 3;
    core.spearLastWasFinisher = stage === 2;
    core.spearPreviousSkillId = skill.id;
    return;
  }

  if (skill.id === ID.DISTRACTING_THROW && (core.spearLastWasFinisher || (core.spearChainStage || 0) === 0)) {
    const followsFinisher = core.spearLastWasFinisher;
    core.spearChainStage = 1;
    core.spearLastWasFinisher = false;
    core.spearPreviousSkillId = skill.id;
    // The committed window follows the throw's own same-time packets, so it buffs subsequent damage only.
    if (followsFinisher) runtime.schedule('thief.distracting-throw-window', runtime.time, undefined, undefined, 20);
    return;
  }

  if (skill.spearStealthAttack || SPEAR_STEALTH_SKILLS.has(skill.id)) {
    core.spearChainStage = 0;
    core.spearLastWasFinisher = false;
    core.spearPreviousSkillId = skill.id;
  }
}

/** Open the finisher reward after the granting throw has resolved at the commitment instant. */
export function grantDistractingThrowWindow(runtime: ThiefRuntime): void {
  replaceThiefBuff(
    runtime,
    'distracting-throw',
    balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.distractingThrow), 'durationMultiplier'),
    ID.DISTRACTING_THROW,
    'Distracting Throw',
    'thief'
  );
}

/**
 * Unsuspecting Strike's Bleeding adds a fresh bonus application while the target is above ninety percent health. The
 * bonus keeps the original skill identity and cannot trigger itself.
 */
export function unsuspectingStrikeBonus(runtime: ThiefRuntime, application: Gw2ResolverEvent): void {
  runtime.effects.emit({
    kind: 'packet',
    cause: application,
    event: buildResolverCondition({
      at: runtime.time,
      source: application.source,
      sourceId: application.sourceId,
      actorType: application.actorType,
      ownerActorType: application.ownerActorType,
      skillId: application.skillId,
      skillName: application.skillName,
      activationId: application.activationId,
      triggeredBy: application.triggeredBy,
      fixedDuration: application.fixedDuration,
      name: 'Unsuspecting Strike - Bonus Bleeding',
      condition: 'Bleeding',
      duration: application.duration || 0,
      stacks: 3
    })
  });
}

/** Eligibility and commitment share the same spear chain stage policy. */
export function thiefSpearAvailability(
  runtime: MechanicQueriesOf<ThiefRuntime>,
  skill: ThiefSkill
): AvailabilityResult | null {
  const stage = spearChainStageForSkill(skill.id);
  return stage != null && (runtime.profession.core.spearChainStage || 0) !== stage
    ? denySkillCast(skill, 'thief.spear-chain', `requires spear chain stage ${stage + 1}.`)
    : null;
}
