import type { SkillId } from "../../platform/engine/types.js";

export interface EvtcRotationActionIdentity {
  readonly name: string;
  readonly skillId: SkillId;
}

export interface EvtcRotationBuffTransition {
  readonly buffSkillId: number;
  readonly gain: EvtcRotationActionIdentity;
  readonly loss: EvtcRotationActionIdentity;
  readonly suppressWeaponSwap: boolean;
}

export interface EvtcRotationProfessionProfile {
  readonly professionId: string;
  readonly professionName: string;
  readonly specializationId: string;
  readonly specializationName: string;
  readonly dodge: EvtcRotationActionIdentity;
  readonly weaponSwap: EvtcRotationActionIdentity;
  readonly skillNameAliases: Readonly<Record<string, string>>;
  readonly skillIdAliases: Readonly<Record<number, SkillId>>;
  readonly buffTransitions: readonly EvtcRotationBuffTransition[];
}

interface ProfessionProfileSource {
  readonly id: string;
  readonly name: string;
  readonly specializations: Readonly<Record<string, string>>;
  readonly dodgeId?: SkillId;
  readonly dodgeBySpecialization?: Readonly<
    Record<string, EvtcRotationActionIdentity>
  >;
  readonly aliases?: Readonly<Record<string, string>>;
  readonly skillIdAliasesBySpecialization?: Readonly<
    Record<string, Readonly<Record<number, SkillId>>>
  >;
  readonly buffTransitionsBySpecialization?: Readonly<
    Record<string, readonly EvtcRotationBuffTransition[]>
  >;
}

const sources: readonly ProfessionProfileSource[] = [
  {
    id: "elementalist",
    name: "Elementalist",
    specializations: {
      core: "Core",
      tempest: "Tempest",
      weaver: "Weaver",
      catalyst: "Catalyst",
      evoker: "Evoker",
    },
    dodgeId: 1100277,
  },
  {
    id: "mesmer",
    name: "Mesmer",
    specializations: {
      core: "Core",
      chronomancer: "Chronomancer",
      mirage: "Mirage",
      virtuoso: "Virtuoso",
      troubadour: "Troubadour",
    },
    dodgeBySpecialization: {
      mirage: { name: "Dodge / Mirage Cloak", skillId: -1 },
      troubadour: { name: "Dodge", skillId: -5 },
    },
    aliases: {
      "mirage cloak": "Dodge / Mirage Cloak",
      dodge: "Dodge / Mirage Cloak",
    },
  },
  {
    id: "necromancer",
    name: "Necromancer",
    specializations: {
      core: "Core",
      reaper: "Reaper",
      scourge: "Scourge",
      harbinger: "Harbinger",
      ritualist: "Ritualist",
    },
    buffTransitionsBySpecialization: {
      harbinger: [
        {
          buffSkillId: 59964,
          gain: { name: "Harbinger Shroud", skillId: 62567 },
          loss: { name: "Exit Harbinger Shroud", skillId: 62540 },
          suppressWeaponSwap: true,
        },
      ],
    },
  },
  {
    id: "ranger",
    name: "Ranger",
    specializations: {
      core: "Core",
      druid: "Druid",
      soulbeast: "Soulbeast",
      untamed: "Untamed",
      galeshot: "Galeshot",
    },
  },
  {
    id: "thief",
    name: "Thief",
    specializations: {
      core: "Core",
      daredevil: "Daredevil",
      deadeye: "Deadeye",
      specter: "Specter",
      antiquary: "Antiquary",
    },
  },
  {
    id: "engineer",
    name: "Engineer",
    specializations: {
      core: "Core",
      scrapper: "Scrapper",
      holosmith: "Holosmith",
      mechanist: "Mechanist",
      amalgam: "Amalgam",
    },
  },
  {
    id: "guardian",
    name: "Guardian",
    specializations: {
      core: "Core",
      dragonhunter: "Dragonhunter",
      firebrand: "Firebrand",
      willbender: "Willbender",
      luminary: "Luminary",
    },
  },
  {
    id: "warrior",
    name: "Warrior",
    specializations: {
      core: "Core",
      berserker: "Berserker",
      spellbreaker: "Spellbreaker",
      bladesworn: "Bladesworn",
      paragon: "Paragon",
    },
    skillIdAliasesBySpecialization: {
      paragon: {
        69297: 45252,
        69433: 45252,
        80252: 80203,
        80263: 80203,
      },
    },
    buffTransitionsBySpecialization: {
      bladesworn: [
        {
          buffSkillId: 62769,
          gain: { name: "Unsheathe Gunsaber", skillId: 62745 },
          loss: { name: "Sheathe Gunsaber", skillId: 62861 },
          suppressWeaponSwap: true,
        },
      ],
    },
  },
  {
    id: "revenant",
    name: "Revenant",
    specializations: {
      core: "Core",
      herald: "Herald",
      renegade: "Renegade",
      vindicator: "Vindicator",
      conduit: "Conduit",
    },
    aliases: {
      "legend swap": "Swap Legends",
    },
  },
];

function aliasesFor(
  source: ProfessionProfileSource,
  specializationId: string,
): Readonly<Record<string, string>> {
  const aliases = { ...(source.aliases || {}) };
  if (specializationId !== "mirage") delete aliases.dodge;
  return Object.freeze(aliases);
}

export const EVTC_ROTATION_PROFILES: readonly EvtcRotationProfessionProfile[] =
  Object.freeze(
    sources.flatMap((source) =>
      Object.entries(source.specializations).map(
        ([specializationId, specializationName]) =>
          Object.freeze({
            professionId: source.id,
            professionName: source.name,
            specializationId,
            specializationName,
            dodge:
              source.dodgeBySpecialization?.[specializationId] ||
              Object.freeze({
                name: "Dodge",
                skillId: source.dodgeId ?? -5,
              }),
            weaponSwap: Object.freeze({
              name: "Swap Weapons",
              skillId: -3,
            }),
            skillNameAliases: aliasesFor(source, specializationId),
            skillIdAliases: Object.freeze({
              ...(source.skillIdAliasesBySpecialization?.[specializationId] ||
                {}),
            }),
            buffTransitions: Object.freeze([
              ...(source.buffTransitionsBySpecialization?.[specializationId] ||
                []),
            ]),
          }),
      ),
    ),
  );

const profilesById = new Map(
  EVTC_ROTATION_PROFILES.map((profile) => [
    `${profile.professionId}:${profile.specializationId}`,
    profile,
  ]),
);

export function evtcRotationProfile(
  professionId: string,
  specializationId: string,
): EvtcRotationProfessionProfile | null {
  return profilesById.get(`${professionId}:${specializationId}`) || null;
}
