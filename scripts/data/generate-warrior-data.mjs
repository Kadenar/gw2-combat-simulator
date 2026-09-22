import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { constantName as baseConstantName, declaration, mapConcurrent } from './lib/generator-utils.mjs';

const API_ROOT = 'https://api.guildwars2.com/v2';
const WIKI_API = 'https://wiki.guildwars2.com/api.php';
const SUPPLEMENTAL_NAMES = Object.freeze([
  'Swift Cut',
  'Steel Divide',
  'Explosive Thrust',
  'Blooming Fire',
  'Artillery Slash',
  'Cyclone Trigger',
  'Break Step',
  'Dragon Slash—Force',
  'Dragon Slash—Boost',
  'Dragon Slash—Reach',
  'Flicker Step',
  'Triggerguard'
]);
const SUPPLEMENTAL_OVERRIDES_BY_ID = new Map([
  [62966, { icon: 'https://wiki.guildwars2.com/images/e/e3/Swift_Cut.png' }],
  [62772, { icon: 'https://wiki.guildwars2.com/images/9/9a/Steel_Divide.png' }],
  [62918, { icon: 'https://wiki.guildwars2.com/images/9/99/Explosive_Thrust.png' }],
  [
    62930,
    {
      icon: 'https://wiki.guildwars2.com/images/d/d0/Blooming_Fire.png',
      ammoCastLockout: 2,
      ammo: 2,
      ammoRecharge: 10
    }
  ],
  [
    62732,
    {
      icon: 'https://wiki.guildwars2.com/images/6/68/Artillery_Slash.png',
      ammoCastLockout: 2,
      ammo: 2,
      ammoRecharge: 15
    }
  ],
  [
    62789,
    {
      icon: 'https://wiki.guildwars2.com/images/6/6c/Cyclone_Trigger.png',
      ammoCastLockout: 1,
      ammo: 2,
      ammoRecharge: 20
    }
  ],
  [
    62885,
    {
      icon: 'https://wiki.guildwars2.com/images/7/76/Break_Step.png',
      ammoCastLockout: 1,
      ammo: 2,
      ammoRecharge: 20
    }
  ],
  [
    62797,
    {
      icon: 'https://wiki.guildwars2.com/images/b/b5/Dragon_Slash%E2%80%94Force.png'
    }
  ],
  [
    62980,
    {
      icon: 'https://wiki.guildwars2.com/images/7/75/Dragon_Slash%E2%80%94Boost.png'
    }
  ],
  [
    62951,
    {
      icon: 'https://wiki.guildwars2.com/images/e/eb/Dragon_Slash%E2%80%94Reach.png'
    }
  ],
  [
    62926,
    {
      icon: 'https://wiki.guildwars2.com/images/d/de/Flicker_Step.png',
      ammoCastLockout: 0.5,
      ammo: 3,
      ammoRecharge: 20
    }
  ],
  [
    62893,
    {
      icon: 'https://wiki.guildwars2.com/images/4/4e/Triggerguard.png',
      ammoCastLockout: 1,
      ammo: 2,
      ammoRecharge: 30
    }
  ]
]);

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'gw2-combat-simulator/2.0 Warrior generator' }
  });

  if (!response.ok) throw new Error(`${response.status} ${url}`);

  return response.json();
}

async function fetchMany(endpoint, ids) {
  const result = [];

  for (let index = 0; index < ids.length; index += 100) {
    result.push(...(await fetchJson(`${API_ROOT}/${endpoint}?ids=${ids.slice(index, index + 100).join(',')}&lang=en`)));
  }

  return result;
}

function constantName(value) {
  const normalized = baseConstantName(value);

  // Warrior generated identifiers reserve a readable prefix for names that begin with a number.
  return /^\d/.test(normalized) ? `SKILL_${normalized}` : normalized;
}

function stableEntries(entries) {
  const result = [];
  const used = new Set();

  for (const entry of entries) {
    const base = constantName(entry.name);

    if (!base) continue;
    const key = used.has(base) ? `${base}_ID_${entry.id}` : base;

    used.add(base);
    result.push({ ...entry, key });
  }

  return result;
}

function skillInfobox(wikitext) {
  return String(wikitext || '').match(/\{\{Skill infobox[\s\S]*?\n\}\}/i)?.[0] || '';
}

function infoboxId(wikitext) {
  const raw = skillInfobox(wikitext).match(/^\|\s*id\s*=\s*([^\n]+)/im)?.[1] || '';

  return Number(raw.match(/\d+/)?.[0] || 0);
}

async function wikiWikitext(name) {
  const query = new URLSearchParams({
    action: 'parse',
    prop: 'wikitext',
    format: 'json',
    formatversion: '2',
    page: name,
    redirects: '1'
  });

  try {
    const result = await fetchJson(`${WIKI_API}?${query}`);

    return String(result.parse?.wikitext || '');
  } catch {
    return '';
  }
}

function fact(raw, text, type) {
  return (raw.facts || []).find((candidate) => candidate.text === text && (!type || candidate.type === type));
}

function normalizeRawSkill(raw, identity) {
  const overrides = SUPPLEMENTAL_OVERRIDES_BY_ID.get(identity.id) || {};

  if (!raw) {
    const dragonSlash = identity.name.startsWith('Dragon Slash');
    const ammo = Number(overrides.ammo || 0);
    const ammoRecharge = Number(overrides.ammoRecharge || 0);
    const cooldown = Number(ammo > 0 ? ammoRecharge : dragonSlash ? 1 : 0);
    const ammoCastLockout = Number(overrides.ammoCastLockout || 0);

    return {
      id: identity.id,
      name: identity.name,
      description: 'Bladesworn gunsaber profession mechanic.',
      icon: overrides.icon || '',
      type: 'Bundle',
      weapon: '',
      slot: dragonSlash ? 'Weapon_1' : 'Weapon_1',
      specialization: 'Bladesworn',
      categories: dragonSlash ? ['Burst', 'DragonSlash'] : [],
      cooldown,
      ammo,
      ammoRecharge,
      ...(ammoCastLockout > 0 ? { ammoCastLockout } : {}),
      nextChainId: null,
      flipSkillId: null,
      simulatorExcluded: false
    };
  }

  const maximumCount = fact(raw, 'Maximum Count', 'Number')?.value || 0;
  const countRecharge =
    (raw.facts || []).find((candidate) => candidate.text === 'Count Recharge' && candidate.type === 'Time')?.duration ||
    0;
  const ammo = Number(overrides.ammo ?? maximumCount);
  const ammoRecharge = Number(overrides.ammoRecharge ?? countRecharge);
  const sourceRecharge = Number(fact(raw, 'Recharge', 'Recharge')?.value || 0);

  return {
    id: raw.id,
    name: raw.name,
    description: raw.description || '',
    icon: raw.icon || overrides.icon || '',
    type: 'Bundle',
    weapon: '',
    slot: raw.slot || 'Weapon_1',
    specialization: 'Bladesworn',
    categories: raw.categories || [],
    cooldown: ammo > 0 ? ammoRecharge : sourceRecharge,
    ammo,
    ammoRecharge,
    ...(ammo > 0 && sourceRecharge > 0 ? { ammoCastLockout: sourceRecharge } : {}),
    nextChainId: raw.next_chain || null,
    flipSkillId: raw.flip_skill || null,
    simulatorExcluded: false
  };
}

// Refreshes Warrior IDs and supplemental metadata without rewriting hand-owned skill catalogs.
export async function generateWarriorData({ skills: apiSkills, specializations: apiSpecializations }) {
  const canonicalSkills = Object.freeze(apiSkills.filter((skill) => !/^\(\(/.test(String(skill.name || ''))));
  const supplementalWikitext = await mapConcurrent(SUPPLEMENTAL_NAMES, 6, wikiWikitext);
  const supplementalIds = supplementalWikitext.map((wikitext, index) => ({
    id: infoboxId(wikitext),
    name: SUPPLEMENTAL_NAMES[index]
  }));

  for (const skill of supplementalIds) {
    if (!skill.id) throw new Error(`Could not resolve ${skill.name} from the Guild Wars 2 Wiki.`);
  }

  const rawSkills = await fetchMany('skills', [...new Set(canonicalSkills.map((skill) => skill.id))]);
  const rawById = new Map(rawSkills.map((skill) => [skill.id, skill]));
  const supplemental = supplementalIds.map((identity) => normalizeRawSkill(rawById.get(identity.id), identity));
  const identities = [...canonicalSkills, ...supplemental];
  const entries = stableEntries(identities);

  const traits = stableEntries(
    apiSpecializations.flatMap((specialization) => [
      ...specialization.minorTraits,
      ...specialization.majorTraits.flat()
    ])
  );
  const idsSource = [
    '// Generated by scripts/data/generate-warrior-data.mjs.',
    '// Committed constants keep mechanic references independent from metadata loading.',
    '',
    declaration('WARRIOR_SKILL_IDS', entries, ['WEAPON_STOW: -6,', 'DODGE: -5,', 'SWAP_WEAPONS: -3,']),
    '',
    declaration('WARRIOR_TRAIT_IDS', traits),
    ''
  ].join('\n');

  await writeFile(
    fileURLToPath(new URL('../../js/games/gw2/professions/warrior/data/ids.ts', import.meta.url)),
    idsSource,
    'utf8'
  );

  // Generated skills use the same domain-owned type import as maintained catalogs.
  const supplementalSource = `// Generated by scripts/data/generate-warrior-data.mjs.
import type { Skill } from "#gw2/platform/engine/skills/types.js";

export const WARRIOR_SUPPLEMENTAL_SKILLS: readonly Skill[] = Object.freeze(
  ${JSON.stringify(supplemental, null, 2)},
);
`;

  await writeFile(
    fileURLToPath(
      new URL('../../js/games/gw2/professions/warrior/data/warrior-supplemental-skills.ts', import.meta.url)
    ),
    supplementalSource,
    'utf8'
  );
  console.log(`Wrote ${entries.length} skill and ${traits.length} trait IDs.`);
  console.log(`Wrote ${supplemental.length} supplemental Bladesworn skills.`);
}
