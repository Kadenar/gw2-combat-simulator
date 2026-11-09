/** Own spirit actions, recurring work, and the transition from a pending opening to an independent field. */
import { autonomousActionsAllowed } from '#gw2/platform/combat/engagement.js';
import { ACTOR } from '#gw2/platform/constants.js';
import { buildResolverStrike } from '#gw2/platform/effects/packet-builders.js';
import type { SimulationEventBase } from '#gw2/platform/events/events.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { defineTriggerPoint } from '#gw2/platform/profession-definition/trigger-points.js';
import { balanceNumber } from '#gw2/platform/skills/balance-profiles.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import { registerNecromancerShroudLifecycle } from '#gw2/professions/necromancer/core/mechanics/shroud-lifecycle.js';
import { creatureSummoned } from '#gw2/professions/necromancer/core/mechanics/state-helpers.js';
import { NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import { spiritFields } from '#gw2/professions/necromancer/specializations/ritualist/mechanics/attribution.js';
import { RITUALIST_SPIRIT_SKILL_IDS } from '#gw2/professions/necromancer/specializations/ritualist/mechanics/spirit-projection.js';
import {
  spiritDefinition,
  type SpiritDefinition
} from '#gw2/professions/necromancer/specializations/ritualist/mechanics/spirits.js';
import {
  emitRitualistSpiritField,
  ritualistSpiritCommandPackets,
  ritualistSpiritField,
  ritualistSpiritStrikePackets,
  type RitualistSpiritField
} from '#gw2/professions/necromancer/specializations/ritualist/skills/spirit-packets.js';
import { ritualistState } from '#gw2/professions/necromancer/specializations/ritualist/state.js';
import { lingeringSpiritsActive } from '#gw2/professions/necromancer/specializations/ritualist/traits/behavior.js';
import type {
  NecromancerRuntime,
  NecromancerRuntimeState,
  NecromancerSkill
} from '#gw2/professions/necromancer/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

const FIELD = 'ritualist.wanderlust-field';
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
  const state = ritualistState.from(runtime.profession);
  for (const key of Object.keys(state.activeSpirits)) {
    runtime.cancelOwner(owner(key, state.activeSpirits[key].generation));
    runtime.cancelOwner(actionOwner(runtime, key));
  }

  state.activeSpirits = {};
  runtime.resourceController.refresh('lifeForce');
}

/** Attack cancellation is independent of both damage attribution and the recurring spirit clock. */
function actionOwner(runtime: NecromancerRuntime, key: string) {
  const actor = ritualistState.from(runtime.profession).activeSpirits[key];
  return { id: `spirit-action:${key}:${actor.generation}`, generation: actor.actionGeneration };
}

/** A replacement action cancels unfinished work without changing the creature or its next clock opportunity. */
function beginAction(runtime: NecromancerRuntime, key: string, duration: number): void {
  const actor = ritualistState.from(runtime.profession).activeSpirits[key];
  runtime.cancelOwner(actionOwner(runtime, key));
  actor.actionGeneration++;
  actor.busyUntil = canonicalTime(runtime.time + duration);
}

/** Every pending packet captures the accepted action's owner, independently of damage attribution. */
function emitActionPackets(runtime: NecromancerRuntime, key: string, events: readonly SimulationEventBase[]): void {
  const owner = actionOwner(runtime, key);
  for (const event of events) runtime.effects.emit({ kind: 'packet', event, owner });
}

/** Protect unfinished openings; accepted commands replace one action without moving the creature's recurring clock. */
export function commandRitualistSpirits(runtime: NecromancerRuntime, cast: RuntimeCast<NecromancerSkill>): void {
  for (const id of RITUALIST_SPIRIT_SKILL_IDS) {
    const spirit = spiritDefinition(runtime, id)!;
    const actor = ritualistState.from(runtime.profession).activeSpirits[spirit.key];

    if (!actor || (actor.actionGeneration === 0 && actor.busyUntil > runtime.time)) continue;

    beginAction(runtime, spirit.key, spirit.activeDuration);
    emitActionPackets(runtime, spirit.key, ritualistSpiritCommandPackets(runtime, cast, spirit));
  }
}

/** Opening strikes remain replaceable; a field becomes independent only when its owned creation task executes. */
export function startRitualistSpiritOpening(
  runtime: NecromancerRuntime,
  cast: RuntimeCast<NecromancerSkill>,
  spirit: SpiritDefinition
): void {
  if (spirit.key !== 'wanderlust') {
    emitActionPackets(
      runtime,
      spirit.key,
      ritualistSpiritStrikePackets(runtime, cast, spirit, spirit.summonTicks, 'initial')
    );
    return;
  }

  const field = ritualistSpiritField(runtime, cast, spirit);

  if (!field) return;

  const actor = ritualistState.from(runtime.profession).activeSpirits[spirit.key];
  // Creation precedes a same-time auto opportunity, which would otherwise replace the opening action.
  runtime.schedule(FIELD, Math.min(actor.busyUntil, field.at), field, actionOwner(runtime, spirit.key), -1);
}

/** Each spirit joins the same clock, skipping busy opportunities without delaying future attack starts. */
function auto(runtime: NecromancerRuntime, data: unknown): void {
  const work = data as SpiritAuto;
  const state = ritualistState.from(runtime.profession);

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
    beginAction(runtime, work.key, spirit.autoattackImpactDelayMs / 1000);
    runtime.effects.emit({
      kind: 'packet',
      owner: actionOwner(runtime, work.key),
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

  const interval = balanceNumber(runtime.helpers, TRAIT.SPAWNING_POWER, 'pulseInterval');
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
  const state = ritualistState.from(runtime.profession);
  const key = spirit.key;
  const previous = state.activeSpirits[key];

  if (previous) {
    runtime.cancelOwner(owner(key, previous.generation));
    runtime.cancelOwner(actionOwner(runtime, key));
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

  const state = ritualistState.from(runtime.profession);
  for (const [key, actor] of Object.entries(state.activeSpirits)) {
    if (actor.started) continue;

    const spirit = spiritDefinition(runtime, actor.skillId);

    if (!spirit) continue;

    const interval = balanceNumber(runtime.helpers, TRAIT.SPAWNING_POWER, 'pulseInterval');

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

      const state = ritualistState.from(runtime.profession);

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

/** Recurring wakes belong to the creature; field creation belongs to its opening action. */
export const ritualistSpiritTasks: NonNullable<RuntimeHooks<NecromancerRuntimeState, NecromancerSkill>['tasks']> = {
  [AUTO]: auto,
  [FIELD](runtime, data) {
    // Passing the creation task's ownership check releases all remaining field output from the spirit's lifetime.
    emitRitualistSpiritField(runtime, data as RitualistSpiritField);
  }
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
