import { professionCoreState } from "../../../platform/engine/profession.js";
import { gw2StatsForWeaponSet } from "../../../platform/gw2/runtime-rules.js";
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
 *     plus the module-composed creature-summon reaction dispatcher.
 *
 * Handlers depend on this module; it must not depend on them.
 */
import {
  NECROMANCER_SKILL_IDS as ID,
  NECROMANCER_TRAIT_IDS as TRAIT,
} from "../data/ids.js";
import {
  hasNecromancerTrait,
  snapshotNecromancerState,
  syncNecromancerResources,
} from "./state.js";
import type {
  SchedulerRecord,
  SimulationActorType,
  SkillId,
} from "../../../platform/engine/types.js";
import type {
  HarbingerState,
  NecromancerCastContext,
  NecromancerConfig,
  NecromancerCoreState,
  NecromancerEmissionContext,
  NecromancerSchedulerContext,
  NecromancerSkill,
  ScourgeState,
} from "../types.js";

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
export const EXIT_ID_BY_SHROUD: Readonly<Record<string, SkillId>> =
  Object.freeze({
    death: ID.END_DEATH_SHROUD,
    reaper: ID.EXIT_REAPERS_SHROUD,
    harbinger: ID.EXIT_HARBINGER_SHROUD,
    ritualist: ID.EXIT_RITUALISTS_SHROUD,
  });
export const ENTRY_ID_BY_SHROUD: Readonly<Record<string, SkillId>> =
  Object.freeze(
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

export function traits(context: {
  readonly config: NecromancerConfig;
}): Set<string | number> {
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
    skillWeapon = String(
      skill.skillWeapon ??
        (skill.type === "Weapon" ? skill.weapon || "" : "Unequipped"),
    ),
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
  {
    at = context.effectiveEnd ?? context.state.time,
    metadata = {},
  }: {
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

/** Pattern 2/3 party-boon metadata with concrete active minion identities. */
export function necromancerPartyBoonRecipients(
  context: NecromancerEmissionContext,
): Readonly<SchedulerRecord> {
  const core = professionCoreState(context);
  const companionIds: string[] = [];
  for (const [key, count] of Object.entries(core.activeMinions || {})) {
    for (let index = 0; index < Number(count || 0); index += 1) {
      companionIds.push(`minion:${key}:${index}`);
    }
  }
  return {
    recipients: "party",
    maximumRecipients: 5,
    companionIds,
  };
}

export function necromancerBoonDuration(
  context: NecromancerCastContext,
  boon: string,
  baseDuration: number,
  at = context.effectiveEnd,
): number {
  const stats = gw2StatsForWeaponSet(
    context.config,
    context.state.activeWeaponSet,
  );
  let concentration = Number(stats.concentration || 0);
  const active = context.state.profession.specialization;
  if (
    hasTrait(context, TRAIT.SAND_SAGE) &&
    active.kind === "Scourge" &&
    active.state.shades.some((expiresAt: number) => expiresAt > at)
  ) {
    concentration += 225;
  }
  const name = String(boon || "");
  const bonus =
    concentration / 1500 +
    Number(stats.boonDurationBonus || 0) / 100 +
    Number(stats.boonDurationBonuses?.[name] || 0) / 100;
  return Number(baseDuration) * Math.max(1, Math.min(2, 1 + bonus));
}

export function purgeTimedState(state: NecromancerCoreState, at: number): void {
  state.carapaceExpiries = state.carapaceExpiries.filter(
    (expiresAt: number) => expiresAt > at,
  );
  state.soulShardExpiries = state.soulShardExpiries.filter(
    (expiresAt: number) => expiresAt > at,
  );
  syncNecromancerResources(state);
}

export function purgeHarbingerTimedState(
  state: HarbingerState,
  at: number,
): void {
  state.blightExpiries = state.blightExpiries.filter(
    (expiresAt: number) => expiresAt > at,
  );
  state.blight = state.blightExpiries.length;
}

export function purgeScourgeTimedState(state: ScourgeState, at: number): void {
  state.shades = state.shades.filter((expiresAt: number) => expiresAt > at);
}

export function addCarapace(
  state: NecromancerCoreState,
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
  state: HarbingerState,
  stacks: number,
  at: number,
): number {
  purgeHarbingerTimedState(state, at);
  const count = Math.min(
    Math.max(0, Math.trunc(Number(stacks || 0))),
    25 - state.blightExpiries.length,
  );
  state.blightExpiries.push(...Array.from({ length: count }, () => at + 25));
  state.blight = state.blightExpiries.length;
  return count;
}

export function consumeBlight(
  state: HarbingerState,
  stacks: number,
  at: number,
): number {
  purgeHarbingerTimedState(state, at);
  const count = Math.min(
    Math.max(0, Math.trunc(Number(stacks || 0))),
    state.blightExpiries.length,
  );
  state.blightExpiries.splice(0, count);
  state.blight = state.blightExpiries.length;
  return count;
}

export function addSoulShards(
  state: NecromancerCoreState,
  stacks: number,
  at: number,
  duration = 10,
): number {
  purgeTimedState(state, at);
  const expiresAt = at + duration;
  state.soulShardExpiries = state.soulShardExpiries.map(() => expiresAt);
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
  state: NecromancerCoreState,
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
  const state = professionCoreState(context);
  const multiplier = hasTrait(context, TRAIT.GLUTTONY) ? 1.1 : 1;
  const before = state.lifeForce;
  state.lifeForce = Math.min(
    state.maximumLifeForce,
    state.lifeForce +
      ((Number(amount) * Number(state.maximumLifeForce || 100)) / 100) *
        multiplier,
  );
  syncNecromancerResources(state);
  if (state.lifeForce !== before && reason) emitState(context, at, reason);
  return state.lifeForce - before;
}

type CreatureSummonReaction = (
  context: NecromancerCastContext,
  skill: NecromancerSkill,
  at: number,
  count: number,
) => void;

const creatureSummonReactions = new WeakMap<
  object,
  Map<string, CreatureSummonReaction>
>();

/**
 * Registers an active module's reaction without making Core depend on that
 * module. Scheduler and cast contexts share the same state object.
 */
export function registerCreatureSummonReaction(
  context: NecromancerSchedulerContext,
  id: string,
  reaction: CreatureSummonReaction,
): void {
  let reactions = creatureSummonReactions.get(context.state);
  if (!reactions) {
    reactions = new Map();
    creatureSummonReactions.set(context.state, reactions);
  }
  reactions.set(id, reaction);
}

export function runCreatureSummonReactions(
  context: NecromancerCastContext,
  skill: NecromancerSkill,
  at: number,
  count = 1,
): void {
  for (const reaction of creatureSummonReactions.get(context.state)?.values() ||
    []) {
    reaction(context, skill, at, count);
  }
}
