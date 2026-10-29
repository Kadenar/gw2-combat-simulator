import { autonomousActionsAllowed } from '#gw2/platform/combat/engagement.js';
import { ACTOR } from '#gw2/platform/constants.js';
import { buildResolverStrike } from '#gw2/platform/effects/packet-builders.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { defineTriggerPoint } from '#gw2/platform/profession-definition/trigger-points.js';
import { balanceNumberFromContext } from '#gw2/platform/skills/balance-profiles.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import { registerNecromancerShroudLifecycle } from '#gw2/professions/necromancer/core/mechanics/shroud-lifecycle.js';
import { creatureSummoned } from '#gw2/professions/necromancer/core/mechanics/state-helpers.js';
import { NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import { spiritFields } from '#gw2/professions/necromancer/specializations/ritualist/mechanics/attribution.js';
import {
  spiritDefinition,
  type SpiritDefinition
} from '#gw2/professions/necromancer/specializations/ritualist/mechanics/spirits.js';
import { ritualistState } from '#gw2/professions/necromancer/specializations/ritualist/state.js';
import { lingeringSpiritsActive } from '#gw2/professions/necromancer/specializations/ritualist/traits/behavior.js';
import type {
  NecromancerRuntime,
  NecromancerRuntimeState,
  NecromancerSkill
} from '#gw2/professions/necromancer/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

const AUTO = 'ritualist.spirit-auto';
const owner = (key: string, generation: number) => ({ id: `spirit:${key}`, generation });
interface SpiritAuto {
  key: string;
  generation: number;
  skillId: SkillId;
  anchor: number;
  pulse: number;
  activationId: string;
}

/** Removing a spirit cancels its pending attacks and wakes; already created fields retain their own lifetime. */
function clearSpirits(runtime: NecromancerRuntime): void {
  const state = ritualistState.from(runtime);
  for (const key of Object.keys(state.activeSpirits)) {
    runtime.cancelOwner(owner(key, state.activeSpirits[key].generation));
    runtime.cancelOwner(ritualistSpiritActionOwner(runtime, key));
  }

  state.activeSpirits = {};
  runtime.resourceController.refresh('lifeForce');
}

/** Attack cancellation is independent of both damage attribution and the recurring spirit clock. */
export function ritualistSpiritActionOwner(runtime: NecromancerRuntime, key: string) {
  const actor = ritualistState.from(runtime).activeSpirits[key];
  return { id: `spirit-action:${key}:${actor.generation}`, generation: actor.actionGeneration };
}

/** A replacement action cancels unfinished work without changing the creature or its next clock opportunity. */
export function beginRitualistSpiritAction(runtime: NecromancerRuntime, key: string, duration: number): void {
  const actor = ritualistState.from(runtime).activeSpirits[key];
  runtime.cancelOwner(ritualistSpiritActionOwner(runtime, key));
  actor.actionGeneration++;
  actor.busyUntil = canonicalTime(runtime.time + duration);
}

/** Each spirit joins the same clock, skipping busy opportunities without delaying future attack starts. */
function auto(runtime: NecromancerRuntime, data: unknown): void {
  const work = data as SpiritAuto;
  const state = ritualistState.from(runtime);

  if (
    !state.activeSpirits[work.key] ||
    state.activeSpirits[work.key]?.generation !== work.generation ||
    !autonomousActionsAllowed(runtime)
  )
    return;

  const spirit = spiritDefinition(runtime, work.skillId);

  if (!spirit || !(spirit.attackCoefficient > 0)) return;

  const skill = runtime.helpers.skillsById.get(work.skillId)!;

  if (!(state.activeSpirits[work.key].busyUntil > runtime.time)) {
    beginRitualistSpiritAction(runtime, work.key, spirit.autoattackImpactDelayMs / 1000);
    runtime.effects.emit({
      kind: 'packet',
      owner: ritualistSpiritActionOwner(runtime, work.key),
      event: buildResolverStrike({
        at: canonicalTime(runtime.time + spirit.autoattackImpactDelayMs / 1000),
        source: 'Spirit',
        sourceId: skill.id,
        skillId: skill.id,
        skillName: `${skill.name} Autoattack`,
        icon: skill.icon,
        actorType: ACTOR.SUMMON,
        coefficient: spirit.attackCoefficient,
        skillWeapon: 'Unequipped',
        weaponStrength: spirit.attackWeaponStrength,
        canCrit: true,
        summonInheritsCriticalAttributes: true,
        ...spiritFields(work.key, 'autoattack'),
        activationId: `${work.activationId}:auto:${work.pulse}`
      })
    });
  }

  const interval = balanceNumberFromContext(runtime, TRAIT.SPAWNING_POWER, 'pulseInterval');
  const at = canonicalTime(work.anchor + (work.pulse + 1) * interval);

  if (at > runtime.time)
    runtime.schedule(AUTO, at, { ...work, pulse: work.pulse + 1 }, owner(work.key, work.generation));
}

/** Replacing one creature preserves the shared cadence and refunds Soul Twisting only after its summon has committed. */
export function summonRitualistSpirit(
  runtime: NecromancerRuntime,
  cast: RuntimeCast<NecromancerSkill>,
  spirit: SpiritDefinition
): void {
  const state = ritualistState.from(runtime);
  const key = spirit.key;
  const previous = state.activeSpirits[key];

  if (previous) {
    runtime.cancelOwner(owner(key, previous.generation));
    runtime.cancelOwner(ritualistSpiritActionOwner(runtime, key));
  }

  state.activeSpirits[key] = {
    skillId: cast.skill.id,
    activationId: cast.id,
    generation: ++state.spiritGeneration,
    started: false,
    actionGeneration: 0,
    // The opening's recovery depends on whether this cast replaces a live spirit; its shared clock is unchanged.
    busyUntil: canonicalTime(runtime.time + (previous ? spirit.resummonBusyMs : spirit.initialBusyMs) / 1000)
  };
  runtime.resourceController.refresh('lifeForce');
  runtime.fireTrigger(ritualistSpiritCommitted, { cast });

  runtime.fireTrigger(creatureSummoned, { skill: cast.skill, at: runtime.time, count: 1, activationId: cast.id });
  runtime.fireTrigger(ritualistSpiritSummoned, { cast, key });

  startRitualistSpirits(runtime);
}

/** Newly engaged or replaced spirits join the existing clock after the current boundary. */
export function startRitualistSpirits(runtime: NecromancerRuntime): void {
  if (!autonomousActionsAllowed(runtime)) return;

  const state = ritualistState.from(runtime);
  for (const [key, actor] of Object.entries(state.activeSpirits)) {
    if (actor.started) continue;

    const spirit = spiritDefinition(runtime, actor.skillId);

    if (!spirit) continue;

    const interval = balanceNumberFromContext(runtime, TRAIT.SPAWNING_POWER, 'pulseInterval');

    if (!(interval > 0) || !(spirit.attackCoefficient > 0)) continue;

    actor.started = true;

    const pulse = Math.max(0, Math.floor(canonicalTime(runtime.time - state.spiritAutoAnchorAt) / interval) + 1);
    runtime.schedule(
      AUTO,
      canonicalTime(state.spiritAutoAnchorAt + pulse * interval),
      {
        key,
        generation: state.activeSpirits[key].generation,
        skillId: actor.skillId,
        anchor: state.spiritAutoAnchorAt,
        pulse,
        activationId: actor.activationId
      },
      owner(key, state.activeSpirits[key].generation)
    );
  }
}

/** Shroud entry restarts the shared clock while preserving attacks already underway; ordinary summons retain its phase. */
export function initializeRitualistSpiritLifecycle(runtime: NecromancerRuntime): void {
  registerNecromancerShroudLifecycle(runtime, 'ritualist.shroud', {
    onEnter(skill) {
      if (skill.shroudEntry !== 'ritualist') return;

      const state = ritualistState.from(runtime);

      state.spiritAutoAnchorAt = runtime.time;
      for (const [key, actor] of Object.entries(state.activeSpirits)) {
        runtime.cancelOwner(owner(key, actor.generation));
        actor.started = false;
      }

      runtime.fireTrigger(ritualistShroudEntered);
      startRitualistSpirits(runtime);
    },
    onExit: () => {
      if (!lingeringSpiritsActive(runtime)) clearSpirits(runtime);
    },
    onDepletion: () => clearSpirits(runtime)
  });
}

/** Creature-owned wakes survive action interruptions but end when that creature is removed. */
export const ritualistSpiritTasks: NonNullable<RuntimeHooks<NecromancerRuntimeState, NecromancerSkill>['tasks']> = {
  [AUTO]: auto
};

/** Preserve the accepted spirit-committed boundary and its original reward order. */
export const ritualistSpiritCommitted = defineTriggerPoint<{
  readonly cast: RuntimeCast<NecromancerSkill>;
}>('necromancer.spirit-committed', [TRAIT.SOUL_TWISTING]);

/** Preserve the accepted spirit-summoned boundary and its original reward order. */
export const ritualistSpiritSummoned = defineTriggerPoint<{
  readonly cast: RuntimeCast<NecromancerSkill>;
  readonly key: string;
}>('necromancer.spirit-summoned', [TRAIT.EMPOWERING_SPIRITS]);

/** Preserve the accepted ritualist-shroud-entered boundary and its original reward order. */
export const ritualistShroudEntered = defineTriggerPoint<Record<string, never>>(
  'necromancer.ritualist-shroud-entered',
  [TRAIT.SOUL_TWISTING]
);
