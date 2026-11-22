/** Own complete spirit summons and actions while keeping creature, attack, and independent effect lifetimes distinct. */
import { gw2Time } from '#gw2/platform/combat/clock.js';
import { autonomousActionsAllowed } from '#gw2/platform/combat/engagement.js';
import { ACTOR, CONTROL } from '#gw2/platform/constants.js';
import { buildResolverStrike } from '#gw2/platform/effects/packet-builders.js';
import type { SimulationEventBase } from '#gw2/platform/events/events.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { defineTriggerPoint } from '#gw2/platform/profession-definition/trigger-points.js';
import { balanceNumber, effectNumber, requireEffect, requireSkill } from '#gw2/platform/skills/balance-profiles.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import { necromancerLifeForce } from '#gw2/professions/necromancer/core/mechanics/resources.js';
import { registerNecromancerShroudLifecycle } from '#gw2/professions/necromancer/core/mechanics/shroud-lifecycle.js';
import { creatureSummoned } from '#gw2/professions/necromancer/core/mechanics/state-helpers.js';
import { NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import { ritualistPartyBoonPolicy } from '#gw2/professions/necromancer/specializations/ritualist/mechanics/party-boons.js';
import {
  attribution,
  spiritFields,
  spiritImpactAt
} from '#gw2/professions/necromancer/specializations/ritualist/mechanics/spirit-packet-context.js';
import {
  RITUALIST_SPIRIT_SKILL_IDS,
  spiritDefinition,
  type SpiritAttack,
  type SpiritDefinition
} from '#gw2/professions/necromancer/specializations/ritualist/mechanics/spirits.js';
import { painfulBondSkill } from '#gw2/professions/necromancer/specializations/ritualist/skills/spirit-attacks.js';
import { ritualistState } from '#gw2/professions/necromancer/specializations/ritualist/state.js';
import { lingeringSpiritsActive } from '#gw2/professions/necromancer/specializations/ritualist/traits/behavior.js';
import type {
  NecromancerRuntime,
  NecromancerRuntimeState,
  NecromancerSkill
} from '#gw2/professions/necromancer/types.js';

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

/** Pending field creation retains its payload until the opening action releases it from spirit ownership. */
interface SpiritField {
  events: SimulationEventBase[];
  skillId: SkillId;
  at: number;
  attribution: ReturnType<typeof attribution>;
}

/** Materialize finite attacks here so attribution and lifetime admission remain part of the same operation. */
function strikePackets(
  runtime: NecromancerRuntime,
  cast: RuntimeCast<NecromancerSkill>,
  spirit: SpiritDefinition,
  attack: SpiritAttack | undefined,
  attackType: 'initial' | 'summon-spirits'
): SimulationEventBase[] {
  if (!attack) return [];

  return attack.ticks.map((tick, index) =>
    buildResolverStrike({
      ...attribution(cast),
      ...tick.payload,
      ...spiritFields(spirit.key, attackType, tick.payload.metadata),
      at: spiritImpactAt(runtime.time, cast, tick.atMs),
      skillWeapon: 'Unequipped',
      hitIndex: index + 1,
      totalHits: attack.ticks.length,
      ...(attackType === 'summon-spirits'
        ? { sourceId: `ritualist.${spirit.key}.summon-spirits` }
        : {
            activationId: spirit.key === 'wanderlust' ? `${cast.id}:field` : cast.id,
            name: spirit.key === 'wanderlust' ? 'Spirit of Wanderlust - Initial Attack' : cast.skill.name
          })
    })
  );
}

/** Created fields emit strikes before conditions and survive later spirit replacement or removal. */
function emitSpiritField(runtime: NecromancerRuntime, field: SpiritField): void {
  for (const event of field.events) runtime.effects.emit({ kind: 'packet', event });
  const opening = requireSkill(runtime.helpers, field.skillId);
  runtime.effects.emit({
    kind: 'profile',
    profile: opening,
    effects: spiritDefinition(runtime.helpers, field.skillId)!.openingConditions,
    at: field.at,
    attribution: { ...field.attribution, ...spiritFields('wanderlust', 'initial') },
    transform: (event) => ({ ...event, name: `${opening.name} - ${event.condition}` })
  });
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
  actor.busyUntil = gw2Time(runtime.time + duration);
}

/** Every pending packet captures the accepted action's owner, independently of damage attribution. */
function emitActionPackets(runtime: NecromancerRuntime, key: string, events: readonly SimulationEventBase[]): void {
  const owner = actionOwner(runtime, key);
  for (const event of events) runtime.effects.emit({ kind: 'packet', event, owner });
}

/** Protect unfinished openings; accepted commands replace one action without moving the creature's recurring clock. */
function commandRitualistSpirits(runtime: NecromancerRuntime, cast: RuntimeCast<NecromancerSkill>): void {
  for (const id of RITUALIST_SPIRIT_SKILL_IDS) {
    const spirit = spiritDefinition(runtime.helpers, id)!;
    const actor = ritualistState.from(runtime.profession).activeSpirits[spirit.key];

    if (!actor || (actor.actionGeneration === 0 && actor.busyUntil > runtime.time)) continue;

    beginAction(runtime, spirit.key, spirit.activeDuration);
    const events = strikePackets(runtime, cast, spirit, spirit.active, 'summon-spirits');

    if (spirit.key === 'wanderlust')
      events.push({
        ...attribution(cast),
        ...spiritFields(spirit.key, 'summon-spirits'),
        type: 'control',
        controlKind: CONTROL.DAZE,
        sourceId: `ritualist.${spirit.key}.summon-spirits`,
        at: spiritImpactAt(runtime.time, cast, spirit.active?.ticks[0]?.atMs ?? 0)
      });

    emitActionPackets(runtime, spirit.key, events);
  }
}

/** Opening strikes remain replaceable; a field becomes independent only when its owned creation task executes. */
function startSpiritOpening(
  runtime: NecromancerRuntime,
  cast: RuntimeCast<NecromancerSkill>,
  spirit: SpiritDefinition
): void {
  const first = spirit.lingering?.ticks[0];

  if (first) {
    const field: SpiritField = {
      events: strikePackets(runtime, cast, spirit, spirit.lingering, 'initial'),
      skillId: cast.skill.id,
      at: spiritImpactAt(runtime.time, cast, first.atMs),
      attribution: attribution(cast)
    };
    const actor = ritualistState.from(runtime.profession).activeSpirits[spirit.key];
    // Creation precedes a same-time auto opportunity, which would otherwise replace the opening action.
    runtime.schedule(FIELD, Math.min(actor.busyUntil, field.at), field, actionOwner(runtime, spirit.key), -1);
    return;
  }

  if (spirit.key !== 'anguish') return;

  // Anguish's conditions are independent; only its barrage belongs to the replaceable opening action.
  runtime.effects.emit({
    kind: 'profile',
    profile: cast.skill,
    effects: spirit.openingConditions,
    attribution: attribution(cast),
    transform: (event) => ({
      ...event,
      name: `${cast.skill.name} - ${event.condition}`,
      offTarget: cast.command.offTarget
    })
  });
  emitActionPackets(runtime, spirit.key, strikePackets(runtime, cast, spirit, spirit.summon, 'initial'));
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

  const spirit = spiritDefinition(runtime.helpers, work.skillId);

  if (!spirit?.autoattack) return;

  const skill = runtime.helpers.skillsById.get(work.skillId)!;
  const payload = spirit.autoattack.ticks[0].payload;

  if (!(state.activeSpirits[work.key].busyUntil > runtime.time)) {
    beginAction(runtime, work.key, spirit.autoattackImpactDelayMs / 1000);
    runtime.effects.emit({
      kind: 'packet',
      owner: actionOwner(runtime, work.key),
      event: buildResolverStrike({
        at: gw2Time(runtime.time + spirit.autoattackImpactDelayMs / 1000),
        source: 'Spirit',
        sourceId: skill.id,
        skillId: skill.id,
        skillName: `${skill.name} Autoattack`,
        icon: skill.icon,
        actorType: ACTOR.SUMMON,
        skillWeapon: 'Unequipped',
        canCrit: true,
        summonInheritsCriticalAttributes: true,
        ...payload,
        ...spiritFields(work.key, 'autoattack', payload.metadata),
        activationId: `${work.activationId}:auto:${work.pulse}`
      })
    });
  }

  const interval = balanceNumber(runtime.helpers, TRAIT.SPAWNING_POWER, 'pulseInterval');
  const at = gw2Time(work.anchor + (work.pulse + 1) * interval);

  if (at > runtime.time)
    runtime.schedule(AUTO, at, { ...work, pulse: work.pulse + 1 }, owner(work.key, work.generation));
}

/** Summon grants survive spirit cancellation; party boons observe the newly committed creature. */
function grantSpiritSummonEffects(
  runtime: NecromancerRuntime,
  cast: RuntimeCast<NecromancerSkill>,
  spirit: SpiritDefinition
): void {
  if (spirit.key === 'anguish') {
    const profile = requireSkill(runtime.helpers, painfulBondSkill.id);
    const effect = requireEffect(profile, 'buff', 'necromancer-painful-bond');
    const opening = spirit.summon?.ticks[0];

    if (effect && opening) {
      const at = spiritImpactAt(runtime.time, cast, opening.atMs);
      const duration = effectNumber(profile, effect, 'duration');
      runtime.effects.emit({
        kind: 'packet',
        event: {
          ...attribution(cast),
          type: 'necromancer.painful-bond',
          at,
          mode: 'apply',
          duration,
          triggeredBy: cast.skill.name
        }
      });
    }
  } else if (spirit.key === 'preservation') {
    for (const effect of cast.skill.effects ?? [])
      if (effect.type === 'boon') {
        runtime.effects.emit({
          kind: 'profile',
          profile: cast.skill,
          effects: [effect],
          ...ritualistPartyBoonPolicy(runtime, cast)
        });
      }
  }
}

/** Resolve and commit the summon, then start its opening and independent grants in their accepted reward order. */
function summonRitualistSpirit(runtime: NecromancerRuntime, cast: RuntimeCast<NecromancerSkill>): void {
  const spirit = spiritDefinition(runtime.helpers, cast.skill.id)!;
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
    busyUntil: gw2Time(runtime.time + (previous ? spirit.resummonBusyMs : spirit.initialBusyMs) / 1000)
  };
  runtime.resourceController.refresh('lifeForce');
  runtime.fireTrigger(ritualistSpiritCommitted, { cast });

  runtime.fireTrigger(creatureSummoned, { skill: cast.skill, at: runtime.time, count: 1, activationId: cast.id });
  runtime.fireTrigger(ritualistSpiritSummoned, { cast, key });

  startRitualistSpirits(runtime);
  startSpiritOpening(runtime, cast, spirit);
  grantSpiritSummonEffects(runtime, cast, spirit);
}

/** Newly engaged or replaced spirits join the existing clock after the current boundary. */
function startRitualistSpirits(runtime: NecromancerRuntime): void {
  if (!autonomousActionsAllowed(runtime)) return;

  const state = ritualistState.from(runtime.profession);
  for (const [key, actor] of Object.entries(state.activeSpirits)) {
    if (actor.started) continue;

    const spirit = spiritDefinition(runtime.helpers, actor.skillId);

    if (!spirit) continue;

    const interval = balanceNumber(runtime.helpers, TRAIT.SPAWNING_POWER, 'pulseInterval');

    if (!(interval > 0) || !spirit.autoattack) continue;

    actor.started = true;

    const pulse = Math.max(0, Math.floor(gw2Time(runtime.time - state.spiritAutoAnchorAt) / interval) + 1);
    runtime.schedule(
      AUTO,
      gw2Time(state.spiritAutoAnchorAt + pulse * interval),
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
function initializeRitualistSpiritLifecycle(runtime: NecromancerRuntime): void {
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

/** Register the complete spirit lifetime so callers cannot omit its tasks, combat startup, or resource recovery. */
export const ritualistSpiritHooks: RuntimeHooks<NecromancerRuntimeState, NecromancerSkill> = {
  initialize: initializeRitualistSpiritLifecycle,
  // An assumed shroud has no entry cast to set the clock for a newly summoned spirit.
  prepareDamageState(runtime, skill) {
    if (skill?.shroud === 'ritualist') ritualistState.from(runtime.profession).spiritAutoAnchorAt = runtime.time;
  },
  onCombatStart: startRitualistSpirits,
  sideEffectHandlers: {
    'ritualist.summon-spirit'(runtime, context) {
      if (context.kind === 'cast') summonRitualistSpirit(runtime, context.cast);
    },
    'ritualist.summon-spirits'(runtime, context) {
      if (context.kind === 'cast') commandRitualistSpirits(runtime, context.cast);
    }
  },
  tasks: {
    [AUTO]: auto,
    [FIELD](runtime, data) {
      // Passing the creation task's ownership check releases field output from the spirit's lifetime.
      emitSpiritField(runtime, data as SpiritField);
    }
  },
  resources: {
    lifeForce: {
      ...necromancerLifeForce,
      recovery(runtime) {
        if (
          !runtime.profession.core.activeShroud &&
          Object.keys(ritualistState.from(runtime.profession).activeSpirits).length &&
          lingeringSpiritsActive(runtime)
        )
          return (
            (-runtime.profession.core.lifeForce.maximum *
              balanceNumber(runtime.helpers, TRAIT.SPAWNING_POWER, 'lifeForceDrain')) /
            100
          );

        return necromancerLifeForce.recovery(runtime);
      }
    }
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
