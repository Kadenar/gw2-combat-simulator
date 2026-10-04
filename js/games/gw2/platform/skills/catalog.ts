import { normalizeSkillEffects } from '#gw2/platform/effects/validation.js';
import { deriveAutoattackChains, indexAutoattackChains } from '#gw2/platform/skills/autoattack-chain-index.js';
import type {
  AutoattackChainPosition,
  BalanceProfile,
  CanonicalCatalog,
  CatalogEntity,
  Skill,
  SkillId
} from '#gw2/platform/skills/types.js';
import { normalizeSkill, validateCanonicalCatalog } from '#gw2/platform/skills/validation.js';

/**
 * Canonical catalog assembly for profession-neutral skill metadata. This is the
 * boundary where generated API data, hand-authored mechanics, explicit
 * overrides, and resolver handlers become one validated immutable lookup.
 */

/** Corrects derived catalog chains with authored additions and exclusions shared by module contributions. */
export interface AutoattackChainOptions {
  readonly additional?: readonly (readonly SkillId[])[];
  readonly excludeSkillIds?: readonly SkillId[];
}

interface CanonicalCatalogOptions<TSkill extends Skill> {
  readonly generated?: readonly TSkill[];
  readonly mechanics?: Readonly<Record<string, Partial<TSkill>>>;
  readonly overrides?: Readonly<Record<string, Partial<TSkill>>>;
  readonly extraSkills?: readonly TSkill[];
  readonly balanceProfiles?: readonly BalanceProfile[];
  readonly autoattackChains?: AutoattackChainOptions;
  readonly traits?: readonly CatalogEntity[];
  readonly specializations?: readonly CatalogEntity[];
  readonly weapons?: readonly string[];
  readonly weaponHands?: ReadonlyMap<string, string> | Readonly<Record<string, string>>;
  readonly skillNameCollision?: 'first' | 'last';
  readonly skillNormalizer?: (skill: Partial<TSkill>) => Partial<TSkill>;
}

interface NormalizedAutoattackChains {
  readonly chains: readonly (readonly number[])[];
  readonly positions: Map<number, AutoattackChainPosition>;
}

/**
 * Discovers the catalog's normal weapon chains, applies the small number of
 * API-data corrections supplied by a profession, and creates the shared
 * per-skill position index used by runtime rules.
 */
function normalizeAutoattackChains(
  skills: readonly Skill[],
  options: AutoattackChainOptions = {}
): NormalizedAutoattackChains {
  if (options == null || typeof options !== 'object' || Array.isArray(options)) {
    throw new TypeError('Autoattack-chain options must be an object.');
  }

  const additional = options.additional ?? [];
  const excluded = options.excludeSkillIds ?? [];
  if (!Array.isArray(additional) || !Array.isArray(excluded)) {
    throw new TypeError('Autoattack-chain additions and exclusions must be arrays.');
  }

  const excludedIds = new Set(excluded.map(Number));
  const chainSources: readonly (readonly SkillId[])[] = [
    ...deriveAutoattackChains(skills), // derived from API data flip-skill links
    ...additional // hand-authored corrections from the profession
  ];
  // Entire chains containing an excluded skill are dropped; partial chains would
  // break the chain-step index and produce incorrect autoattack sequencing.
  const chains = Object.freeze(
    chainSources
      .filter((chain) => !chain.some((skillId) => excludedIds.has(Number(skillId))))
      .map((chain) => Object.freeze(chain.map(Number)))
  );
  // All chain members must exist in the skill list — a missing id means the API
  // data and hand-authored corrections are out of sync.
  const skillIds = new Set(skills.map((skill) => skill.id));
  for (const chain of chains) {
    for (const skillId of chain) {
      if (!skillIds.has(skillId)) {
        throw new TypeError(`Autoattack chain references missing skill ${skillId}.`);
      }
    }
  }

  return {
    chains,
    positions: indexAutoattackChains(chains)
  };
}

/**
 * Builds the immutable catalog consumed by the shared runtime and
 * app adapters, preserving the owning profession's skill fields through normalization.
 */
export function createCanonicalCatalog<TSkill extends Skill = Skill>({
  generated = [],
  mechanics = {},
  overrides = {},
  extraSkills = [],
  balanceProfiles = [],
  autoattackChains = {},
  traits = [],
  specializations = [],
  weapons = [],
  weaponHands = {},
  skillNameCollision = 'first',
  skillNormalizer
}: CanonicalCatalogOptions<TSkill> = {}): Readonly<CanonicalCatalog<TSkill>> {
  if (!['first', 'last'].includes(skillNameCollision)) {
    throw new TypeError(`Invalid skill name collision policy: ${skillNameCollision}`);
  }

  const declared = [...generated, ...extraSkills];
  const declaredIds = new Set();
  for (const skill of declared) {
    if (declaredIds.has(skill.id)) {
      throw new Error(`Duplicate skill id: ${skill.id}`);
    }

    declaredIds.add(skill.id);
  }

  const generatedById = new Map(generated.map((skill) => [skill.id, skill]));
  const allIds = new Set([
    ...generatedById.keys(),
    ...Object.keys(mechanics).map(Number),
    ...Object.keys(overrides).map(Number),
    ...extraSkills.map((skill) => skill.id)
  ]);
  const normalizedSkills: TSkill[] = [...allIds].map((id) => {
    // Merge priority (lowest → highest): generated API data → hand-authored mechanics
    // → explicit overrides → extraSkills. Each layer shadows fields from the layer below.
    const mergedSource = {
      ...(generatedById.get(id) || {}),
      ...(mechanics[id] || {}),
      ...(overrides[id] || {}),
      ...(extraSkills.find((candidate) => candidate.id === id) || {})
    };
    return normalizeSkill(id, mergedSource, skillNormalizer);
  });
  const normalizedAutoattacks = normalizeAutoattackChains(normalizedSkills, autoattackChains);
  // Inject chain position data (root id + step index) into each skill after the chain
  // index is built, since chains depend on the complete normalized skill list.
  const skills = normalizedSkills.map((skill) => {
    const position = normalizedAutoattacks.positions.get(Number(skill.id));
    return Object.freeze({
      ...skill,
      chainRoot: position?.root ?? null,
      chainStep: position?.step ?? null
    });
  });
  // skillsByName is used for name-based lookups (e.g. from trait/effect references).
  // The collision policy controls which skill wins when two share the same name.
  const skillsByName = new Map<string, TSkill>();
  for (const skill of skills) {
    if (skillNameCollision === 'last' || !skillsByName.has(skill.name)) {
      skillsByName.set(skill.name, skill);
    }
  }

  const profiles: readonly BalanceProfile[] = balanceProfiles.map((profile) =>
    Object.freeze({
      ...profile,
      effects: normalizeSkillEffects(profile.effects || [], `profile=${profile.id}`)
    })
  );
  const profileIds = new Set<SkillId>();
  const procRateIds = new Set<string>();
  for (const profile of profiles) {
    if (profileIds.has(profile.id)) {
      throw new TypeError(`Duplicate balance profile id: ${String(profile.id)}`);
    }

    profileIds.add(profile.id);
    if (!String(profile.name || '')) {
      throw new TypeError(`Balance profile ${String(profile.id)} has no name.`);
    }

    if (!profile.profileKind) {
      throw new TypeError(`Balance profile ${String(profile.id)} has no profileKind.`);
    }

    // Proc declarations compose with Core/elite catalogs and must not silently share an override key.
    if (profile.procRate) {
      const { id, traitId, field, opportunity } = profile.procRate;
      const chance = profile[field];
      if (
        !/^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)+$/.test(id) ||
        procRateIds.has(id) ||
        !traits.some((trait) => trait.id === traitId) ||
        !opportunity ||
        typeof chance !== 'number' ||
        !Number.isFinite(chance) ||
        chance < 0 ||
        chance > 1
      ) {
        throw new TypeError(`Balance profile ${String(profile.id)} has an invalid or duplicate procRate declaration.`);
      }

      procRateIds.add(id);
    }
  }

  const catalog: CanonicalCatalog<TSkill> = {
    skills: Object.freeze(skills),
    skillsById: new Map(skills.map((skill) => [skill.id, skill])),
    skillsByName,
    balanceProfiles: Object.freeze(profiles),
    balanceProfilesById: new Map(profiles.map((profile) => [profile.id, profile])),
    balanceProfilesByName: new Map(profiles.map((profile) => [profile.name, profile])),
    autoattackChains: normalizedAutoattacks.chains,
    autoattackChainPositions: normalizedAutoattacks.positions,
    traits: Object.freeze(traits.map((trait) => Object.freeze({ ...trait }))),
    specializations: Object.freeze(specializations.map((specialization) => Object.freeze({ ...specialization }))),
    weapons: new Set(weapons),
    weaponHands: new Map(weaponHands instanceof Map ? weaponHands : Object.entries(weaponHands || {}))
  };
  validateCanonicalCatalog(catalog);
  return Object.freeze(catalog);
}
