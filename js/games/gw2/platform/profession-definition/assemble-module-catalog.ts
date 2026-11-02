import { normalizeGw2ComboCatalogSkill } from '#gw2/platform/combos/catalog.js';
import { prepareCatalogActionRequirements } from '#gw2/platform/effects/action-declarations.js';
import type { AnyNativeModule, NativeModuleCatalogData } from '#gw2/platform/profession-definition/module-types.js';
import { traitBalanceProfiles } from '#gw2/platform/profession-definition/traits.js';
import type { ProfessionModuleCatalogFragment } from '#gw2/platform/profession-definition/types.js';
import { createCanonicalCatalog } from '#gw2/platform/skills/catalog.js';
import { combineFields, type FieldSpecs } from '#gw2/platform/skills/field-specs.js';
import type { SkillFlipDefinition, SkillFlips } from '#gw2/platform/skills/skill-flip-definitions.js';
import type { CanonicalCatalog, CatalogEntity, Skill, SkillId } from '#gw2/platform/skills/types.js';
import { validateCanonicalCatalog } from '#gw2/platform/skills/validation.js';
import { toEntries } from '#kernel/core/collections.js';

/** Selects a module from shared input using the same catalog fields as its output. */
export interface NativeModuleDataSelection<TSkill extends Skill = Skill> extends Omit<
  NativeModuleCatalogData<TSkill>,
  'traits'
> {
  readonly id: string;
}

const MODULE_DATA_FIELDS = new Set([
  'id',
  'skills',
  'skillFields',
  'profileFields',
  'traitLines',
  'weapons',
  'weaponHands',
  'autoattackChains',
  'skillFlips'
]);

/** Select complete module skill declarations and trait-line ownership before catalog compilation. */
export function createNativeModuleData<TSkill extends Skill = Skill>(
  selection: NativeModuleDataSelection<TSkill>
): NativeModuleCatalogData<TSkill> {
  // Reject unsupported input rather than silently discarding declarations from an untyped caller.
  for (const field of Object.keys(selection))
    if (!MODULE_DATA_FIELDS.has(field)) throw new TypeError(`Unsupported native module data field: ${field}.`);

  const {
    id,
    skills = [],
    skillFields,
    profileFields,
    traitLines = [],
    weapons = [],
    weaponHands = {},
    autoattackChains,
    skillFlips
  } = selection;
  // Missing presentation is an authoring error; module assembly never consults a second skill catalog.
  for (const skill of skills) {
    for (const field of ['name', 'icon'] as const) {
      if (typeof skill[field] !== 'string' || !skill[field].trim()) {
        throw new TypeError(`${id} skill ${skill.id} requires an authored ${field}.`);
      }
    }
  }

  // Trait-line layout supplies both trait membership and module ownership.
  const ownedTraitLines = traitLines.filter((line) => (line.elite ? line.name === id : id === 'Core'));

  return Object.freeze({
    skills: Object.freeze([...skills]),
    ...(skillFields == null ? {} : { skillFields }),
    ...(profileFields == null ? {} : { profileFields }),
    traits: Object.freeze(ownedTraitLines.flatMap((line) => [...line.minorTraits, ...line.majorTraits.flat()])),
    traitLines: Object.freeze(ownedTraitLines),
    ...(weapons.length ? { weapons: Object.freeze([...weapons]) } : {}),
    ...(weaponHands instanceof Map || Object.keys(weaponHands).length ? { weaponHands } : {}),
    ...(autoattackChains == null ? {} : { autoattackChains }),
    ...(skillFlips == null ? {} : { skillFlips })
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

  const skills = mergeEntityArrays(modules, (module) => module.data.skills || [], 'skill id');
  const balanceProfiles = mergeEntityArrays(
    modules,
    (module) => traitBalanceProfiles(module.traitDefinitions ?? [], module.data.traits ?? []),
    'balance profile id'
  );
  const traits = mergeEntityArrays(modules, (module) => module.data.traits || [], 'trait id');
  // A profession field has one declaring module; the combined table validates every module's skills.
  const skillFields: FieldSpecs = combineFields(
    modules.map((module) => ({ owner: module.id, fields: module.data.skillFields }))
  );
  // Profile vocabulary follows the same single-owner contract as skill vocabulary.
  const profileFields = combineFields(
    modules.map((module) => ({ owner: module.id, fields: module.data.profileFields }))
  );
  const specializations = mergeEntityArrays(modules, (module) => module.data.traitLines || [], 'specialization id');
  const weapons = new Set<string>();
  const weaponHands = new Map<string, string>();
  const weaponHandOwners = new Map<string, string>();
  const declaredFlips: Array<{ owner: string; flip: SkillFlipDefinition }> = [];
  const declaredChains: Array<{ owner: string; chain: readonly SkillId[] }> = [];

  for (const module of modules) {
    for (const weapon of module.data.weapons || []) weapons.add(weapon);
    for (const [weapon, hand] of toEntries(module.data.weaponHands)) {
      const prior = weaponHandOwners.get(weapon);

      if (prior) {
        throw new TypeError(`Duplicate weapon-hand entry ${weapon} in ${prior} and ${module.id}.`);
      }

      weaponHandOwners.set(weapon, module.id);
      weaponHands.set(weapon, hand);
    }

    for (const flip of module.data.skillFlips || []) declaredFlips.push({ owner: module.id, flip });

    for (const chain of module.data.autoattackChains || []) {
      declaredChains.push({ owner: module.id, chain });
    }
  }

  const catalog = createCanonicalCatalog({
    // The contributor is the sole owner; Core has no specialization restriction.
    skills: skills.values.map((skill) => {
      for (const field of ['specialization', 'chainRoot', 'chainStep', 'nextChainId', 'flipSkillId', 'flipParentId']) {
        if (Object.hasOwn(skill, field))
          throw new TypeError(`Skill ${skill.id} must not author ${field}; it is derived during assembly.`);
      }

      const owner = skills.owners.get(skill.id)!;

      // Native declarations normalize their explicit GW2 combos before general catalog validation.
      return normalizeGw2ComboCatalogSkill(owner === 'Core' ? skill : { ...skill, specialization: owner });
    }),
    balanceProfiles: balanceProfiles.values,
    traits: traits.values,
    specializations: specializations.values,
    weapons: [...weapons],
    weaponHands,
    autoattackChains: declaredChains.map((entry) => entry.chain),
    skillFlips: declaredFlips.map((entry) => entry.flip),
    skillFields,
    profileFields
  });

  const skillOwners = skills.owners;

  const chainContributions = new Map<string, CanonicalCatalog['autoattackChains']>();
  for (const module of modules) {
    chainContributions.set(module.id, []);
  }

  // Each autoattack chain must be entirely within one runtime module - a chain
  // that spans Core and a spec module would be impossible to schedule correctly.
  for (const [index, { owner: declarationOwner }] of declaredChains.entries()) {
    // Runtime fragments retain the validated immutable copy, never the author's mutable input array.
    const chain = catalog.autoattackChains[index];
    const owners = new Set(chain.map((skillId) => skillOwners.get(skillId)));

    if (owners.size !== 1 || owners.has(undefined)) {
      throw new TypeError(`${declarationOwner} autoattack chain crosses runtime module ownership.`);
    }

    const owner = [...owners][0] as string;
    const current = chainContributions.get(owner)!;
    chainContributions.set(owner, [...current, chain]);
  }

  // A flip family must remain complete when Core and one specialization are selected.
  const flipContributions = new Map<string, SkillFlips>();
  for (const [index, { owner: declarationOwner }] of declaredFlips.entries()) {
    const flip = catalog.skillFlips[index];
    const owner = skillOwners.get(Number(flip.parentId))!;

    if (owner !== skillOwners.get(Number(flip.followUpId))) {
      throw new TypeError(`${declarationOwner} skill flip crosses runtime module ownership.`);
    }

    flipContributions.set(owner, [...(flipContributions.get(owner) || []), flip]);
  }

  const fragments = new Map<string, Readonly<ProfessionModuleCatalogFragment<TSkill>>>();
  for (const module of modules) {
    const hands = new Map([...weaponHands].filter(([weapon]) => weaponHandOwners.get(weapon) === module.id));
    const chains = chainContributions.get(module.id)!;
    fragments.set(
      module.id,
      Object.freeze({
        skills: Object.freeze(catalog.skills.filter((skill) => skillOwners.get(skill.id) === module.id)),
        skillFields: catalog.skillFields,
        profileFields: catalog.profileFields,
        balanceProfiles: Object.freeze(
          catalog.balanceProfiles.filter((profile) => balanceProfiles.owners.get(profile.id) === module.id)
        ),
        traits: Object.freeze(catalog.traits.filter((trait) => traits.owners.get(trait.id) === module.id)),
        specializations: Object.freeze(
          catalog.specializations.filter(
            (specialization) => specializations.owners.get(specialization.id) === module.id
          )
        ),
        weapons: new Set([...weapons].filter((weapon) => module.data.weapons?.includes(weapon))),
        weaponHands: hands,
        autoattackChains: Object.freeze(chains),
        autoattackChainPositions: new Map(
          [...catalog.autoattackChainPositions].filter(([id]) => skillOwners.get(id) === module.id)
        ),
        skillFlips: Object.freeze(flipContributions.get(module.id) || [])
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

/** Builds the active catalog from validated ownership fragments, retaining Core-owned shared weapon skills. */
export function assembleNativeRuntimeCatalog<TSkill extends Skill>(
  fragments: readonly Readonly<ProfessionModuleCatalogFragment<TSkill>>[]
): Readonly<CanonicalCatalog<TSkill>> {
  const first = fragments[0];

  if (!first) throw new TypeError('A native runtime catalog requires selected module fragments.');

  // Selection owns fresh collections while borrowing immutable records compiled at the authoring boundary.
  const skills = Object.freeze(fragments.flatMap((fragment) => fragment.skills));
  const balanceProfiles = Object.freeze(fragments.flatMap((fragment) => fragment.balanceProfiles));
  const catalog: CanonicalCatalog<TSkill> = {
    skills,
    skillsById: new Map(skills.map((skill) => [skill.id, skill])),
    skillFields: first.skillFields,
    profileFields: first.profileFields,
    balanceProfiles,
    balanceProfilesById: new Map(balanceProfiles.map((profile) => [profile.id, profile])),
    traits: Object.freeze(fragments.flatMap((fragment) => fragment.traits)),
    specializations: Object.freeze(fragments.flatMap((fragment) => fragment.specializations)),
    weapons: new Set(fragments.flatMap((fragment) => [...fragment.weapons])),
    weaponHands: new Map(fragments.flatMap((fragment) => [...fragment.weaponHands])),
    autoattackChains: Object.freeze(fragments.flatMap((fragment) => fragment.autoattackChains)),
    autoattackChainPositions: new Map(fragments.flatMap((fragment) => [...fragment.autoattackChainPositions])),
    skillFlips: Object.freeze(fragments.flatMap((fragment) => fragment.skillFlips))
  };
  // A reference valid in the full editor catalog may still point into an inactive module.
  validateCanonicalCatalog(catalog);
  prepareCatalogActionRequirements(catalog);
  return Object.freeze(catalog);
}
