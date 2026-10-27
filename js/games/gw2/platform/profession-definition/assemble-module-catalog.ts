import { traitBalanceProfiles } from '#gw2/platform/profession-definition/traits.js';
import { createCanonicalCatalog, type AutoattackChainOptions } from '#gw2/platform/skills/catalog.js';
import { toEntries } from '#kernel/core/collections.js';
import type { CanonicalCatalog, CatalogEntity, Skill, SkillId } from '#gw2/platform/skills/types.js';
import type { ProfessionModuleCatalogFragment } from '#gw2/platform/profession-definition/types.js';
import type { AnyNativeModule, NativeModuleCatalogData } from '#gw2/platform/profession-definition/module-types.js';
import { normalizeGw2ComboCatalogSkill } from '#gw2/platform/combos/catalog.js';
import { combineSkillFields, type SkillFieldSpecs } from '#gw2/platform/skills/field-specs.js';

/** Selects a module from shared input using the same catalog fields as its output. */
export interface NativeModuleDataSelection<TSkill extends Skill = Skill> extends NativeModuleCatalogData<TSkill> {
  readonly id: string;
  readonly sharedExtraSkills?: readonly TSkill[];
}

// Resolves which module owns an entity by matching its .specialization field
// against the elite spec names. Falls back to "Core" when there's no match,
// so base-game skills and traits always land in the Core module.
function canonicalModuleName(value: object, specializations: readonly CatalogEntity[]): string {
  const specialization = ((value as { readonly specialization?: string }).specialization || '').toLowerCase();
  return specializations.find((entry) => entry.elite && entry.name.toLowerCase() === specialization)?.name || 'Core';
}

/**
 * Selects generated identity metadata for one semantic owner while retaining
 * the module's locally authored mechanics and extra skills.
 */
export function createNativeModuleData<TSkill extends Skill = Skill>(
  selection: NativeModuleDataSelection<TSkill>
): NativeModuleCatalogData<TSkill> {
  // Reject obsolete module tuning before selection could silently discard it.
  if (Object.hasOwn(selection, 'balanceProfiles')) {
    throw new TypeError('Module data.balanceProfiles is not supported; declare skill tuning or traitDefinitions.');
  }

  const {
    id,
    generatedSkills = [],
    sharedExtraSkills = [],
    skillMechanics = {},
    skillOverrides = {},
    extraSkills = [],
    skillFields,
    traits = [],
    specializations = [],
    weapons = [],
    weaponHands = {},
    autoattackChains,
    specializationOnlySkillIds = []
  } = selection;
  // Treat authored mechanics as the support allowlist so raw API metadata cannot
  // enter the simulator merely because a new skill is absent from an exclusion list.
  // The declaration owns admission because API specialization labels can be stale.
  const authoredSkillIds = new Set(Object.keys(skillMechanics));
  const isAuthored = (skill: Skill): boolean => authoredSkillIds.has(String(skill.id));
  const generated = generatedSkills.filter(isAuthored);
  const sharedExtra = sharedExtraSkills.filter(isAuthored);
  const generatedIds = new Set(generated.map((skill) => String(skill.id)));
  // Restrict skillOverrides to skills this module actually owns — prevents one
  // module from patching another module's generated skills.
  const localOverrides = Object.fromEntries(
    Object.entries(skillOverrides).filter(([skillId]) => generatedIds.has(skillId))
  );
  return Object.freeze({
    generatedSkills: Object.freeze(generated),
    generatedSkillOrder: new Map(generated.map((skill) => [skill.id, generatedSkills.indexOf(skill)])),
    skillMechanics: Object.freeze({ ...skillMechanics }),
    skillOverrides: Object.freeze(localOverrides),
    extraSkills: Object.freeze([...sharedExtra, ...extraSkills]),
    ...(skillFields == null ? {} : { skillFields }),
    sharedExtraSkillOrder: new Map(sharedExtra.map((skill) => [skill.id, sharedExtraSkills.indexOf(skill)])),
    traits: Object.freeze(traits.filter((trait) => canonicalModuleName(trait, specializations) === id)),
    specializations: Object.freeze(
      specializations.filter((specialization) => (specialization.elite ? specialization.name === id : id === 'Core'))
    ),
    ...(weapons.length ? { weapons: Object.freeze([...weapons]) } : {}),
    ...(weaponHands instanceof Map || Object.keys(weaponHands).length ? { weaponHands } : {}),
    ...(autoattackChains == null ? {} : { autoattackChains }),
    ...(specializationOnlySkillIds.length
      ? {
          specializationOnlySkillIds: Object.freeze([...specializationOnlySkillIds])
        }
      : {})
  });
}

interface AssembledNativeCatalog<TSkill extends Skill = Skill> {
  readonly catalog: Readonly<CanonicalCatalog<TSkill>>;
  readonly fragments: ReadonlyMap<string, Readonly<ProfessionModuleCatalogFragment<TSkill>>>;
}

interface AssemblyCacheEntry {
  readonly modules: readonly object[];
  readonly assembly: AssembledNativeCatalog;
}

const assemblyCache = new WeakMap<object, AssemblyCacheEntry[]>();

function mergeEntityArrays<T extends CatalogEntity, TSkill extends Skill>(
  modules: readonly AnyNativeModule<string, TSkill>[],
  select: (module: AnyNativeModule<string, TSkill>) => readonly T[],
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

// After merging entity arrays from multiple modules, the insertion order is
// per-module rather than per-position in the original shared array. This restores
// the original position ordering so that catalog.skills has a stable, predictable
// sequence regardless of module declaration order.
function restoreSharedSourceOrder<TSkill extends Skill>(
  values: CatalogEntity[],
  modules: readonly AnyNativeModule<string, TSkill>[],
  select: (module: AnyNativeModule<string, TSkill>) => ReadonlyMap<SkillId, number> | undefined
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

function composeNativeCatalog<TSkill extends Skill>(
  modules: readonly AnyNativeModule<string, TSkill>[]
): AssembledNativeCatalog<TSkill> {
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
    (module) => traitBalanceProfiles(module.traitDefinitions ?? []),
    'balance profile id'
  );
  restoreSharedSourceOrder(generated.values, modules, (module) => module.data.generatedSkillOrder);
  restoreSharedSourceOrder(extras.values, modules, (module) => module.data.sharedExtraSkillOrder);
  const traits = mergeEntityArrays(modules, (module) => module.data.traits || [], 'trait id');
  // A profession field has one declaring module; the combined table validates every module's skills.
  const skillFields: SkillFieldSpecs = combineSkillFields(
    modules.map((module) => ({ owner: module.id, fields: module.data.skillFields }))
  );
  const specializations = mergeEntityArrays(
    modules,
    (module) => module.data.specializations || [],
    'specialization id'
  );
  const mechanics: Record<string, Partial<TSkill>> = {};
  const mechanicsOwners = new Map<string, string>();
  const overrides: Record<string, Partial<TSkill>> = {};
  const overrideOwners = new Map<string, string>();
  const exclusiveOwners = new Map<string, string>();
  const weapons = new Set<string>();
  const weaponHands = new Map<string, string>();
  const weaponHandOwners = new Map<string, string>();
  const additionalChains: Array<{ owner: string; chain: readonly SkillId[] }> = [];
  const excludedChains: SkillId[] = [];

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
      excludedChains.push(skillId);
    }
  }

  const catalog = createCanonicalCatalog({
    generated: generated.values,
    mechanics,
    overrides,
    extraSkills: extras.values,
    balanceProfiles: balanceProfiles.values,
    traits: traits.values,
    specializations: specializations.values,
    weapons: [...weapons],
    weaponHands,
    autoattackChains: {
      additional: additionalChains.map((entry) => entry.chain),
      excludeSkillIds: excludedChains
    },
    skillNormalizer: normalizeGw2ComboCatalogSkill,
    skillFields
  });

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
    const specialization = eliteNames.get((skill.specialization || '').toLowerCase());
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

  const chainContributions = new Map<string, AutoattackChainOptions>();
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

  for (const skillId of excludedChains) {
    const owner = skillOwners.get(skillId);

    if (!owner) throw new TypeError(`Unknown excluded autoattack skill ${String(skillId)}.`);

    const current = chainContributions.get(owner)!;
    chainContributions.set(owner, {
      ...current,
      excludeSkillIds: [...(current.excludeSkillIds || []), skillId]
    });
  }

  const fragments = new Map<string, Readonly<ProfessionModuleCatalogFragment<TSkill>>>();
  for (const module of modules) {
    const hands = new Map([...weaponHands].filter(([weapon]) => weaponHandOwners.get(weapon) === module.id));
    const chains = chainContributions.get(module.id)!;
    fragments.set(
      module.id,
      Object.freeze({
        skills: Object.freeze(catalog.skills.filter((skill) => skillOwners.get(skill.id) === module.id)),
        skillFields,
        balanceProfiles: Object.freeze(
          catalog.balanceProfiles.filter((profile) => balanceProfiles.owners.get(profile.id) === module.id)
        ),
        traits: Object.freeze(catalog.traits.filter((trait) => traits.owners.get(trait.id) === module.id)),
        specializations: Object.freeze(
          catalog.specializations.filter(
            (specialization) => specializations.owners.get(specialization.id) === module.id
          )
        ),
        weapons: Object.freeze([...weapons].filter((weapon) => module.data.weapons?.includes(weapon))),
        weaponHands: hands,
        autoattackChains: Object.freeze(chains)
      } satisfies ProfessionModuleCatalogFragment<TSkill>)
    );
  }

  return Object.freeze({ catalog, fragments });
}

// Caches assembled catalogs keyed by the first (Core) module so the expensive
// composition step is only run once per unique module selection.
// The WeakMap entry is tied to the Core module's lifetime, so cache entries are
// automatically freed when the profession is garbage collected.
/** Assembles and caches the validated catalog and skill ownership for a native module set. */
export function getNativeCatalogAssembly<TSkill extends Skill>(
  modules: readonly AnyNativeModule<string, TSkill>[]
): AssembledNativeCatalog<TSkill> {
  const first = modules[0];

  if (!first) throw new TypeError('A native profession requires modules.');

  const cached = assemblyCache.get(first) || [];
  const match = cached.find(
    (entry) =>
      entry.modules.length === modules.length && entry.modules.every((module, index) => module === modules[index])
  );

  // Identity-matched modules retain the skill type used when this cache entry was assembled.
  if (match) return match.assembly as AssembledNativeCatalog<TSkill>;

  const assembly = composeNativeCatalog(modules);
  cached.push({ modules: [...modules], assembly });
  assemblyCache.set(first, cached);
  return assembly;
}

/** Derives the complete application catalog from module contributions. */
export function assembleNativeApplicationCatalog<TSkill extends Skill>(
  modules: readonly AnyNativeModule<string, TSkill>[]
): Readonly<CanonicalCatalog<TSkill>> {
  return getNativeCatalogAssembly(modules).catalog;
}

/** Builds the active catalog from validated ownership fragments, retaining shared elite-authored weapon skills. */
export function assembleNativeRuntimeCatalog<TSkill extends Skill>(
  fragments: readonly Readonly<ProfessionModuleCatalogFragment<TSkill>>[]
): Readonly<CanonicalCatalog<TSkill>> {
  // Entity and weapon-hand ownership was validated once during full application assembly.
  const catalog = createCanonicalCatalog({
    generated: fragments.flatMap((fragment) => fragment.skills || []),
    // Fragments share one profession-wide table; any fragment supplies it.
    skillFields: fragments.find((fragment) => fragment.skillFields)?.skillFields,
    balanceProfiles: fragments.flatMap((fragment) => fragment.balanceProfiles || []),
    traits: fragments.flatMap((fragment) => fragment.traits || []),
    specializations: fragments.flatMap((fragment) => fragment.specializations || []),
    weapons: [...new Set(fragments.flatMap((fragment) => fragment.weapons || []))],
    weaponHands: new Map(fragments.flatMap((fragment) => [...toEntries(fragment.weaponHands)])),
    autoattackChains: {
      additional: fragments.flatMap((fragment) => fragment.autoattackChains?.additional || []),
      excludeSkillIds: [...new Set(fragments.flatMap((fragment) => fragment.autoattackChains?.excludeSkillIds || []))]
    }
  });
  return catalog;
}
