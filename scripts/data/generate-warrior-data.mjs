import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  SKILLS,
  SPECIALIZATIONS,
} from "../../js/professions/warrior/data/warrior-api-metadata.js";

const API_ROOT = "https://api.guildwars2.com/v2";
const WIKI_API = "https://wiki.guildwars2.com/api.php";
const SPECIALIZATION_BY_ID = new Map(
  SPECIALIZATIONS.map((specialization) => [
    specialization.id,
    specialization.name,
  ]),
);
const CANONICAL_SKILLS = Object.freeze(
  SKILLS.filter((skill) => !/^\(\(/.test(String(skill.name || ""))),
);
const SUPPLEMENTAL_NAMES = Object.freeze([
  "Swift Cut",
  "Steel Divide",
  "Explosive Thrust",
  "Blooming Fire",
  "Artillery Slash",
  "Cyclone Trigger",
  "Break Step",
  "Dragon Slash—Force",
  "Dragon Slash—Boost",
  "Dragon Slash—Reach",
  "Flicker Step",
  "Triggerguard",
]);
const SUPPLEMENTAL_OVERRIDES_BY_ID = new Map([
  [62966, { icon: "https://wiki.guildwars2.com/images/e/e3/Swift_Cut.png" }],
  [62772, { icon: "https://wiki.guildwars2.com/images/9/9a/Steel_Divide.png" }],
  [
    62918,
    { icon: "https://wiki.guildwars2.com/images/9/99/Explosive_Thrust.png" },
  ],
  [
    62930,
    {
      icon: "https://wiki.guildwars2.com/images/d/d0/Blooming_Fire.png",
      ammo: 2,
      ammoRecharge: 10,
    },
  ],
  [
    62732,
    {
      icon: "https://wiki.guildwars2.com/images/6/68/Artillery_Slash.png",
      ammo: 2,
      ammoRecharge: 15,
    },
  ],
  [
    62789,
    {
      icon: "https://wiki.guildwars2.com/images/6/6c/Cyclone_Trigger.png",
      ammo: 2,
      ammoRecharge: 20,
    },
  ],
  [
    62885,
    {
      icon: "https://wiki.guildwars2.com/images/7/76/Break_Step.png",
      ammo: 2,
      ammoRecharge: 20,
    },
  ],
  [
    62797,
    {
      icon: "https://wiki.guildwars2.com/images/b/b5/Dragon_Slash%E2%80%94Force.png",
    },
  ],
  [
    62980,
    {
      icon: "https://wiki.guildwars2.com/images/7/75/Dragon_Slash%E2%80%94Boost.png",
    },
  ],
  [
    62951,
    {
      icon: "https://wiki.guildwars2.com/images/e/eb/Dragon_Slash%E2%80%94Reach.png",
    },
  ],
  [62926, { icon: "https://wiki.guildwars2.com/images/d/de/Flicker_Step.png" }],
  [62893, { icon: "https://wiki.guildwars2.com/images/4/4e/Triggerguard.png" }],
]);
const BOONS = new Set([
  "Aegis",
  "Alacrity",
  "Fury",
  "Might",
  "Protection",
  "Quickness",
  "Regeneration",
  "Resistance",
  "Resolution",
  "Stability",
  "Swiftness",
  "Vigor",
]);
const CONDITIONS = new Set([
  "Bleeding",
  "Burning",
  "Chilled",
  "Confusion",
  "Crippled",
  "Immobilized",
  "Poisoned",
  "Slow",
  "Torment",
  "Vulnerability",
  "Weakness",
]);
const CONTROL_TYPES = new Set([
  "Daze",
  "Fear",
  "Float",
  "Knockback",
  "Knockdown",
  "Launch",
  "Pull",
  "Sink",
  "Stun",
  "Taunt",
]);

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { "User-Agent": "gw2-combat-simulator/2.0 Warrior generator" },
  });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.json();
}

async function fetchMany(endpoint, ids) {
  const result = [];
  for (let index = 0; index < ids.length; index += 100) {
    result.push(
      ...(await fetchJson(
        `${API_ROOT}/${endpoint}?ids=${ids.slice(index, index + 100).join(",")}&lang=en`,
      )),
    );
  }
  return result;
}

function constantName(value) {
  const normalized = String(value || "")
    .normalize("NFKD")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
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
  return (
    String(wikitext || "").match(/\{\{Skill infobox[\s\S]*?\n\}\}/i)?.[0] || ""
  );
}

function infoboxId(wikitext) {
  const raw =
    skillInfobox(wikitext).match(/^\|\s*id\s*=\s*([^\n]+)/im)?.[1] || "";
  return Number(raw.match(/\d+/)?.[0] || 0);
}

function activationFromWikitext(wikitext, skillId) {
  const infobox = skillInfobox(wikitext);
  if (!infobox) return 0;
  const ids = infobox.match(/^\|\s*id\s*=\s*([^\n]+)/im)?.[1] || "";
  if (ids && !ids.match(new RegExp(`(^|\\D)${skillId}(\\D|$)`))) return 0;
  const raw = infobox.match(/^\|\s*activation\s*=\s*([0-9.]+)/im)?.[1];
  return raw ? Math.round(Number(raw) * 1000) : 0;
}

async function wikiWikitext(name) {
  const query = new URLSearchParams({
    action: "parse",
    prop: "wikitext",
    format: "json",
    formatversion: "2",
    page: name,
    redirects: "1",
  });
  try {
    const result = await fetchJson(`${WIKI_API}?${query}`);
    return String(result.parse?.wikitext || "");
  } catch {
    return "";
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
    }),
  );
  return output;
}

function fact(raw, text, type) {
  return (raw.facts || []).find(
    (candidate) =>
      candidate.text === text && (!type || candidate.type === type),
  );
}

function normalizeRawSkill(raw, identity) {
  const overrides = SUPPLEMENTAL_OVERRIDES_BY_ID.get(identity.id) || {};
  if (!raw) {
    const dragonSlash = identity.name.startsWith("Dragon Slash");
    return {
      id: identity.id,
      name: identity.name,
      description: "Bladesworn gunsaber profession mechanic.",
      icon: overrides.icon || "",
      type: "Bundle",
      weapon: "",
      slot: dragonSlash ? "Weapon_1" : "Weapon_1",
      specialization: "Bladesworn",
      categories: dragonSlash ? ["Burst", "DragonSlash"] : [],
      recharge: dragonSlash ? 1 : 0,
      ammo: Number(overrides.ammo || 0),
      ammoRecharge: Number(overrides.ammoRecharge || 0),
      nextChainId: null,
      flipSkillId: null,
      simulatorExcluded: false,
    };
  }
  const maximumCount = fact(raw, "Maximum Count", "Number")?.value || 0;
  const countRecharge =
    (raw.facts || []).find(
      (candidate) =>
        candidate.text === "Count Recharge" && candidate.type === "Time",
    )?.duration || 0;
  return {
    id: raw.id,
    name: raw.name,
    description: raw.description || "",
    icon: raw.icon || overrides.icon || "",
    type: "Bundle",
    weapon: "",
    slot: raw.slot || "Weapon_1",
    specialization: "Bladesworn",
    categories: raw.categories || [],
    recharge: Number(fact(raw, "Recharge", "Recharge")?.value || 0),
    ammo: Number(overrides.ammo ?? maximumCount),
    ammoRecharge: Number(overrides.ammoRecharge ?? countRecharge),
    nextChainId: raw.next_chain || null,
    flipSkillId: raw.flip_skill || null,
    simulatorExcluded: false,
  };
}

function effectsFor(raw) {
  const effects = [];
  const seenFacts = new Set();
  for (const current of raw.facts || []) {
    const factKey = [current.type, current.text, current.status || ""].join(
      "|",
    );
    if (seenFacts.has(factKey)) continue;
    seenFacts.add(factKey);
    if (current.type === "Damage" && Number(current.dmg_multiplier) > 0) {
      const burstLevel = Number(
        String(current.text || "").match(/^Level (\d+) Damage$/i)?.[1] || 0,
      );
      if (burstLevel > 1) continue;
      const hits = Math.max(1, Number(current.hit_count || 1));
      const healthThreshold = Number(
        String(current.text || "").match(/under (\d+)% health/i)?.[1] || 0,
      );
      const baseStrike = [...effects]
        .reverse()
        .find((effect) => effect.type === "strike");
      if (
        healthThreshold > 0 &&
        baseStrike &&
        Number(baseStrike.coefficient) > 0
      ) {
        baseStrike.coefficientModifiers = [
          {
            kind: "target-health-below",
            threshold: healthThreshold / 100,
            multiplier:
              (Number(current.dmg_multiplier) * hits) /
              Number(baseStrike.coefficient),
          },
        ];
        continue;
      }
      effects.push({
        type: "strike",
        coefficient: Number(current.dmg_multiplier) * hits,
        hits,
        ...(current.text !== "Damage"
          ? { name: `${raw.name} — ${current.text}` }
          : {}),
      });
    } else if (current.type === "Buff" && current.status === "Blindness") {
      effects.push({ type: "blind" });
    } else if (
      current.type === "Buff" &&
      CONDITIONS.has(current.status) &&
      Number(current.duration) > 0
    ) {
      effects.push({
        type: "condition",
        condition: current.status,
        stacks: Math.max(1, Number(current.apply_count || 1)),
        duration: Number(current.duration || 0),
      });
    } else if (
      current.type === "Buff" &&
      BOONS.has(current.status) &&
      Number(current.duration) > 0
    ) {
      effects.push({
        type: "boon",
        boon: current.status.toLowerCase(),
        duration: Number(current.duration || 0),
        stacks: Math.max(1, Number(current.apply_count || 1)),
      });
    } else if (
      CONTROL_TYPES.has(current.type) ||
      CONTROL_TYPES.has(current.text)
    ) {
      const controlKind = CONTROL_TYPES.has(current.text)
        ? current.text
        : current.type;
      effects.push({
        type: "control",
        metadata: {
          controlKind: controlKind.toLowerCase(),
          ...(Number(current.duration) > 0
            ? { duration: Number(current.duration) }
            : {}),
        },
      });
    }
  }
  return effects;
}

function ownerOf(identity, raw) {
  if (identity.type === "Weapon" || identity.type === "Bundle") {
    return identity.type === "Bundle" ? "Bladesworn" : "Core";
  }
  return (
    SPECIALIZATION_BY_ID.get(Number(raw.specialization)) ||
    identity.specialization ||
    "Core"
  );
}

function handlerId(identity, raw) {
  if ([30185, 30435].includes(identity.id)) return "warrior.berserk";
  if (identity.id === 44165) return "warrior.full-counter";
  if (identity.id === 62745) return "warrior.gunsaber-enter";
  if (identity.id === 62861) return "warrior.gunsaber-exit";
  if (identity.id === 62803) return "warrior.dragon-trigger";
  if (identity.name.startsWith("Dragon Slash")) return "warrior.dragon-slash";
  if ([76782, 77155, 77342].includes(identity.id)) return "warrior.chant";
  if (Number(raw.cost || 0) > 0 || fact(raw, "Adrenaline", "Number")) {
    return "warrior.resource";
  }
  return "";
}

const supplementalWikitext = await mapConcurrent(
  SUPPLEMENTAL_NAMES,
  6,
  wikiWikitext,
);
const supplementalIds = supplementalWikitext.map((wikitext, index) => ({
  id: infoboxId(wikitext),
  name: SUPPLEMENTAL_NAMES[index],
}));
for (const skill of supplementalIds) {
  if (!skill.id)
    throw new Error(
      `Could not resolve ${skill.name} from the Guild Wars 2 Wiki.`,
    );
}
const rawSkills = await fetchMany("skills", [
  ...new Set(CANONICAL_SKILLS.map((skill) => skill.id)),
]);
const rawById = new Map(rawSkills.map((skill) => [skill.id, skill]));
const supplemental = supplementalIds.map((identity) =>
  normalizeRawSkill(rawById.get(identity.id), identity),
);
const identities = [...CANONICAL_SKILLS, ...supplemental];
const entries = stableEntries(identities);
const keyById = new Map(entries.map((entry) => [entry.id, entry.key]));
const wikitext = await mapConcurrent(identities, 8, (skill) =>
  wikiWikitext(skill.name),
);
const activationById = new Map(
  identities.map((skill, index) => [
    skill.id,
    activationFromWikitext(wikitext[index], skill.id),
  ]),
);

const supplementalMechanics = new Map([
  [
    62966,
    {
      effects: [
        {
          type: "strike",
          name: "Swift Cut — Blade",
          coefficient: 0.9,
          hits: 1,
        },
        {
          type: "strike",
          name: "Swift Cut — Shot",
          coefficient: 0.75,
          hits: 1,
        },
      ],
    },
  ],
  [
    62772,
    {
      effects: [
        {
          type: "strike",
          name: "Steel Divide — Blade",
          coefficient: 1.1,
          hits: 1,
        },
        {
          type: "strike",
          name: "Steel Divide — Shot",
          coefficient: 0.75,
          hits: 1,
        },
      ],
    },
  ],
  [
    62918,
    {
      effects: [
        {
          type: "strike",
          name: "Explosive Thrust — Blade",
          coefficient: 1.35,
          hits: 1,
        },
        {
          type: "strike",
          name: "Explosive Thrust — Explosion",
          coefficient: 1.2,
          hits: 1,
        },
      ],
    },
  ],
  [62930, { effects: [{ type: "strike", coefficient: 4, hits: 5 }] }],
  [62732, { effects: [{ type: "strike", coefficient: 3, hits: 1 }] }],
  [62789, { effects: [{ type: "strike", coefficient: 2.5, hits: 1 }] }],
  [62885, { effects: [{ type: "strike", coefficient: 1.5, hits: 1 }] }],
  [62797, { effects: [], dragonSlashMaximumCoefficient: 20.4 }],
  [62980, { effects: [], dragonSlashMaximumCoefficient: 17 }],
  [62951, { effects: [], dragonSlashMaximumCoefficient: 17 }],
  [62926, { effects: [] }],
  [62893, { effects: [] }],
]);

const declarations = {
  Core: [],
  Berserker: [],
  Spellbreaker: [],
  Bladesworn: [],
  Paragon: [],
};
for (const identity of identities) {
  const raw = rawById.get(identity.id) || identity;
  const castTimeMs =
    activationById.get(identity.id) ||
    (identity.type === "Profession" ? 0 : 500);
  const burst =
    identity.categories?.some((category) => /burst/i.test(category)) ||
    /Burst\./.test(identity.description || "");
  const cost = [30185, 30435].includes(identity.id)
    ? 30
    : burst && !identity.name.startsWith("Dragon Slash")
      ? 10
      : 0;
  const adrenalineGain = Math.max(
    0,
    Number(fact(raw, "Adrenaline", "Number")?.value || 0),
  );
  const flowGain = Math.max(0, Number(fact(raw, "Flow", "Number")?.value || 0));
  const handler = handlerId(identity, raw);
  const mechanics = {
    implemented: true,
    castTimeMs,
    effects: supplementalMechanics.get(identity.id)?.effects || effectsFor(raw),
    ...(castTimeMs > 0
      ? { quicknessCastTimeMs: Math.round(castTimeMs / 1.5) }
      : {}),
    ...(cost > 0
      ? { adrenalineCost: cost, burstTier: Math.max(1, Math.ceil(cost / 10)) }
      : {}),
    ...(adrenalineGain > 0 ? { adrenalineGain } : {}),
    ...(flowGain > 0 ? { flowGain } : {}),
    ...(burst ? { burst: true } : {}),
    ...(identity.categories?.includes("PrimalBurst")
      ? { primalBurst: true }
      : {}),
    ...(identity.type === "Bundle"
      ? { gunsaberSkill: true, skillWeapon: "Gunsaber" }
      : {}),
    ...(identity.name.startsWith("Dragon Slash") ? { dragonSlash: true } : {}),
    ...(supplementalMechanics.get(identity.id) || {}),
    ...(handler ? { handlerId: handler } : {}),
  };
  declarations[ownerOf(identity, raw)].push({
    key: keyById.get(identity.id),
    mechanics,
  });
}

const roots = {
  Core: "core",
  Berserker: "specializations/berserker",
  Spellbreaker: "specializations/spellbreaker",
  Bladesworn: "specializations/bladesworn",
  Paragon: "specializations/paragon",
};
const constants = {
  Core: "WARRIOR_CORE_SKILL_MECHANICS",
  Berserker: "BERSERKER_SKILL_MECHANICS",
  Spellbreaker: "SPELLBREAKER_SKILL_MECHANICS",
  Bladesworn: "BLADESWORN_SKILL_MECHANICS",
  Paragon: "PARAGON_SKILL_MECHANICS",
};
for (const [owner, owned] of Object.entries(declarations)) {
  const importPath = owner === "Core" ? "../data/ids.js" : "../../data/ids.js";
  const typePath =
    owner === "Core"
      ? "../../../platform/engine/types.js"
      : "../../../../platform/engine/types.js";
  const source = `/** Explicit PvE skill mechanics owned by the ${owner} Warrior module. */
import { WARRIOR_SKILL_IDS as ID } from ${JSON.stringify(importPath)};
import type { SkillFragment } from ${JSON.stringify(typePath)};

export const ${constants[owner]}: Readonly<Record<number, SkillFragment>> = Object.freeze({
${owned.map((entry) => `  [ID.${entry.key}]: ${JSON.stringify(entry.mechanics, null, 2).replace(/\n/g, "\n  ")},`).join("\n")}
});
`;
  const target = fileURLToPath(
    new URL(
      `../../js/professions/warrior/${roots[owner]}/skills.ts`,
      import.meta.url,
    ),
  );
  await mkdir(
    fileURLToPath(
      new URL(`../../js/professions/warrior/${roots[owner]}/`, import.meta.url),
    ),
    { recursive: true },
  );
  await writeFile(target, source, "utf8");
  console.log(`Wrote ${owned.length} ${owner} Warrior skill mechanics.`);
}

function declaration(name, values, prefix = []) {
  return [
    `export const ${name} = Object.freeze({`,
    ...prefix.map((line) => `  ${line}`),
    ...values.map((entry) => `  ${entry.key}: ${entry.id}, // ${entry.name}`),
    "});",
  ].join("\n");
}

const traits = stableEntries(
  SPECIALIZATIONS.flatMap((specialization) => [
    ...specialization.minorTraits,
    ...specialization.majorTraits.flat(),
  ]),
);
const specializationEntries = SPECIALIZATIONS.map((specialization) => ({
  key: constantName(specialization.name),
  id: specialization.id,
  name: specialization.name,
}));
const idsSource = [
  "// Generated by scripts/data/generate-warrior-data.mjs.",
  "// Committed constants keep mechanic references independent from metadata loading.",
  "",
  declaration("WARRIOR_SKILL_IDS", entries, ["SWAP_WEAPONS: -3,"]),
  "",
  declaration("WARRIOR_TRAIT_IDS", traits),
  "",
  declaration("WARRIOR_SPECIALIZATION_IDS", specializationEntries),
  "",
].join("\n");
await writeFile(
  fileURLToPath(
    new URL("../../js/professions/warrior/data/ids.ts", import.meta.url),
  ),
  idsSource,
  "utf8",
);

const supplementalSource = `// Generated by scripts/data/generate-warrior-data.mjs.
import type { Skill } from "../../../platform/engine/types.js";

export const WARRIOR_SUPPLEMENTAL_SKILLS: readonly Skill[] = Object.freeze(
  ${JSON.stringify(supplemental, null, 2)},
);
`;
await writeFile(
  fileURLToPath(
    new URL(
      "../../js/professions/warrior/data/warrior-supplemental-skills.ts",
      import.meta.url,
    ),
  ),
  supplementalSource,
  "utf8",
);
console.log(
  `Wrote ${entries.length} skill, ${traits.length} trait, and ${specializationEntries.length} specialization IDs.`,
);
console.log(`Wrote ${supplemental.length} supplemental Bladesworn skills.`);
