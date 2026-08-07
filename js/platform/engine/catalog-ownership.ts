import type {
  CanonicalCatalog,
  CatalogEntity,
  ProfessionModuleCatalogFragment,
  Skill,
  SkillId,
} from "./types.js";

type EntityOwner<T> = (entity: T) => string | null | undefined;
type OwnerOverrides<TKey extends string | number> =
  | ReadonlyMap<TKey, string>
  | Readonly<Record<string, string>>;

export interface CatalogOwnershipCoreOptions
  extends ProfessionModuleCatalogFragment {
  readonly ownsWeapons?: boolean;
}

export interface CatalogOwnershipOptions<TSkill extends Skill = Skill> {
  readonly catalog: CanonicalCatalog<TSkill>;
  readonly modules: readonly string[];
  readonly defaultSkillOwner?: EntityOwner<TSkill>;
  readonly defaultTraitOwner?: EntityOwner<CatalogEntity>;
  readonly defaultSpecializationOwner?: EntityOwner<CatalogEntity>;
  readonly skillOverrides?: OwnerOverrides<SkillId>;
  readonly traitOverrides?: OwnerOverrides<SkillId>;
  readonly specializationOverrides?: OwnerOverrides<SkillId>;
  readonly handlerOwners?: OwnerOverrides<string>;
  readonly core?: CatalogOwnershipCoreOptions;
  readonly moduleFragments?: Readonly<
    Record<string, ProfessionModuleCatalogFragment>
  >;
}

export interface CatalogOwnership {
  readonly skillOwners: ReadonlyMap<SkillId, string>;
  readonly traitOwners: ReadonlyMap<SkillId, string>;
  readonly specializationOwners: ReadonlyMap<SkillId, string>;
  readonly handlerOwners: ReadonlyMap<string, string>;
  readonly fragments: ReadonlyMap<
    string,
    Readonly<ProfessionModuleCatalogFragment>
  >;
  readonly fragment: (
    moduleId: string,
  ) => Readonly<ProfessionModuleCatalogFragment>;
}

interface MaterializedOverrides {
  readonly owners: ReadonlyMap<string, string>;
}

function materializeOverrides(
  value: OwnerOverrides<string | number> | undefined,
  label: string,
): MaterializedOverrides {
  const entries = value instanceof Map
    ? [...value.entries()]
    : Object.entries(value || {});
  const owners = new Map<string, string>();
  for (const [rawKey, owner] of entries) {
    const key = String(rawKey);
    if (owners.has(key)) {
      throw new TypeError(`Duplicate ${label} ownership override ${key}.`);
    }
    owners.set(key, owner);
  }
  return { owners };
}

function validateOverrideKeys(
  overrides: MaterializedOverrides,
  ids: ReadonlySet<string>,
  label: string,
): void {
  for (const key of overrides.owners.keys()) {
    if (!ids.has(key)) {
      throw new TypeError(`Unknown ${label} ownership override ${key}.`);
    }
  }
}

function canonicalModule(
  value: unknown,
  modules: readonly string[],
): string | undefined {
  const normalized = String(value || "").toLowerCase();
  return modules.find((moduleId) => moduleId.toLowerCase() === normalized);
}

function ownerMap<T extends CatalogEntity>(
  entities: readonly T[],
  modules: readonly string[],
  overrides: MaterializedOverrides,
  fallback: EntityOwner<T>,
  label: string,
): Map<SkillId, string> {
  const result = new Map<SkillId, string>();
  for (const entity of entities) {
    const override = overrides.owners.get(String(entity.id));
    const owner = override ?? fallback(entity);
    if (owner == null || owner === "") {
      throw new TypeError(`${label} ${String(entity.id)} has no owner.`);
    }
    if (!modules.includes(owner)) {
      throw new TypeError(
        `${label} ${String(entity.id)} has unknown owner "${owner}".`,
      );
    }
    result.set(entity.id, owner);
  }
  return result;
}

function handlerEntries(
  handlers: ProfessionModuleCatalogFragment["skillHandlers"],
): [string, unknown][] {
  return handlers instanceof Map
    ? [...handlers.entries()].map(([id, handler]) => [String(id), handler])
    : Object.entries(handlers || {});
}

function mergeWeaponHands(
  target: Map<string, string>,
  source: ProfessionModuleCatalogFragment["weaponHands"],
  moduleId: string,
): void {
  const entries = source instanceof Map
    ? source.entries()
    : Object.entries(source || {});
  for (const [weapon, hand] of entries) {
    if (target.has(weapon)) {
      throw new TypeError(
        `Weapon hand ${weapon} is claimed twice by module ${moduleId}.`,
      );
    }
    target.set(weapon, String(hand));
  }
}

function assertEntityPartition<T extends CatalogEntity>(
  label: string,
  applicationEntities: readonly T[],
  fragments: ReadonlyMap<string, ProfessionModuleCatalogFragment>,
  select: (fragment: ProfessionModuleCatalogFragment) => readonly T[],
): void {
  const applicationIds = new Set(applicationEntities.map((entry) => entry.id));
  const owners = new Map<SkillId, string>();
  for (const [moduleId, fragment] of fragments) {
    for (const entity of select(fragment)) {
      const previous = owners.get(entity.id);
      if (previous) {
        throw new TypeError(
          `${label} ${String(entity.id)} is claimed by ${previous} and ${moduleId}.`,
        );
      }
      if (!applicationIds.has(entity.id)) {
        throw new TypeError(
          `${label} fragment union contains unknown entity ${String(entity.id)}.`,
        );
      }
      owners.set(entity.id, moduleId);
    }
  }
  const missing = applicationEntities
    .filter((entity) => !owners.has(entity.id))
    .map((entity) => String(entity.id));
  if (missing.length > 0 || owners.size !== applicationIds.size) {
    throw new TypeError(
      `${label} fragment union differs from the application catalog` +
        (missing.length > 0 ? `; missing ${missing.join(", ")}.` : "."),
    );
  }
}

function assertHandlerPartition(
  catalog: CanonicalCatalog,
  fragments: ReadonlyMap<string, ProfessionModuleCatalogFragment>,
): void {
  const applicationIds = new Set(catalog.skillHandlers.keys());
  const owners = new Map<string, string>();
  for (const [moduleId, fragment] of fragments) {
    for (const [handlerId] of handlerEntries(fragment.skillHandlers)) {
      const previous = owners.get(handlerId);
      if (previous) {
        throw new TypeError(
          `Handler ${handlerId} is claimed by ${previous} and ${moduleId}.`,
        );
      }
      if (!applicationIds.has(handlerId)) {
        throw new TypeError(
          `Handler fragment union contains unknown handler ${handlerId}.`,
        );
      }
      owners.set(handlerId, moduleId);
    }
  }
  const missing = [...applicationIds].filter((id) => !owners.has(id));
  if (missing.length > 0 || owners.size !== applicationIds.size) {
    throw new TypeError(
      "Handler fragment union differs from the application catalog" +
        (missing.length > 0 ? `; missing ${missing.join(", ")}.` : "."),
    );
  }
}

/**
 * Materializes and validates the ownership boundary between an application
 * catalog and the Core/elite runtime catalog fragments.
 */
export function defineCatalogOwnership<TSkill extends Skill = Skill>({
  catalog,
  modules,
  defaultSkillOwner,
  defaultTraitOwner,
  defaultSpecializationOwner,
  skillOverrides,
  traitOverrides,
  specializationOverrides,
  handlerOwners,
  core = {},
  moduleFragments = {},
}: CatalogOwnershipOptions<TSkill>): Readonly<CatalogOwnership> {
  if (!modules.includes("Core")) {
    throw new TypeError('Catalog ownership modules must include "Core".');
  }
  if (new Set(modules).size !== modules.length) {
    throw new TypeError("Catalog ownership module IDs must be unique.");
  }
  for (const moduleId of Object.keys(moduleFragments)) {
    if (!modules.includes(moduleId)) {
      throw new TypeError(`Unknown catalog module fragment ${moduleId}.`);
    }
  }

  const skillOverrideMap = materializeOverrides(
    skillOverrides,
    "skill",
  );
  const traitOverrideMap = materializeOverrides(
    traitOverrides,
    "trait",
  );
  const specializationOverrideMap = materializeOverrides(
    specializationOverrides,
    "specialization",
  );
  const handlerOverrideMap = materializeOverrides(
    handlerOwners,
    "handler",
  );
  validateOverrideKeys(
    skillOverrideMap,
    new Set(catalog.skills.map((skill) => String(skill.id))),
    "skill",
  );
  validateOverrideKeys(
    traitOverrideMap,
    new Set(catalog.traits.map((trait) => String(trait.id))),
    "trait",
  );
  validateOverrideKeys(
    specializationOverrideMap,
    new Set(
      catalog.specializations.map((specialization) =>
        String(specialization.id),
      ),
    ),
    "specialization",
  );
  validateOverrideKeys(
    handlerOverrideMap,
    new Set(catalog.skillHandlers.keys()),
    "handler",
  );

  const eliteSpecializations = catalog.specializations.filter(
    (specialization) => specialization.elite,
  );
  const eliteModuleFor = (specialization: unknown): string | undefined => {
    const value = String(specialization || "");
    const elite = eliteSpecializations.find(
      (entry) => entry.name.toLowerCase() === value.toLowerCase(),
    );
    if (!elite) return undefined;
    return canonicalModule(elite.name, modules) || elite.name;
  };
  const skillOwners = ownerMap(
    catalog.skills,
    modules,
    skillOverrideMap,
    defaultSkillOwner || ((skill) => {
      if (skill.type === "Weapon") return "Core";
      return canonicalModule(skill.specialization, modules)
        || eliteModuleFor(skill.specialization)
        || "Core";
    }),
    "Skill",
  );
  const traitOwners = ownerMap(
    catalog.traits,
    modules,
    traitOverrideMap,
    defaultTraitOwner || ((trait) =>
      canonicalModule(trait.specialization, modules)
        || eliteModuleFor(trait.specialization)
        || "Core"),
    "Trait",
  );
  const specializationOwners = ownerMap(
    catalog.specializations,
    modules,
    specializationOverrideMap,
    defaultSpecializationOwner || ((specialization) =>
      specialization.elite
        ? canonicalModule(specialization.name, modules)
          || specialization.name
        : "Core"),
    "Specialization",
  );

  if (core.ownsWeapons) {
    for (const skill of catalog.skills) {
      if (
        skill.type === "Weapon"
        && skillOwners.get(skill.id) !== "Core"
        && !skillOverrideMap.owners.has(String(skill.id))
      ) {
        throw new TypeError(
          `Weaponmaster skill ${String(skill.id)} must be Core-owned or explicitly overridden.`,
        );
      }
    }
  }

  const materializedHandlerOwners = new Map<string, string>();
  for (const handlerId of catalog.skillHandlers.keys()) {
    const owner = handlerOverrideMap.owners.get(handlerId) || "Core";
    if (!modules.includes(owner)) {
      throw new TypeError(
        `Handler ${handlerId} has unknown owner "${owner}".`,
      );
    }
    const referencedOwners = new Set(
      catalog.skills
        .filter((skill) => String(skill.handlerId || "") === handlerId)
        .map((skill) => skillOwners.get(skill.id)),
    );
    if (referencedOwners.size === 0) {
      throw new TypeError(`Handler ${handlerId} is not used by a catalog skill.`);
    }
    if (
      (owner === "Core" && !referencedOwners.has("Core"))
      || (owner !== "Core"
        && (referencedOwners.size !== 1 || !referencedOwners.has(owner)))
    ) {
      throw new TypeError(
        `Handler ${handlerId} is registered by ${owner}, but its skills are owned by `
          + `${[...referencedOwners].join(", ")}.`,
      );
    }
    materializedHandlerOwners.set(handlerId, owner);
  }

  const fragments = new Map<
    string,
    Readonly<ProfessionModuleCatalogFragment>
  >();
  for (const moduleId of modules) {
    const coreFragment = moduleId === "Core" ? core : {};
    const configured = moduleFragments[moduleId] || {};
    const extraSkills = [
      ...(coreFragment.skills || []),
      ...(configured.skills || []),
    ];
    const extraTraits = [
      ...(coreFragment.traits || []),
      ...(configured.traits || []),
    ];
    const extraSpecializations = [
      ...(coreFragment.specializations || []),
      ...(configured.specializations || []),
    ];
    const handlers = new Map<string, unknown>(
      [...catalog.skillHandlers].filter(
        ([handlerId]) => materializedHandlerOwners.get(handlerId) === moduleId,
      ),
    );
    for (const source of [coreFragment.skillHandlers, configured.skillHandlers]) {
      for (const [handlerId, handler] of handlerEntries(source)) {
        if (handlers.has(handlerId)) {
          throw new TypeError(
            `Handler ${handlerId} is claimed twice by module ${moduleId}.`,
          );
        }
        handlers.set(handlerId, handler);
      }
    }
    const weapons = new Set<string>();
    if (moduleId === "Core" && core.ownsWeapons) {
      for (const weapon of catalog.weapons) weapons.add(weapon);
    }
    for (const weapon of coreFragment.weapons || []) weapons.add(weapon);
    for (const weapon of configured.weapons || []) weapons.add(weapon);
    const weaponHands = new Map<string, string>();
    if (moduleId === "Core" && core.ownsWeapons) {
      for (const [weapon, hand] of catalog.weaponHands) {
        weaponHands.set(weapon, hand);
      }
    }
    mergeWeaponHands(weaponHands, coreFragment.weaponHands, moduleId);
    mergeWeaponHands(weaponHands, configured.weaponHands, moduleId);
    const additional = [
      ...(coreFragment.autoattackChains?.additional || []),
      ...(configured.autoattackChains?.additional || []),
    ];
    const excludeSkillIds = [
      ...(coreFragment.autoattackChains?.excludeSkillIds || []),
      ...(configured.autoattackChains?.excludeSkillIds || []),
    ];
    for (const skillId of [...additional.flat(), ...excludeSkillIds]) {
      const owner = skillOwners.get(skillId);
      if (!owner) {
        throw new TypeError(
          `Autoattack configuration for ${moduleId} references unknown skill ${String(skillId)}.`,
        );
      }
      if (owner !== moduleId) {
        throw new TypeError(
          `Autoattack skill ${String(skillId)} is owned by ${owner}, not ${moduleId}.`,
        );
      }
    }
    const fragment: ProfessionModuleCatalogFragment = {
      skills: Object.freeze([
        ...catalog.skills.filter(
          (skill) => skillOwners.get(skill.id) === moduleId,
        ),
        ...extraSkills,
      ]),
      skillHandlers: handlers,
      traits: Object.freeze([
        ...catalog.traits.filter(
          (trait) => traitOwners.get(trait.id) === moduleId,
        ),
        ...extraTraits,
      ]),
      specializations: Object.freeze([
        ...catalog.specializations.filter(
          (specialization) =>
            specializationOwners.get(specialization.id) === moduleId,
        ),
        ...extraSpecializations,
      ]),
      ...(weapons.size > 0 ? { weapons: Object.freeze([...weapons]) } : {}),
      ...(weaponHands.size > 0 ? { weaponHands } : {}),
      ...(additional.length > 0 || excludeSkillIds.length > 0
        ? {
            autoattackChains: Object.freeze({
              ...(additional.length > 0
                ? { additional: Object.freeze(additional.map((chain) =>
                    Object.freeze([...chain]))) }
                : {}),
              ...(excludeSkillIds.length > 0
                ? { excludeSkillIds: Object.freeze([...excludeSkillIds]) }
                : {}),
            }),
          }
        : {}),
    };
    fragments.set(moduleId, Object.freeze(fragment));
  }

  assertEntityPartition(
    "Skill",
    catalog.skills,
    fragments,
    (fragment) => (fragment.skills || []) as readonly TSkill[],
  );
  assertEntityPartition(
    "Trait",
    catalog.traits,
    fragments,
    (fragment) => fragment.traits || [],
  );
  assertEntityPartition(
    "Specialization",
    catalog.specializations,
    fragments,
    (fragment) => fragment.specializations || [],
  );
  assertHandlerPartition(catalog, fragments);

  const fragment = (
    moduleId: string,
  ): Readonly<ProfessionModuleCatalogFragment> => {
    const result = fragments.get(moduleId);
    if (!result) throw new Error(`Unknown catalog module ${moduleId}.`);
    return result;
  };
  return Object.freeze({
    skillOwners,
    traitOwners,
    specializationOwners,
    handlerOwners: materializedHandlerOwners,
    fragments,
    fragment,
  });
}
