import { defaultWeaponSkillMatchesSet } from '../../../platform/gw2/weapon-skill-matcher.js';
import { ELEMENTALIST_ASSUMPTION_CONTROLS } from '../assumptions.js';
import { ELEMENTALIST_ATTUNEMENT_SKILL_IDS } from '../data/ids.js';
import { ELEMENTALIST_ATTUNEMENTS, type ElementalistAttunement, type ElementalistCoreState } from './state.js';
import type { ElementalistState } from '../types.js';
import type {
  CanonicalCatalog,
  PaletteSkillAvailability,
  ProfessionEventLogDescriptor,
  ProfessionPaletteGroup,
  ProfessionStartControl,
  ProfessionUiContract,
  RotationStateSnapshotItem,
  SchedulerRecord,
  SimulationEvent,
  Skill
} from '../../../platform/engine/types.js';

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

function uiState(context: SchedulerRecord): Partial<ElementalistState> {
  const professionState = context.professionState as Partial<ElementalistState> | undefined;
  const endState = context.state as { profession?: Partial<ElementalistState> } | undefined;
  return professionState || endState?.profession || {};
}

function selectedSpecialization(context: SchedulerRecord): string {
  return String(context.specialization || (context.config as SchedulerRecord | undefined)?.specialization || 'Core');
}

function usesDualAttunements(context: SchedulerRecord): boolean {
  if (uiState(context).secondaryAttunement != null) return true;
  const specialization = selectedSpecialization(context);
  const catalog = (context.catalog as Readonly<CanonicalCatalog> | undefined) || elementalistCatalog;
  return catalog.skills.some(
    (skill) => skill.specialization === specialization && String(skill.attunement || '').includes('+')
  );
}

function usesCoreResourceAnchor(context: SchedulerRecord): boolean {
  if (usesDualAttunements(context)) return true;
  const specialization = selectedSpecialization(context);
  const catalog = (context.catalog as Readonly<CanonicalCatalog> | undefined) || elementalistCatalog;
  return !catalog.specializations.some((candidate) => candidate.name === specialization && candidate.elite);
}

function pistolBulletRecord(value: unknown): SchedulerRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as SchedulerRecord) : null;
}

function configuredPistolBullets(context: SchedulerRecord): SchedulerRecord {
  const build = context.build as SchedulerRecord | undefined;
  return pistolBulletRecord(build?.pistolBullets) || {};
}

function displayedPistolBullets(context: SchedulerRecord): SchedulerRecord {
  return pistolBulletRecord(uiState(context).pistolBullets) || configuredPistolBullets(context);
}

function elementalistPistolEquipped(context: SchedulerRecord): boolean {
  const build = context.build as SchedulerRecord | undefined;
  return Array.isArray(build?.weapons) && build.weapons.includes('Pistol');
}

function pistolBulletPaletteGroup(context: SchedulerRecord): ProfessionPaletteGroup | null {
  if (!elementalistPistolEquipped(context)) return null;
  const state = uiState(context);
  const configured = configuredPistolBullets(context);
  const live = pistolBulletRecord(state.pistolBullets);
  const displayed = live || configured;
  const activeAttunements = new Set([state.primaryAttunement, state.secondaryAttunement].filter(Boolean).map(String));
  const primaryAttunement = String(
    state.primaryAttunement || (context.build as SchedulerRecord | undefined)?.startAttunement || 'Fire'
  );
  return {
    id: 'elementalist-pistol-bullets',
    label: 'Bullet',
    skillIds: [],
    color: '#ddbb88',
    className: 'elementalist-pistol-bullets',
    placement: 'active-weapon',
    weaponRowLabel: primaryAttunement,
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

function paletteWeaponSkills(context: SchedulerRecord, skills: readonly Skill[]): Skill[] {
  if (!elementalistPistolEquipped(context)) return [...skills];
  const explosion =
    skills.find((skill) => skill.name === 'Elemental Explosion') ||
    elementalistCatalog.skillsByName.get('Elemental Explosion');
  const ordinarySkills = skills.filter((skill) => skill.name !== 'Elemental Explosion');
  if (!explosion || !ELEMENTALIST_ATTUNEMENTS.every((element) => displayedPistolBullets(context)[element])) {
    return ordinarySkills;
  }
  const state = uiState(context);
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

function elementalistWeaponSkillMatchesSet(
  skill: Skill,
  weapons: readonly (string | undefined)[],
  context: SchedulerRecord
): boolean {
  if (uiState(context).conjureEquipped) return false;
  if (String(skill.attunement || '').includes('+') && !usesDualAttunements(context)) {
    return false;
  }
  return defaultWeaponSkillMatchesSet(skill, weapons, context);
}

function elementalistPaletteGroups(context: SchedulerRecord): ProfessionPaletteGroup[] {
  const state = uiState(context);
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
      resourceAnchor: usesCoreResourceAnchor(context)
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

function currentAttunement(
  context: SchedulerRecord,
  key: 'startAttunement' | 'secondaryAttunement'
): ElementalistAttunement {
  const build = context.build as SchedulerRecord | undefined;
  const value = String(
    key === 'startAttunement'
      ? uiState(context).primaryAttunement || build?.[key] || 'Fire'
      : uiState(context).secondaryAttunement || build?.[key] || 'Fire'
  );
  return ELEMENTALIST_ATTUNEMENTS.includes(value as ElementalistAttunement)
    ? (value as ElementalistAttunement)
    : 'Fire';
}

function configuredAttunement(
  context: SchedulerRecord,
  key: 'startAttunement' | 'secondaryAttunement'
): ElementalistAttunement {
  const build = context.build as SchedulerRecord | undefined;
  const value = String(build?.[key] || (key === 'secondaryAttunement' ? build?.startAttunement : '') || 'Fire');
  return ELEMENTALIST_ATTUNEMENTS.includes(value as ElementalistAttunement)
    ? (value as ElementalistAttunement)
    : 'Fire';
}

function attunementStartControl(
  context: SchedulerRecord,
  key: 'startAttunement' | 'secondaryAttunement',
  label: string
): ProfessionStartControl {
  const value = configuredAttunement(context, key);
  return {
    id: `elementalist-${key}`,
    label,
    buildKey: key,
    value,
    options: ELEMENTALIST_ATTUNEMENTS.map((attunement) => ({
      value: attunement,
      label: attunement,
      icon: elementalistCatalog.skillsById.get(ELEMENTALIST_ATTUNEMENT_SKILL_IDS[attunement])?.icon,
      description: `${attunement} attunement`
    })),
    color: ATTUNEMENT_COLORS[value]
  };
}

function paletteAvailability(context: SchedulerRecord, skill: Skill): PaletteSkillAvailability {
  const state = uiState(context);
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
  const primary = String(
    state.primaryAttunement || (context.build as SchedulerRecord | undefined)?.startAttunement || 'Fire'
  );
  const secondary = String(
    state.secondaryAttunement || (context.build as SchedulerRecord | undefined)?.secondaryAttunement || primary
  );
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
  const attunement = String(skill.attunement || '');
  if (skill.skillFamily === 'Attunement') {
    const target = skill.name.replace(/ Attunement$/, '');
    if (!ELEMENTALIST_ATTUNEMENTS.includes(target as ElementalistAttunement)) {
      return { available: false, message: 'Unknown attunement.' };
    }
    const alreadyAttuned = target === primary && (!usesDualAttunements(context) || target === secondary);
    if (alreadyAttuned) {
      return {
        available: false,
        message: `Already attuned to ${target}.`
      };
    }
    // Recharge is represented by the scheduler's normal cooldown projection.
    // Keep the action contextually available so palette clicks can queue it;
    // the scheduler will delay the swap until its retry time.
    return { available: true, message: '' };
  }
  if (!attunement) {
    return { available: true, message: '' };
  }
  const required = attunement.split('+');
  if (skill.type !== 'Weapon') {
    const available = required.length === 1 && required[0] === primary;
    return {
      available,
      message: available ? '' : `Requires ${attunement} attunement.`
    };
  }
  const slot = Number(String(skill.slot || '').match(/(\d+)$/)?.[1] || 0);
  const dualAttunement = usesDualAttunements(context);
  const unravelActive = Number(state.unravelUntil || 0) > Number(context.time || 0);
  const available =
    !dualAttunement || unravelActive
      ? required.length === 1 && required[0] === primary
      : required.length > 1
        ? slot === 3 && required.every((element) => [primary, secondary].includes(element))
        : slot <= 2
          ? required[0] === primary
          : slot >= 4
            ? required[0] === secondary
            : primary === secondary && required[0] === primary;
  return {
    available,
    message: available ? '' : `Requires ${attunement} in the active attunement slot.`
  };
}

function eventLogRow(
  _context: SchedulerRecord,
  event: SimulationEvent
): ProfessionEventLogDescriptor | null | undefined {
  if (event.type === 'elementalist.attunement') {
    const from =
      event.skillName === 'Unravel' && event.fromSecondaryAttunement
        ? `${String(event.from)}/${String(event.fromSecondaryAttunement)}`
        : String(event.from);
    return {
      type: event.type,
      description: `${from} → ${String(event.to)}`,
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

function timelineWeaponLineTransition(context: SchedulerRecord): string | undefined {
  if (context.initial === true) {
    const primary = currentAttunement(context, 'startAttunement');
    if (!usesDualAttunements(context)) return primary;
    const secondary = currentAttunement(context, 'secondaryAttunement');
    return `${primary[0]}/${secondary[0]}`;
  }
  const skill = context.skill as Skill | undefined;
  const target = skill ? skill.name.replace(/ Attunement$/, '') : '';
  if (skill?.skillFamily !== 'Attunement' || !ELEMENTALIST_ATTUNEMENTS.includes(target as ElementalistAttunement)) {
    return undefined;
  }
  if (!usesDualAttunements(context)) return target;

  const build = context.build as SchedulerRecord | undefined;
  const currentPrimary = String(context.weaponLine || '').split('/')[0];
  const primary =
    ELEMENTALIST_ATTUNEMENTS.find((attunement) => attunement[0] === currentPrimary) ||
    currentAttunement({ build }, 'startAttunement');
  return `${target[0]}/${primary[0]}`;
}

function rotationStateSnapshot(context: SchedulerRecord): RotationStateSnapshotItem[] {
  const state = uiState(context);
  const bullets = Object.entries(state.pistolBullets || {})
    .filter(([, active]) => active)
    .map(([element]) => element)
    .join('/');
  const orbs = Object.entries(state.hammerOrbs || {})
    .filter(([, expiresAt]) => Number(expiresAt || 0) > 0)
    .map(([element]) => element)
    .join('/');
  return [
    {
      id: 'elementalist-attunement',
      label: 'Attunement',
      value: state.secondaryAttunement
        ? `${state.primaryAttunement}/${state.secondaryAttunement}`
        : String(state.primaryAttunement || 'Fire')
    },
    {
      id: 'elementalist-pistol-bullets',
      label: 'Bullets',
      value: bullets || 'None',
      active: Boolean(bullets)
    },
    {
      id: 'elementalist-hammer-orbs',
      label: 'Orbs',
      value: orbs || 'None',
      active: Boolean(orbs)
    }
  ];
}

export const elementalistCoreUi: Partial<ProfessionUiContract> & SchedulerRecord = Object.freeze({
  assumptionControls: ELEMENTALIST_ASSUMPTION_CONTROLS,
  weaponSkillMatchesSet: elementalistWeaponSkillMatchesSet,
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
  startControls: (context: SchedulerRecord) => {
    const dualAttunement = usesDualAttunements(context);
    return [
      attunementStartControl(context, 'startAttunement', dualAttunement ? 'Primary attunement' : 'Start attunement'),
      ...(dualAttunement ? [attunementStartControl(context, 'secondaryAttunement', 'Secondary attunement')] : [])
    ];
  },
  paletteSkillAvailability: paletteAvailability,
  rotationStateSnapshot,
  timelineWeaponLineTransition,
  eventLogRow,
  weaponSwapChangesSet: false
});

export function bindElementalistCoreUi(catalog: Readonly<CanonicalCatalog>): typeof elementalistCoreUi {
  elementalistCatalog = catalog;
  void elementalistCatalog;
  return elementalistCoreUi;
}
