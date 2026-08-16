import type { SkillId } from "../../platform/engine/types.js";

export interface EvtcRotationActionIdentity {
  readonly name: string;
  readonly skillId: SkillId;
}

export interface EvtcRotationBuffTransition {
  readonly buffSkillId: number;
  readonly gain?: EvtcRotationActionIdentity;
  readonly loss?: EvtcRotationActionIdentity;
  readonly lossRequiresRemainingDuration?: boolean;
  readonly suppressWeaponSwap: boolean;
}

export interface EvtcRotationInitialSummon {
  readonly agentSpeciesId: number;
  readonly action: EvtcRotationActionIdentity;
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
  readonly ignoredInstantSkillIds: ReadonlySet<number>;
  readonly buffTransitions: readonly EvtcRotationBuffTransition[];
  readonly initialSummons: readonly EvtcRotationInitialSummon[];
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
  readonly ignoredInstantSkillIds?: readonly number[];
  readonly buffTransitions?: readonly EvtcRotationBuffTransition[];
  readonly buffTransitionsBySpecialization?: Readonly<
    Record<string, readonly EvtcRotationBuffTransition[]>
  >;
  readonly initialSummons?: readonly EvtcRotationInitialSummon[];
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
    buffTransitions: [
      {
        buffSkillId: 72976,
        loss: { name: "Distress", skillId: 73116 },
        lossRequiresRemainingDuration: true,
        suppressWeaponSwap: false,
      },
    ],
    buffTransitionsBySpecialization: {
      reaper: [
        {
          buffSkillId: 29446,
          gain: { name: "Reaper's Shroud", skillId: 30792 },
          loss: { name: "Exit Reaper's Shroud", skillId: 30961 },
          suppressWeaponSwap: true,
        },
      ],
      harbinger: [
        {
          buffSkillId: 59964,
          gain: { name: "Harbinger Shroud", skillId: 62567 },
          loss: { name: "Exit Harbinger Shroud", skillId: 62540 },
          suppressWeaponSwap: true,
        },
      ],
      ritualist: [
        {
          buffSkillId: 76958,
          gain: { name: "Ritualist's Shroud", skillId: 77238 },
          loss: { name: "Exit Ritualist's Shroud", skillId: 76933 },
          suppressWeaponSwap: true,
        },
      ],
    },
    initialSummons: [
      {
        agentSpeciesId: 1104,
        action: { name: "Summon Blood Fiend", skillId: 10547 },
      },
      {
        agentSpeciesId: 1792,
        action: { name: "Summon Flesh Golem", skillId: 10646 },
      },
      {
        agentSpeciesId: 1458,
        action: { name: "Summon Bone Fiend", skillId: 10533 },
      },
      {
        agentSpeciesId: 1192,
        action: { name: "Summon Bone Minions", skillId: 10541 },
      },
      {
        agentSpeciesId: 6002,
        action: { name: "Summon Flesh Wurm", skillId: 10543 },
      },
      {
        agentSpeciesId: 5673,
        action: { name: "Summon Shadow Fiend", skillId: 10589 },
      },
    ],
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
    buffTransitionsBySpecialization: {
      specter: [
        {
          buffSkillId: 63239,
          gain: { name: "Enter Shadow Shroud", skillId: 63155 },
          loss: { name: "Exit Shadow Shroud", skillId: 63251 },
          suppressWeaponSwap: true,
        },
      ],
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
    // Willbender Flames are passive virtue damage packets rather than player
    // inputs. Their Arc skill IDs can otherwise look like instant casts.
    ignoredInstantSkillIds: [62528, 62618, 62552],
    buffTransitionsBySpecialization: {
      luminary: [
        {
          buffSkillId: 77142,
          gain: { name: "Enter Radiant Forge", skillId: 77073 },
          loss: { name: "Exit Radiant Forge", skillId: 76616 },
          suppressWeaponSwap: true,
        },
        {
          buffSkillId: 77821,
          loss: { name: "Radiant Justice", skillId: 78837 },
          lossRequiresRemainingDuration: true,
          suppressWeaponSwap: false,
        },
        {
          buffSkillId: 77855,
          loss: { name: "Radiant Resolve", skillId: 78514 },
          lossRequiresRemainingDuration: true,
          suppressWeaponSwap: false,
        },
        {
          buffSkillId: 77893,
          loss: { name: "Radiant Courage", skillId: 78358 },
          lossRequiresRemainingDuration: true,
          suppressWeaponSwap: false,
        },
        {
          buffSkillId: 77095,
          gain: { name: "Effulgent Stance", skillId: 76813 },
          suppressWeaponSwap: false,
        },
      ],
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
    // Song of the Mists and Invoke Torment packets are legend-swap trait
    // effects, not separate player inputs.
    ignoredInstantSkillIds: [
      28625, 46843, 46847, 46849, 46854, 46856, 46857, 59591, 62705,
    ],
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
            ignoredInstantSkillIds: new Set(
              source.ignoredInstantSkillIds || [],
            ),
            buffTransitions: Object.freeze([
              ...(source.buffTransitions || []),
              ...(source.buffTransitionsBySpecialization?.[specializationId] ||
                []),
            ]),
            initialSummons: Object.freeze([...(source.initialSummons || [])]),
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
