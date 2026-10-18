import { PROFESSION_IDENTITIES } from '#gw2/profession-identities.js';
import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import { ELEMENTALIST_SKILL_IDS as ELEMENTALIST_ID } from '#gw2/professions/elementalist/data/ids.js';

export interface RotationActionIdentity {
  readonly name: string;
  readonly skillId: SkillId;
}

export interface RotationProfessionProfile {
  readonly professionId: string;
  readonly professionName: string;
  readonly specializationId: string;
  readonly specializationName: string;
  readonly dodge: RotationActionIdentity;
  readonly weaponSwap: RotationActionIdentity;
  readonly skillNameAliases: Readonly<Record<string, string>>;
  readonly skillIdAliases: Readonly<Record<number, SkillId>>;
}

interface RotationProfileOverrides {
  readonly dodgeBySpecialization?: Readonly<Record<string, RotationActionIdentity>>;
  readonly aliases?: Readonly<Record<string, string>>;
  readonly skillIdAliases?: Readonly<Record<number, SkillId>>;
  readonly skillIdAliasesBySpecialization?: Readonly<Record<string, Readonly<Record<number, SkillId>>>>;
}

// External log identities stay here; shared identity metadata owns the supported profession/spec inventory.
const overrides: Partial<Record<keyof typeof PROFESSION_IDENTITIES, RotationProfileOverrides>> = {
  elementalist: {
    skillIdAliases: {
      5736: ELEMENTALIST_ID.GLYPH_OF_STORMS_FIRE,
      5737: ELEMENTALIST_ID.GLYPH_OF_STORMS_AIR
    }
  },
  mesmer: {
    dodgeBySpecialization: {
      mirage: { name: 'Dodge / Mirage Cloak', skillId: -1 },
      troubadour: { name: 'Dodge', skillId: SHARED_SKILL_IDS.DODGE }
    },
    aliases: { dodge: 'Dodge / Mirage Cloak' },
    skillIdAliasesBySpecialization: {
      core: { [-63]: 10191, 49068: 10191 },
      chronomancer: { 56925: 56930 },
      // EI's synthetic identities resolve to existing actions; shared cloak source selection runs before this lookup.
      mirage: { [-63]: 10191, 49068: 10191 },
      virtuoso: { 62560: 69311, 62586: 62617 }
    }
  },
  revenant: {
    aliases: { 'legend swap': 'Swap Legends' },
    skillIdAliasesBySpecialization: {
      conduit: { 78191: 28287, 78203: 27917, 78351: 76503 }
    }
  }
};

function aliasesFor(source: RotationProfileOverrides, specializationId: string): Readonly<Record<string, string>> {
  const aliases = { ...(source.aliases || {}) };

  if (specializationId !== 'mirage') delete aliases.dodge;

  return Object.freeze(aliases);
}

/** Combines the shared profession inventory with source-specific action and skill normalization rules. */
export const ROTATION_PROFILES: readonly RotationProfessionProfile[] = Object.freeze(
  Object.entries(PROFESSION_IDENTITIES).flatMap(([professionId, identity]) => {
    const source = overrides[professionId as keyof typeof PROFESSION_IDENTITIES] ?? {};
    return Object.entries(identity.specializations).map(([specializationId, specializationName]) =>
      Object.freeze({
        professionId,
        professionName: identity.name,
        specializationId,
        specializationName,
        dodge:
          source.dodgeBySpecialization?.[specializationId] ||
          Object.freeze({
            name: 'Dodge',
            skillId: SHARED_SKILL_IDS.DODGE
          }),
        weaponSwap: Object.freeze({ name: 'Swap Weapons', skillId: SHARED_SKILL_IDS.SWAP_WEAPONS }),
        skillNameAliases: aliasesFor(source, specializationId),
        skillIdAliases: Object.freeze({
          ...source.skillIdAliases,
          ...source.skillIdAliasesBySpecialization?.[specializationId]
        })
      })
    );
  })
);
