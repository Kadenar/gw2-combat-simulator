import { fileURLToPath } from 'node:url';

import { generateProfessionIds, mapConcurrent, serializeWithLocalImages } from './lib/generator-utils.mjs';

const REQUEST_HEADERS = { 'User-Agent': 'gw2-combat-simulator/2.0 Warrior generator' };
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
  [62966, { icon: '@images/wiki/swift-cut.png' }],
  [62772, { icon: '@images/wiki/steel-divide.png' }],
  [62918, { icon: '@images/wiki/explosive-thrust.png' }],
  [
    62930,
    {
      icon: '@images/wiki/blooming-fire.png',
      ammoCastLockout: 2,
      ammo: 2,
      ammoRecharge: 10
    }
  ],
  [
    62732,
    {
      icon: '@images/wiki/artillery-slash.png',
      ammoCastLockout: 2,
      ammo: 2,
      ammoRecharge: 15
    }
  ],
  [
    62789,
    {
      icon: '@images/wiki/cyclone-trigger.png',
      ammoCastLockout: 1,
      ammo: 2,
      ammoRecharge: 20
    }
  ],
  [
    62885,
    {
      icon: '@images/wiki/break-step.png',
      ammoCastLockout: 1,
      ammo: 2,
      ammoRecharge: 20
    }
  ],
  [
    62797,
    {
      icon: '@images/wiki/dragon-slash-force.png'
    }
  ],
  [
    62980,
    {
      icon: '@images/wiki/dragon-slash-boost.png'
    }
  ],
  [
    62951,
    {
      icon: '@images/wiki/dragon-slash-reach.png'
    }
  ],
  [
    62926,
    {
      icon: '@images/wiki/flicker-step.png',
      ammoCastLockout: 0.5,
      ammo: 3,
      ammoRecharge: 20
    }
  ],
  [
    62893,
    {
      icon: '@images/wiki/triggerguard.png',
      ammoCastLockout: 1,
      ammo: 2,
      ammoRecharge: 30
    }
  ]
]);

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: REQUEST_HEADERS
  });

  if (!response.ok) throw new Error(`${response.status} ${url}`);

  return response.json();
}

// Supported synthetic actions, procs, and variants that upstream snapshots omit.
const FIXED_SKILLS = [
  { key: 'MAGEBANE_TETHER', id: 43532 },
  { key: 'LESSER_SIGNET_OF_MIGHT', id: 29977 },
  { key: 'WILD_THROW_ALTERNATE', id: 73131, name: 'Wild Throw (alternating projectile packet)' },
  { key: 'SHARP_DRAGON_SLASH_FORCE', id: 80199, name: 'Dragon Slash—Force (Sharp as the Wind)' },
  { key: 'SHARP_BLOOMING_FIRE', id: 80212, name: 'Blooming Fire (Sharp as the Wind)' },
  { key: 'SHARP_EXPLOSIVE_THRUST', id: 80213, name: 'Explosive Thrust (Sharp as the Wind)' },
  { key: 'SHARP_STEEL_DIVIDE', id: 80238, name: 'Steel Divide (Sharp as the Wind)' },
  { key: 'SHARP_BREAK_STEP', id: 80241, name: 'Break Step (Sharp as the Wind)' },
  { key: 'SHARP_DRAGON_SLASH_REACH', id: 80246, name: 'Dragon Slash—Reach (Sharp as the Wind)' },
  { key: 'SHARP_CYCLONE_TRIGGER', id: 80226, name: 'Cyclone Trigger (Sharp as the Wind)' },
  { key: 'SHARP_ARTILLERY_SLASH', id: 80274, name: 'Artillery Slash (Sharp as the Wind)' },
  { key: 'SHARP_DRAGON_SLASH_BOOST', id: 80281, name: 'Dragon Slash—Boost (Sharp as the Wind)' },
  { key: 'SHARP_SWIFT_CUT', id: 80293, name: 'Swift Cut (Sharp as the Wind)' }
];

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

// The skills endpoint rejects every gunsaber ID, so each supplemental record is authored from its wiki identity.
function supplementalSkill(identity) {
  const overrides = SUPPLEMENTAL_OVERRIDES_BY_ID.get(identity.id) || {};
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
    // Gunsaber skills share one bundle slot.
    slot: 'Weapon_1',
    specialization: 'Bladesworn',
    categories: dragonSlash ? ['Burst', 'DragonSlash'] : [],
    cooldown,
    // Field order matches the committed catalog so an unchanged refresh rewrites nothing.
    ...(ammoCastLockout > 0 ? { ammoCastLockout } : {}),
    ammo,
    ammoRecharge,
    nextChainId: null,
    flipSkillId: null,
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

  const supplemental = supplementalIds.map(supplementalSkill);
  const identities = [...canonicalSkills, ...supplemental];
  const generated = await generateProfessionIds({
    profession: 'warrior',
    generator: 'generate-warrior-data',
    skills: identities,
    specializations: apiSpecializations,
    fixedSkills: FIXED_SKILLS
  });

  // Generated skills use the same domain-owned type import as maintained catalogs.
  const supplementalSource = `// Generated by scripts/data/generate-warrior-data.mjs.
import type { Skill } from "#gw2/platform/skills/types.js";

export const WARRIOR_SUPPLEMENTAL_SKILLS: readonly Skill[] = Object.freeze(
  ${serializeWithLocalImages(supplemental, 2)},
);
`;

  return {
    files: [
      ...generated.files,
      {
        target: fileURLToPath(
          new URL('../../js/games/gw2/professions/warrior/data/warrior-supplemental-skills.ts', import.meta.url)
        ),
        source: supplementalSource,
        summary: `${supplemental.length} supplemental skills`
      }
    ]
  };
}
