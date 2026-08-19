import { GW2_BUILD_TEMPLATE_PROFESSIONS } from './build-template-data.js';
import type { CanonicalCatalog, Skill, SkillId } from '../engine/types.js';
import type { Gw2BuildSpecialization } from './types.js';

const BUILD_TEMPLATE_HEADER = 0x0d;
const FIXED_LENGTH = 44;
const SLOT_LAYOUT = Object.freeze([
  { slot: 'Heal', type: 'Heal', paletteIndex: 0 },
  { slot: 'Utility1', type: 'Utility', paletteIndex: 2 },
  { slot: 'Utility2', type: 'Utility', paletteIndex: 4 },
  { slot: 'Utility3', type: 'Utility', paletteIndex: 6 },
  { slot: 'Elite', type: 'Elite', paletteIndex: 8 }
]);

export const GW2_BUILD_TEMPLATE_WEAPON_NAMES: Readonly<Record<number, string>> = Object.freeze({
  5: 'Axe',
  35: 'Longbow',
  47: 'Dagger',
  49: 'Focus',
  50: 'Greatsword',
  51: 'Hammer',
  53: 'Mace',
  54: 'Pistol',
  85: 'Rifle',
  86: 'Scepter',
  87: 'Shield',
  89: 'Staff',
  90: 'Sword',
  102: 'Torch',
  103: 'Warhorn',
  107: 'Shortbow',
  265: 'Spear'
});

export interface DecodedGw2BuildTemplateSpecialization {
  readonly id: number;
  readonly traits: string;
}

export interface DecodedGw2BuildTemplate {
  readonly professionCode: number;
  readonly specializations: readonly DecodedGw2BuildTemplateSpecialization[];
  readonly skillPaletteIds: readonly number[];
  readonly professionData: readonly number[];
  readonly weaponTypeIds: readonly number[];
  readonly skillOverrides: readonly number[];
}

export interface ResolvedGw2BuildTemplate {
  readonly professionId: string;
  readonly professionName: string;
  readonly specializations: readonly Gw2BuildSpecialization[];
  readonly selectedSkills: Readonly<Record<string, string>>;
  readonly weaponCandidates: readonly string[];
  readonly weaponOptions: readonly Gw2BuildTemplateWeaponSet[];
  readonly weapons: Gw2BuildTemplateWeaponSet | null;
  readonly skillOverrides: readonly number[];
  readonly warnings: readonly string[];
}

export type Gw2BuildTemplateWeaponSet = readonly [string, string];

export interface Gw2BuildTemplateProfessionIdentity {
  readonly code: number;
  readonly id: string;
  readonly name: string;
}

function uint16(view: DataView, offset: number): number {
  return view.getUint16(offset, true);
}

function traits(byte: number): string {
  return [0, 2, 4].map((shift) => (byte >> shift) & 0x03).join('-');
}

/** Decodes the stable binary contract behind a GW2 `[&...=]` build chat link. */
export function decodeGw2BuildTemplate(chatCode: string): DecodedGw2BuildTemplate {
  const match = /^\[&([A-Za-z0-9+/]+={0,2})\]$/.exec(String(chatCode).trim());
  if (!match) {
    throw new Error('Build template must be a Guild Wars 2 [&...=] chat code.');
  }

  let bytes: Uint8Array;
  try {
    const binary = atob(match[1]);
    bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    throw new Error('Build template contains invalid base64 data.');
  }

  if (bytes.length < FIXED_LENGTH) {
    throw new Error('Build template is shorter than the GW2 fixed layout.');
  }

  if (bytes[0] !== BUILD_TEMPLATE_HEADER) {
    throw new Error('Chat code is not a GW2 build template.');
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const specializations = [0, 1, 2].map((index) => {
    const offset = 2 + index * 2;
    return Object.freeze({
      id: bytes[offset],
      traits: traits(bytes[offset + 1])
    });
  });
  const skillPaletteIds = Array.from({ length: 10 }, (_, index) => uint16(view, 8 + index * 2));
  const professionData = [...bytes.slice(28, FIXED_LENGTH)];
  let offset = FIXED_LENGTH;
  const weaponTypeIds: number[] = [];
  const skillOverrides: number[] = [];
  if (offset < bytes.length) {
    const weaponCount = bytes[offset];
    offset += 1;
    const weaponEnd = offset + weaponCount * 2;
    if (weaponEnd > bytes.length) {
      throw new Error('Build template has a truncated weapon array.');
    }

    for (; offset < weaponEnd; offset += 2) {
      weaponTypeIds.push(uint16(view, offset));
    }

    if (offset >= bytes.length) {
      throw new Error('Build template is missing its skill-override count.');
    }

    const overrideCount = bytes[offset];
    offset += 1;
    const overrideEnd = offset + overrideCount * 4;
    if (overrideEnd !== bytes.length) {
      throw new Error('Build template has a malformed skill-override array.');
    }

    for (; offset < overrideEnd; offset += 4) {
      skillOverrides.push(view.getUint32(offset, true));
    }
  }

  return Object.freeze({
    professionCode: bytes[1],
    specializations: Object.freeze(specializations),
    skillPaletteIds: Object.freeze(skillPaletteIds),
    professionData: Object.freeze(professionData),
    weaponTypeIds: Object.freeze(weaponTypeIds),
    skillOverrides: Object.freeze(skillOverrides)
  });
}

function selectableCandidates(
  catalog: CanonicalCatalog,
  skillId: number,
  type: string,
  selectedSpecializations: ReadonlySet<string>
): Skill[] {
  return catalog.skills.filter(
    (skill) =>
      Number(skill.loadoutSkillId ?? skill.id) === skillId &&
      skill.type === type &&
      skill.implemented !== false &&
      skill.slotSelectable !== false &&
      skill.flipParentId == null &&
      (!skill.specialization || selectedSpecializations.has(skill.specialization))
  );
}

function preferredCandidate(
  candidates: readonly Skill[],
  preferredAttunement: string,
  skillId: SkillId
): Skill | undefined {
  return [...candidates].sort((left, right) => {
    const leftAttunement = String(left.attunement || '');
    const rightAttunement = String(right.attunement || '');
    const leftPreferred = leftAttunement === preferredAttunement ? 1 : 0;
    const rightPreferred = rightAttunement === preferredAttunement ? 1 : 0;
    if (leftPreferred !== rightPreferred) return rightPreferred - leftPreferred;
    const leftExact = left.id === skillId ? 1 : 0;
    const rightExact = right.id === skillId ? 1 : 0;
    return rightExact - leftExact;
  })[0];
}

function inferredWeaponOptions(
  catalog: CanonicalCatalog,
  candidates: readonly string[],
  warnings: string[]
): readonly Gw2BuildTemplateWeaponSet[] {
  const options: Gw2BuildTemplateWeaponSet[] = [];
  for (const [mainIndex, main] of candidates.entries()) {
    const wielding = catalog.weaponHands.get(main);
    if (wielding === '2h') {
      options.push(Object.freeze([main, '']));
      continue;
    }

    if (wielding !== 'mh' && wielding !== 'mh+oh') continue;
    const offhands = candidates.filter(
      (weapon, index) => index !== mainIndex && ['oh', 'mh+oh'].includes(catalog.weaponHands.get(weapon) || '')
    );
    for (const offhand of offhands) {
      options.push(Object.freeze([main, offhand]));
    }

    // The game deduplicates repeated weapon types, so one versatile weapon can
    // represent a dual-wielded set such as Pistol/Pistol or Dagger/Dagger.
    if (wielding === 'mh+oh') {
      options.push(Object.freeze([main, main]));
    } else if (!offhands.length) {
      options.push(Object.freeze([main, '']));
    }
  }

  const unique = options.filter(
    (option, index) =>
      options.findIndex((candidate) => candidate[0] === option[0] && candidate[1] === option[1]) === index
  );
  if (!unique.length && candidates.length) {
    warnings.push('No listed weapon can be equipped in the main hand.');
  } else if (unique.length > 1) {
    warnings.push(
      'GW2 build codes store unique weapon types, not exact set pairing. Choose the intended weapon set before applying.'
    );
  }

  return Object.freeze(unique);
}

/**
 * Resolves profession, trait, terrestrial slot, and best-effort primary weapon
 * selections without requiring a live API request.
 */
export function resolveGw2BuildTemplate(
  decoded: DecodedGw2BuildTemplate,
  {
    catalog,
    expectedProfession,
    preferredAttunement = 'Fire'
  }: {
    readonly catalog: CanonicalCatalog;
    readonly expectedProfession: Gw2BuildTemplateProfessionIdentity;
    readonly preferredAttunement?: string;
  }
): ResolvedGw2BuildTemplate {
  const professionData = GW2_BUILD_TEMPLATE_PROFESSIONS[decoded.professionCode];
  if (!professionData) {
    throw new Error(`Build template uses unknown profession code ${decoded.professionCode}.`);
  }

  if (decoded.professionCode !== expectedProfession.code) {
    throw new Error(`Build template uses profession code ${decoded.professionCode}, not ${expectedProfession.name}.`);
  }

  const warnings: string[] = [];
  const specializations = decoded.specializations.flatMap((selection) => {
    const specialization = catalog.specializations.find((candidate) => Number(candidate.id) === selection.id);
    if (!specialization) {
      warnings.push(`Unknown specialization ID ${selection.id}.`);
      return [];
    }

    if (selection.traits.includes('0')) {
      warnings.push(`${specialization.name} contains an unselected trait tier.`);
    }

    return [{ name: specialization.name, traits: selection.traits }];
  });
  const selectedSpecializations = new Set(specializations.map((specialization) => specialization.name));
  const paletteMap = new Map(professionData.paletteEntries);
  const selectedSkills: Record<string, string> = {};
  for (const { slot, type, paletteIndex } of SLOT_LAYOUT) {
    const paletteId = decoded.skillPaletteIds[paletteIndex];
    if (!paletteId) continue;
    const skillId = paletteMap.get(paletteId);
    if (skillId == null) {
      warnings.push(`${slot} uses unknown palette ID ${paletteId}.`);
      continue;
    }

    const skill = preferredCandidate(
      selectableCandidates(catalog, skillId, type, selectedSpecializations),
      preferredAttunement,
      skillId
    );
    if (!skill) {
      warnings.push(`${slot} skill ${skillId} is not implemented.`);
      continue;
    }

    selectedSkills[slot] = skill.name;
  }

  const weaponCandidates = decoded.weaponTypeIds.flatMap((weaponId) => {
    const weapon = GW2_BUILD_TEMPLATE_WEAPON_NAMES[weaponId];
    if (weapon) return [weapon];
    warnings.push(`Unknown weapon type ID ${weaponId}.`);
    return [];
  });
  const weaponOptions = inferredWeaponOptions(catalog, weaponCandidates, warnings);
  const weapons = weaponOptions[0] ?? null;
  if (decoded.skillOverrides.length) {
    warnings.push(
      `${decoded.skillOverrides.length} weapon skill override(s) were decoded but are not applied to equipment.`
    );
  }

  return Object.freeze({
    professionId: expectedProfession.id,
    professionName: expectedProfession.name,
    specializations: Object.freeze(specializations),
    selectedSkills: Object.freeze(selectedSkills),
    weaponCandidates: Object.freeze(weaponCandidates),
    weaponOptions,
    weapons,
    skillOverrides: decoded.skillOverrides,
    warnings: Object.freeze(warnings)
  });
}
