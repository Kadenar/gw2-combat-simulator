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
import { ELEMENTALIST_ATTUNEMENT_SKILL_IDS } from '#gw2/professions/elementalist/data/ids.js';
import {
  AURA_TRANSMUTE_SKILLS,
  ETCHING_CHAINS,
  HAMMER_ORB_SKILLS
} from '#gw2/professions/elementalist/core/constants.js';
import { ELEMENTALIST_ATTUNEMENTS, type ElementalistAttunement } from '#gw2/professions/elementalist/core/state.js';
import type { ElementalistState } from '#gw2/professions/elementalist/types.js';
import type { CanonicalCatalog, Skill } from '#gw2/platform/engine/skills/types.js';
import type {
  PaletteSkillAvailability,
  ProfessionEventLogDescriptor,
  ProfessionPaletteGroup,
  ProfessionUiContract,
  RotationStateSnapshotItem
} from '#gw2/platform/engine/profession/types.js';
import type { SchedulerRecord } from '#gw2/platform/engine/execution/types.js';
import type { SimulationEvent } from '#gw2/platform/engine/events/types.js';
import {
  bindElementalistFamilyUiCatalog,
  elementalistAttunementResourceAnchor
} from '#gw2/professions/elementalist/presentation.js';

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

let elementalistCatalog: Readonly<CanonicalCatalog>;

// The palette is inspected both mid-rotation (live scheduler state) and after a
// run (projected end state); accept either shape.
export function elementalistUiState(context: SchedulerRecord): Partial<ElementalistState> {
  const professionState = context.professionState as Partial<ElementalistState> | undefined;
  const endState = context.state as { profession?: Partial<ElementalistState> } | undefined;
  return professionState || endState?.profession || {};
}

function pistolBulletRecord(value: unknown): SchedulerRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as SchedulerRecord) : null;
}

// Bullets the build starts with, as opposed to what is stocked right now.
function configuredPistolBullets(context: SchedulerRecord): SchedulerRecord {
  const build = context.build as SchedulerRecord | undefined;
  return pistolBulletRecord(build?.pistolBullets) || {};
}

// Prefer live simulation stock; before a run there is only the build's setting.
function displayedPistolBullets(context: SchedulerRecord): SchedulerRecord {
  return pistolBulletRecord(elementalistUiState(context).pistolBullets) || configuredPistolBullets(context);
}

function elementalistPistolEquipped(context: SchedulerRecord): boolean {
  const build = context.build as SchedulerRecord | undefined;
  return Array.isArray(build?.weapons) && build.weapons.includes('Pistol');
}

// Render the four bullets as toggle controls: `active` shows the current stock,
// `pressed` the starting stock the user can click to change.
function pistolBulletPaletteGroup(context: SchedulerRecord): ProfessionPaletteGroup | null {
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
    placement: 'weapon-set-1',
    controls: PISTOL_BULLETS.map(({ element, label, skillName }) => {
      const currentStocked = Boolean(displayed[element]);
      const startsStocked = Boolean(configured[element]);
      const offAttunement = Boolean(live) && !activeAttunements.has(element);
      return {
        id: `${PISTOL_BULLET_CONTROL_PREFIX}${element}`,
        label,
        icon: elementalistCatalog.skillsByName.get(skillName)?.icon,
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
function paletteWeaponSkills(context: SchedulerRecord, skills: readonly Skill[]): Skill[] {
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
    elementalistCatalog.skillsByName.get('Elemental Explosion');
  const ordinarySkills = projectedSkills.filter((skill) => skill.name !== 'Elemental Explosion');
  if (!explosion || !ELEMENTALIST_ATTUNEMENTS.every((element) => displayedPistolBullets(context)[element])) {
    return ordinarySkills;
  }

  const primaryAttunement = String(
    state.primaryAttunement || (context.build as SchedulerRecord | undefined)?.startAttunement || 'Fire'
  );
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
function updatePaletteControl(context: SchedulerRecord, controlId: string): boolean {
  if (!controlId.startsWith(PISTOL_BULLET_CONTROL_PREFIX)) return false;
  const element = controlId.slice(PISTOL_BULLET_CONTROL_PREFIX.length);
  if (!ELEMENTALIST_ATTUNEMENTS.includes(element as ElementalistAttunement)) {
    return false;
  }

  const build = context.build as SchedulerRecord | undefined;
  if (!build) return false;
  const configured = configuredPistolBullets(context);
  build.pistolBullets = configured;
  configured[element] = !Boolean(configured[element]);
  return true;
}

// Build the shared palette in mechanic order, including only stateful weapon
// groups that are meaningful for the current build and attunement.
function elementalistPaletteGroups(context: SchedulerRecord): ProfessionPaletteGroup[] {
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
  const conjureEquipped = String(state.conjureEquipped || '');
  if (conjureEquipped) {
    groups.push({
      id: 'elementalist-conjure-weapon',
      label: conjureEquipped,
      skillIds: elementalistCatalog.skills
        .filter((skill) => skill.type === 'Weapon' && (skill.weapon || skill.skillWeapon) === conjureEquipped)
        .map((skill) => skill.id),
      color: '#d4a43f'
    });
  }

  const now = Number(context.time || 0);
  const actionNames = conjureEquipped
    ? ['__drop_bundle']
    : Object.entries(state.conjurePickups || {})
        .filter(([, expiresAt]) => Number(expiresAt) >= now)
        .map(([weapon]) => `__pickup_${weapon}`);
  const actionSkillIds = actionNames.flatMap((name) => {
    const skill = elementalistCatalog.skillsByName.get(name);
    return skill ? [skill.id] : [];
  });
  if (actionSkillIds.length) {
    groups.push({
      id: 'elementalist-conjure-actions',
      label: conjureEquipped ? 'Drop' : 'Pick',
      skillIds: actionSkillIds,
      color: '#d4a43f',
      includeActionSkills: true
    });
  }

  const pistolBullets = pistolBulletPaletteGroup(context);
  if (pistolBullets) groups.push(pistolBullets);
  return groups;
}

// Live attunement when a run exists, otherwise the build's configured start.
function currentAttunement(context: SchedulerRecord): ElementalistAttunement {
  const build = context.build as SchedulerRecord | undefined;
  const value = String(elementalistUiState(context).primaryAttunement || build?.startAttunement || 'Fire');
  return ELEMENTALIST_ATTUNEMENTS.includes(value as ElementalistAttunement)
    ? (value as ElementalistAttunement)
    : 'Fire';
}

// Explain why a palette tile is not castable at the inspection point. Covers the
// skill pairs and resources that flip on core state: aura generator vs transmute,
// Rock Barrier vs Hurl, hammer orbs, pistol bullets, and autoattack chain order.
function paletteAvailability(context: SchedulerRecord, skill: Skill): PaletteSkillAvailability {
  const state = elementalistUiState(context);
  const now = Number(context.time || 0);
  const transmuteAura = AURA_TRANSMUTE_SKILLS[Number(skill.id)];
  const generatedAura = AURA_TRANSMUTE_SKILLS[Number(skill.nextChainId)];
  if (transmuteAura || generatedAura) {
    // Aura generators and transmutes are reciprocal catalog flips. This state
    // check lets the shared projector expose only the side usable right now.
    const aura = transmuteAura || generatedAura;
    const transmuteActive = Boolean(state.activeAuras?.some((entry) => entry.type === aura && entry.expiresAt > now));
    const available = transmuteAura ? transmuteActive : !transmuteActive;
    if (!available) {
      return {
        available: false,
        message: transmuteActive ? `${aura} can be transmuted now.` : `Requires an active ${aura}.`
      };
    }
  }

  // The shared tile projector chooses the one Rock Barrier variant that is
  // usable at the inspection point, including the exact barrier expiry.
  if (skill.name === 'Rock Barrier' || skill.name === 'Hurl') {
    const hurlActive = Number(state.rockBarrierExpiresAt || 0) > now;
    const available = skill.name === (hurlActive ? 'Hurl' : 'Rock Barrier');
    if (!available) {
      return {
        available: false,
        message: hurlActive ? 'Hurl currently replaces Rock Barrier.' : 'Requires an active Rock Barrier.'
      };
    }
  }

  const hasActiveHammerOrb = Object.values(state.hammerOrbs || {}).some(
    (expiresAt) => expiresAt != null && Number(expiresAt) >= now
  );
  const hammerElements = HAMMER_ORB_SKILLS[Number(skill.id)] ? [HAMMER_ORB_SKILLS[Number(skill.id)]] : null;
  // Active orb elements share one refreshed 15-second lifetime, while element
  // membership determines which visible generator is locked during that window.
  if (
    hammerElements?.some((element) => {
      const expiresAt = state.hammerOrbs?.[element];
      return expiresAt != null && Number(expiresAt) >= now;
    })
  ) {
    return {
      available: false,
      message: 'Grand Finale must consume the active orb before it can be created again.'
    };
  }

  // Grand Finale stays in the palette as the shared orb consumer, but cannot
  // be queued after the common orb lifetime has ended.
  if (skill.name === 'Grand Finale' && !hasActiveHammerOrb) {
    return {
      available: false,
      message: 'Requires at least one active hammer orb.'
    };
  }

  if (skill.name === 'Elemental Explosion') {
    const bullets = displayedPistolBullets(context);
    const available = ELEMENTALIST_ATTUNEMENTS.every((element) => bullets[element]);
    if (!available) {
      return {
        available: false,
        message: 'Requires all four elemental bullets.'
      };
    }
  }

  const position = (context.catalog as Readonly<CanonicalCatalog> | undefined)?.autoattackChainPositions.get(
    Number(skill.id)
  );
  if (position) {
    const expected = Number(state.autoattackChains?.[position.root]) || position.root;
    if (expected !== Number(skill.id)) {
      const expectedSkill = (context.catalog as Readonly<CanonicalCatalog>).skillsById.get(expected);
      return {
        available: false,
        message: `Cast ${expectedSkill?.name || 'the earlier chain skill'} first.`
      };
    }

    if (
      state.autoattackCarryover?.root === position.root &&
      state.autoattackCarryover.attunement === skill.attunement
    ) {
      return { available: true, message: '' };
    }
  }

  return { available: true, message: '' };
}

// Convert Elementalist-specific state events into compact log rows while letting
// shared events fall through to the default renderer.
function eventLogRow(
  _context: SchedulerRecord,
  event: SimulationEvent
): ProfessionEventLogDescriptor | null | undefined {
  if (event.type === 'elementalist.attunement') {
    if (event.fromSecondaryAttunement) return undefined;
    return {
      type: event.type,
      description: `${String(event.from)} → ${String(event.to)}`,
      className: 'resource',
      order: 20,
      flags: []
    };
  }

  if (event.type === 'elementalist.aura') {
    return {
      type: event.type,
      description: `${String(event.aura)} from ${String(event.skillName)}`,
      className: 'buff',
      order: 25,
      flags: []
    };
  }

  if (
    event.type === 'combo_field' ||
    event.type === 'combo' ||
    event.type === 'elementalist.fresh-air' ||
    event.type === 'elementalist.evasive-arcana' ||
    event.type === 'elementalist.attunement-enter' ||
    event.type === 'elementalist.signet-fire'
  ) {
    return null;
  }

  return undefined;
}

// Label the timeline's weapon lane with the attunement it switches into.
function timelineWeaponLineTransition(context: SchedulerRecord): string | undefined {
  if (context.initial === true) {
    return currentAttunement(context);
  }

  const skill = context.skill as Skill | undefined;
  const target = skill ? skill.name.replace(/ Attunement$/, '') : '';
  if (skill?.skillFamily !== 'Attunement' || !ELEMENTALIST_ATTUNEMENTS.includes(target as ElementalistAttunement)) {
    return undefined;
  }

  return target;
}

// Summarize hammer orbs; pistol bullets already have dedicated palette controls.
function rotationStateSnapshot(context: SchedulerRecord): RotationStateSnapshotItem[] {
  const state = elementalistUiState(context);
  const orbs = Object.entries(state.hammerOrbs || {})
    .filter(([, expiresAt]) => Number(expiresAt || 0) > 0)
    .map(([element]) => element)
    .join('/');
  return [
    {
      id: 'elementalist-hammer-orbs',
      label: 'Orbs',
      value: orbs || 'None',
      active: Boolean(orbs)
    }
  ];
}

/**
 * The Core Elementalist half of the shared profession UI contract, merged with
 * the family and specialization contracts by the module registry.
 */
export const elementalistCoreUi: Partial<ProfessionUiContract> & SchedulerRecord = Object.freeze({
  assumptionControls: ELEMENTALIST_ASSUMPTION_CONTROLS,
  skillBarGroups: () => [
    {
      id: 'elementalist-attunements',
      label: 'Attunements',
      skillIds: Object.values(ELEMENTALIST_ATTUNEMENT_SKILL_IDS),
      color: '#c85142',
      className: 'elementalist-attunements'
    }
  ],
  paletteGroups: elementalistPaletteGroups,
  paletteWeaponSkills,
  updatePaletteControl,
  paletteSkillAvailability: paletteAvailability,
  rotationStateSnapshot,
  timelineWeaponLineTransition,
  eventLogRow,
  weaponSwapChangesSet: false
});

/**
 * Module presentation entry point: captures the canonical catalog these
 * projections need before returning the Core UI contract.
 */
export function bindElementalistCoreUi(catalog: Readonly<CanonicalCatalog>): typeof elementalistCoreUi {
  elementalistCatalog = catalog;
  bindElementalistFamilyUiCatalog(catalog);
  void elementalistCatalog;
  return elementalistCoreUi;
}
