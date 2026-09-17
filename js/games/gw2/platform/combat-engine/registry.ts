/**
 * Run-local combat state with the reference engine's iteration semantics.
 *
 * The pinned C++ engine stores state in EnTT 3.11 pools. Several systems
 * depend on the order those pools are visited (side-effect hooks, stack
 * removal, child-actor spawning), and that order is an artifact of EnTT's
 * sparse sets: entries are visited from the most recently packed to the
 * oldest, removal swaps the last entry into the freed slot, and a view walks
 * its smallest pool. Rather than a general ECS, this module keeps one typed
 * pool per component with exactly those three rules so the port can follow
 * upstream order without guessing. Entity identifiers also follow EnTT's
 * LIFO recycling with version bumps so reference names line up in diagnostics.
 */
import type {
  ComboField,
  CounterConfiguration,
  ConditionalSkillGroup,
  Effect,
  EffectApplication,
  Encounter,
  Rotation,
  SkillCast,
  AttributeConversion,
  AttributeModifier,
  Attribute,
  CooldownModifier,
  CounterModifier,
  EffectRemoval,
  Pair,
  Skill,
  SkillTrigger,
  UniqueEffect,
  WeaponPosition,
  WeaponSet,
  WeaponType
} from '#gw2/platform/combat-engine/configuration.js';
import type { RandomSource } from '#gw2/platform/combat-engine/rng.js';
import type { AuditEvent } from '#gw2/platform/combat-engine/types.js';

export type Entity = number;

/** Not an entity: counter dependencies, random predicates, and root membership changes invalidate every pair. */
export const ALL_ATTRIBUTE_PAIRS = -1;

const ENTITY_MASK = 0xfffff;
const VERSION_SHIFT = 20;
const VERSION_MASK = 0xfff;

/** A sparse-set pool: packed entities iterated newest-first, removed by swap-and-pop. */
export class Pool<T> {
  private readonly packed: Entity[] = [];
  private readonly values: T[] = [];
  private readonly slots = new Map<Entity, number>();

  /** Structural revisions invalidate derived indexes; mutable component values notify at their mutation site. */
  revision = 0;
  constructor(private readonly onChange?: (entity: Entity | undefined, previous?: unknown) => void) {}

  get size(): number {
    return this.packed.length;
  }

  has(entity: Entity): boolean {
    return this.slots.has(entity);
  }

  get(entity: Entity): T {
    const slot = this.slots.get(entity);
    if (slot === undefined) throw new Error(`Entity ${entity} is missing a required component.`);
    return this.values[slot];
  }

  tryGet(entity: Entity): T | undefined {
    const slot = this.slots.get(entity);
    return slot === undefined ? undefined : this.values[slot];
  }

  /** EnTT asserts on duplicate emplacement; the release reference build would corrupt state instead. */
  emplace(entity: Entity, value: T): T {
    if (this.slots.has(entity)) throw new Error(`Entity ${entity} already has this component.`);
    this.slots.set(entity, this.packed.length);
    this.packed.push(entity);
    this.values.push(value);
    this.revision += 1;
    this.onChange?.(entity);
    return value;
  }

  /** Replacement keeps the packed position, so iteration order does not change. */
  emplaceOrReplace(entity: Entity, value: T): T {
    const slot = this.slots.get(entity);
    if (slot === undefined) return this.emplace(entity, value);
    const previous = this.values[slot];
    this.values[slot] = value;
    this.revision += 1;
    this.onChange?.(entity, previous);
    return value;
  }

  getOrEmplace(entity: Entity, create: () => T): T {
    const slot = this.slots.get(entity);
    return slot === undefined ? this.emplace(entity, create()) : this.values[slot];
  }

  remove(entity: Entity): void {
    const slot = this.slots.get(entity);
    if (slot === undefined) return;
    const previous = this.values[slot];
    const last = this.packed.length - 1;
    if (slot !== last) {
      this.packed[slot] = this.packed[last];
      this.values[slot] = this.values[last];
      this.slots.set(this.packed[slot], slot);
    }

    this.packed.pop();
    this.values.pop();
    this.slots.delete(entity);
    this.revision += 1;
    this.onChange?.(entity, previous);
  }

  clear(): void {
    if (this.size === 0) return;
    this.packed.length = 0;
    this.values.length = 0;
    this.slots.clear();
    this.revision += 1;
    this.onChange?.(undefined);
  }

  /**
   * Visits entries newest-first. The start offset is captured up front, so
   * entries appended during the walk are skipped and removing the visited
   * entry is safe, matching EnTT iterator behavior.
   */
  forEach(visit: (entity: Entity, value: T) => void): void {
    for (let offset = this.packed.length; offset > 0; offset -= 1) {
      if (offset > this.packed.length) continue;
      const entity = this.packed[offset - 1];
      visit(entity, this.values[offset - 1]);
    }
  }

  /** Same order as `forEach`, allowing early exit for the reference's `break` loops. */
  *entries(): Generator<[Entity, T]> {
    for (let offset = this.packed.length; offset > 0; offset -= 1) {
      if (offset > this.packed.length) continue;
      yield [this.packed[offset - 1], this.values[offset - 1]];
    }
  }
}

/** Component pools that only mark an entity. */
export type Tag = true;

/**
 * Builds a multi-pool view like `registry.view<A, B>(exclude<C>)`: the
 * smallest required pool leads (first wins on ties) and the others filter.
 */
export function view(
  required: readonly Pool<unknown>[],
  excluded: readonly Pool<unknown>[] = []
): { forEach(visit: (entity: Entity) => void): void; entities(): Generator<Entity> } {
  let leading = required[0];
  for (const pool of required) {
    if (pool.size < leading.size) leading = pool;
  }

  const accepts = (entity: Entity) =>
    required.every((pool) => pool === leading || pool.has(entity)) && !excluded.some((pool) => pool.has(entity));

  return {
    forEach(visit) {
      leading.forEach((entity) => {
        if (accepts(entity)) visit(entity);
      });
    },
    *entities() {
      for (const [entity] of leading.entries()) {
        if (accepts(entity)) yield entity;
      }
    }
  };
}

export interface WeaponComponent {
  readonly type: WeaponType | null;
  readonly position: WeaponPosition | null;
  readonly set: WeaponSet | null;
}

export interface RotationComponent {
  readonly rotation: { readonly skillCasts: SkillCast[] };
  currentIndex: number;
  tickOffset: number;
  readonly repeat: boolean;
  readonly queuedRotation: SkillCast[];
}

export interface AnimationComponent {
  readonly skillEntity: Entity;
  readonly duration: Pair;
  progress: [number, number];
}

export interface CooldownComponent {
  readonly duration: Pair;
  progress: [number, number];
}

export interface DurationComponent {
  duration: number;
  progress: number;
}

export interface AmmoComponent {
  readonly maxAmmo: number;
  currentAmmo: number;
}

export interface SkillTickState {
  readonly skillEntity: Entity;
  skillTickProgress: number;
  nextSkillTickIndex: number;
  /** Keyed by roll group; the cast's own roll is group 0. */
  readonly weaponStrengthRollByGroup: Map<number, number>;
}

export interface SkillActionState {
  readonly skillEntity: Entity;
  readonly actionProgress: [number, number];
  nextStrikeIndex: number;
  nextPulseIndex: number;
  nextWhirlIndex: number;
  readonly weaponStrengthRoll: number;
}

export interface Strike {
  readonly skillEntity: Entity;
  numTargets: number;
  readonly flatDamage: number;
  readonly weaponStrength: number;
  readonly damageCoefficient: number;
  readonly canCriticalStrike: boolean;
  readonly onStrikeEffectApplications: readonly EffectApplication[];
  readonly tags: readonly string[];
}

export interface IncomingStrike {
  readonly sourceEntity: Entity;
  readonly strike: Strike;
  readonly isCritical: boolean;
}

/** An effect application in flight, stamped with the skill that produced it. */
export interface PendingEffectApplication extends Omit<EffectApplication, 'numTargets'> {
  readonly sourceSkill: string;
  numTargets: number;
}

export interface IncomingEffectApplication {
  readonly sourceEntity: Entity;
  readonly application: PendingEffectApplication;
  /** Duration actually applied, so auditing never recomputes against later attribute state. */
  durationMs?: number;
}

export interface IncomingDamageEvent {
  readonly tick: number;
  readonly sourceEntity: Entity;
  readonly effect: Effect | null;
  readonly skill: string;
  readonly value: number;
}

export interface BufferedConditionDamage {
  readonly effectSourceEntity: Entity;
  readonly effect: Effect;
  readonly sourceSkill: string;
  readonly damage: number;
}

export interface CounterState {
  value: number;
  readonly configuration: CounterConfiguration;
}

/** Attributes one actor has against each other actor, retained until an input changes. */
export type RelativeAttributes = Map<Entity, Map<Attribute, number>>;

export type AttributeDependency = 'health' | 'counter' | 'cooldown' | 'random';

/** Structural inputs observed by one attribute-holder index; value predicates have separate dirty markers. */
export interface AttributeHolderInputs {
  revision: number;
  holderRevision: number;
  readonly ownership: Set<Entity>;
  readonly stackOwners: Set<Entity>;
  ownerLed: boolean;
}

export interface Registry {
  tick: number;
  /** Simulated milliseconds per loop step; the reference uses 1. */
  readonly stepMs: number;
  readonly encounter: Encounter;
  readonly random: RandomSource;
  readonly detailed: boolean;
  readonly auditEvents: AuditEvent[];
  readonly afkTicksByActor: Map<string, number>;
  /** Dirty actor rows/columns, or ALL_ATTRIBUTE_PAIRS for inputs that cannot be localized. */
  readonly recalculateAttributes: Pool<Tag>;
  readonly attributeDependencies: Set<AttributeDependency>;
  readonly attributeHolderInputs: Map<Pool<unknown>, AttributeHolderInputs>;

  readonly isActor: Pool<Tag>;
  readonly actorCreated: Pool<Tag>;
  readonly team: Pool<number>;
  readonly baseClass: Pool<string>;
  readonly profession: Pool<string>;
  readonly currentWeaponSet: Pool<WeaponSet | null>;
  readonly staticAttributes: Pool<ReadonlyMap<Attribute, number>>;
  readonly equippedWeapons: Pool<readonly WeaponComponent[]>;
  /** Per root actor: the skill a whirl finisher spawns inside each combo field type. */
  readonly whirlFinisherSkills: Pool<ReadonlyMap<ComboField, string>>;
  readonly rotation: Pool<RotationComponent>;
  readonly noMoreRotation: Pool<Tag>;
  readonly alreadyPerformedRotation: Pool<Tag>;
  readonly destroyAfterRotation: Pool<Tag>;
  readonly animation: Pool<AnimationComponent>;
  readonly alreadyPerformedAnimation: Pool<Tag>;
  readonly animationExpired: Pool<Tag>;
  readonly isAfk: Pool<Tag>;
  readonly begunCastingSkills: Pool<Entity[]>;
  readonly finishedCastingSkills: Pool<Entity[]>;
  readonly skillsTicksTracker: Pool<SkillTickState[]>;
  readonly destroySkillsTicksTracker: Pool<Entity[]>;
  readonly skillsActions: Pool<SkillActionState[]>;
  readonly finishedSkillsActions: Pool<Entity[]>;
  readonly bundle: Pool<string>;
  readonly equippedBundle: Pool<string>;
  readonly droppedBundle: Pool<string>;
  readonly relativeAttributes: Pool<RelativeAttributes>;
  readonly combatStats: Pool<{ health: number }>;
  readonly combatStatsUpdated: Pool<Tag>;
  readonly isDownstate: Pool<Tag>;
  readonly hasQuickness: Pool<Tag>;
  readonly hasAlacrity: Pool<Tag>;
  readonly outgoingStrikes: Pool<Strike[]>;
  readonly incomingStrikes: Pool<IncomingStrike[]>;
  readonly outgoingEffects: Pool<PendingEffectApplication[]>;
  readonly incomingEffects: Pool<IncomingEffectApplication[]>;
  readonly incomingDamage: Pool<IncomingDamageEvent[]>;
  readonly bufferedConditionDamage: Pool<BufferedConditionDamage[]>;

  readonly owner: Pool<Entity>;
  readonly destroyEntity: Pool<Tag>;

  readonly isSkill: Pool<Skill>;
  readonly ammo: Pool<AmmoComponent>;
  readonly ammoGained: Pool<Tag>;
  readonly cooldown: Pool<CooldownComponent>;
  readonly cooldownExpired: Pool<Tag>;
  readonly alreadyFinishedCastingSkill: Pool<Tag>;
  readonly isConditionalSkillGroup: Pool<ConditionalSkillGroup>;
  readonly isPartOfConditionalSkillGroup: Pool<Entity>;

  readonly isEffect: Pool<{ readonly effect: Effect; readonly groupedWithNumStacks: number }>;
  readonly isDamagingEffect: Pool<Tag>;
  readonly isUniqueEffect: Pool<UniqueEffect>;
  readonly sourceActor: Pool<Entity>;
  readonly sourceSkill: Pool<string>;
  readonly duration: Pool<DurationComponent>;
  readonly durationExpired: Pool<Tag>;

  readonly isAttributeModifier: Pool<readonly AttributeModifier[]>;
  readonly isAttributeConversion: Pool<readonly AttributeConversion[]>;
  readonly isCounterModifier: Pool<readonly CounterModifier[]>;
  readonly isCooldownModifier: Pool<readonly CooldownModifier[]>;
  readonly isEffectRemoval: Pool<readonly EffectRemoval[]>;
  readonly isSkillTrigger: Pool<{ readonly skillTrigger: SkillTrigger; alreadyTriggered: boolean }>;
  readonly isUnchainedSkillTrigger: Pool<SkillTrigger>;
  readonly isSourceActorSkillTrigger: Pool<SkillTrigger>;
  readonly isCounter: Pool<CounterState>;

  /** Entity slots, holding the live identifier or the next free-list link. */
  readonly entityPool: Entity[];
  freeList: Entity | null;
  readonly names: Map<Entity, string>;
}

const poolLists = new WeakMap<Registry, Pool<unknown>[]>();

/** Every pool, so destroying an entity removes all of its components. Cached because destruction is frequent. */
function allPools(registry: Registry): Pool<unknown>[] {
  let pools = poolLists.get(registry);
  if (!pools) {
    pools = Object.values(registry).filter((value): value is Pool<unknown> => value instanceof Pool);
    poolLists.set(registry, pools);
  }

  return pools;
}

export function createRegistry(encounter: Encounter, random: RandomSource, detailed: boolean, stepMs = 1): Registry {
  const pool = <T>() => new Pool<T>();
  const recalculateAttributes = new Pool<Tag>();
  const attributeDependencies = new Set<AttributeDependency>();
  const attributeHolderInputs = new Map<Pool<unknown>, AttributeHolderInputs>();
  // Only effect components on a holder's immediate parent participate in considered-stack admission.
  const stackInput = <T>() =>
    new Pool<T>((entity) => {
      for (const [holders, inputs] of attributeHolderInputs) {
        if (inputs.holderRevision !== holders.revision) continue;
        if (entity === undefined || inputs.stackOwners.has(entity)) inputs.revision += 1;
      }

      markAttributesDirty(registry, entity);
    });
  const attributeInput = <T>(dependency?: AttributeDependency) =>
    new Pool<T>((entity) => {
      if (dependency === undefined || attributeDependencies.has(dependency)) {
        markAttributesDirty(registry, dependency === 'counter' ? undefined : entity);
      }
    });
  const registry: Registry = {
    tick: 0,
    stepMs,
    encounter,
    random,
    detailed,
    auditEvents: [],
    afkTicksByActor: new Map(),
    recalculateAttributes,
    attributeDependencies,
    attributeHolderInputs,
    isActor: new Pool((entity) => {
      if (entity === undefined || registry.staticAttributes.has(entity)) markAttributesDirty(registry);
    }),
    actorCreated: pool(),
    team: pool(),
    baseClass: pool(),
    profession: pool(),
    currentWeaponSet: attributeInput(),
    staticAttributes: new Pool((entity) => {
      // Adding or removing a root's static attributes changes the set of cached pairs.
      if (entity === undefined || !registry.staticAttributes.has(entity)) markAttributesDirty(registry);
      else markAttributesDirty(registry, entity);
    }),
    equippedWeapons: attributeInput(),
    whirlFinisherSkills: pool(),
    rotation: pool(),
    noMoreRotation: pool(),
    alreadyPerformedRotation: pool(),
    destroyAfterRotation: pool(),
    animation: pool(),
    alreadyPerformedAnimation: pool(),
    animationExpired: pool(),
    isAfk: pool(),
    begunCastingSkills: pool(),
    finishedCastingSkills: pool(),
    skillsTicksTracker: pool(),
    destroySkillsTicksTracker: pool(),
    skillsActions: pool(),
    finishedSkillsActions: pool(),
    bundle: attributeInput(),
    equippedBundle: pool(),
    droppedBundle: pool(),
    relativeAttributes: pool(),
    combatStats: attributeInput('health'),
    combatStatsUpdated: pool(),
    isDownstate: pool(),
    hasQuickness: pool(),
    hasAlacrity: pool(),
    outgoingStrikes: pool(),
    incomingStrikes: pool(),
    outgoingEffects: pool(),
    incomingEffects: pool(),
    incomingDamage: pool(),
    bufferedConditionDamage: pool(),
    owner: new Pool((entity, previous) => {
      for (const [holders, inputs] of attributeHolderInputs) {
        // A changed holder pool already requires rebuilding; its old dependency set needs no further notifications.
        if (inputs.holderRevision !== holders.revision) continue;
        // Ownership can change an ancestor, admit an ownerless holder, or change the view's leading pool/order.
        if (
          entity === undefined ||
          holders.has(entity) ||
          inputs.ownership.has(entity) ||
          inputs.ownerLed ||
          registry.owner.size <= holders.size
        )
          inputs.revision += 1;
      }

      if (entity !== undefined && registry.staticAttributes.has(entity)) markAttributesDirty(registry);
      else markAttributesDirty(registry, entity);
      if (typeof previous === 'number') markAttributesDirty(registry, previous);
    }),
    destroyEntity: pool(),
    isSkill: attributeInput('cooldown'),
    ammo: pool(),
    ammoGained: pool(),
    cooldown: attributeInput('cooldown'),
    cooldownExpired: pool(),
    alreadyFinishedCastingSkill: pool(),
    isConditionalSkillGroup: attributeInput(),
    isPartOfConditionalSkillGroup: pool(),
    isEffect: stackInput(),
    isDamagingEffect: pool(),
    isUniqueEffect: stackInput(),
    sourceActor: attributeInput(),
    sourceSkill: pool(),
    duration: pool(),
    durationExpired: pool(),
    isAttributeModifier: attributeInput(),
    isAttributeConversion: attributeInput(),
    isCounterModifier: pool(),
    isCooldownModifier: pool(),
    isEffectRemoval: pool(),
    isSkillTrigger: pool(),
    isUnchainedSkillTrigger: pool(),
    isSourceActorSkillTrigger: pool(),
    isCounter: attributeInput('counter'),
    entityPool: [],
    freeList: null,
    names: new Map()
  };
  return registry;
}

/** Actor-local inputs affect that actor as source or target; unseen roots and global inputs need a full rebuild. */
export function markAttributesDirty(registry: Registry, entity?: Entity): void {
  if (registry.recalculateAttributes.has(ALL_ATTRIBUTE_PAIRS)) return;
  if (entity === undefined) {
    registry.recalculateAttributes.emplaceOrReplace(ALL_ATTRIBUTE_PAIRS, true);
    return;
  }

  const actor = ownerOf(registry, entity);
  if (registry.staticAttributes.has(actor)) {
    registry.recalculateAttributes.emplaceOrReplace(
      registry.relativeAttributes.has(actor) ? actor : ALL_ATTRIBUTE_PAIRS,
      true
    );
  }
}

const entityIndex = (entity: Entity) => entity & ENTITY_MASK;
const entityVersion = (entity: Entity) => (entity >>> VERSION_SHIFT) & VERSION_MASK;
const combine = (index: number, version: number) => ((version << VERSION_SHIFT) | index) >>> 0;

/** Allocates an identifier, recycling the most recently destroyed slot first. */
export function createEntity(registry: Registry, name?: string): Entity {
  let entity: Entity;
  if (registry.freeList == null) {
    entity = registry.entityPool.length;
    registry.entityPool.push(entity);
  } else {
    const index = entityIndex(registry.freeList);
    const stored = registry.entityPool[index];
    const next = entityIndex(stored);
    registry.freeList = next === ENTITY_MASK ? null : next;
    entity = combine(index, entityVersion(stored));
    registry.entityPool[index] = entity;
  }

  // Names are keyed by full identifier and never overwritten, like `ctx().emplace_as`.
  if (name !== undefined && !registry.names.has(entity)) registry.names.set(entity, name);
  return entity;
}

export function isValidEntity(registry: Registry, entity: Entity): boolean {
  const index = entityIndex(entity);
  return index < registry.entityPool.length && registry.entityPool[index] === entity;
}

/** Removes every component, then releases the slot with a bumped version. */
export function destroyEntity(registry: Registry, entity: Entity): void {
  // Keep ownership available while removing dependent components so their invalidation reaches the former root.
  for (const pool of allPools(registry)) {
    if (pool !== registry.owner) pool.remove(entity);
  }

  registry.owner.remove(entity);
  const index = entityIndex(entity);
  let version = (entityVersion(entity) + 1) & VERSION_MASK;
  if (version === VERSION_MASK) version = 0;
  registry.entityPool[index] = combine(registry.freeList == null ? ENTITY_MASK : registry.freeList, version);
  registry.freeList = index;
}

export function entityName(registry: Registry, entity: Entity): string {
  return registry.names.get(entity) ?? 'temporary_entity';
}

/** Follows ownership to the root actor, as `utils::get_owner` does. */
export function ownerOf(registry: Registry, entity: Entity): Entity {
  let current = entity;
  while (registry.owner.has(current)) current = registry.owner.get(current);
  return current;
}

/** Rotation state for a rotation-driven actor or a temporary child actor. */
export function createRotationComponent(rotation: Rotation | null): RotationComponent {
  return {
    rotation: { skillCasts: rotation ? [...rotation.skillCasts] : [] },
    currentIndex: 0,
    tickOffset: 0,
    repeat: rotation?.repeat ?? false,
    queuedRotation: []
  };
}
