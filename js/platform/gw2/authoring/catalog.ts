import { createCanonicalCatalog } from '../../engine/skills/catalog.js';
import { toEntries } from '../../engine/core/collections.js';
import type {
  CanonicalCatalog,
  BalanceProfile,
  CatalogEntity,
  ProfessionModuleCatalogFragment,
  Skill,
  SkillFragment,
  SkillHandlerStrategy,
  SkillId
} from '../../engine/types.js';
import type {
  AnyNativeModule,
  NativeAutoattackChains,
  NativeCatalogOptions,
  NativeModuleCatalogData,
  NativeSkillHandlerRegistry
} from './module-types.js';
import { normalizeGw2ComboCatalogSkill } from '../combos/catalog.js';

interface NativeModuleDataSelection<TContext extends object> {
  readonly id: string;
  readonly generatedSkills?: readonly Skill[];
  readonly sharedExtraSkills?: readonly Skill[];
  readonly skillMechanics?: Readonly<Record<string, SkillFragment>>;
  readonly skillOverrides?: Readonly<Record<string, SkillFragment>>;
  readonly extraSkills?: readonly Skill[];
  readonly balanceProfiles?: readonly BalanceProfile[];
  readonly handlers?: NativeSkillHandlerRegistry<TContext>;
  readonly traits?: readonly CatalogEntity[];
  readonly specializations?: readonly CatalogEntity[];
  readonly weapons?: readonly string[];
  readonly weaponHands?: ReadonlyMap<string, string> | Readonly<Record<string, string>>;
  readonly autoattackChains?: NativeAutoattackChains;
  readonly skillNameOverrides?: Readonly<Record<string, SkillId>>;
  readonly specializationOnlySkillIds?: readonly SkillId[];
  readonly specializationOnlySkillOwners?: Readonly<Record<string, string>>;
}

// Resolves which module owns an entity by matching its .specialization field
// against the elite spec names. Falls back to "Core" when there's no match,
// so base-game skills and traits always land in the Core module.
function canonicalModuleName(value: object, specializations: readonly CatalogEntity[]): string {
  const specialization = String((value as { readonly specialization?: string }).specialization || '').toLowerCase();
  return specializations.find((entry) => entry.elite && entry.name.toLowerCase() === specialization)?.name || 'Core';
}

/**
 * Selects generated identity metadata for one semantic owner while retaining
 * the module's locally authored mechanics, handlers, and extra skills.
 */
export function createNativeModuleData<TContext extends object>({
  id,
  generatedSkills = [],
  sharedExtraSkills = [],
  skillMechanics = {},
  skillOverrides = {},
  extraSkills = [],
  balanceProfiles = [],
  handlers,
  traits = [],
  specializations = [],
  weapons = [],
  weaponHands = {},
  autoattackChains,
  skillNameOverrides,
  specializationOnlySkillIds = [],
  specializationOnlySkillOwners = {}
}: NativeModuleDataSelection<TContext>): NativeModuleCatalogData<TContext> {
  const forced = new Set(specializationOnlySkillIds.map(String));
  const ownsSkill = (skill: Skill): boolean => {
    // specializationOnlySkillOwners can pin specific skill IDs to a module,
    // overriding the automatic elite-spec-name-based ownership resolution.
    const forcedOwner = specializationOnlySkillOwners[String(skill.id)];

    if (forcedOwner) return forcedOwner === id;

    if (forced.has(String(skill.id))) return true;
    return canonicalModuleName(skill, specializations) === id;
  };

  const generated = generatedSkills.filter(ownsSkill);
  const sharedExtra = sharedExtraSkills.filter(ownsSkill);
  const generatedIds = new Set(generated.map((skill) => String(skill.id)));
  // Restrict skillOverrides to skills this module actually owns — prevents one
  // module from patching another module's generated skills.
  const localOverrides = Object.fromEntries(
    Object.entries(skillOverrides).filter(([skillId]) => generatedIds.has(String(skillId)))
  );
  return Object.freeze({
    generatedSkills: Object.freeze(generated),
    generatedSkillOrder: new Map(generated.map((skill) => [skill.id, generatedSkills.indexOf(skill)])),
    skillMechanics: Object.freeze({ ...skillMechanics }),
    skillOverrides: Object.freeze(localOverrides),
    extraSkills: Object.freeze([...sharedExtra, ...extraSkills]),
    balanceProfiles: Object.freeze([...balanceProfiles]),
    sharedExtraSkillOrder: new Map(sharedExtra.map((skill) => [skill.id, sharedExtraSkills.indexOf(skill)])),
    traits: Object.freeze(traits.filter((trait) => canonicalModuleName(trait, specializations) === id)),
    specializations: Object.freeze(
      specializations.filter((specialization) => (specialization.elite ? specialization.name === id : id === 'Core'))
    ),
    ...(handlers == null ? {} : { handlers }),
    ...(weapons.length ? { weapons: Object.freeze([...weapons]) } : {}),
    ...(weaponHands instanceof Map || Object.keys(weaponHands).length ? { weaponHands } : {}),
    ...(autoattackChains == null ? {} : { autoattackChains }),
    ...(skillNameOverrides == null ? {} : { skillNameOverrides: Object.freeze({ ...skillNameOverrides }) }),
    ...(specializationOnlySkillIds.length
      ? {
          specializationOnlySkillIds: Object.freeze([...specializationOnlySkillIds])
        }
      : {})
  });
}

export interface AssembledNativeCatalog {
  readonly catalog: Readonly<CanonicalCatalog>;
  readonly fragments: ReadonlyMap<string, Readonly<ProfessionModuleCatalogFragment>>;
  readonly skillOwners: ReadonlyMap<SkillId, string>;
}

interface AssemblyCacheEntry {
  readonly modules: readonly AnyNativeModule[];
  readonly options: NativeCatalogOptions | undefined;
  readonly assembly: AssembledNativeCatalog;
}

const assemblyCache = new WeakMap<AnyNativeModule, AssemblyCacheEntry[]>();

function mergeEntityArrays<T extends CatalogEntity>(
  modules: readonly AnyNativeModule[],
  select: (module: AnyNativeModule) => readonly T[],
  label: string
): { readonly values: T[]; readonly owners: Map<SkillId, string> } {
  const values: T[] = [];
  const owners = new Map<SkillId, string>();
  for (const module of modules) {
    for (const entity of select(module)) {
      const prior = owners.get(entity.id);

      if (prior) {
        throw new TypeError(`Duplicate ${label} ${String(entity.id)} in ${prior} and ${module.id}.`);
      }

      owners.set(entity.id, module.id);
      values.push(entity);
    }
  }

  return { values, owners };
}

// Mutates skillsByName after the catalog is otherwise frozen. This is a
// controlled exception: name overrides must be applied post-assembly because
// they depend on the canonical skill objects the assembly produced.
// Validates that the override key matches the skill's actual name to prevent
// remapping to unrelated skills.
function applySkillNameOverrides(
  catalog: Readonly<CanonicalCatalog>,
  overrides: Readonly<Record<string, SkillId>> | undefined
): void {
  for (const [name, skillId] of Object.entries(overrides || {})) {
    const skill = catalog.skillsById.get(skillId);

    if (!skill) {
      throw new TypeError(`Unknown skill-name override ${name}: ${String(skillId)}.`);
    }

    if (skill.name !== name) {
      throw new TypeError(`Skill-name override ${name} points to ${skill.name} (${String(skillId)}).`);
    }

    (catalog.skillsByName as Map<string, Skill>).set(name, skill);
  }
}

// After merging entity arrays from multiple modules, the insertion order is
// per-module rather than per-position in the original shared array. This restores
// the original position ordering so that catalog.skills has a stable, predictable
// sequence regardless of module declaration order.
function restoreSharedSourceOrder(
  values: CatalogEntity[],
  modules: readonly AnyNativeModule[],
  select: (module: AnyNativeModule) => ReadonlyMap<SkillId, number> | undefined
): void {
  const positions = new Map<SkillId, number>();
  for (const module of modules) {
    for (const [id, position] of select(module) || []) {
      positions.set(id, position);
    }
  }

  values.sort(
    (left, right) =>
      (positions.get(left.id) ?? Number.POSITIVE_INFINITY) - (positions.get(right.id) ?? Number.POSITIVE_INFINITY)
  );
}

function composeNativeCatalog(
  modules: readonly AnyNativeModule[],
  options: NativeCatalogOptions | undefined
): AssembledNativeCatalog {
  const moduleIds = new Set(modules.map((module) => module.id));

  if (modules[0]?.id !== 'Core') {
    throw new TypeError('Native profession modules must begin with "Core".');
  }

  if (moduleIds.size !== modules.length) {
    throw new TypeError('Native profession module IDs must be unique.');
  }

  const generated = mergeEntityArrays(modules, (module) => module.data.generatedSkills || [], 'generated skill id');
  const extras = mergeEntityArrays(modules, (module) => module.data.extraSkills || [], 'extra skill id');
  const balanceProfiles = mergeEntityArrays(
    modules,
    (module) => module.data.balanceProfiles || [],
    'balance profile id'
  );
  restoreSharedSourceOrder(generated.values, modules, (module) => module.data.generatedSkillOrder);
  restoreSharedSourceOrder(extras.values, modules, (module) => module.data.sharedExtraSkillOrder);
  const traits = mergeEntityArrays(modules, (module) => module.data.traits || [], 'trait id');
  const specializations = mergeEntityArrays(
    modules,
    (module) => module.data.specializations || [],
    'specialization id'
  );
  const mechanics: Record<string, SkillFragment> = {};
  const mechanicsOwners = new Map<string, string>();
  const overrides: Record<string, SkillFragment> = {};
  const overrideOwners = new Map<string, string>();
  const handlers = new Map<string, SkillHandlerStrategy<object>>();
  const handlerOwners = new Map<string, string>();
  const exclusiveOwners = new Map<string, string>();
  const weapons = new Set<string>();
  const weaponHands = new Map<string, string>();
  const weaponHandOwners = new Map<string, string>();
  const additionalChains: Array<{ owner: string; chain: readonly SkillId[] }> = [];
  const excludedChains: Array<{ owner: string; skillId: SkillId }> = [];

  for (const module of modules) {
    for (const [skillId, mechanic] of Object.entries(module.data.skillMechanics || {})) {
      const prior = mechanicsOwners.get(skillId);

      if (prior) {
        throw new TypeError(`Duplicate skill mechanics ${skillId} in ${prior} and ${module.id}.`);
      }

      mechanicsOwners.set(skillId, module.id);
      mechanics[skillId] = mechanic;
    }

    for (const [skillId, override] of Object.entries(module.data.skillOverrides || {})) {
      const prior = overrideOwners.get(skillId);

      if (prior) {
        throw new TypeError(`Duplicate skill override ${skillId} in ${prior} and ${module.id}.`);
      }

      overrideOwners.set(skillId, module.id);
      overrides[skillId] = override;
    }

    for (const [handlerId, handler] of toEntries(
      module.data.handlers as NativeSkillHandlerRegistry<object> | undefined
    )) {
      const prior = handlerOwners.get(handlerId);

      if (prior) {
        throw new TypeError(`Duplicate skill handler ${handlerId} in ${prior} and ${module.id}.`);
      }

      handlerOwners.set(handlerId, module.id);
      handlers.set(handlerId, handler);
    }

    for (const skillId of module.data.specializationOnlySkillIds || []) {
      const key = String(skillId);
      const prior = exclusiveOwners.get(key);

      if (prior) {
        throw new TypeError(`Duplicate specialization-only skill ${key} in ${prior} and ${module.id}.`);
      }

      exclusiveOwners.set(key, module.id);
    }

    for (const weapon of module.data.weapons || []) weapons.add(weapon);
    for (const [weapon, hand] of toEntries(module.data.weaponHands)) {
      const prior = weaponHandOwners.get(weapon);

      if (prior) {
        throw new TypeError(`Duplicate weapon-hand entry ${weapon} in ${prior} and ${module.id}.`);
      }

      weaponHandOwners.set(weapon, module.id);
      weaponHands.set(weapon, hand);
    }

    for (const chain of module.data.autoattackChains?.additional || []) {
      additionalChains.push({ owner: module.id, chain });
    }

    for (const skillId of module.data.autoattackChains?.excludeSkillIds || []) {
      excludedChains.push({ owner: module.id, skillId });
    }
  }

  const catalog = createCanonicalCatalog({
    generated: generated.values as Skill[],
    mechanics,
    overrides,
    extraSkills: extras.values as Skill[],
    balanceProfiles: balanceProfiles.values,
    skillHandlers: handlers,
    traits: traits.values,
    specializations: specializations.values,
    weapons: [...weapons],
    weaponHands,
    autoattackChains: {
      additional: additionalChains.map((entry) => entry.chain),
      excludeSkillIds: excludedChains.map((entry) => entry.skillId)
    },
    skillNameCollision: options?.skillNameCollision,
    skillNormalizer: normalizeGw2ComboCatalogSkill
  });
  applySkillNameOverrides(catalog, options?.skillNameOverrides);

  const eliteNames = new Map(
    catalog.specializations
      .filter((specialization) => specialization.elite)
      .map((specialization) => [specialization.name.toLowerCase(), specialization.name])
  );
  const declaredOwners = new Map<SkillId, string>([...generated.owners, ...extras.owners]);
  const skillOwners = new Map<SkillId, string>();
  // Skill ownership resolution priority:
  //   1. specializationOnly explicit pin
  //   2. Weapon-type skills always go to Core (shared by all specs)
  //   3. Elite spec name on the skill
  //   4. Module that contributed the skill (generated or extra)
  //   5. Module that declared the skill's mechanics
  //   6. Core as final fallback
  for (const skill of catalog.skills) {
    const explicit = exclusiveOwners.get(String(skill.id));
    const specialization = eliteNames.get(String(skill.specialization || '').toLowerCase());
    const mechanicOwner = mechanicsOwners.get(String(skill.id));
    const owner =
      explicit ||
      (skill.type === 'Weapon' ? 'Core' : null) ||
      specialization ||
      declaredOwners.get(skill.id) ||
      mechanicOwner ||
      'Core';

    if (!moduleIds.has(owner)) {
      throw new TypeError(`Skill ${String(skill.id)} resolves to unknown runtime module ${owner}.`);
    }

    skillOwners.set(skill.id, owner);
  }

  for (const [skillId, owner] of exclusiveOwners) {
    if (!catalog.skillsById.has(Number(skillId))) {
      throw new TypeError(`${owner} declares unknown specialization-only skill ${skillId}.`);
    }
  }

  // Each handler must be owned by the same module as the skills that use it.
  // Core handlers may serve skills in any module (since Core is the base layer),
  // but a non-Core handler must not cross into another module's skills.
  for (const [handlerId, owner] of handlerOwners) {
    const referencedOwners = new Set(
      catalog.skills.filter((skill) => skill.handlerId === handlerId).map((skill) => skillOwners.get(skill.id))
    );

    if (!referencedOwners.size) {
      throw new TypeError(`Skill handler ${handlerId} is unused.`);
    }

    if (
      (owner === 'Core' && !referencedOwners.has('Core')) ||
      (owner !== 'Core' && (referencedOwners.size !== 1 || !referencedOwners.has(owner)))
    ) {
      throw new TypeError(
        `Skill handler ${handlerId} is contributed by ${owner}, but its skills ` +
          `are available in ${[...referencedOwners].join(', ')}.`
      );
    }
  }

  const chainContributions = new Map<string, NativeAutoattackChains>();
  for (const module of modules) {
    chainContributions.set(module.id, { additional: [], excludeSkillIds: [] });
  }

  // Each autoattack chain must be entirely within one runtime module — a chain
  // that spans Core and a spec module would be impossible to schedule correctly.
  for (const { owner: declarationOwner, chain } of additionalChains) {
    const owners = new Set(chain.map((skillId) => skillOwners.get(skillId)));

    if (owners.size !== 1 || owners.has(undefined)) {
      throw new TypeError(`${declarationOwner} autoattack chain crosses runtime module ownership.`);
    }

    const owner = [...owners][0] as string;
    const current = chainContributions.get(owner)!;
    chainContributions.set(owner, {
      ...current,
      additional: [...(current.additional || []), chain]
    });
  }

  for (const { skillId } of excludedChains) {
    const owner = skillOwners.get(skillId);

    if (!owner) throw new TypeError(`Unknown excluded autoattack skill ${String(skillId)}.`);
    const current = chainContributions.get(owner)!;
    chainContributions.set(owner, {
      ...current,
      excludeSkillIds: [...(current.excludeSkillIds || []), skillId]
    });
  }

  const fragments = new Map<string, Readonly<ProfessionModuleCatalogFragment>>();
  for (const module of modules) {
    const moduleHandlers = new Map([...handlers].filter(([handlerId]) => handlerOwners.get(handlerId) === module.id));
    const hands = new Map([...weaponHands].filter(([weapon]) => weaponHandOwners.get(weapon) === module.id));
    const chains = chainContributions.get(module.id)!;
    // Module-local selections resolve active specialization collisions; global overrides remain Core-owned.
    const skillNameOverrides = {
      ...(module.data.skillNameOverrides || {}),
      ...(module.id === 'Core' ? options?.skillNameOverrides || {} : {})
    };
    fragments.set(
      module.id,
      Object.freeze({
        skills: Object.freeze(catalog.skills.filter((skill) => skillOwners.get(skill.id) === module.id)),
        balanceProfiles: Object.freeze(
          catalog.balanceProfiles.filter((profile) => balanceProfiles.owners.get(profile.id) === module.id)
        ),
        skillHandlers: moduleHandlers,
        traits: Object.freeze(catalog.traits.filter((trait) => traits.owners.get(trait.id) === module.id)),
        specializations: Object.freeze(
          catalog.specializations.filter(
            (specialization) => specializations.owners.get(specialization.id) === module.id
          )
        ),
        weapons: Object.freeze([...weapons].filter((weapon) => module.data.weapons?.includes(weapon))),
        weaponHands: hands,
        autoattackChains: Object.freeze(chains),
        ...(Object.keys(skillNameOverrides).length ? { skillNameOverrides: Object.freeze(skillNameOverrides) } : {}),
        ...(module.id === 'Core'
          ? {
              skillNameCollision: options?.skillNameCollision
            }
          : {})
      } as ProfessionModuleCatalogFragment)
    );
  }

  return Object.freeze({ catalog, fragments, skillOwners });
}

// Caches assembled catalogs keyed by the first (Core) module so the expensive
// composition step is only run once per unique combination of modules+options.
// The WeakMap entry is tied to the Core module's lifetime, so cache entries are
// automatically freed when the profession is garbage collected.
/** Assembles and caches the validated catalog and skill ownership for a native module set. */
export function getNativeCatalogAssembly(
  modules: readonly AnyNativeModule[],
  options: NativeCatalogOptions | undefined
): AssembledNativeCatalog {
  const first = modules[0];

  if (!first) throw new TypeError('A native profession requires modules.');
  const cached = assemblyCache.get(first) || [];
  const match = cached.find(
    (entry) =>
      entry.options === options &&
      entry.modules.length === modules.length &&
      entry.modules.every((module, index) => module === modules[index])
  );

  if (match) return match.assembly;
  const assembly = composeNativeCatalog(modules, options);
  cached.push({ modules: [...modules], options, assembly });
  assemblyCache.set(first, cached);
  return assembly;
}

/** Derives the complete application catalog from module contributions. */
export function assembleNativeApplicationCatalog(
  modules: readonly AnyNativeModule[],
  options?: NativeCatalogOptions
): Readonly<CanonicalCatalog> {
  return getNativeCatalogAssembly(modules, options).catalog;
}

/** Returns the native module label that owns a skill's runtime behavior. */
export function nativeSkillRuntimeOwner(
  modules: readonly AnyNativeModule[],
  skill: Skill,
  options?: NativeCatalogOptions
): string {
  return getNativeCatalogAssembly(modules, options).skillOwners.get(skill.id) || 'Core';
}
