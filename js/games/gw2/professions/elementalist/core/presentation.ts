import { CONJURE_PICKUP_WEAPONS } from '#gw2/professions/elementalist/core/constants.js';
import { ELEMENTALIST_LOADOUT_SKILL_IDS } from '#gw2/professions/elementalist/data/skill-identities.js';
import { readProfessionCoreState } from '#gw2/platform/profession-definition/state.js';
import type {
  ProfessionAttributePreviewContext,
  ProfessionAttributePreviewPreparation
} from '#gw2/platform/profession-presentation/attribute-preview.js';
import { planningBuffAt } from '#gw2/platform/results/result-queries.js';
import { elementalistWeaponGroups } from '#gw2/professions/elementalist/core/weapon-groups.js';
import type {
  ElementalistPistolBullets,
  ElementalistSkill,
  ElementalistState,
  ElementalistUiContext,
  ElementalistUiSlice
} from '#gw2/professions/elementalist/types.js';
import { createPreviewControls } from '#gw2/professions/shared/attribute-preview.js';
/**
 * Core Elementalist UI contract.
 *
 * Projects live core state onto the shared build/rotation views: the attunement
 * and weapon-resource palette, which variant of a state-flipped skill is shown
 * and castable at the inspection point, the profession event-log rows, and the
 * timeline's attunement lane. Read-only over simulation state - the one
 * exception is `updatePaletteControl`, which edits the build's starting stock.
 */
import { selectedSkillIdSet } from '#gw2/platform/builds/selected-skills.js';
import { PERMANENT_COMBO_FIELD_ASSUMPTION_CONTROLS } from '#gw2/platform/combos/permanent-field-assumption.js';
import type { SimulationEvent } from '#gw2/platform/events/events.js';
import type { CanonicalCatalog, Skill } from '#gw2/platform/skills/types.js';
import type {
  SkillDamagePreviewPreparation,
  SkillDamageState
} from '#gw2/platform/profession-presentation/skill-damage.js';
import type {
  ProfessionEventLogDescriptor,
  ProfessionPaletteGroup,
  RotationStateSnapshotItem
} from '#gw2/platform/profession-presentation/types.js';
import { SIMULATION_RANDOMNESS_ASSUMPTION_CONTROLS } from '#gw2/platform/builds/randomness-assumptions.js';
import { ELEMENTALIST_ASSUMPTION_CONTROLS } from '#gw2/professions/elementalist/build/assumptions.js';
import { AURA_TRANSMUTE_SKILLS, CONJURE_SKILLS, ETCHING_CHAINS } from '#gw2/professions/elementalist/core/constants.js';
import {
  ELEMENTALIST_ATTUNEMENTS,
  isElementalistAttunement,
  type ElementalistAttunement
} from '#gw2/professions/elementalist/core/state.js';
import {
  ELEMENTALIST_ATTUNEMENT_SKILL_IDS,
  ELEMENTALIST_SKILL_IDS as ID
} from '#gw2/professions/elementalist/data/ids.js';
import { elementalistAttunementResourceAnchor } from '#gw2/professions/elementalist/family-presentation.js';

const ATTUNEMENT_COLORS: Readonly<Record<ElementalistAttunement, string>> = Object.freeze({
  Fire: '#d94c35',
  Water: '#368bc9',
  Air: '#9b65c7',
  Earth: '#a7783f'
});

const PISTOL_BULLET_CONTROL_PREFIX = 'elementalist-pistol-bullet:';
const PISTOL_BULLETS = Object.freeze([
  {
    element: 'Fire',
    label: 'Fire Bullet',
    skillName: 'Scorching Shot'
  },
  {
    element: 'Water',
    label: 'Ice Bullet',
    skillName: 'Soothing Splash'
  },
  {
    element: 'Air',
    label: 'Air Bullet',
    skillName: 'Electric Exposure'
  },
  {
    element: 'Earth',
    label: 'Earth Bullet',
    skillName: 'Piercing Pebble'
  }
] as const);

// Palettes read the flat projection for either the insertion point or the completed run.
export function elementalistUiState(context: ElementalistUiContext): Partial<ElementalistState> {
  return context.professionState ?? {};
}

function pistolBulletRecord(value: unknown): ElementalistPistolBullets | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

// Bullets the build starts with, as opposed to what is stocked right now.
function configuredPistolBullets(context: ElementalistUiContext): ElementalistPistolBullets {
  const build = context.build;
  return pistolBulletRecord(build?.pistolBullets) || {};
}

// Prefer live simulation stock; before a run there is only the build's setting.
function displayedPistolBullets(context: ElementalistUiContext): ElementalistPistolBullets {
  return pistolBulletRecord(elementalistUiState(context).pistolBullets) || configuredPistolBullets(context);
}

function elementalistPistolEquipped(context: ElementalistUiContext): boolean {
  const build = context.build;
  // Preview the live equipment set when available, otherwise the build's chosen starting set.
  const weaponSet = context.activeWeaponSet || build?.startingWeaponSet || 1;
  const weapons = weaponSet === 2 ? build?.alternateWeapons : build?.weapons;
  return Array.isArray(weapons) && weapons.includes('Pistol');
}

// Render the four bullets as toggle controls: `active` shows the current stock,
// `pressed` the starting stock the user can click to change.
function pistolBulletPaletteGroup(
  catalog: Readonly<CanonicalCatalog<ElementalistSkill>>,
  context: ElementalistUiContext
): ProfessionPaletteGroup | null {
  if (!elementalistPistolEquipped(context)) return null;
  const state = elementalistUiState(context);
  const configured = configuredPistolBullets(context);
  const live = pistolBulletRecord(state.pistolBullets);
  const displayed = live || configured;
  const activeAttunements = new Set([state.primaryAttunement].filter(Boolean).map(String));
  return {
    id: 'elementalist-pistol-bullets',
    label: 'Bullet',
    skillIds: [],
    color: '#ddbb88',
    className: 'elementalist-pistol-bullets',
    // Keep the stock controls after the complete attunement bank so they do
    // not split the active weapon's elemental rows.
    placement: 'active-weapon',
    weaponRowLabel: 'Earth',
    controls: PISTOL_BULLETS.map(({ element, label, skillName }) => {
      const currentStocked = Boolean(displayed[element]);
      const startsStocked = Boolean(configured[element]);
      const offAttunement = Boolean(live) && !activeAttunements.has(element);
      return {
        id: `${PISTOL_BULLET_CONTROL_PREFIX}${element}`,
        label,
        icon: catalog.skillsByName.get(skillName)?.icon,
        title: `${label}: ${currentStocked ? 'currently stocked' : 'not currently stocked'}; starts ${startsStocked ? 'stocked' : 'not stocked'}. Click to toggle starting stock.`,
        color: ATTUNEMENT_COLORS[element],
        className: 'pistol-bullet',
        active: currentStocked,
        pressed: startsStocked,
        muted: offAttunement,
        badge: startsStocked ? 'S' : ''
      };
    })
  };
}

// Rewrite the weapon rows the palette shows so state-driven slot replacements
// are visible: the live etching stage in spear slot 5, and Elemental Explosion
// standing in for the current attunement's pistol autoattack once all four
// bullets are stocked.
function paletteWeaponSkills(
  catalog: Readonly<CanonicalCatalog<ElementalistSkill>>,
  context: ElementalistUiContext,
  skills: readonly Skill[]
): Skill[] {
  const state = elementalistUiState(context);
  // Each spear etching occupies slot 5 throughout its lesser/full progression;
  // expose only the stage represented by the live etching state.
  const projectedSkills = skills.filter((skill) => {
    const chain = ETCHING_CHAINS.find((candidate) =>
      [candidate.etchingId, candidate.lesserId, candidate.fullId].some((id) => id === skill.id)
    );
    if (!chain) return true;
    const progress = state.etchings?.[chain.etching];
    const displayedId = !progress ? chain.etchingId : progress.stage === 'full' ? chain.fullId : chain.lesserId;
    return skill.id === displayedId;
  });
  if (!elementalistPistolEquipped(context)) return projectedSkills;
  const explosion =
    projectedSkills.find((skill) => skill.id === ID.ELEMENTAL_EXPLOSION) ||
    catalog.skillsById.get(ID.ELEMENTAL_EXPLOSION);
  const ordinarySkills = projectedSkills.filter((skill) => skill.id !== ID.ELEMENTAL_EXPLOSION);
  if (!explosion || !ELEMENTALIST_ATTUNEMENTS.every((element) => displayedPistolBullets(context)[element])) {
    return ordinarySkills;
  }

  const primaryAttunement = state.primaryAttunement || context.build?.startAttunement || 'Fire';
  let replaced = false;
  return ordinarySkills.map((skill) => {
    const replacesActiveAutoattack =
      !replaced &&
      skill.weapon === 'Pistol' &&
      skill.slot === 'Weapon_1' &&
      String(skill.attunement || '') === primaryAttunement;
    if (!replacesActiveAutoattack) return skill;
    replaced = true;
    return { ...explosion, attunement: skill.attunement };
  });
}

// Handles clicks on the bullet toggles by flipping the build's starting stock.
function updatePaletteControl(context: ElementalistUiContext, controlId: string): boolean {
  if (!controlId.startsWith(PISTOL_BULLET_CONTROL_PREFIX)) return false;
  const element = controlId.slice(PISTOL_BULLET_CONTROL_PREFIX.length) as ElementalistAttunement;
  if (!ELEMENTALIST_ATTUNEMENTS.includes(element)) {
    return false;
  }

  const build = context.build;
  if (!build) return false;
  const configured = configuredPistolBullets(context);
  // Complete sparse preview input before storing an edit so the build keeps all four canonical flags.
  build.pistolBullets = {
    Fire: Boolean(configured.Fire),
    Water: Boolean(configured.Water),
    Air: Boolean(configured.Air),
    Earth: Boolean(configured.Earth),
    [element]: !Boolean(configured[element])
  };
  return true;
}

// Build the shared palette in mechanic order, including only stateful weapon
// groups that are meaningful for the current build and attunement.
function elementalistPaletteGroups(
  catalog: Readonly<CanonicalCatalog<ElementalistSkill>>,
  context: ElementalistUiContext
): ProfessionPaletteGroup[] {
  const state = elementalistUiState(context);
  const groups: ProfessionPaletteGroup[] = [
    {
      id: 'elementalist-attunements',
      label: 'Attune',
      skillIds: [],
      skillEntries: ELEMENTALIST_ATTUNEMENTS.map((attunement) => ({
        skillId: ELEMENTALIST_ATTUNEMENT_SKILL_IDS[attunement],
        variantBadge: attunement[0]
      })),
      color: '#c85142',
      className: 'elementalist-attunement-palette',
      includeActionSkills: true,
      resourceAnchor: elementalistAttunementResourceAnchor(context)
    }
  ];
  const conjureEquipped = state.conjureEquipped || '';
  const selectedSkillIds = selectedSkillIdSet(context.build?.selectedSkillIds || context.config?.selectedSkillIds);
  // Selected conjures keep a stable bar below utilities even when their bundle is not currently wielded.
  const conjures = new Set(
    Object.entries(CONJURE_SKILLS)
      .filter(([id]) => selectedSkillIds.has(Number(id)))
      .map(([, weapon]) => weapon)
  );
  if (conjureEquipped) conjures.add(conjureEquipped);
  for (const weapon of conjures) {
    groups.push({
      id: `elementalist-conjure-weapon-${weapon.toLowerCase().replaceAll(' ', '-')}`,
      label: weapon === 'Lightning Hammer' ? 'LH' : weapon,
      placement: 'utility',
      skillIds: catalog.skills
        .filter((skill) => skill.type === 'Weapon' && (skill.weapon || skill.skillWeapon) === weapon)
        .map((skill) => skill.id),
      color: '#d4a43f'
    });
  }

  const pistolBullets = pistolBulletPaletteGroup(catalog, context);
  if (pistolBullets) groups.push(pistolBullets);
  return groups;
}

// Put available conjure controls beside Dodge in ACT, keeping the equipped weapon bar below utilities.
function paletteActionSkills(
  catalog: Readonly<CanonicalCatalog<ElementalistSkill>>,
  context: ElementalistUiContext,
  skills: readonly Skill[]
): Skill[] {
  const state = elementalistUiState(context);
  const now = context.time || 0;
  const actionIds = [
    ...(state.conjureEquipped ? [ID.DROP_BUNDLE] : []),
    ...Object.entries(CONJURE_PICKUP_WEAPONS)
      .filter(([, weapon]) => (state.conjurePickups?.[weapon] ?? 0) > now)
      .map(([id]) => Number(id))
  ];
  return [
    ...skills,
    ...actionIds.flatMap((id) => {
      const skill = catalog.skillsById.get(id);
      return skill ? [skill] : [];
    })
  ];
}

// Live attunement when a run exists, otherwise the build's configured start.
function currentAttunement(context: ElementalistUiContext): ElementalistAttunement {
  const build = context.build;
  const value = elementalistUiState(context).primaryAttunement || build?.startAttunement || 'Fire';
  return ELEMENTALIST_ATTUNEMENTS.includes(value as ElementalistAttunement)
    ? (value as ElementalistAttunement)
    : 'Fire';
}

// Convert Elementalist-specific state events into compact log rows while letting
// shared events fall through to the default renderer.
function eventLogRow(
  _context: ElementalistUiContext,
  event: SimulationEvent
): ProfessionEventLogDescriptor | null | undefined {
  if (event.type === 'elementalist.conjure') {
    return {
      type: event.type,
      description: event.conjureEquipped ? `Equipped ${String(event.conjureEquipped)}` : 'Dropped conjured weapon',
      className: 'resource',
      order: 20
    };
  }

  if (event.type === 'elementalist.attunement') {
    if (event.fromSecondaryAttunement) return undefined;
    return {
      type: event.type,
      description: `${String(event.from)} → ${String(event.to)}`,
      className: 'resource',
      order: 20
    };
  }

  if (event.type === 'elementalist.aura') {
    return {
      type: event.type,
      description: `${String(event.aura)} from ${String(event.skillName)}`,
      className: 'buff',
      order: 25
    };
  }

  if (
    event.type === 'combo_field' ||
    event.type === 'combo' ||
    event.type === 'elementalist.fresh-air' ||
    event.type === 'elementalist.evasive-arcana' ||
    event.type === 'elementalist.attunement-enter'
  ) {
    return null;
  }

  return undefined;
}

// Label the timeline's weapon lane with the attunement it switches into.
function timelineWeaponLineTransition(context: ElementalistUiContext): string | undefined {
  if (context.initial === true) {
    return currentAttunement(context);
  }

  const skill = context.skill;
  const target = skill ? skill.name.replace(/ Attunement$/, '') : '';
  if (skill?.skillFamily !== 'Attunement' || !ELEMENTALIST_ATTUNEMENTS.includes(target as ElementalistAttunement)) {
    return undefined;
  }

  return target;
}

// Show Fresh Air's ferocity window across specializations alongside hammer orb state.
function rotationStateSnapshot(context: ElementalistUiContext): RotationStateSnapshotItem[] {
  const state = elementalistUiState(context);
  const freshAir = planningBuffAt(context.planningState, 'fresh-air');
  const orbs = Object.entries(state.hammerOrbs || {})
    .filter(([, expiresAt]) => (expiresAt || 0) > 0)
    .map(([element]) => element)
    .join('/');
  return [
    ...(freshAir ? [{ id: 'fresh-air', label: 'Fresh Air', value: `${freshAir.remaining.toFixed(1)}s` }] : []),
    {
      id: 'elementalist-hammer-orbs',
      label: 'Orbs',
      value: orbs || 'None',
      active: Boolean(orbs)
    }
  ];
}

/**
 * Attunement-bound skills are measured from their own attunement: a single-element skill starts in that element in
 * both hands, and a Weaver dual skill ("Fire+Water") starts with its main-hand and off-hand elements.
 */
export function elementalistAttunementConfig(skill: Skill): Readonly<Record<string, string>> | null {
  const attunement = String((skill as { readonly attunement?: unknown }).attunement ?? '');
  const [primary, secondary = primary] = attunement.split('+');
  if (!isElementalistAttunement(primary) || !isElementalistAttunement(secondary)) return null;
  return { startAttunement: primary, secondaryAttunement: secondary };
}

/** Open bundles and staged skills through their authored casts; only the final cast is measured. */
function elementalistSkillDamageOccurrence(
  context: SkillDamagePreviewPreparation,
  skill: Skill
): SkillDamageState | null {
  // Direct evaluation supplies damage state without prerequisite actions.
  const config = elementalistAttunementConfig(skill);
  if (skill.id === ID.GRAND_FINALE) {
    const orbs = ELEMENTALIST_ATTUNEMENTS.filter((element) => Boolean(context.values[`finaleOrb:${element}`]));
    return {
      config: config ?? {},
      inputs: Object.fromEntries(ELEMENTALIST_ATTUNEMENTS.map((element) => [`orb:${element}`, orbs.includes(element)])),
      assumptions: [`Grand Finale orbs: ${orbs.join(', ') || 'none'}`]
    };
  }

  return config ? { config } : null;
}

/** Captures this UI's catalog so other profession instances cannot change its projections. */
export function bindElementalistCoreUi(catalog: Readonly<CanonicalCatalog<ElementalistSkill>>): ElementalistUiSlice {
  return Object.freeze({
    skillDamageState: elementalistSkillDamageOccurrence,
    /** Declare this module's conditional inputs without adding simulation settings. */
    previewControls(context: ProfessionAttributePreviewContext) {
      const preview = createPreviewControls(context);
      // Expose held combat bonuses to isolated damage calculations.
      preview.damageBuff('Bountiful Power', 'bountifulPower', 'bountiful-power-active');
      preview.condition('Burning', "Pyromancer's Training", 'Fiery Might');
      preview.condition('Bleeding', 'Serrated Stones');
      if (context.weapons.includes('Hammer'))
        preview.add({
          key: 'flameWheel',
          label: 'Flame Wheel',
          group: 'Other buffs',
          kind: 'buff',
          field: 'hammer fire orb',
          scope: ['damage'],
          description: 'Fire orb damage bonus active'
        });
      // Grand Finale's orb inputs only apply when this weapon set can use Hammer skills.
      if (context.weapons.includes('Hammer'))
        for (const element of ELEMENTALIST_ATTUNEMENTS)
          preview.add({
            key: `finaleOrb:${element}`,
            label: `${element} orb`,
            group: 'Grand Finale',
            kind: 'special',
            scope: ['damage'],
            initial: 1,
            description: 'Include this orb in Grand Finale'
          });
      // Slot skills use this start element; weapon rows retain the attunement required by their own skill.
      preview.add({
        key: 'damageAttunement',
        label: 'Active attunement',
        group: 'Attunement',
        kind: 'special',
        scope: ['damage'],
        options: ELEMENTALIST_ATTUNEMENTS,
        initial: (context.build as { startAttunement?: string }).startAttunement ?? 'Fire',
        description: 'Attunement for skills without a fixed elemental requirement'
      });
      if (preview.has('Persisting Flames'))
        preview.trait('Persisting Flames', {
          key: 'persistingFlames',
          kind: 'buff',
          field: 'persisting flames',
          scope: ['damage'],
          max: preview.maximumStacks('Persisting Flames'),
          description: 'Fire-field damage stacks active'
        });

      preview.buff('Fresh Air', 'freshAir', 'fresh-air', 'Ferocity while active');
      preview.buff('Arcane Lightning', 'arcaneLightning', 'arcane-lightning', 'Ferocity while active');
      preview.add({
        key: 'attunement',
        label: 'Attunement',
        group: 'Attunement',
        kind: 'special',
        options: ['None', 'Fire', 'Water', 'Air', 'Earth'],
        description: 'Attunement-dependent traits'
      });
      if (context.weapons.includes('Hammer'))
        preview.add({
          key: 'crescentWind',
          label: 'Crescent Wind',
          group: 'Other buffs',
          kind: 'buff',
          field: 'hammer air orb',
          description: '+15% Critical Chance'
        });
      const conjures = (
        [
          [ID.CONJURE_FIERY_GREATSWORD, 'Fiery Greatsword'],
          [ID.CONJURE_LIGHTNING_HAMMER, 'Lightning Hammer'],
          [ID.CONJURE_FROST_BOW, 'Frost Bow']
        ] as const
      )
        .filter(([skill]) => preview.skills.has(skill))
        .map(([, weapon]) => weapon);
      if (conjures.length)
        preview.add({
          key: 'conjure',
          label: 'Conjured weapon',
          group: 'Other buffs',
          kind: 'special',
          options: ['None', ...conjures],
          description: 'Attributes while wielded'
        });
      preview.passives(ID.SIGNET_OF_FIRE);
      return preview.controls;
    },
    /** Apply only the damage panel's chosen starting element to the isolated runtime. */
    prepareSkillDamagePreview: ({ values }: SkillDamagePreviewPreparation) => ({
      startAttunement: values.damageAttunement,
      secondaryAttunement: values.damageAttunement
    }),
    /** Seed only the detached attribute query; combat state and saved builds remain untouched. */
    prepareAttributePreview(context: ProfessionAttributePreviewPreparation) {
      // The isolated preview permits no attunement; live combat always has an elemental attunement.
      const core = readProfessionCoreState<{ primaryAttunement: string }>(context.professionState);
      core.primaryAttunement = String(context.values.attunement);
      if (context.values.conjure && context.values.conjure !== 'None')
        context.queryOptions.skillWeapon = String(context.values.conjure);
      context.queryOptions.conditionDurations = context.values.conjure === 'Frost Bow';
    },

    paletteWeaponGroups: (_context, skills) => elementalistWeaponGroups(skills),
    // Selected utilities follow the live primary attunement without mutating the saved loadout.
    paletteSelectedSlotSkills: (context, skills) => {
      const primary = elementalistUiState(context).primaryAttunement || context.build?.startAttunement || '';
      const activeCatalog = context.catalog || catalog;
      return skills.map((skill) => {
        if (!skill.attunement) return skill;
        // Variant identity comes from the authored loadout group, independent of localized names.
        const loadoutId = ELEMENTALIST_LOADOUT_SKILL_IDS.get(Number(skill.id));
        return (
          (loadoutId == null
            ? undefined
            : activeCatalog.skills.find(
                (candidate) =>
                  candidate.attunement === primary &&
                  ELEMENTALIST_LOADOUT_SKILL_IDS.get(Number(candidate.id)) === loadoutId
              )) ?? skill
        );
      });
    },

    // Tile identity follows the active bar even when the visible skill cannot currently be cast.
    paletteOverride: (context, skill) => {
      const state = elementalistUiState(context);
      const aura = AURA_TRANSMUTE_SKILLS[Number(skill.id)] || AURA_TRANSMUTE_SKILLS[Number(skill.nextChainId)];
      if (aura) {
        const active = Boolean(
          state.activeAuras?.some((entry) => entry.type === aura && entry.expiresAt > (context.time || 0))
        );
        return { tileActive: Boolean(AURA_TRANSMUTE_SKILLS[Number(skill.id)]) === active };
      }
    },
    // Expose the shared seed control alongside Elementalist's own simulation assumptions.
    assumptionControls: [
      ...ELEMENTALIST_ASSUMPTION_CONTROLS,
      ...SIMULATION_RANDOMNESS_ASSUMPTION_CONTROLS,
      ...PERMANENT_COMBO_FIELD_ASSUMPTION_CONTROLS
    ],
    paletteGroups: (context: ElementalistUiContext) => elementalistPaletteGroups(catalog, context),
    paletteActionSkills: (context: ElementalistUiContext, skills: readonly Skill[]) =>
      paletteActionSkills(catalog, context, skills),
    paletteWeaponSkills: (context: ElementalistUiContext, skills: readonly Skill[]) =>
      paletteWeaponSkills(catalog, context, skills),
    updatePaletteControl,
    rotationStateSnapshot,
    timelineWeaponLineTransition,
    eventLogRow
  });
}
