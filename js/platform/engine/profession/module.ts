/**
 * Profession module composition. Validates independently owned Core and
 * specialization fragments and combines their catalogs, hooks, and state.
 */
import type {
  BalanceProfile,
  CatalogEntity,
  CanonicalCatalog,
  ProfessionModuleDefinition,
  SchedulerConfig,
  SchedulerRecord,
  Skill,
  SkillId
} from '../types.js';
import { createCanonicalCatalog } from '../skills/catalog.js';
import { toEntries } from '../core/collections.js';

export interface NamedModule<TModuleState extends object = SchedulerRecord> {
  readonly name: string;
  readonly module: ProfessionModuleDefinition<TModuleState>;
}

export function assertModuleDefinition(definition: unknown): void {
  if (!definition || typeof definition !== 'object' || Array.isArray(definition)) {
    throw new TypeError('A profession module must be an object.');
  }

  const candidate = definition as SchedulerRecord;
  if (!String(candidate.id || '').trim()) {
    throw new TypeError('Profession module id is required.');
  }
}

/**
 * Declares one independently composable profession mechanics fragment.
 */
export function defineProfessionModule<TProfessionState extends object = SchedulerRecord>(
  definition: ProfessionModuleDefinition<TProfessionState>
): Readonly<ProfessionModuleDefinition<TProfessionState>> {
  assertModuleDefinition(definition);
  return Object.freeze({
    ...definition,
    catalog: definition.catalog ? Object.freeze({ ...definition.catalog }) : undefined
  });
}

function mergeUniqueEntries<T>(
  modules: readonly NamedModule<object>[],
  values: (module: ProfessionModuleDefinition<any>) => readonly T[],
  keyFor: (value: T) => string | number,
  label: string
): T[] {
  const result: T[] = [];
  const owners = new Map<string | number, string>();
  for (const entry of modules) {
    for (const value of values(entry.module)) {
      const key = keyFor(value);
      const previous = owners.get(key);
      if (previous) {
        throw new TypeError(`Duplicate ${label} ${String(key)} in ${previous} and ${entry.name}.`);
      }

      owners.set(key, entry.name);
      result.push(value);
    }
  }

  return result;
}

export function composeModuleCatalog(modules: readonly NamedModule<object>[]): Readonly<CanonicalCatalog> {
  const skills = mergeUniqueEntries(
    modules,
    (entry) => entry.catalog?.skills || [],
    (skill) => skill.id,
    'skill id'
  ) as Skill[];
  const balanceProfiles = mergeUniqueEntries(
    modules,
    (entry) => entry.catalog?.balanceProfiles || [],
    (profile) => profile.id,
    'balance profile id'
  ) as BalanceProfile[];
  const traits = mergeUniqueEntries(
    modules,
    (entry) => entry.catalog?.traits || [],
    (trait) => trait.id,
    'trait id'
  ) as CatalogEntity[];
  const specializations = mergeUniqueEntries(
    modules,
    (entry) => entry.catalog?.specializations || [],
    (specialization) => specialization.id,
    'specialization id'
  ) as CatalogEntity[];
  const handlers = new Map<string, unknown>();
  const handlerOwners = new Map<string, string>();
  const weapons = new Set<string>();
  const weaponHands = new Map<string, string>();
  const additionalChains: SkillId[][] = [];
  const excludedSkillIds = new Set<SkillId>();
  let skillNameCollision: 'first' | 'last' = 'first';
  const skillNameOverrides = new Map<string, SkillId>();

  for (const entry of modules) {
    const fragment = entry.module.catalog || {};
    for (const [id, handler] of toEntries(fragment.skillHandlers)) {
      const previous = handlerOwners.get(id);
      if (previous) {
        throw new TypeError(`Duplicate skill handler ${id} in ${previous} and ${entry.name}.`);
      }

      handlerOwners.set(id, entry.name);
      handlers.set(id, handler);
    }

    for (const weapon of fragment.weapons || []) weapons.add(weapon);
    for (const [weapon, hand] of toEntries(fragment.weaponHands)) {
      if (weaponHands.has(weapon)) {
        throw new TypeError(`Duplicate weapon-hand entry ${weapon} in ${entry.name}.`);
      }

      weaponHands.set(weapon, String(hand));
    }

    for (const chain of fragment.autoattackChains?.additional || []) {
      additionalChains.push([...chain]);
    }

    for (const skillId of fragment.autoattackChains?.excludeSkillIds || []) {
      excludedSkillIds.add(skillId);
    }

    if (fragment.skillNameCollision != null) {
      skillNameCollision = fragment.skillNameCollision;
    }

    for (const [name, skillId] of Object.entries(fragment.skillNameOverrides || {})) {
      if (skillNameOverrides.has(name)) {
        throw new TypeError(`Duplicate skill-name override ${name}.`);
      }

      skillNameOverrides.set(name, skillId);
    }
  }

  const catalog = createCanonicalCatalog({
    generated: skills,
    balanceProfiles,
    skillHandlers: handlers,
    traits,
    specializations,
    weapons: [...weapons],
    weaponHands,
    autoattackChains: {
      additional: additionalChains,
      excludeSkillIds: [...excludedSkillIds]
    },
    skillNameCollision
  });
  for (const [name, skillId] of skillNameOverrides) {
    const skill = catalog.skillsById.get(skillId);
    if (!skill) continue;
    if (skill.name !== name) {
      throw new TypeError(`Skill-name override ${name} points to ${skill.name} (${String(skillId)}).`);
    }

    (catalog.skillsByName as Map<string, Skill>).set(name, skill);
  }

  return catalog;
}

function hookValues(
  modules: readonly NamedModule<object>[],
  container: keyof ProfessionModuleDefinition<any>,
  name: string
): unknown[] {
  return modules.flatMap((entry) => {
    const source = entry.module[container] as SchedulerRecord | undefined;
    const value = source?.[name];
    return value == null ? [] : Array.isArray(value) ? value : [value];
  });
}

export function composeHookContainer(
  modules: readonly NamedModule<object>[],
  container: keyof ProfessionModuleDefinition<any>,
  names: readonly string[]
): SchedulerRecord {
  return Object.fromEntries(
    names.flatMap((name) => {
      const values = hookValues(modules, container, name);
      return values.length ? [[name, values]] : [];
    })
  );
}

export function mergeHandlerRegistries(
  modules: readonly NamedModule<object>[],
  select: (
    module: ProfessionModuleDefinition<any>
  ) => Readonly<Record<string, (...args: never[]) => unknown>> | null | undefined,
  label: string
): Readonly<Record<string, (...args: never[]) => unknown>> {
  const result: Record<string, (...args: never[]) => unknown> = {};
  const owners = new Map<string, string>();
  for (const entry of modules) {
    for (const [id, handler] of Object.entries(select(entry.module) || {})) {
      const previous = owners.get(id);
      if (previous) {
        throw new TypeError(`Duplicate ${label} ${id} in ${previous} and ${entry.name}.`);
      }

      owners.set(id, entry.name);
      result[id] = handler;
    }
  }

  return Object.freeze(result);
}

export function composeEventReactions(modules: readonly NamedModule<object>[]): Readonly<Record<string, unknown>> {
  const eventTypes = new Set<string>();
  for (const entry of modules) {
    for (const eventType of Object.keys(entry.module.resolverHooks?.eventReactions || {})) {
      eventTypes.add(eventType);
    }
  }

  return Object.freeze(
    Object.fromEntries(
      [...eventTypes].map((eventType) => [
        eventType,
        modules.flatMap((entry) => {
          const value = entry.module.resolverHooks?.eventReactions?.[eventType];
          return value == null ? [] : Array.isArray(value) ? value : [value];
        })
      ])
    )
  );
}

function createStateFragment(
  entry: NamedModule<object>,
  config: Readonly<SchedulerConfig>,
  resolver: boolean
): SchedulerRecord {
  const resources = entry.module.resources;
  const factory = resolver
    ? resources?.createResolverState || resources?.createProfessionState
    : resources?.createProfessionState;
  const fragment = factory?.(config) || {};
  if (!fragment || typeof fragment !== 'object' || Array.isArray(fragment)) {
    throw new TypeError(`${entry.name} state factory must return an object.`);
  }

  return fragment as SchedulerRecord;
}

function createComposedState(
  core: SchedulerRecord,
  specializationKind: string,
  specializationState: SchedulerRecord
): object {
  for (const property of Reflect.ownKeys(core)) {
    if (property === 'core' || property === 'specialization') {
      throw new TypeError(`Core state fragment uses reserved key ${String(property)}.`);
    }
  }

  for (const property of Reflect.ownKeys(specializationState)) {
    if (property === 'core' || property === 'specialization') {
      throw new TypeError(`${specializationKind} state fragment uses reserved key ${String(property)}.`);
    }

    if (Reflect.has(core, property)) {
      throw new TypeError(`Duplicate state field ${String(property)} in Core and ${specializationKind}.`);
    }
  }

  return {
    core,
    specialization: {
      kind: specializationKind,
      state: specializationState
    }
  };
}

export function composeStateFragments(
  modules: readonly NamedModule<object>[],
  config: Readonly<SchedulerConfig>,
  resolver: boolean
): object {
  const core = createStateFragment(modules[0], config, resolver);
  const specialization = modules[1];
  return createComposedState(
    core,
    specialization?.name || 'Core',
    specialization ? createStateFragment(specialization, config, resolver) : {}
  );
}
