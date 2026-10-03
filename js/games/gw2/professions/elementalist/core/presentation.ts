import { elementalistWeaponGroups } from '#gw2/professions/elementalist/core/weapon-groups.js';
import { timedBuffAt } from '#gw2/platform/results/query.js';
import type {
  ElementalistSkill,
  ElementalistState,
  ElementalistUiContext,
  ElementalistPistolBullets,
  ElementalistUiSlice
} from '#gw2/professions/elementalist/types.js';
/**
 * Core Elementalist UI contract.
 *
 * Projects live core state onto the shared build/rotation views: the attunement
 * and weapon-resource palette, which variant of a state-flipped skill is shown
 * and castable at the inspection point, the profession event-log rows, and the
 * timeline's attunement lane. Read-only over simulation state - the one
 * exception is `updatePaletteControl`, which edits the build's starting stock.
 */
import { ELEMENTALIST_ASSUMPTION_CONTROLS } from '#gw2/professions/elementalist/build/assumptions.js';
import { SIMULATION_RANDOMNESS_ASSUMPTION_CONTROLS } from '#gw2/platform/simulation/randomness.js';
import { PERMANENT_COMBO_FIELD_ASSUMPTION_CONTROLS } from '#gw2/platform/combos/permanent-field-assumption.js';
import { selectedSkillNameSet } from '#gw2/platform/builds/selected-skills.js';
import { ELEMENTALIST_ATTUNEMENT_SKILL_IDS } from '#gw2/professions/elementalist/data/ids.js';
import { AURA_TRANSMUTE_SKILLS, CONJURE_SKILLS, ETCHING_CHAINS } from '#gw2/professions/elementalist/core/constants.js';
import { ELEMENTALIST_ATTUNEMENTS, type ElementalistAttunement } from '#gw2/professions/elementalist/core/state.js';
import type { CanonicalCatalog, Skill } from '#gw2/platform/engine/skills/types.js';
import type {
  ProfessionEventLogDescriptor,
  ProfessionPaletteGroup,
  RotationStateSnapshotItem
} from '#gw2/platform/profession-presentation/types.js';
import type { SimulationEvent } from '#gw2/platform/engine/events/events.js';
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

// The palette is inspected both mid-rotation (live scheduler state) and after a
// run (projected end state); accept either shape.
export function elementalistUiState(context: ElementalistUiContext): Partial<ElementalistState> {
  const professionState = context.professionState;
  const planningState = context.state;
  return professionState || planningState?.profession || {};
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
      [candidate.etching, candidate.lesser, candidate.full].some((name) => name === skill.name)
    );
    if (!chain) return true;
    const progress = state.etchings?.[chain.etching];
    const displayedName = !progress ? chain.etching : progress.stage === 'full' ? chain.full : chain.lesser;
    return skill.name === displayedName;
  });
  if (!elementalistPistolEquipped(context)) return projectedSkills;
  const explosion =
    projectedSkills.find((skill) => skill.name === 'Elemental Explosion') ||
    catalog.skillsByName.get('Elemental Explosion');
  const ordinarySkills = projectedSkills.filter((skill) => skill.name !== 'Elemental Explosion');
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
  const selectedSkills = selectedSkillNameSet(context.build?.selectedSkills || context.config?.selectedSkills);
  // Selected conjures keep a stable bar below utilities even when their bundle is not currently wielded.
  const conjures = new Set(
    Object.entries(CONJURE_SKILLS)
      .filter(([id]) => selectedSkills.has(catalog.skillsById.get(Number(id))?.name || ''))
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
  const actionNames = [
    ...(state.conjureEquipped ? ['__drop_bundle'] : []),
    ...Object.entries(state.conjurePickups || {})
      .filter(([, expiresAt]) => Number.isFinite(expiresAt) && expiresAt > now)
      .map(([weapon]) => `__pickup_${weapon}`)
  ];
  return [
    ...skills,
    ...actionNames.flatMap((name) => {
      const skill = catalog.skillsByName.get(name);
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
  const freshAir = timedBuffAt(context.result, 'fresh air', context.atSeconds || 0);
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

/** Captures this UI's catalog so other profession instances cannot change its projections. */
export function bindElementalistCoreUi(catalog: Readonly<CanonicalCatalog<ElementalistSkill>>): ElementalistUiSlice {
  return Object.freeze({
    paletteWeaponGroups: (_context, skills) => elementalistWeaponGroups(skills),
    // Selected utilities follow the live primary attunement without mutating the saved loadout.
    paletteSelectedSlotSkills: (context, skills) => {
      const primary = elementalistUiState(context).primaryAttunement || context.build?.startAttunement || '';
      const activeCatalog = context.catalog || catalog;
      return skills.map((skill) => {
        if (!skill.attunement) return skill;
        const suffix = ` (${skill.attunement})`;
        const base = skill.name.endsWith(suffix) ? skill.name.slice(0, -suffix.length) : skill.name;
        return activeCatalog.skillsByName.get(`${base} (${primary})`) || skill;
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
    eventLogRow,
    weaponSwapChangesSet: false
  });
}
