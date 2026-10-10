import { autonomousActionsAllowed } from '#gw2/platform/combat/engagement.js';
import { buildResolverStrike } from '#gw2/platform/effects/packet-builders.js';
import type { SimulationEventBase } from '#gw2/platform/events/events.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { defineTriggerPoint } from '#gw2/platform/profession-definition/trigger-points.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import { registerNecromancerShroudLifecycle } from '#gw2/professions/necromancer/core/mechanics/shroud-lifecycle.js';
import { creatureSummoned } from '#gw2/professions/necromancer/core/mechanics/state-helpers.js';
import { NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import { spiritFields } from '#gw2/professions/necromancer/specializations/ritualist/mechanics/attribution.js';
import { spiritDefinition } from '#gw2/professions/necromancer/specializations/ritualist/mechanics/spirits.js';
import { RITUALIST_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/necromancer/specializations/ritualist/profiles.js';
import { ritualistState } from '#gw2/professions/necromancer/specializations/ritualist/state.js';
import { lingeringSpiritsActive } from '#gw2/professions/necromancer/specializations/ritualist/traits/behavior.js';
import type {
  NecromancerRuntime,
  NecromancerRuntimeState,
  NecromancerSkill
} from '#gw2/professions/necromancer/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

const AUTO = 'ritualist.spirit-auto';
const PACKET = 'ritualist.spirit-packet';
const owner = (key: string, generation: number) => ({ id: `spirit:${key}`, generation });
type Spirit = NonNullable<ReturnType<typeof spiritDefinition>>;
interface SpiritPacket {
  key: string;
  generation: number;
  event: SimulationEventBase;
}
interface SpiritAuto {
  key: string;
  generation: number;
  skillId: SkillId;
  anchor: number;
  pulse: number;
  activationId: string;
}

/** Removing a spirit cancels autonomous work; already committed player attacks retain their separate lifetime. */
function clearSpirits(runtime: NecromancerRuntime): void {
  const state = ritualistState.from(runtime);
  for (const key of Object.keys(state.activeSpirits))
    runtime.cancelOwner(owner(key, state.activeSpirits[key].generation));
  state.activeSpirits = {};
  runtime.resourceController.refresh('lifeForce');
}

/** Only autonomous impacts belong to a spirit generation; player payloads use direct effect emission. */
function queueAutonomousPacket(runtime: NecromancerRuntime, key: string, event: SimulationEventBase): void {
  const generation = ritualistState.from(runtime).activeSpirits[key].generation;
  runtime.schedule(PACKET, event.at, { key, generation, event }, owner(key, generation));
}

/** One autonomous wake per spirit advances the shared animation grid; both animation start and impact check busy state. */
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
  if (!(state.activeSpirits[work.key].busyUntil > runtime.time))
    queueAutonomousPacket(
      runtime,
      work.key,
      buildResolverStrike({
        at: canonicalTime(runtime.time + spirit.autoattackImpactDelayMs / 1000),
        source: 'Spirit',
        sourceId: skill.id,
        skillId: skill.id,
        skillName: `${skill.name} Autoattack`,
        icon: skill.icon,
        actorType: 'summon',
        coefficient: spirit.attackCoefficient,
        skillWeapon: 'Unequipped',
        weaponStrength: spirit.attackWeaponStrength,
        canCrit: true,
        summonInheritsCriticalAttributes: true,
        ...spiritFields(work.key, 'autoattack'),
        activationId: `${work.activationId}:auto:${work.pulse}`
      })
    );
  const interval = balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.resources), 'pulseInterval');
  const at = canonicalTime(work.anchor + (work.pulse + 1) * interval);
  if (at > runtime.time)
    runtime.schedule(AUTO, at, { ...work, pulse: work.pulse + 1 }, owner(work.key, work.generation));
}

/** Replacing one creature preserves the shared cadence and refunds Soul Twisting only after its summon has committed. */
export function summonRitualistSpirit(
  runtime: NecromancerRuntime,
  cast: RuntimeCast<NecromancerSkill>,
  spirit: Spirit
): void {
  const state = ritualistState.from(runtime);
  const key = spirit.key;
  const previous = state.activeSpirits[key];
  if (previous) runtime.cancelOwner(owner(key, previous.generation));
  state.activeSpirits[key] = {
    skillId: cast.skill.id,
    activationId: cast.id,
    generation: ++state.spiritGeneration,
    started: false,
    initialUntil: canonicalTime(runtime.time + (key === 'anguish' ? 1.1 : 0)),
    busyUntil: canonicalTime(runtime.time + spirit.initialBusyMs / 1000)
  };
  runtime.resourceController.refresh('lifeForce');
  runtime.fireTrigger(ritualistSpiritCommitted, { cast, at: runtime.time, activationId: cast.id });

  runtime.fireTrigger(creatureSummoned, { skill: cast.skill, at: runtime.time, count: 1, activationId: cast.id });
  runtime.fireTrigger(ritualistSpiritSummoned, { cast, key, at: runtime.time, activationId: cast.id });

  startRitualistSpirits(runtime);
}

/** Engagement establishes the first shared cadence from live spirits; subsequent summons join that cadence. */
export function startRitualistSpirits(runtime: NecromancerRuntime): void {
  if (!autonomousActionsAllowed(runtime)) return;
  const state = ritualistState.from(runtime);
  for (const [key, actor] of Object.entries(state.activeSpirits)) {
    if (actor.started) continue;
    const spirit = spiritDefinition(runtime, actor.skillId);
    if (!spirit) continue;
    const resources = requireBalanceProfileFromContext(runtime, PROFILE.resources);
    const interval = balanceProfileNumber(resources, 'pulseInterval');
    if (!(interval > 0) || !(spirit.attackCoefficient > 0)) continue;
    actor.started = true;
    if (!Number.isFinite(state.spiritAutoAnchorAt)) {
      state.spiritAutoAnchorAt = canonicalTime(
        runtime.time +
          (state.resummonedSpiritAutoCycle
            ? balanceProfileNumber(resources, 'resummonedSpiritAttackDelayMs') / 1000
            : balanceProfileNumber(resources, 'initialDelay'))
      );
      state.resummonedSpiritAutoCycle = false;
    }

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

/** Entry preserves the resummon cadence choice; only depletion overrides Lingering Spirits on exit. */
export function initializeRitualistSpiritLifecycle(runtime: NecromancerRuntime): void {
  registerNecromancerShroudLifecycle(runtime, 'ritualist.shroud', {
    onEnter(skill) {
      if (skill.shroudEntry !== 'ritualist') return;
      const state = ritualistState.from(runtime);
      state.resummonedSpiritAutoCycle = Object.keys(state.activeSpirits).length > 0;
      state.spiritAutoAnchorAt = NaN;
      runtime.fireTrigger(ritualistShroudEntered, { skill, at: runtime.time });
    },
    onExit: () => {
      if (!lingeringSpiritsActive(runtime)) clearSpirits(runtime);
    },
    onDepletion: () => clearSpirits(runtime)
  });
}

/** A spirit's initial attack window must finish before a commanded follow-up can be committed. */
export function canActivateRitualistSpirit(runtime: NecromancerRuntime, key: string): boolean {
  const state = ritualistState.from(runtime);
  return Boolean(state.activeSpirits[key]) && !(state.activeSpirits[key].initialUntil > runtime.time);
}

/** A committed active attack suppresses autonomous starts and impacts without moving their shared cadence. */
export function markRitualistSpiritBusy(runtime: NecromancerRuntime, spirit: Spirit): void {
  const state = ritualistState.from(runtime);
  state.activeSpirits[spirit.key].busyUntil = Math.max(
    state.activeSpirits[spirit.key].busyUntil,
    canonicalTime(runtime.time + spirit.activeDuration)
  );
}

/** Hooks install the owner's tasks; stale generations and busy creatures cannot deliver autonomous impacts. */
export const ritualistSpiritTasks: NonNullable<RuntimeHooks<NecromancerRuntimeState, NecromancerSkill>['tasks']> = {
  [AUTO]: auto,
  [PACKET](runtime, data) {
    const work = data as SpiritPacket;
    const state = ritualistState.from(runtime);
    if (
      state.activeSpirits[work.key] &&
      state.activeSpirits[work.key]?.generation === work.generation &&
      !(state.activeSpirits[work.key].busyUntil > runtime.time)
    )
      runtime.effects.emit({ kind: 'packet', event: work.event });
  }
};

/** Preserve the accepted spirit-committed boundary and its original reward order. */
export const ritualistSpiritCommitted = defineTriggerPoint<{
  readonly cast: RuntimeCast<NecromancerSkill>;
  readonly at: number;
  readonly activationId: string;
}>('necromancer.spirit-committed', [TRAIT.SOUL_TWISTING]);

/** Preserve the accepted spirit-summoned boundary and its original reward order. */
export const ritualistSpiritSummoned = defineTriggerPoint<{
  readonly cast: RuntimeCast<NecromancerSkill>;
  readonly at: number;
  readonly activationId: string;
  readonly key: string;
}>('necromancer.spirit-summoned', [TRAIT.EMPOWERING_SPIRITS]);

/** Preserve the accepted ritualist-shroud-entered boundary and its original reward order. */
export const ritualistShroudEntered = defineTriggerPoint<{ readonly skill: NecromancerSkill; readonly at: number }>(
  'necromancer.ritualist-shroud-entered',
  [TRAIT.SOUL_TWISTING]
);
