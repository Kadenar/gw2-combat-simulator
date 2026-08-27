import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const API_ROOT = 'https://api.guildwars2.com/v2';
const WIKI_API = 'https://wiki.guildwars2.com/api.php';
const SUPPLEMENTAL = [
  { id: 31796, name: 'Cosmic Ray', specialization: 'Druid', type: 'Bundle' },
  { id: 31406, name: 'Seed of Life', specialization: 'Druid', type: 'Bundle' },
  { id: 31318, name: 'Lunar Impact', specialization: 'Druid', type: 'Bundle' },
  {
    id: 31894,
    name: 'Rejuvenating Tides',
    specialization: 'Druid',
    type: 'Bundle'
  },
  {
    id: 31503,
    name: 'Natural Convergence',
    specialization: 'Druid',
    type: 'Bundle'
  },
  { id: 77183, name: 'Keen Shot', specialization: 'Galeshot', type: 'Bundle' },
  { id: 76664, name: 'Hawkeye', specialization: 'Galeshot', type: 'Bundle' },
  { id: 77319, name: 'Bluster', specialization: 'Galeshot', type: 'Bundle' },
  {
    id: 77012,
    name: 'Fleeting Zephyr',
    specialization: 'Galeshot',
    type: 'Bundle'
  },
  {
    id: 77334,
    name: "Quarry's Peril",
    specialization: 'Galeshot',
    type: 'Bundle'
  },
  { id: 76722, name: 'Pelt', specialization: 'Galeshot', type: 'Bundle' },
  {
    id: 77174,
    name: 'Supersonic Arrow',
    specialization: 'Galeshot',
    type: 'Bundle'
  }
];
const BOONS = new Set([
  'Aegis',
  'Alacrity',
  'Fury',
  'Might',
  'Protection',
  'Quickness',
  'Regeneration',
  'Resistance',
  'Resolution',
  'Stability',
  'Swiftness',
  'Vigor'
]);
const CONDITIONS = new Set([
  'Bleeding',
  'Burning',
  'Chilled',
  'Confusion',
  'Crippled',
  'Immobilized',
  'Poisoned',
  'Slow',
  'Torment',
  'Vulnerability',
  'Weakness'
]);
const CONTROL_TYPES = new Set([
  'Daze',
  'Fear',
  'Float',
  'Knockback',
  'Knockdown',
  'Launch',
  'Pull',
  'Sink',
  'Stun',
  'Taunt'
]);

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'gw2-combat-simulator/2.0 Ranger generator' }
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
  return String(value || '')
    .normalize('NFKD')
    .replace(/['\u2019]/g, '')
    .replace(/[^a-z0-9]+/gi, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();
}

function stableKeys(entries) {
  const used = new Set();
  const result = new Map();

  for (const skill of entries) {
    const base = constantName(skill.name);
    const key = used.has(base) ? `${base}_ID_${skill.id}` : base;

    used.add(base);
    result.set(skill.id, key);
  }

  return result;
}

function activationFromWikitext(wikitext, skillId) {
  const infobox = String(wikitext || '').match(/\{\{Skill infobox[\s\S]*?\n\}\}/i)?.[0] || '';

  if (!infobox) return 0;
  const ids = infobox.match(/^\|\s*id\s*=\s*([^\n]+)/im)?.[1] || '';

  if (ids && !ids.match(new RegExp(`(^|\\D)${skillId}(\\D|$)`))) return 0;
  const raw = infobox.match(/^\|\s*activation\s*=\s*([0-9.]+)/im)?.[1];

  return raw ? Math.round(Number(raw) * 1000) : 0;
}

async function wikiActivation(skill) {
  const query = new URLSearchParams({
    action: 'parse',
    prop: 'wikitext',
    format: 'json',
    formatversion: '2',
    page: skill.name
  });

  try {
    const result = await fetchJson(`${WIKI_API}?${query}`);

    return activationFromWikitext(result.parse?.wikitext, skill.id);
  } catch {
    return 0;
  }
}

async function mapConcurrent(values, limit, callback) {
  const output = new Array(values.length);
  let next = 0;

  await Promise.all(
    Array.from({ length: limit }, async () => {
      while (next < values.length) {
        const index = next++;

        output[index] = await callback(values[index]);
      }
    })
  );

  return output;
}

function effectsFor(skill, petSkill) {
  const effects = [];
  const actor = petSkill ? { source: 'ranger-pet', actorType: 'summon' } : {};

  for (const fact of skill.facts || []) {
    if (fact.type === 'Damage' && Number(fact.dmg_multiplier) > 0) {
      const hits = Math.max(1, Number(fact.hit_count || 1));

      effects.push({
        type: 'strike',
        coefficient: Number(fact.dmg_multiplier) * hits,
        hits,
        ...(fact.text !== 'Damage' ? { name: `${skill.name} - ${fact.text}` } : {}),
        ...actor
      });
    } else if (fact.type === 'Buff' && fact.status === 'Blindness') {
      effects.push({ type: 'blind', ...actor });
    } else if (fact.type === 'Buff' && CONDITIONS.has(fact.status) && Number(fact.duration || 0) > 0) {
      effects.push({
        type: 'condition',
        condition: fact.status,
        stacks: Math.max(1, Number(fact.apply_count || 1)),
        duration: Number(fact.duration || 0),
        ...actor
      });
    } else if (fact.type === 'Buff' && BOONS.has(fact.status) && Number(fact.duration || 0) > 0) {
      effects.push({
        type: 'boon',
        boon: fact.status.toLowerCase(),
        duration: Number(fact.duration || 0),
        stacks: Math.max(1, Number(fact.apply_count || 1)),
        ...actor
      });
    } else if (CONTROL_TYPES.has(fact.type)) {
      effects.push({ type: 'control', ...actor });
    }
  }

  return effects;
}

function ownerOf(skill, petIds) {
  if (petIds.has(skill.id) || skill.type === 'Weapon' || !skill.specialization) {
    if (skill.type !== 'Profession') return 'Core';
  }

  if ([31869, 31411].includes(skill.id)) return 'Druid';

  if ([63094, 63147, 63209, 63258, 63344].includes(skill.id)) return 'Untamed';

  if ([76787, 77213].includes(skill.id)) return 'Galeshot';

  if (skill.type === 'Profession') return 'Soulbeast';

  return skill.specialization || 'Core';
}

// Generates Ranger mechanics from the just-fetched API snapshot so refreshing
// data remains a single process without an intermediate TypeScript build.
export async function generateRangerSkillMechanics({ skills: apiSkills }) {
  const petIds = await fetchJson(`${API_ROOT}/pets?lang=en`);
  const pets = await fetchMany('pets', petIds);
  const petSkillIds = [...new Set(pets.flatMap((pet) => pet.skills.map((skill) => skill.id)))];
  const petSkills = await fetchMany('skills', petSkillIds);
  const petSet = new Set(petSkillIds);
  const identities = [...apiSkills, ...petSkills, ...SUPPLEMENTAL];
  const keyById = stableKeys(identities);
  const rawSkills = await fetchMany('skills', [...new Set([...apiSkills.map((skill) => skill.id), ...petSkillIds])]);
  const rawById = new Map(rawSkills.map((skill) => [skill.id, skill]));
  const activations = await mapConcurrent(identities, 8, wikiActivation);
  const activationById = new Map(identities.map((skill, index) => [skill.id, activations[index]]));

  const supplementalMechanics = new Map([
    [31796, { castTimeMs: 500, effects: [] }],
    [31406, { castTimeMs: 0, effects: [{ type: 'blind' }] }],
    [31318, { castTimeMs: 750, effects: [{ type: 'control' }] }],
    [
      31894,
      {
        castTimeMs: 500,
        effects: [{ type: 'boon', boon: 'might', duration: 10, stacks: 5 }]
      }
    ],
    [
      31503,
      {
        castTimeMs: 2500,
        effects: [
          {
            type: 'strike',
            coefficient: 0.75,
            hits: 4,
            atMs: 0,
            intervalMs: 500,
            timingAnchor: 'castStart',
            timingScale: 'fixed'
          },
          {
            type: 'strike',
            coefficient: 2,
            hits: 1,
            atMs: 2500,
            timingAnchor: 'castStart',
            timingScale: 'fixed'
          },
          { type: 'condition', condition: 'Immobilized', stacks: 4, duration: 2 },
          { type: 'control' }
        ]
      }
    ],
    [
      77183,
      {
        castTimeMs: 500,
        effects: [{ type: 'strike', coefficient: 0.75, hits: 1 }],
        arrowCost: 0
      }
    ],
    [
      76664,
      {
        castTimeMs: 1000,
        effects: [{ type: 'strike', coefficient: 6.8, hits: 5 }],
        arrowCost: 0,
        handlerId: 'ranger.cyclone-bow-skill'
      }
    ],
    [
      77319,
      {
        castTimeMs: 750,
        effects: [{ type: 'strike', coefficient: 1.92, hits: 3 }],
        arrowCost: 1,
        handlerId: 'ranger.cyclone-bow-skill'
      }
    ],
    [
      77012,
      {
        castTimeMs: 250,
        effects: [
          { type: 'strike', coefficient: 0.8, hits: 1 },
          { type: 'condition', condition: 'Crippled', stacks: 1, duration: 4 }
        ],
        arrowCost: 1,
        handlerId: 'ranger.cyclone-bow-skill'
      }
    ],
    [
      77334,
      {
        castTimeMs: 500,
        effects: [
          { type: 'strike', coefficient: 2.5, hits: 1 },
          { type: 'condition', condition: 'Immobilized', stacks: 1, duration: 2 }
        ],
        arrowCost: 2,
        handlerId: 'ranger.cyclone-bow-skill'
      }
    ],
    [
      76722,
      {
        castTimeMs: 500,
        effects: [{ type: 'strike', coefficient: 2.5, hits: 1 }],
        arrowCost: 1,
        handlerId: 'ranger.cyclone-bow-skill'
      }
    ],
    [
      77174,
      {
        castTimeMs: 1000,
        effects: [{ type: 'strike', coefficient: 4, hits: 1 }, { type: 'control' }],
        arrowCost: 3,
        handlerId: 'ranger.cyclone-bow-skill'
      }
    ]
  ]);

  const overrides = new Map([
    [31869, { castTimeMs: 0, effects: [], handlerId: 'ranger.celestial-avatar-enter' }],
    [31411, { castTimeMs: 0, effects: [], handlerId: 'ranger.celestial-avatar-exit' }],
    [42944, { castTimeMs: 0, effects: [], handlerId: 'ranger.beastmode-enter' }],
    [43014, { castTimeMs: 0, effects: [], handlerId: 'ranger.beastmode-exit' }],
    [45717, { castTimeMs: 0, effects: [], handlerId: 'ranger.one-wolf-pack' }],
    [63147, { castTimeMs: 0, effects: [], handlerId: 'ranger.unleash-ranger' }],
    [63344, { castTimeMs: 0, effects: [], handlerId: 'ranger.unleash-pet' }],
    [76787, { castTimeMs: 0, effects: [], handlerId: 'ranger.cyclone-bow-enter' }],
    [77213, { castTimeMs: 0, effects: [], handlerId: 'ranger.cyclone-bow-exit' }],
    [76979, { arrowsRestored: 2, handlerId: 'ranger.galeshot-arrows' }]
  ]);

  const declarations = {
    Core: [],
    Druid: [],
    Soulbeast: [],
    Untamed: [],
    Galeshot: []
  };

  function normalizeCastTiming(mechanics) {
    if (mechanics.castTimeMs == null || mechanics.quicknessCastTimeMs == null) {
      return mechanics;
    }

    const castTimeMs = Number(mechanics.castTimeMs);
    const quicknessCastTimeMs = Number(mechanics.quicknessCastTimeMs);

    if (castTimeMs === quicknessCastTimeMs) {
      const { quicknessCastTimeMs: _quicknessCastTimeMs, ...normalized } = mechanics;

      return castTimeMs > 0 ? { ...normalized, unaffectedByQuickness: true } : normalized;
    }

    const scale = (quicknessCastTimeMs * 1.5) / castTimeMs;
    const scaleTiming = (value) => Number((Number(value) * scale).toFixed(12));
    const effects = mechanics.effects?.map((effect) => {
      if (effect.timingScale !== 'cast') return effect;

      return {
        ...effect,
        ...(Array.isArray(effect.ticks)
          ? {
              ticks: effect.ticks.map((tick) => ({
                ...tick,
                atMs: scaleTiming(tick.atMs)
              }))
            }
          : {}),
        ...(effect.atMs == null ? {} : { atMs: scaleTiming(effect.atMs) }),
        ...(effect.intervalMs == null || effect.intervalTimingScale === 'fixed'
          ? {}
          : { intervalMs: scaleTiming(effect.intervalMs) })
      };
    });
    const { castTimeMs: _castTimeMs, ...normalized } = mechanics;

    return effects ? { ...normalized, effects } : normalized;
  }

  for (const identity of identities) {
    const raw = rawById.get(identity.id) || identity;
    const petSkill = petSet.has(identity.id);
    const castTimeMs = activationById.get(identity.id) || (petSkill ? 500 : identity.type === 'Profession' ? 0 : 500);
    const base = supplementalMechanics.get(identity.id) || {
      castTimeMs,
      effects: effectsFor(raw, petSkill)
    };
    const mechanics = normalizeCastTiming({
      implemented: true,
      ...base,
      ...(castTimeMs > 0 ? { quicknessCastTimeMs: Math.round(castTimeMs / 1.5) } : {}),
      ...(petSkill ? { petSkill: true } : {}),
      ...(overrides.get(identity.id) || {})
    });

    declarations[ownerOf(identity, petSet)].push({
      key: keyById.get(identity.id),
      mechanics
    });
  }

  const constants = {
    Core: 'RANGER_CORE_BASE_SKILL_MECHANICS',
    Druid: 'DRUID_BASE_SKILL_MECHANICS',
    Soulbeast: 'SOULBEAST_BASE_SKILL_MECHANICS',
    Untamed: 'UNTAMED_BASE_SKILL_MECHANICS',
    Galeshot: 'GALESHOT_BASE_SKILL_MECHANICS'
  };
  const directories = {
    Core: 'core',
    Druid: 'specializations/druid',
    Soulbeast: 'specializations/soulbeast',
    Untamed: 'specializations/untamed',
    Galeshot: 'specializations/galeshot'
  };

  for (const [owner, entries] of Object.entries(declarations)) {
    const importPath = owner === 'Core' ? '../data/ids.js' : '../../data/ids.js';
    const typePath = owner === 'Core' ? '../../../platform/engine/types.js' : '../../../../platform/engine/types.js';
    const extraSource =
      owner === 'Core'
        ? `

export const RANGER_CORE_EXTRA_SKILLS: readonly Skill[] = Object.freeze([
  {
    id: ID.PATH_OF_SCARS_MAX_RANGE,
    name: "Path of Scars (Max Range)",
    description:
      "Throw your axe from maximum range so its returning strike lands later.",
    icon: "https://render.guildwars2.com/file/B5B27723701C39327D2145DEE76579FB007F9344/103903.png",
    variantBadge: "MAX",
    type: "Weapon",
    weapon: "Axe",
    slot: "Weapon_4",
    quicknessCastTimeMs: 440,
    rechargeAnchor: "castStart",
    cooldown: 15,
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          { atMs: 400, coefficient: 1.2 },
          { atMs: 1640, coefficient: 1.2 },
        ],
        timingAnchor: "castStart",
        timingScale: "fixed",
        persistsAfterInterrupt: true,
      },
      {
        type: "control",
        atMs: 1640,
        timingAnchor: "castStart",
        timingScale: "fixed",
        persistsAfterInterrupt: true,
        metadata: { controlKind: "pull" },
      },
    ],
  },
  {
    id: ID.DODGE,
    name: "Dodge",
    description: "Perform a dodge roll.",
    icon: "https://wiki.guildwars2.com/images/b/b2/Dodge.png",
    type: "Action",
    weapon: "",
    slot: "Action",
    castTimeMs: 800,
    unaffectedByQuickness: true,
    rechargeAnchor: "castStart",
    cooldown: 0,
    implemented: true,
    handlerId: "ranger.dodge",
    effects: [],
  },
  {
    id: ID.PET_SWAP,
    name: "Swap Pets",
    description: "Swap your active pet and trigger pet-swap traits.",
    icon: "",
    type: "Action",
    weapon: "",
    slot: "Action",
    castTimeMs: 0,
    rechargeAnchor: "castStart",
    cooldown: 20,
    implemented: true,
    handlerId: "ranger.pet-swap",
    effects: [],
  },
  {
    id: ID.SWAP_WEAPONS,
    name: "Swap Weapons",
    description: "Swap to your alternate weapon set.",
    icon: "https://wiki.guildwars2.com/images/c/ce/Weapon_Swap_Button.png",
    type: "Action",
    slot: "Action",
    castTimeMs: 0,
    rechargeAnchor: "castStart",
    cooldown: 10,
    implemented: true,
    handlerId: "ranger.weapon-swap",
    effects: [],
  },
]);`
        : '';
    const source = `/** Explicit PvE skill mechanics owned by the ${owner} Ranger module. */
import { RANGER_SKILL_IDS as ID } from ${JSON.stringify(importPath)};
import type { ${owner === 'Core' ? 'Skill, ' : ''}SkillFragment } from ${JSON.stringify(typePath)};

export const ${constants[owner]}: Readonly<Record<number, SkillFragment>> = Object.freeze({
${entries.map((entry) => `  [ID.${entry.key}]: ${JSON.stringify(entry.mechanics, null, 2).replace(/\n/g, '\n  ')},`).join('\n')}
});${extraSource}
`;
    const target = fileURLToPath(
      new URL(`../../js/games/gw2/content/professions/ranger/${directories[owner]}/skills.ts`, import.meta.url)
    );

    await writeFile(target, source, 'utf8');
    console.log(`Wrote ${entries.length} ${owner} Ranger skill mechanics.`);
  }
}
