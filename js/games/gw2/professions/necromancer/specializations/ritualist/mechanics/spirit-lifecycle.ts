import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import type { SimulationEventBase } from '#gw2/platform/events/events.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { buildResolverStrike } from '#gw2/platform/effects/packet-builders.js';
import { registerNecromancerShroudLifecycle } from '#gw2/professions/necromancer/core/mechanics/shroud-lifecycle.js';
import { runCreatureSummonReactions } from '#gw2/professions/necromancer/core/mechanics/state-helpers.js';
import { spiritFields } from '#gw2/professions/necromancer/specializations/ritualist/mechanics/attribution.js';
import { spiritDefinition } from '#gw2/professions/necromancer/specializations/ritualist/mechanics/spirits.js';
import { RITUALIST_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/necromancer/specializations/ritualist/profiles.js';
import { ritualistState } from '#gw2/professions/necromancer/specializations/ritualist/state.js';
import {
  applyEmpoweringSpirits,
  armSoulTwisting,
  consumeSoulTwisting,
  lingeringSpiritsActive
} from '#gw2/professions/necromancer/specializations/ritualist/traits/behavior.js';
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
  for (const key of Object.keys(state.activeSpirits)) runtime.cancelOwner(owner(key, state.spiritGenerations[key]));
  state.activeSpirits = {};
  runtime.resourceController.refresh('lifeForce');
}

/** Only autonomous impacts belong to a spirit generation; player payloads use direct effect emission. */
function queueAutonomousPacket(runtime: NecromancerRuntime, key: string, event: SimulationEventBase): void {
  const generation = ritualistState.from(runtime).spiritGenerations[key];
  runtime.schedule(PACKET, event.at, { key, generation, event }, owner(key, generation));
}

/** One autonomous wake per spirit advances the shared animation grid; both animation start and impact check busy state. */
function auto(runtime: NecromancerRuntime, data: unknown): void {
  const work = data as SpiritAuto;
  const state = ritualistState.from(runtime);
  if (
    !state.activeSpirits[work.key] ||
    state.spiritGenerations[work.key] !== work.generation ||
    runtime.deathTime != null
  )
    return;
  const spirit = spiritDefinition(runtime, work.skillId);
  if (!spirit || !(spirit.attackCoefficient > 0)) return;
  const skill = runtime.helpers.skillsById.get(work.skillId)!;
  if (!(state.spiritBusyUntil[work.key] > runtime.time))
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
  runtime.cancelOwner(owner(key, state.spiritGenerations[key] ?? 0));
  state.spiritGenerations[key] = (state.spiritGenerations[key] ?? 0) + 1;
  state.activeSpirits[key] = true;
  state.spiritInitialUntil[key] = canonicalTime(runtime.time + (key === 'anguish' ? 1.1 : 0));
  state.spiritBusyUntil[key] = canonicalTime(runtime.time + spirit.initialBusyMs / 1000);
  runtime.resourceController.refresh('lifeForce');
  consumeSoulTwisting(runtime, cast);

  runCreatureSummonReactions(runtime, cast.skill, runtime.time, 1, cast.id);
  applyEmpoweringSpirits(runtime, cast, key);

  const resources = requireBalanceProfileFromContext(runtime, PROFILE.resources);
  const interval = balanceProfileNumber(resources, 'pulseInterval');
  if (!(interval > 0) || !(spirit.attackCoefficient > 0)) return;
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
      generation: state.spiritGenerations[key],
      skillId: cast.skill.id,
      anchor: state.spiritAutoAnchorAt,
      pulse,
      activationId: cast.id
    },
    owner(key, state.spiritGenerations[key])
  );
}

/** Entry preserves the resummon cadence choice; only depletion overrides Lingering Spirits on exit. */
export function initializeRitualistSpiritLifecycle(runtime: NecromancerRuntime): void {
  registerNecromancerShroudLifecycle(runtime, 'ritualist.shroud', {
    onEnter(skill) {
      if (skill.shroudEntry !== 'ritualist') return;
      const state = ritualistState.from(runtime);
      state.resummonedSpiritAutoCycle = Object.keys(state.activeSpirits).length > 0;
      state.spiritAutoAnchorAt = NaN;
      armSoulTwisting(runtime);
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
  return Boolean(state.activeSpirits[key]) && !(state.spiritInitialUntil[key] > runtime.time);
}

/** A committed active attack suppresses autonomous starts and impacts without moving their shared cadence. */
export function markRitualistSpiritBusy(runtime: NecromancerRuntime, spirit: Spirit): void {
  const state = ritualistState.from(runtime);
  state.spiritBusyUntil[spirit.key] = Math.max(
    state.spiritBusyUntil[spirit.key],
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
      state.spiritGenerations[work.key] === work.generation &&
      !(state.spiritBusyUntil[work.key] > runtime.time)
    )
      runtime.effects.emit({ kind: 'packet', event: work.event });
  }
};
