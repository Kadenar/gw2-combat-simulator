/** Compiles the selected application build using pinned Guardian content; it never treats fixture stats as user gear. */
import { calculateCommonAttributes, PRIMARY_ATTRIBUTES } from '#gw2/platform/builds/attributes.js';
import { withUpstreamSkillConventions } from '#gw2/platform/combat-engine/configuration.js';
import { rejectPreviewInput } from '#gw2/platform/simulation/combat-engine-adapter/input.js';
import { adaptRotation } from '#gw2/platform/simulation/combat-engine-adapter/rotation.js';
import { createGuardianBuildDefaults, validateGuardianBuild } from '#gw2/professions/guardian/build/build.js';
import { guardianCatalog } from '#gw2/professions/guardian/catalog.js';
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';
import { REFERENCE_PLAYER } from '#gw2/professions/guardian/combat-engine/reference-content.js';
import { ZEALOTS_FLAME_FLIP_DURATION_MS } from '#gw2/professions/guardian/core/skills/weapons/torch.js';
import type { CombatPreviewInput, AdaptedEngineRequest } from '#gw2/platform/simulation/combat-engine-adapter/input.js';

export const GUARDIAN_PREVIEW_CONTENT_REVISION = 'guardian-willbender-cc9a0d0-adapter-2';

/** Numeric editor identities are explicit; names below are pinned engine keys, not a display-name lookup. */
export const GUARDIAN_PREVIEW_SKILL_KEYS = new Map([
  [ID.SWAP_WEAPONS, 'Weapon Swap'],
  [ID.THROUGH_THE_HEART, 'Through the Heart'],
  [ID.PEACEKEEPER, 'Peacekeeper'],
  [ID.SYMBOL_OF_IGNITION, 'Symbol of Ignition'],
  [ID.HAIL_OF_JUSTICE, 'Hail of Justice'],
  [ID.JURISDICTION, 'Jurisdiction Lvl 3'],
  [ID.ZEALOTS_FLAME, "Zealot's Flame"],
  [ID.ZEALOTS_FIRE, "Zealot's Fire"],
  [ID.CLEANSING_FLAME, 'Cleansing Flame'],
  [ID.SIGNET_OF_WRATH, 'Signet of Wrath'],
  [ID.PURGING_FLAMES, 'Purging Flames'],
  [ID.WHIRLING_LIGHT, 'Whirling Light'],
  [ID.RUSHING_JUSTICE, 'Rushing Justice'],
  [ID.FLOWING_RESOLVE, 'Flowing Resolve'],
  [ID.CRASHING_COURAGE, 'Crashing Courage']
]);

const fixedFields: Readonly<Record<string, unknown>> = {
  weapons: ['Pistol', 'Torch'],
  alternateWeapons: ['Pistol', 'Pistol'],
  rune: 'Balthazar',
  weaponSigils: [
    ['Bursting', 'Air'],
    ['Bursting', 'Torment']
  ],
  relic: 'Fractal',
  food: 'Cilantro and Cured Meat Flatbread',
  utility: 'Toxic Tuning Crystal',
  specializations: [
    { name: 'Radiance', traits: '2-2-1' },
    { name: 'Virtues', traits: '3-1-1' },
    { name: 'Willbender', traits: '1-1-2' }
  ],
  selectedSkills: {
    Heal: 'Litany of Wrath',
    Utility1: 'Purging Flames',
    Utility2: 'Whirling Light',
    Utility3: 'Signet of Wrath',
    Elite: "Heaven's Palm"
  },
  targetStartingHealthPercent: 100,
  precastRelics: [],
  initialTomePages: 5
};

const boonKeys = [
  'fury',
  'quickness',
  'alacrity',
  'protection',
  'resolution',
  'regeneration',
  'swiftness',
  'vigor',
  'aegis'
];
const conditionKeys: Readonly<Record<string, string>> = {
  Bleeding: 'BLEEDING',
  Burning: 'BURNING',
  Torment: 'TORMENT',
  Confusion: 'CONFUSION',
  Poisoned: 'POISON',
  Chilled: 'CHILLED',
  Cripple: 'CRIPPLED',
  Slow: 'SLOW',
  Weakness: 'WEAKNESS',
  Vulnerability: 'VULNERABILITY'
};

/** Compare object values independent of property insertion order. */
function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  const left = Object.entries(a),
    right = Object.entries(b);
  return (
    left.length === right.length &&
    left.every(([key, value]) => Object.hasOwn(b, key) && sameValue(value, (b as Record<string, unknown>)[key]))
  );
}

export function compileGuardianPreview({
  selection,
  rotation,
  operation = 'baseline'
}: CombatPreviewInput): AdaptedEngineRequest {
  if (operation !== 'baseline') rejectPreviewInput('operation', `The preview does not support ${operation}.`);
  if (selection.contentRevision !== GUARDIAN_PREVIEW_CONTENT_REVISION)
    rejectPreviewInput('selection.contentRevision', 'Unknown Guardian preview content revision.');
  if (selection.patchId !== 'reference')
    rejectPreviewInput('selection.patchId', 'This content supports only the pinned reference patch.');
  const build = selection.build;
  const validation = validateGuardianBuild(build);
  if (!validation.valid) rejectPreviewInput('build', validation.errors.join('; '));
  const defaults = createGuardianBuildDefaults();
  for (const key of Object.keys(build)) {
    if (!Object.hasOwn(defaults, key) && key !== 'precastRelics')
      rejectPreviewInput(`build.${key}`, 'Unsupported build field.');
  }

  for (const [key, value] of Object.entries(fixedFields)) {
    if (!sameValue(build[key] ?? defaults[key], value))
      rejectPreviewInput(`build.${key}`, 'This selection is outside the supported Willbender preview content.');
  }

  const assumptions = build.assumptions;
  for (const key of boonKeys) {
    if (typeof assumptions[key] !== 'boolean') rejectPreviewInput(`build.assumptions.${key}`, 'Expected a boolean.');
  }

  if (!Number.isSafeInteger(assumptions.might) || Number(assumptions.might) < 0 || Number(assumptions.might) > 25)
    rejectPreviewInput('build.assumptions.might', 'Expected an integer from 0 to 25.');
  const supportedAssumptions = new Set([
    ...boonKeys,
    'might',
    'targetConditions',
    'simulationMode',
    'permanentComboField',
    'targetMoving',
    'targetBoonless',
    'targetSkillActivationsPerSecond'
  ]);
  for (const key of Object.keys(assumptions)) {
    if (!supportedAssumptions.has(key)) rejectPreviewInput(`build.assumptions.${key}`, 'Unsupported assumption.');
  }

  for (const [key, expected] of Object.entries({
    simulationMode: 'deterministic',
    permanentComboField: 'none',
    targetMoving: false,
    targetBoonless: true,
    targetSkillActivationsPerSecond: 0
  })) {
    if ((assumptions[key] ?? expected) !== expected)
      rejectPreviewInput(`build.assumptions.${key}`, 'Unsupported assumption value.');
  }

  // Common calculation supplies base, gear, upgrades and consumables. Reference traits and boons remain engine-owned.
  const common = [1, 2].map((weaponSet) => calculateCommonAttributes(build, { weaponSet }).attributes);
  const attributeName = (name: string) => name.toLowerCase().replaceAll(' ', '_');
  const attributes = PRIMARY_ATTRIBUTES.map((name) => [attributeName(name), common[0][name].final]);
  const uniqueEffects = structuredClone(REFERENCE_PLAYER.permanent_unique_effects) as Record<string, unknown>[];
  const removed = new Set(['Jade Bot Core: Tier 10', 'Toxic Focusing Crystal']);
  const effects = uniqueEffects
    .filter((effect) => !removed.has(String(effect.unique_effect_key)))
    .map((effect) => {
      if (effect.unique_effect_key === 'Balthazar Rune') {
        // Keep only duration; the common attribute calculator already includes the rune's condition damage.
        effect.attribute_modifiers = (effect.attribute_modifiers as Record<string, unknown>[]).filter(
          (modifier) => modifier.attribute !== 'condition_damage'
        );
      }

      if (effect.unique_effect_key === 'Cilantro and Cured Meat Flatbread') effect.attribute_modifiers = [];
      return effect;
    });
  effects.push({
    unique_effect_key: 'Selected second-set gear',
    attribute_modifiers: PRIMARY_ATTRIBUTES.flatMap((name) => {
      const delta = common[1][name].final - common[0][name].final;
      return delta === 0 ? [] : [{ attribute: attributeName(name), addend: delta, condition: { weapon_set: 'set_2' } }];
    })
  });
  const player = withUpstreamSkillConventions({
    ...REFERENCE_PLAYER,
    // The pinned engine enum predates Willbender. Its generic/invalid value has no profession mechanics attached.
    profession: 'invalid',
    attributes,
    initial_weapon_set: `set_${build.startingWeaponSet}`,
    permanent_unique_effects: effects,
    permanent_effects: [
      ...boonKeys.filter((key) => assumptions[key]).map((key) => key.toUpperCase()),
      ...Array(Number(assumptions.might ?? 0)).fill('MIGHT')
    ]
  });
  // Radiant Fire's existing flip window is part of the UI model, distinct from the pinned pulse damage content.
  const playerSkills = structuredClone(REFERENCE_PLAYER.skills) as Record<string, unknown>[];
  for (const skill of playerSkills) {
    if (skill.skill_key !== GUARDIAN_PREVIEW_SKILL_KEYS.get(ID.ZEALOTS_FLAME)) continue;
    for (const tick of skill.skill_ticks as Record<string, unknown>[]) {
      for (const application of tick.on_pulse_effect_applications as Record<string, unknown>[]) {
        if ((application.unique_effect as Record<string, unknown>)?.unique_effect_key === "Zealot's Flame")
          application.base_duration_ms = ZEALOTS_FLAME_FLIP_DURATION_MS.radiantFire;
      }
    }
  }

  (player as Record<string, unknown>).skills = (
    withUpstreamSkillConventions({ skills: playerSkills }) as Record<string, unknown>
  ).skills;
  const adapted = adaptRotation(
    player as Record<string, unknown>,
    rotation,
    GUARDIAN_PREVIEW_SKILL_KEYS,
    guardianCatalog.skillsById,
    assumptions.quickness === true
  );
  const targetEffects: string[] = [];
  for (const [key, value] of Object.entries((assumptions.targetConditions as Record<string, unknown>) ?? {})) {
    if (!conditionKeys[key])
      rejectPreviewInput(`build.assumptions.targetConditions.${key}`, 'Unsupported target condition.');
    const count = typeof value === 'boolean' ? Number(value) : value;
    if (typeof count !== 'number' || !Number.isSafeInteger(count) || count < 0 || count > 1500)
      rejectPreviewInput(`build.assumptions.targetConditions.${key}`, 'Expected a non-negative integer stack count.');
    targetEffects.push(...Array(count).fill(conditionKeys[key]));
  }

  return {
    contentRevision: GUARDIAN_PREVIEW_CONTENT_REVISION,
    commandSkills: adapted.commandSkills,
    damageSources: adapted.damageSources,
    encounter: {
      actors: [
        { name: 'player', team: 1, build: adapted.build, rotation: adapted.rotation },
        {
          name: 'golem',
          team: 2,
          build: {
            attributes: [
              ['max_health', build.targetHealth],
              ['armor', build.targetArmor]
            ],
            permanent_effects: targetEffects
          }
        }
      ],
      termination_conditions: [{ type: 'ROTATION', actor: 'player' }],
      audit_configuration: { audits_to_perform: ['SKILL_CASTS', 'EFFECT_APPLICATIONS', 'DAMAGE', 'ACTOR_DOWNSTATE'] },
      require_afk_skills: false,
      condition_tick_offset: 200,
      weapon_strength_mode: 'MEAN',
      critical_strike_mode: 'MEAN'
    }
  };
}
