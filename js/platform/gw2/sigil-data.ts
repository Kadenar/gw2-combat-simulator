export interface Gw2SigilDataEntry {
  readonly criticalChance?: number;
  readonly strikeDamageA?: number;
  readonly conditionDamageA?: number;
  readonly conditionDuration?: number;
  readonly bleedingDuration?: number;
  readonly burningDuration?: number;
  readonly poisonDuration?: number;
  readonly tormentDuration?: number;
  readonly boonDuration?: number;
  readonly procPrecision?: number;
  readonly procFerocity?: number;
  readonly icon: string;
  readonly [field: string]: unknown;
}

export const SIGIL_DATA: Readonly<Record<string, Gw2SigilDataEntry>> = {
  Accuracy: {
    criticalChance: 7,
    icon: "https://render.guildwars2.com/file/4B0EFF29FD064E5E93E4F8616BE309A451450AED/220661.png",
  },
  Force: {
    strikeDamageA: 5,
    icon: "https://render.guildwars2.com/file/D7420E430D002E07382035EF0D0F77370C4EE6B8/220662.png",
  },
  Bursting: {
    conditionDamageA: 5,
    icon: "https://render.guildwars2.com/file/7ABFCEDF80329157F734FD56B293765D9B940FAD/619703.png",
  },
  Malice: {
    conditionDuration: 10,
    icon: "https://render.guildwars2.com/file/797D052CB4EA63A61A3225962128D197ACB3ED17/619709.png",
  },
  Agony: {
    bleedingDuration: 20,
    icon: "https://render.guildwars2.com/file/BAF34EB051D118F8A7C1645E0D940ED0660E6269/220658.png",
  },
  Smoldering: {
    burningDuration: 20,
    icon: "https://render.guildwars2.com/file/60AAB7109E5D679901E00DC066774EE5FB3E6052/220659.png",
  },
  Venom: {
    poisonDuration: 20,
    icon: "https://render.guildwars2.com/file/080B4F940A05E60A084AA4B1D230F923A1A47CEC/220664.png",
  },
  Demons: {
    tormentDuration: 20,
    icon: "https://render.guildwars2.com/file/52D5D9FE5E0B9091415092A9E21DE830010D2E0E/220674.png",
  },
  Impact: {
    strikeDamageA: 3,
    icon: "https://render.guildwars2.com/file/D9ACA0C94D90A76B1C500D5DE6D62B6820FEDAE2/221170.png",
  },
  Air: {
    icon: "https://render.guildwars2.com/file/C337CC61DF2F5EE44B7D053EFF33059111024444/220676.png",
  },
  Blight: {
    icon: "https://render.guildwars2.com/file/AE0A1C7816B56296FEA527E1D01376491374195A/941026.png",
  },
  Earth: {
    icon: "https://render.guildwars2.com/file/251EE3B8B5ADB8D7F7A35DBAEFABA35AEACDF51B/220677.png",
  },
  Torment: {
    icon: "https://render.guildwars2.com/file/E42EB6198022E5B4D71C5EE41465DD4EB84A0465/665778.png",
  },
  Doom: {
    icon: "https://render.guildwars2.com/file/6CE4D1D6E5392C4CC8BACA595E3393EBF208BEED/220686.png",
  },
  Energy: {
    icon: "https://render.guildwars2.com/file/3A064B97AB7D0E1F1250EFB5F06798A8FE623708/220688.png",
  },
  Geomancy: {
    icon: "https://render.guildwars2.com/file/B79B430645DDF54E6792909A52F5CA40A4911407/220687.png",
  },
  Hydromancy: {
    icon: "https://render.guildwars2.com/file/B5F3E2021863079919299707290698504B5C7E90/220689.png",
  },
  Severance: {
    procPrecision: 250,
    procFerocity: 250,
    icon: "https://render.guildwars2.com/file/396D7A5DBFA03BC49C12DAB532C4E34D342F0B51/1766396.png",
  },
  Concentration: {
    boonDuration: 10,
    icon: "https://render.guildwars2.com/file/C501D2CCF95A7B59F15EEDEF9C7D42C2DECE48E7/1201533.png",
  },
};

export const SIGIL_NAMES: readonly string[] = Object.keys(SIGIL_DATA)
  .sort((left, right) => left.localeCompare(right));
