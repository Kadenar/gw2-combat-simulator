import { canonicalTime, EPSILON, timeKey } from '#kernel/core/clock.js';
import { resourceDepletionAt } from '#gw2/platform/combat/resources/clock.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import {
  conditionEffectTicks,
  effectFirstAtMs,
  strikeEffectCoefficient
} from '#gw2/platform/engine/effects/authoring.js';
import { armSkillFlip, consumeSkillFlip } from '#gw2/platform/engine/skills/skill-flips.js';
import { requireEffect } from '#gw2/platform/engine/skills/balance-profiles.js';
import { buildResolverCondition, buildResolverStrike } from '#gw2/platform/resolver/packets.js';
import { gw2CooldownReadyAt } from '#gw2/platform/skills/timing.js';
import { REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';
import { liveRevenantEnergyCost } from '#gw2/professions/revenant/family-state.js';
import type { SkillId } from '#gw2/platform/engine/skills/types.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
import type { RevenantUpkeepState } from '#gw2/professions/revenant/core/state.js';
import type { RevenantSkill } from '#gw2/professions/revenant/types.js';
import type { RevenantRuntime } from '#gw2/professions/revenant/core/live-events.js';

export const REVENANT_UPKEEP_PULSE = 'revenant.upkeep-pulse';
export const REVENANT_ENERGY_DEPLETED = 'revenant.energy-depleted';
const VENGEFUL_HAMMERS_IDS = new Set<SkillId>([ID.VENGEFUL_HAMMERS, ID.VENGEFUL_HAMMERS_ID_56752]);
const STARVATION_OWNER = 'revenant.energy-depleted';

interface UpkeepPulse {
  readonly skillId: SkillId;
  readonly startsAt: number;
}

/** Each activation owns its recurring work; a later activation of the same skill has a new generation. */
export function revenantUpkeepOwner(skillId: SkillId, startsAt: number) {
  return { id: `revenant.upkeep:${skillId}`, generation: timeKey(startsAt) };
}

/** Returns the currently active upkeep for this skill, optionally matching one activation's start. */
export function activeRevenantUpkeep(
  runtime: RevenantRuntime,
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
  runtime.cancelOwner(revenantUpkeepOwner(skillId, Number(active.startsAt)));
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
    .filter((active) => Number(active.startsAt || 0) <= runtime.time)
    .reduce((sum, active) => sum + Number(active.upkeepCost || 0), 0);
}

/** Every rate or balance change replaces the prior starvation wake at the next action-tick zero crossing. */
export function refreshRevenantStarvation(runtime: RevenantRuntime): void {
  const core = runtime.profession.core;
  runtime.cancelOwner({ id: STARVATION_OWNER, generation: core.energyWakeGeneration });
  core.energyWakeGeneration++;
  const at = gw2CooldownReadyAt(resourceDepletionAt(core.energy));
  if (Number.isFinite(at))
    runtime.schedule(
      REVENANT_ENERGY_DEPLETED,
      at,
      null,
      { id: STARVATION_OWNER, generation: core.energyWakeGeneration },
      -300
    );
}

/** Starvation ends every upkeep, applies its starvation recharge, and drops legend follow-ups. */
export function starveRevenantUpkeeps(runtime: RevenantRuntime): void {
  const core = runtime.profession.core;
  if (gw2CooldownReadyAt(resourceDepletionAt(core.energy)) > runtime.time) {
    refreshRevenantStarvation(runtime);
    return;
  }

  for (const active of [...core.activeUpkeeps]) {
    const skill = runtime.helpers.skillsById.get(active.skillId);
    const cooldown = Math.max(0, Number(skill?.starvationCooldown || 0));
    if (skill && cooldown > 0) runtime.cooldownController.startRecharge({ ...skill, cooldown }, runtime.time);
    removeRevenantUpkeep(runtime, active.skillId);
  }

  clearRevenantLegendFlips(runtime);
  runtime.resourceController.refresh('energy');
}

// Emit one Embrace the Darkness pulse; an armed empowered pulse selects the stronger Torment packet once.
function embracePulse(runtime: RevenantRuntime, skill: RevenantSkill, at: number, empowered: boolean): void {
  const strike = skill.effects?.find((effect) => effect.type === 'strike');
  const torment = skill.effects?.find(
    (effect) =>
      effect.type === 'condition' &&
      String(effect.metadata?.trigger || '') === (empowered ? 'empowered-upkeep-pulse' : '')
  );
  if (strike?.type !== 'strike' || torment?.type !== 'condition')
    throw new Error('Embrace the Darkness is missing its pulse effects.');
  const tick = conditionEffectTicks(torment)[0];
  const common = {
    at,
    source: 'revenant',
    sourceId: skill.id,
    actorType: 'player' as const,
    skillId: skill.id,
    skillName: skill.name
  };
  runtime.emit(
    buildResolverStrike({
      ...common,
      name: skill.name,
      coefficient: strikeEffectCoefficient(strike),
      skillWeapon: 'Unequipped'
    })
  );
  runtime.emit(
    buildResolverCondition({
      ...common,
      // Label empowered applications in chart attribution while keeping the shared skill identity.
      name: empowered ? `${skill.name} — Empowered Torment` : `${skill.name} — Torment`,
      ...(torment.metadata ? { metadata: torment.metadata } : {}),
      condition: 'Torment',
      stacks: Number(tick?.stacks || 0),
      duration: Number(tick?.duration || 0)
    })
  );
}

/** Vengeful Hammers divides one pulse's coefficient across its simultaneous hammers. */
function hammerPulse(runtime: RevenantRuntime, skill: RevenantSkill, at: number): void {
  const strike = skill.effects?.find((effect) => effect.type === 'strike');
  if (strike?.type !== 'strike') throw new Error('Vengeful Hammers is missing its strike effect.');
  const hammers = Math.max(1, Math.trunc(Number(strike.hits ?? 1)));
  if (!(Number(strike.atMs) >= 0))
    throw new Error('Vengeful Hammers requires one explicit simultaneous-hit timestamp.');
  for (let index = 1; index <= hammers; index += 1)
    runtime.emit(
      buildResolverStrike({
        at: canonicalTime(at + Number(strike.atMs) / 1000),
        source: 'revenant',
        sourceId: skill.id,
        actorType: 'player',
        skillId: skill.id,
        skillName: skill.name,
        name: `Vengeful Hammers — Hammer ${index}`,
        coefficient: Number(strike.coefficient || 0) / hammers,
        hitIndex: index,
        totalHits: hammers,
        skillWeapon: 'Unequipped'
      })
    );
}

/** A committed Embrace activation lands its opening pulse at the authored offset, before drain begins. */
export function startRevenantUpkeepCast(runtime: RevenantRuntime, cast: RuntimeCast): void {
  const skill = cast.skill as RevenantSkill;
  if (skill.id !== ID.EMBRACE_THE_DARKNESS || activeRevenantUpkeep(runtime, skill.id)) return;
  const strike = skill.effects?.find((effect) => effect.type === 'strike');
  if (!strike) throw new Error('Embrace the Darkness is missing its strike effect.');
  embracePulse(runtime, skill, canonicalTime(cast.start + Number(effectFirstAtMs(strike) || 0) / 1000), false);
}

/** Activation starts the sustained drain at completion, arms the release, and owns its recurring pulses. */
export function toggleRevenantUpkeep(runtime: RevenantRuntime, cast: RuntimeCast): void {
  const skill = cast.skill as RevenantSkill;
  const core = runtime.profession.core;
  if (removeRevenantUpkeep(runtime, skill.id)) {
    runtime.resourceController.refresh('energy');
    return;
  }

  const active: RevenantUpkeepState = {
    skillId: skill.id,
    upkeepCost: Number(skill.upkeepCost || 0),
    startsAt: runtime.time,
    empoweredNextPulse: false
  };
  core.activeUpkeeps.push(active);
  runtime.resourceController.refresh('energy');
  const release = skill.flipSkillId == null ? null : runtime.helpers.skillsById.get(Number(skill.flipSkillId));
  if (release) armSkillFlip(core.availableFlips, release.id, runtime.time);
  // Core schedules only its packet producers; specialization cadences own their own deadlines.
  const first =
    skill.id === ID.EMBRACE_THE_DARKNESS
      ? Math.floor(runtime.time + EPSILON) + 1
      : VENGEFUL_HAMMERS_IDS.has(skill.id)
        ? runtime.time + Math.max(0, Number(skill.pulseInterval ?? 1))
        : null;
  if (first != null)
    runtime.schedule(
      REVENANT_UPKEEP_PULSE,
      canonicalTime(first),
      { skillId: skill.id, startsAt: runtime.time } satisfies UpkeepPulse,
      revenantUpkeepOwner(skill.id, runtime.time)
    );
}

/** Releasing removes the parent's drain and follow-up, then applies its manual-release recharge. */
export function releaseRevenantUpkeep(runtime: RevenantRuntime, cast: RuntimeCast): void {
  const core = runtime.profession.core;
  const parent =
    cast.skill.flipParentId == null ? undefined : runtime.helpers.skillsById.get(Number(cast.skill.flipParentId));
  if (!parent) return;
  removeRevenantUpkeep(runtime, parent.id);
  runtime.resourceController.refresh('energy');
  consumeSkillFlip(core.availableFlips, cast.skill.id);
  const cooldown = Math.max(0, Number(parent.manualReleaseCooldown || 0));
  // Recharge modifiers apply at release using the parent's release-specific base cooldown.
  if (cooldown > 0) runtime.cooldownController.startRecharge({ ...parent, cooldown }, runtime.time);
}

/** One pulse per activation; only the owning activation schedules its successor. */
export function revenantUpkeepPulse(runtime: RevenantRuntime, data: unknown): void {
  const { skillId, startsAt } = data as UpkeepPulse;
  const active = activeRevenantUpkeep(runtime, skillId, startsAt);
  const skill = runtime.helpers.skillsById.get(skillId) as RevenantSkill | undefined;
  if (!active || !skill) return;
  if (skill.id === ID.EMBRACE_THE_DARKNESS) {
    embracePulse(runtime, skill, runtime.time, active.empoweredNextPulse);
    active.empoweredNextPulse = false;
  } else if (VENGEFUL_HAMMERS_IDS.has(skill.id)) hammerPulse(runtime, skill, runtime.time);
  else return;
  runtime.schedule(
    REVENANT_UPKEEP_PULSE,
    canonicalTime(runtime.time + Math.max(0, Number(skill.pulseInterval ?? 1))),
    data,
    revenantUpkeepOwner(skillId, startsAt)
  );
}

/** A committed paid skill, including Embrace's own activation, arms Embrace's next pulse. */
export function empowerRevenantEmbrace(runtime: RevenantRuntime, cast: RuntimeCast): void {
  const skill = cast.skill as RevenantSkill;
  if (skill.id === ID.RESIST_THE_DARKNESS) return;
  // Activation already enabled Embrace, so its cost query now describes a free toggle.
  if (skill.id !== ID.EMBRACE_THE_DARKNESS && !(liveRevenantEnergyCost(runtime, skill) > 0)) return;
  const embrace = activeRevenantUpkeep(runtime, ID.EMBRACE_THE_DARKNESS);
  if (embrace) embrace.empoweredNextPulse = true;
}

function triggersImpossibleOdds(event: Gw2ResolverEvent): boolean {
  return (
    Number(event.coefficient || 0) > 0 &&
    event.skillId !== ID.IMPOSSIBLE_ODDS &&
    // Form attacks inherit player modifiers but must not recursively trigger on-hit attacks.
    event.skillId !== ID.LESSER_ENCHANTED_DAGGERS &&
    event.skillId !== ID.FORM_OF_THE_DERVISH_ATTACK &&
    event.skillId !== ID.FORM_OF_THE_DERVISH_ATTACK_ELITE &&
    // Only Assassin's final shockwave triggers a follow-up.
    (event.skillId !== ID.RELEASE_POTENTIAL_ASSASSIN || event.hitIndex === event.totalHits) &&
    // Player-owned strikes include equipment effects; display source labels do not gate the proc.
    (event.actorType === 'player' || (event.actorType === 'effect' && isGw2PlayerModifierOwnedEvent(event)))
  );
}

/** An accepted qualifying strike launches Impossible Odds' follow-up while the upkeep is active and ready. */
export function reactRevenantImpossibleOdds(runtime: RevenantRuntime, event: Gw2ResolverEvent): void {
  if (!triggersImpossibleOdds(event) || !activeRevenantUpkeep(runtime, ID.IMPOSSIBLE_ODDS)) return;
  const core = runtime.profession.core;
  // Integer clock keys allow the expiry instant without admitting hits just before it.
  if (timeKey(runtime.time) < timeKey(Number(core.traitProcReadyAt.impossibleOdds || 0))) return;
  const impossible = runtime.helpers.skillsById.get(ID.IMPOSSIBLE_ODDS);
  const strike = impossible && requireEffect(impossible, 'strike', 'Impossible Odds');
  // The trigger interval gates only this strike, so a removed strike leaves it ready.
  if (!impossible || !strike) return;
  core.traitProcReadyAt.impossibleOdds = canonicalTime(runtime.time + Number(impossible.triggerIntervalMs || 0) / 1000);
  runtime.emitDerived(
    event,
    buildResolverStrike({
      at: canonicalTime(runtime.time + Number(effectFirstAtMs(strike) || 0) / 1000),
      source: 'revenant',
      sourceId: impossible.id,
      actorType: 'effect',
      ownerActorType: 'player',
      skillId: impossible.id,
      skillName: 'Impossible Odds',
      name: 'Impossible Odds',
      triggeredBy: event.skillName || event.name || undefined,
      coefficient: strikeEffectCoefficient(strike),
      skillWeapon: 'Unequipped',
      canTriggerCriticalSigils: true
    })
  );
}
