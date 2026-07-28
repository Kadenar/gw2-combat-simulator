/**
 * Shared primitives for every necromancer skill handler.
 *
 * Three groups of helpers:
 *   - Shroud id maps (entry/exit skill id <-> shroud name) used to route
 *     shroud enter/leave logic.
 *   - Event emitters (`emitState`, `emitDamage`, `emitCondition`,
 *     `emitControl`, `emitBuff`) that stamp the common necromancer fields onto
 *     canonical events before pushing them through `context.emit`.
 *   - Timed-resource mutators for blight/carapace/shades and life force
 *     (`purgeTimedState`, `addCarapace`, `addBlight`, `consumeBlight`,
 *     `addSoulShards`, `consumeSoulShards`, `gainNecromancerLifeForce`),
 *     plus creature-summon trait procs.
 *
 * Handlers depend on this module; it must not depend on them.
 */
import {
  NECROMANCER_SKILL_IDS as ID,
  NECROMANCER_TRAIT_IDS as TRAIT,
} from "../../data/ids.js";
import {
  hasNecromancerTrait,
  snapshotNecromancerState,
  syncNecromancerResources,
} from "../../state.js";
import { NECROMANCER_HANDLER_MECHANICS as MECHANICS } from "../handler-mechanics.js";

export const SHROUD_ENTRY = Object.freeze({
  [ID.DEATH_SHROUD]: "death",
  [ID.REAPERS_SHROUD]: "reaper",
  [ID.HARBINGER_SHROUD]: "harbinger",
  [ID.RITUALISTS_SHROUD]: "ritualist",
});
export const SHROUD_EXIT = Object.freeze({
  [ID.END_DEATH_SHROUD]: ID.DEATH_SHROUD,
  [ID.EXIT_REAPERS_SHROUD]: ID.REAPERS_SHROUD,
  [ID.EXIT_HARBINGER_SHROUD]: ID.HARBINGER_SHROUD,
  [ID.EXIT_RITUALISTS_SHROUD]: ID.RITUALISTS_SHROUD,
});
export const EXIT_ID_BY_SHROUD = Object.freeze({
  death: ID.END_DEATH_SHROUD,
  reaper: ID.EXIT_REAPERS_SHROUD,
  harbinger: ID.EXIT_HARBINGER_SHROUD,
  ritualist: ID.EXIT_RITUALISTS_SHROUD,
});
export const ENTRY_ID_BY_SHROUD = Object.freeze(
  Object.fromEntries(
    Object.entries(SHROUD_ENTRY).map(([skillId, shroud]) => [
      shroud,
      Number(skillId),
    ]),
  ),
);

export function traits(context) {
  return new Set([
    ...(context.config?.traitIds || []),
    ...(context.config?.selectedTraitIds || []),
    ...(context.config?.selectedTraits || []),
  ]);
}

export function hasTrait(context, traitId) {
  return hasNecromancerTrait(traits(context), traitId);
}

export function emitState(context, at, reason = "") {
  context.emit({
    type: "necromancer.state",
    at,
    source: "necromancer",
    sourceId: `necromancer.state.${reason || "update"}`,
    actorType: "player",
    reason,
    state: snapshotNecromancerState(context.state.profession),
  });
}

export function emitDamage(
  context,
  skill,
  coefficient,
  {
    at = context.effectiveEnd,
    hits = 1,
    interval = 0,
    name = skill.name,
    source = "necromancer",
    sourceId = skill.id,
    actorType = "player",
    skillWeapon = skill.skillWeapon ?? (
      skill.type === "Weapon"
        ? skill.weapon || ""
        : "Unequipped"
    ),
    metadata = {},
  } = {},
) {
  const perHit = Number(coefficient || 0) / Math.max(1, hits);
  for (let index = 0; index < Math.max(1, hits); index += 1) {
    context.emit({
      type: "damage",
      at: at + index * interval,
      source,
      sourceId,
      actorType,
      skillId: skill.id,
      skillName: skill.name,
      name,
      coefficient: perHit,
      hits: 1,
      hitIndex: index + 1,
      totalHits: hits,
      skillWeapon,
      canCrit: metadata.canCrit !== false,
      ...metadata,
    });
  }
}

export function emitCondition(
  context,
  skill,
  name,
  stacks,
  duration,
  {
    at = context.effectiveEnd,
    source = "necromancer",
    sourceId = skill.id,
    actorType = "player",
    metadata = {},
  } = {},
) {
  context.emit({
    type: "condition",
    at,
    source,
    sourceId,
    actorType,
    skillId: skill.id,
    skillName: skill.name,
    name: `${skill.name} — ${name}`,
    condition: name,
    stacks,
    duration,
    ...metadata,
  });
}

export function emitControl(
  context,
  skill,
  kind = "control",
  at = context.effectiveEnd,
  duration = 0,
) {
  context.emit({
    type: "control",
    at,
    source: "necromancer",
    sourceId: skill.id,
    actorType: "player",
    skillId: skill.id,
    skillName: skill.name,
    controlKind: kind,
    ...(duration > 0 ? { duration } : {}),
  });
}

export function emitBuff(context, skill, kind, duration, stacks = 1) {
  context.emit({
    type: "buff",
    at: context.effectiveEnd,
    source: "necromancer",
    sourceId: skill.id,
    actorType: "player",
    skillId: skill.id,
    skillName: skill.name,
    kind,
    duration,
    stacks,
  });
}

export function purgeTimedState(state, at) {
  state.blightExpiries = (state.blightExpiries || [])
    .filter(expiresAt => expiresAt > at);
  state.carapaceExpiries = (state.carapaceExpiries || [])
    .filter(expiresAt => expiresAt > at);
  state.shades = (state.shades || [])
    .filter(expiresAt => expiresAt > at);
  state.soulShardExpiries = (state.soulShardExpiries || [])
    .filter(expiresAt => expiresAt > at);
  syncNecromancerResources(state);
}

export function addCarapace(state, stacks, at, duration = 10) {
  purgeTimedState(state, at);
  const count = Math.min(
    Math.max(0, Math.trunc(Number(stacks || 0))),
    30 - state.carapaceExpiries.length,
  );
  state.carapaceExpiries.push(
    ...Array.from({ length: count }, () => at + duration),
  );
  return count;
}

export function addBlight(state, stacks, at) {
  purgeTimedState(state, at);
  const count = Math.min(
    Math.max(0, Math.trunc(Number(stacks || 0))),
    25 - state.blightExpiries.length,
  );
  state.blightExpiries.push(
    ...Array.from({ length: count }, () => at + 25),
  );
  syncNecromancerResources(state);
  return count;
}

export function consumeBlight(state, stacks, at) {
  purgeTimedState(state, at);
  const count = Math.min(
    Math.max(0, Math.trunc(Number(stacks || 0))),
    state.blightExpiries.length,
  );
  state.blightExpiries.splice(0, count);
  syncNecromancerResources(state);
  return count;
}

export function addSoulShards(state, stacks, at, duration = 10) {
  purgeTimedState(state, at);
  const expiresAt = at + duration;
  state.soulShardExpiries =
    state.soulShardExpiries.map(() => expiresAt);
  const count = Math.min(
    Math.max(0, Math.trunc(Number(stacks || 0))),
    6 - state.soulShardExpiries.length,
  );
  state.soulShardExpiries.push(
    ...Array.from({ length: count }, () => expiresAt),
  );
  syncNecromancerResources(state);
  return count;
}

export function consumeSoulShards(state, stacks, at) {
  purgeTimedState(state, at);
  const count = Math.min(
    Math.max(0, Math.trunc(Number(stacks || 0))),
    state.soulShardExpiries.length,
  );
  state.soulShardExpiries.splice(0, count);
  syncNecromancerResources(state);
  return count;
}

export function gainNecromancerLifeForce(context, amount, at, reason = "") {
  if (!(Number(amount) > 0)) return 0;
  const state = context.state.profession;
  const multiplier = hasTrait(context, TRAIT.GLUTTONY) ? 1.1 : 1;
  const before = state.lifeForce;
  state.lifeForce = Math.min(
    state.maximumLifeForce,
    state.lifeForce
      + Number(amount) * Number(state.maximumLifeForce || 100) / 100
        * multiplier,
  );
  syncNecromancerResources(state);
  if (state.lifeForce !== before && reason) emitState(context, at, reason);
  return state.lifeForce - before;
}

export function emitCreatureSummonTraits(context, skill, at, count = 1) {
  if (hasTrait(context, TRAIT.BOON_OF_CREATION)) {
    gainNecromancerLifeForce(context, 10 * count, at);
  }
  if (hasTrait(context, TRAIT.EXPLOSIVE_GROWTH)) {
    emitDamage(
      context,
      skill,
      MECHANICS.traitStrikeCoefficient[TRAIT.EXPLOSIVE_GROWTH] * count,
      {
      at,
      name: "Explosive Growth",
      source: "Trait",
      sourceId: TRAIT.EXPLOSIVE_GROWTH,
      actorType: "effect",
      skillWeapon: "Unequipped",
      },
    );
  }
}
