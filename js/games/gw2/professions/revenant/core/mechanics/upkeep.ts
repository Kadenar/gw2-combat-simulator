import { gw2CooldownReadyAt } from '#gw2/platform/combat/action-tick.js';
import { resourceDepletionAt } from '#gw2/platform/combat/resources/clock.js';
import { denySkillCast, type AvailabilityResult } from '#gw2/platform/execution/availability.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { armSkillFlip, consumeSkillFlip, skillFlipReady } from '#gw2/platform/execution/skill-flips.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { Skill, SkillId } from '#gw2/platform/skills/types.js';
import type { RevenantRuntime } from '#gw2/professions/revenant/core/events.js';
import type { RevenantUpkeepState } from '#gw2/professions/revenant/core/state.js';
import { isRevenantUpkeep, isRevenantUpkeepRelease } from '#gw2/professions/revenant/data/upkeep-skills.js';
import { revenantEnergyCost } from '#gw2/professions/revenant/energy-cost.js';
import type { RevenantSkill } from '#gw2/professions/revenant/types.js';
import { timeKey } from '#kernel/core/clock.js';

export const REVENANT_ENERGY_DEPLETED = 'revenant.energy-depleted';

// Deferred upkeep costs are immutable acceptance facts, spent only if the activation commits.
const upkeepCosts = new WeakMap<RuntimeCast<RevenantSkill>, number>();

/** Capture the accepted cost before the active upkeep changes live cost queries. */
export function reserveRevenantUpkeep(runtime: RevenantRuntime, cast: RuntimeCast<RevenantSkill>): void {
  upkeepCosts.set(cast, revenantEnergyCost(runtime, cast.skill));
}

/** Cancellation discards the accepted cost without spending Energy. */
export function cancelRevenantUpkeep(_runtime: RevenantRuntime, cast: RuntimeCast<RevenantSkill>): void {
  upkeepCosts.delete(cast);
}

/** Each activation owns its recurring work; a later activation of the same skill has a new generation. */
export function revenantUpkeepOwner(skillId: SkillId, startsAt: number) {
  return { id: `revenant.upkeep:${skillId}`, generation: timeKey(startsAt) };
}

/** Returns the currently active upkeep for this skill, optionally matching one activation's start. */
export function activeRevenantUpkeep(
  runtime: MechanicQueriesOf<RevenantRuntime>,
  skillId: SkillId,
  startsAt?: number
): RevenantUpkeepState | undefined {
  return runtime.profession.core.activeUpkeeps.find(
    (upkeep) => upkeep.skillId === skillId && (startsAt == null || upkeep.startsAt === startsAt)
  );
}

/** Removes one upkeep and its Core pulse owner; elite cadences validate the same activation lazily. */
export function removeRevenantUpkeep(runtime: RevenantRuntime, skillId: SkillId): RevenantUpkeepState | undefined {
  const core = runtime.profession.core;
  const active = activeRevenantUpkeep(runtime, skillId);

  if (!active) return undefined;

  core.activeUpkeeps = core.activeUpkeeps.filter((upkeep) => upkeep !== active);
  runtime.cancelOwner(revenantUpkeepOwner(skillId, active.startsAt));
  return active;
}

/** Legend follow-ups belong to the invoked legend; weapon follow-ups keep their own lifetimes. */
export function clearRevenantLegendFlips(runtime: RevenantRuntime): void {
  const core = runtime.profession.core;
  core.availableFlips = Object.fromEntries(
    Object.entries(core.availableFlips).filter(([id]) => runtime.helpers.skillsById.get(Number(id))?.type === 'Weapon')
  );
}

/** Aggregate drain includes only upkeeps whose activation has completed. */
export function revenantUpkeepDrain(runtime: RevenantRuntime): number {
  return runtime.profession.core.activeUpkeeps
    .filter((active) => active.startsAt <= runtime.time)
    .reduce((sum, active) => sum + (active.upkeepCost || 0), 0);
}

/** Starvation ends every upkeep, applies its starvation recharge, and drops legend follow-ups. */
export function starveRevenantUpkeeps(runtime: RevenantRuntime): void {
  const core = runtime.profession.core;

  if (gw2CooldownReadyAt(resourceDepletionAt(core.energy)) > runtime.time) {
    runtime.resourceController.refresh('energy');
    return;
  }

  for (const active of [...core.activeUpkeeps]) {
    const skill = runtime.helpers.skillsById.get(active.skillId);
    const cooldown = Math.max(0, skill?.starvationCooldown || 0);

    if (skill && cooldown > 0) runtime.cooldownController.startRecharge({ ...skill, cooldown }, runtime.time);

    removeRevenantUpkeep(runtime, active.skillId);
  }

  clearRevenantLegendFlips(runtime);
  runtime.resourceController.refresh('energy');
}

/** Spend the reserved cost before activation changes live cost queries, then start drain and arm the release. */
export function activateRevenantUpkeep(runtime: RevenantRuntime, cast: RuntimeCast<RevenantSkill>): void {
  const cost = upkeepCosts.get(cast);
  upkeepCosts.delete(cast);

  if (cost != null) runtime.resourceController.spend('energy', cost);

  const skill = cast.skill;
  const core = runtime.profession.core;
  const active: RevenantUpkeepState = {
    skillId: skill.id,
    upkeepCost: skill.upkeepCost || 0,
    startsAt: runtime.time,
    empoweredNextPulse: false
  };
  core.activeUpkeeps.push(active);
  runtime.resourceController.refresh('energy');
  const release = skill.flipSkillId == null ? null : runtime.helpers.skillsById.get(Number(skill.flipSkillId));

  if (release) armSkillFlip(core.availableFlips, release.id, runtime.time);
}

/** Releasing removes the parent's drain and follow-up, then applies its manual-release recharge. */
export function releaseRevenantUpkeep(runtime: RevenantRuntime, cast: RuntimeCast<RevenantSkill>): void {
  const core = runtime.profession.core;
  const parent =
    cast.skill.flipParentId == null ? undefined : runtime.helpers.skillsById.get(Number(cast.skill.flipParentId));

  if (!parent) return;

  removeRevenantUpkeep(runtime, parent.id);
  runtime.resourceController.refresh('energy');
  consumeSkillFlip(core.availableFlips, cast.skill.id);
  const cooldown = Math.max(0, parent.manualReleaseCooldown || 0);

  // Recharge modifiers apply at release using the parent's release-specific base cooldown.
  if (cooldown > 0) runtime.cooldownController.startRecharge({ ...parent, cooldown }, runtime.time);
}

/** Releases are identified through the live catalog's upkeep parents. */
export function upkeepRelease(runtime: MechanicQueriesOf<RevenantRuntime>, skill: Skill): boolean {
  return isRevenantUpkeepRelease(skill, (id) => runtime.helpers.skillsById.get(id));
}

/** Upkeep releases require an armed flip, while already active parents cannot activate again. */
export function revenantUpkeepAvailability(
  runtime: MechanicQueriesOf<RevenantRuntime>,
  skill: Skill
): AvailabilityResult | null {
  const core = runtime.profession.core;
  const flips = core.availableFlips;
  const now = runtime.time;

  if (upkeepRelease(runtime, skill) && !skillFlipReady(flips[skill.id], now))
    return denySkillCast(skill, 'revenant.upkeep-inactive', 'activate the matching upkeep skill first.');

  if (isRevenantUpkeep(skill) && core.activeUpkeeps.some((upkeep) => upkeep.skillId === skill.id))
    return denySkillCast(skill, 'revenant.upkeep-active', 'use the matching release skill.');

  return null;
}
