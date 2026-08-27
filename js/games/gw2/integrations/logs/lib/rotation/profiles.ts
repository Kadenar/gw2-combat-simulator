import type { SkillId } from '../../../../platform/engine/types.js';
import { ELEMENTALIST_SKILL_IDS as ELEMENTALIST_ID } from '../../../../content/professions/elementalist/data/ids.js';

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

interface RotationProfileSource {
  readonly id: string;
  readonly name: string;
  readonly specializations: Readonly<Record<string, string>>;
  readonly dodgeId?: SkillId;
  readonly dodgeBySpecialization?: Readonly<Record<string, RotationActionIdentity>>;
  readonly aliases?: Readonly<Record<string, string>>;
  readonly skillIdAliasesBySpecialization?: Readonly<Record<string, Readonly<Record<number, SkillId>>>>;
}

const sources: readonly RotationProfileSource[] = [
  {
    id: 'elementalist',
    name: 'Elementalist',
    specializations: {
      core: 'Core',
      tempest: 'Tempest',
      weaver: 'Weaver',
      catalyst: 'Catalyst',
      evoker: 'Evoker'
    },
    dodgeId: ELEMENTALIST_ID.DODGE,
    skillIdAliasesBySpecialization: Object.fromEntries(
      ['core', 'tempest', 'weaver', 'catalyst', 'evoker'].map((specialization) => [
        specialization,
        {
          5736: ELEMENTALIST_ID.GLYPH_OF_STORMS_FIRE,
          5737: ELEMENTALIST_ID.GLYPH_OF_STORMS_AIR
        }
      ])
    )
  },
  {
    id: 'mesmer',
    name: 'Mesmer',
    specializations: {
      core: 'Core',
      chronomancer: 'Chronomancer',
      mirage: 'Mirage',
      virtuoso: 'Virtuoso',
      troubadour: 'Troubadour'
    },
    dodgeBySpecialization: {
      mirage: { name: 'Dodge / Mirage Cloak', skillId: -1 },
      troubadour: { name: 'Dodge', skillId: -5 }
    },
    aliases: {
      'mirage cloak': 'Dodge / Mirage Cloak',
      dodge: 'Dodge / Mirage Cloak'
    },
    skillIdAliasesBySpecialization: {
      chronomancer: { 56925: 56930 },
      virtuoso: { 62560: 69311, 62586: 62617 }
    }
  },
  {
    id: 'necromancer',
    name: 'Necromancer',
    specializations: {
      core: 'Core',
      reaper: 'Reaper',
      scourge: 'Scourge',
      harbinger: 'Harbinger',
      ritualist: 'Ritualist'
    }
  },
  {
    id: 'ranger',
    name: 'Ranger',
    specializations: {
      core: 'Core',
      druid: 'Druid',
      soulbeast: 'Soulbeast',
      untamed: 'Untamed',
      galeshot: 'Galeshot'
    }
  },
  {
    id: 'thief',
    name: 'Thief',
    specializations: {
      core: 'Core',
      daredevil: 'Daredevil',
      deadeye: 'Deadeye',
      specter: 'Specter',
      antiquary: 'Antiquary'
    }
  },
  {
    id: 'engineer',
    name: 'Engineer',
    specializations: {
      core: 'Core',
      scrapper: 'Scrapper',
      holosmith: 'Holosmith',
      mechanist: 'Mechanist',
      amalgam: 'Amalgam'
    }
  },
  {
    id: 'guardian',
    name: 'Guardian',
    specializations: {
      core: 'Core',
      dragonhunter: 'Dragonhunter',
      firebrand: 'Firebrand',
      willbender: 'Willbender',
      luminary: 'Luminary'
    }
  },
  {
    id: 'warrior',
    name: 'Warrior',
    specializations: {
      core: 'Core',
      berserker: 'Berserker',
      spellbreaker: 'Spellbreaker',
      bladesworn: 'Bladesworn',
      paragon: 'Paragon'
    },
    skillIdAliasesBySpecialization: {
      paragon: {
        69297: 45252,
        69433: 45252,
        80252: 80203,
        80263: 80203
      }
    }
  },
  {
    id: 'revenant',
    name: 'Revenant',
    specializations: {
      core: 'Core',
      herald: 'Herald',
      renegade: 'Renegade',
      vindicator: 'Vindicator',
      conduit: 'Conduit'
    },
    aliases: {
      'legend swap': 'Swap Legends'
    },
    skillIdAliasesBySpecialization: {
      conduit: {
        78191: 28287,
        78203: 27917,
        78351: 76503,
        78587: 27505
      }
    }
  }
];

function aliasesFor(source: RotationProfileSource, specializationId: string): Readonly<Record<string, string>> {
  const aliases = { ...(source.aliases || {}) };
  if (specializationId !== 'mirage') delete aliases.dodge;
  return Object.freeze(aliases);
}

/** Provides one source-neutral profession inventory and canonicalization profile to every combat-log adapter. */
export const ROTATION_PROFILES: readonly RotationProfessionProfile[] = Object.freeze(
  sources.flatMap((source) =>
    Object.entries(source.specializations).map(([specializationId, specializationName]) =>
      Object.freeze({
        professionId: source.id,
        professionName: source.name,
        specializationId,
        specializationName,
        dodge:
          source.dodgeBySpecialization?.[specializationId] ||
          Object.freeze({
            name: 'Dodge',
            skillId: source.dodgeId ?? -5
          }),
        weaponSwap: Object.freeze({
          name: 'Swap Weapons',
          skillId: -3
        }),
        skillNameAliases: aliasesFor(source, specializationId),
        skillIdAliases: Object.freeze({
          ...(source.skillIdAliasesBySpecialization?.[specializationId] || {})
        })
      })
    )
  )
);
