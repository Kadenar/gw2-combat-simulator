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
import type {
  SimulationActorType,
  SkillId,
} from "../../../../platform/engine/types.js";
import type {
  NecromancerCastContext,
  NecromancerConfig,
  NecromancerEmissionContext,
  NecromancerSchedulerContext,
  NecromancerSkill,
  NecromancerState,
} from "../../types.js";

export const SHROUD_ENTRY: Readonly<Record<SkillId, string>> = Object.freeze({
  [ID.DEATH_SHROUD]: "death",
  [ID.REAPERS_SHROUD]: "reaper",
  [ID.HARBINGER_SHROUD]: "harbinger",
  [ID.RITUALISTS_SHROUD]: "ritualist",
});
export const SHROUD_EXIT: Readonly<Record<SkillId, SkillId>> = Object.freeze({
  [ID.END_DEATH_SHROUD]: ID.DEATH_SHROUD,
  [ID.EXIT_REAPERS_SHROUD]: ID.REAPERS_SHROUD,
  [ID.EXIT_HARBINGER_SHROUD]: ID.HARBINGER_SHROUD,
  [ID.EXIT_RITUALISTS_SHROUD]: ID.RITUALISTS_SHROUD,
});
export const EXIT_ID_BY_SHROUD: Readonly<Record<string, SkillId>> = Object.freeze({
  death: ID.END_DEATH_SHROUD,
  reaper: ID.EXIT_REAPERS_SHROUD,
  harbinger: ID.EXIT_HARBINGER_SHROUD,
  ritualist: ID.EXIT_RITUALISTS_SHROUD,
});
export const ENTRY_ID_BY_SHROUD: Readonly<Record<string, SkillId>> = Object.freeze(
  Object.fromEntries(
    Object.entries(SHROUD_ENTRY).map(([skillId, shroud]) => [
      shroud,
      Number(skillId),
    ]),
  ),
);

interface EmitDamageOptions {
  readonly at?: number;
  readonly hits?: number;
  readonly interval?: number;
  readonly name?: string;
  readonly source?: string;
  readonly sourceId?: SkillId;
  readonly actorType?: SimulationActorType;
  readonly skillWeapon?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

interface EmitEventOptions {
  readonly at?: number;
  readonly source?: string;
  readonly sourceId?: SkillId;
  readonly actorType?: SimulationActorType;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export function traits(
  context: { readonly config: NecromancerConfig },
): Set<string | number> {
  return new Set([
    ...(context.config?.traitIds || []),
    ...(context.config?.selectedTraitIds || []),
    ...(context.config?.selectedTraits || []),
  ]);
}

export function hasTrait(
  context: { readonly config: NecromancerConfig },
  traitId: SkillId,
): boolean {
  return hasNecromancerTrait(traits(context), traitId);
}

export function emitState(
  context: NecromancerSchedulerContext,
  at: number,
  reason = "",
): void {
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
  context: NecromancerEmissionContext,
  skill: NecromancerSkill,
  coefficient: number,
  {
    at = context.effectiveEnd ?? context.state.time,
    hits = 1,
    interval = 0,
    name = skill.name,
    source = "necromancer",
    sourceId = skill.id,
    actorType = "player",
    skillWeapon = String(skill.skillWeapon ?? (
      skill.type === "Weapon"
        ? skill.weapon || ""
        : "Unequipped"
    )),
    metadata = {},
  }: EmitDamageOptions = {},
): void {
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
  context: NecromancerEmissionContext,
  skill: NecromancerSkill,
  name: string,
  stacks: number,
  duration: number,
  {
    at = context.effectiveEnd ?? context.state.time,
    source = "necromancer",
    sourceId = skill.id,
    actorType = "player",
    metadata = {},
  }: EmitEventOptions = {},
): void {
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
  context: NecromancerEmissionContext,
  skill: NecromancerSkill,
  kind = "control",
  at = context.effectiveEnd ?? context.state.time,
  duration = 0,
): void {
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

export function emitBuff(
  context: NecromancerEmissionContext,
  skill: NecromancerSkill,
  kind: string,
  duration: number,
  stacks = 1,
  { at = context.effectiveEnd ?? context.state.time, metadata = {} }: {
    readonly at?: number;
    readonly metadata?: Readonly<Record<string, unknown>>;
  } = {},
): void {
  context.emit({
    type: "buff",
    at,
    source: "necromancer",
    sourceId: skill.id,
    actorType: "player",
    skillId: skill.id,
    skillName: skill.name,
    kind,
    duration,
    stacks,
    ...metadata,
  });
}

export function necromancerBoonDuration(
  context: NecromancerCastContext,
  boon: string,
  baseDuration: number,
  at = context.effectiveEnd,
): number {
  let concentration = Number(context.config.stats?.concentration || 0);
  if (
    hasTrait(context, TRAIT.SAND_SAGE)
    && (context.state.profession.shades || []).some(
      (expiresAt: number) => expiresAt > at,
    )
  ) {
    concentration += 225;
  }
  const name = String(boon || "");
  const bonus =
    concentration / 1500
    + Number(context.config.stats?.boonDurationBonus || 0) / 100
    + Number(context.config.stats?.boonDurationBonuses?.[name] || 0) / 100;
  return Number(baseDuration) * Math.max(1, Math.min(2, 1 + bonus));
}

export function purgeTimedState(
  state: NecromancerState,
  at: number,
): void {
  state.blightExpiries = (state.blightExpiries || [])
    .filter((expiresAt: number) => expiresAt > at);
  state.carapaceExpiries = (state.carapaceExpiries || [])
    .filter((expiresAt: number) => expiresAt > at);
  state.shades = (state.shades || [])
    .filter((expiresAt: number) => expiresAt > at);
  state.soulShardExpiries = (state.soulShardExpiries || [])
    .filter((expiresAt: number) => expiresAt > at);
  syncNecromancerResources(state);
}

export function addCarapace(
  state: NecromancerState,
  stacks: number,
  at: number,
  duration = 10,
): number {
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

export function addBlight(
  state: NecromancerState,
  stacks: number,
  at: number,
): number {
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

export function consumeBlight(
  state: NecromancerState,
  stacks: number,
  at: number,
): number {
  purgeTimedState(state, at);
  const count = Math.min(
    Math.max(0, Math.trunc(Number(stacks || 0))),
    state.blightExpiries.length,
  );
  state.blightExpiries.splice(0, count);
  syncNecromancerResources(state);
  return count;
}

export function addSoulShards(
  state: NecromancerState,
  stacks: number,
  at: number,
  duration = 10,
): number {
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

export function consumeSoulShards(
  state: NecromancerState,
  stacks: number,
  at: number,
): number {
  purgeTimedState(state, at);
  const count = Math.min(
    Math.max(0, Math.trunc(Number(stacks || 0))),
    state.soulShardExpiries.length,
  );
  state.soulShardExpiries.splice(0, count);
  syncNecromancerResources(state);
  return count;
}

export function gainNecromancerLifeForce(
  context: NecromancerSchedulerContext,
  amount: number,
  at: number,
  reason = "",
): number {
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

export function emitCreatureSummonTraits(
  context: NecromancerCastContext,
  skill: NecromancerSkill,
  at: number,
  count = 1,
): void {
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
        metadata: {
          skillId: TRAIT.EXPLOSIVE_GROWTH,
          skillName: "Explosive Growth",
          parentSkillName: skill.name,
          triggeredBy: skill.name,
        },
      },
    );
  }
}
