/**
 * Canonical catalog assembly for profession-neutral skill metadata. This is the
 * boundary where complete owner declarations become one validated immutable lookup.
 */
import { prepareCatalogActionRequirements } from '#gw2/platform/effects/action-declarations.js';
import { normalizeSkillEffects } from '#gw2/platform/effects/validation.js';
import type { Gw2SpecializationData } from '#gw2/platform/profession-definition/specialization-data-types.js';
import { indexAutoattackChains } from '#gw2/platform/skills/autoattack-chain-index.js';
import type { FieldSpecs } from '#gw2/platform/skills/field-specs.js';
import { professionProfileFields } from '#gw2/platform/skills/profile-fields.js';
import { professionSkillFields } from '#gw2/platform/skills/shared-fields.js';
import { normalizeSkillFlips, type SkillFlips } from '#gw2/platform/skills/skill-flip-definitions.js';
import type {
  AutoattackChainPosition,
  BalanceProfile,
  CanonicalCatalog,
  CatalogEntity,
  Skill,
  SkillId
} from '#gw2/platform/skills/types.js';
import { normalizeSkill, validateCanonicalCatalog } from '#gw2/platform/skills/validation.js';

/** Ordered, explicit chain declarations; each skill belongs to at most one sequence. */
export type AutoattackChains = readonly (readonly SkillId[])[];

interface CanonicalCatalogOptions<TSkill extends Skill> {
  readonly skills?: readonly TSkill[];
  readonly balanceProfiles?: readonly BalanceProfile[];
  readonly autoattackChains?: AutoattackChains;
  readonly skillFlips?: SkillFlips;
  readonly traits?: readonly CatalogEntity[];
  readonly specializations?: readonly Gw2SpecializationData[];
  readonly weapons?: readonly string[];
  readonly weaponHands?: ReadonlyMap<string, string> | Readonly<Record<string, string>>;
  /** Fields only this profession's code reads; the shared vocabulary is always included. */
  readonly skillFields?: FieldSpecs;
  readonly profileFields?: FieldSpecs;
}

interface NormalizedAutoattackChains {
  readonly chains: readonly (readonly number[])[];
  readonly positions: Map<number, AutoattackChainPosition>;
}

/**
 * Validates authored sequences and creates the position index used by runtime
 * rules. Chain membership comes only from these declarations.
 */
function normalizeAutoattackChains(
  skills: readonly Skill[],
  declarations: AutoattackChains = []
): NormalizedAutoattackChains {
  if (!Array.isArray(declarations) || declarations.some((chain) => !Array.isArray(chain))) {
    throw new TypeError('Autoattack chains must be an array of skill-ID arrays.');
  }

  const chains = Object.freeze(declarations.map((chain) => Object.freeze(chain.map(Number))));
  // Every declared member must be a supported skill in this catalog.
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
  skills: declared = [],
  balanceProfiles = [],
  autoattackChains = [],
  skillFlips = [],
  traits = [],
  specializations = [],
  weapons = [],
  weaponHands = {},
  skillFields: professionFields,
  profileFields: professionProfileDeclarations
}: CanonicalCatalogOptions<TSkill> = {}): Readonly<CanonicalCatalog<TSkill>> {
  // Every declared skill, including patched replacements, is checked against this one profession-wide table.
  const skillFields = professionSkillFields(professionFields);
  const profileFields = professionProfileFields(professionProfileDeclarations);
  const normalizedSkills = declared.map((skill) => normalizeSkill(skill, skillFields));
  const normalizedAutoattacks = normalizeAutoattackChains(normalizedSkills, autoattackChains);
  const normalizedFlips = normalizeSkillFlips(normalizedSkills, skillFlips, normalizedAutoattacks.positions);
  // Inject chain position data (root id + step index) into each skill after the chain
  // index is built, since chains depend on the complete normalized skill list.
  const skills = normalizedSkills.map((skill) => {
    const position = normalizedAutoattacks.positions.get(Number(skill.id));
    return Object.freeze({
      ...skill,
      // Explicit declarations supply the runtime flip identities.
      flipSkillId: normalizedFlips.defaults.get(Number(skill.id)) ?? null,
      flipParentId: normalizedFlips.parents.get(Number(skill.id)) ?? null,
      ...(position
        ? {
            autoattack: skill.autoattack ?? true,
            nextChainId: position.next
          }
        : {}),
      chainRoot: position?.root ?? null,
      // Public chain steps are one-based; the chain index owns the underlying position.
      chainStep: position ? position.index + 1 : null
    });
  });
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

  // Arrays and ID indexes share the same entities; display labels are never stored as identity indexes.
  const catalog: CanonicalCatalog<TSkill> = {
    skills: Object.freeze(skills),
    skillsById: new Map(skills.map((skill) => [skill.id, skill])),
    skillFields,
    profileFields,
    balanceProfiles: Object.freeze(profiles),
    balanceProfilesById: new Map(profiles.map((profile) => [profile.id, profile])),
    autoattackChains: normalizedAutoattacks.chains,
    skillFlips: normalizedFlips.flips,
    autoattackChainPositions: normalizedAutoattacks.positions,
    traits: Object.freeze(traits.map((trait) => Object.freeze({ ...trait }))),
    specializations: Object.freeze(specializations.map((specialization) => Object.freeze({ ...specialization }))),
    weapons: new Set(weapons),
    weaponHands: new Map(weaponHands instanceof Map ? weaponHands : Object.entries(weaponHands || {}))
  };
  validateCanonicalCatalog(catalog);
  prepareCatalogActionRequirements(catalog);
  return Object.freeze(catalog);
}
