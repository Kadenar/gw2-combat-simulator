import { gw2ApiText } from '#gw2/app/presentation/shared/html.js';
import {
  rotationHotkeyActionForSkillName,
  rotationHotkeyActionForSkillSlot,
  rotationLoadoutHotkeyActions,
  rotationUtilityHotkeyAction
} from '#gw2/app/rotation/input/hotkeys.js';
import {
  activeSpecialization,
  paletteEndState,
  paletteProfessionState,
  seconds
} from '#gw2/app/rotation/shared/context.js';
import { ACTION_ICONS, PLACEHOLDER_ICON } from '#gw2/app/rotation/shared/icons.js';
import { resultCombatReferenceMs } from '#gw2/app/rotation/timeline/timing/model.js';
import { ammoDisplayView } from '#ui/rotation/ammo-display.js';

import { paletteSkillResourceView, type PaletteResourceView } from '#gw2/app/rotation/palette/resource-view.js';
import type { ProfessionAppState, ProfessionSlotLoadoutContext } from '#gw2/app/types.js';
import type {
  PaletteSkillAvailability,
  ProfessionPaletteGroup,
  SchedulerRecord,
  Skill,
  SkillId
} from '#gw2/platform/engine/types.js';

import { groupWeaponSkillsByAttunement } from '#gw2/app/profession/weapon-attunement-groups.js';
import type { ProfessionAppContract } from '#gw2/app/types.js';
import { defaultWeaponSkillMatchesSet } from '#gw2/platform/equipment/weapons/skill-matcher.js';

/** Owns the normalized palette declaration consumed by this feature's views. */
export interface NormalizedPaletteGroup extends Omit<ProfessionPaletteGroup, 'skillEntries'> {
  readonly skillEntries: SchedulerRecord[];
  readonly reservedSkillIds: readonly number[];
  readonly color: string;
  readonly className: string;
  readonly stackId: string;
  readonly placement: 'profession' | 'weapon-set-1' | 'active-weapon';
  readonly weaponRowLabel: string;
  readonly resourceAnchor: boolean;
  readonly resourceIds: readonly string[];
  readonly resourcePlacement: 'above' | 'beside' | 'below';
}

const PALETTE_ACTION_ORDER = new Map<string, number>([
  ['Dodge', 0],
  ['Dodge / Mirage Cloak', 0],
  ['Pick Up Mirage Mirror', 1],
  ['Swap Weapons', 2]
]);

/**
 * Normalizes profession-owned palette declarations into isolated app view
 * models so generic renderers cannot mutate catalog-owned definitions.
 */
export function paletteView(profession: ProfessionAppContract, context: SchedulerRecord): NormalizedPaletteGroup[] {
  const groups = profession.ui.paletteGroups(context);
  if (!Array.isArray(groups)) {
    throw new TypeError('paletteGroups must return an array.');
  }

  return groups.map((group) => ({
    id: String(group.id),
    label: String(group.label || group.id),
    skillIds: [...(group.skillIds || [])],
    reservedSkillIds: [...(group.reservedSkillIds || [])],
    skillEntries: (group.skillEntries || []).map((entry) => ({ ...entry })),
    color: String(group.color || ''),
    className: String(group.className || ''),
    stackId: String(group.stackId || ''),
    placement:
      group.placement === 'weapon-set-1' || group.placement === 'active-weapon' ? group.placement : 'profession',
    weaponRowLabel: String(group.weaponRowLabel || ''),
    resourceAnchor: Boolean(group.resourceAnchor),
    resourceIds: (group.resourceIds || []).map(String),
    resourcePlacement:
      group.resourcePlacement === 'above' || group.resourcePlacement === 'beside' || group.resourcePlacement === 'below'
        ? group.resourcePlacement
        : 'below',
    includeActionSkills: Boolean(group.includeActionSkills),
    controls: (group.controls || []).map((control) => ({
      id: String(control.id),
      label: String(control.label || control.id),
      icon: String(control.icon || ''),
      title: String(control.title || control.label || control.id),
      color: String(control.color || ''),
      className: String(control.className || ''),
      active: Boolean(control.active),
      pressed: Boolean(control.pressed),
      muted: Boolean(control.muted),
      badge: String(control.badge || '')
    })),
    statusIcon: group.statusIcon
      ? {
          icon: String(group.statusIcon.icon || ''),
          label: String(group.statusIcon.label || ''),
          title: String(group.statusIcon.title || group.statusIcon.label || '')
        }
      : undefined
  }));
}

export function uniqueByName(skills: readonly Skill[]): Skill[] {
  const unique = new Map<string, Skill>();
  for (const skill of skills) {
    if (!unique.has(skill.name)) unique.set(skill.name, skill);
  }

  return [...unique.values()];
}

// An elite specialization can rework a base weapon skill while keeping its name
// (e.g. Troubadour's Bladecall vs the base dagger Bladecall). Weaponmaster
// training makes both variants pass availability, so a plain name-dedup can keep
// the off-spec rework — whose id the active spec's runtime catalog rejects
// ("Unknown skill id"). Rank same-named weapon skills so the active spec's
// variant wins, then the unspecialized base, then any other elite variant.
function weaponVariantRank(skill: Skill, specialization: string): number {
  const spec = String(skill.specialization || '');
  if (spec === specialization) return 0;
  if (spec === '') return 1;
  return 2;
}

export function uniqueBySpecializedName(skills: readonly Skill[], specialization: string): Skill[] {
  const byName = new Map<string, Skill>();
  for (const skill of skills) {
    const existing = byName.get(skill.name);
    if (!existing || weaponVariantRank(skill, specialization) < weaponVariantRank(existing, specialization)) {
      byName.set(skill.name, skill);
    }
  }

  return [...byName.values()];
}

export function weaponSkills(app: ProfessionAppState, weaponSet = 1): Skill[] {
  const [mainHand, offHand] = weaponSet === 2 ? app.build.alternateWeapons : app.build.weapons;
  return uniqueBySpecializedName(
    app.skills.filter((skill) => {
      // Temporary bars and supplemental effects are exposed by profession
      // palette groups, never as skills on an equipped weapon set.
      if (skill.type !== 'Weapon' || !skill.weapon) return false;
      if (
        !app.adapter.isSkillAvailable(skill, {
          build: app.build,
          specialization: activeSpecialization(app)
        })
      ) {
        return false;
      }

      return (app.adapter.weaponSkillMatchesSet || defaultWeaponSkillMatchesSet)(skill, [mainHand, offHand], {
        build: app.build,
        specialization: activeSpecialization(app),
        professionState: paletteProfessionState(app),
        catalog: app.profession?.catalog || app.adapter?.profession?.catalog || null,
        weaponData: app.weaponData,
        weaponSet,
        weaponBarPreview: true
      });
    }),
    activeSpecialization(app)
  ).sort((left, right) => {
    const slotOrder = String(left.slot).localeCompare(String(right.slot));
    if (slotOrder) return slotOrder;
    if (left.flipSkillId === right.id) return -1;
    if (right.flipSkillId === left.id) return 1;
    const chainOrder =
      Number(left.weaponBarChainStep ?? left.chainStep ?? Number.MAX_SAFE_INTEGER) -
      Number(right.weaponBarChainStep ?? right.chainStep ?? Number.MAX_SAFE_INTEGER);
    return chainOrder || 0;
  });
}

export interface WeaponPaletteRow {
  readonly id: string;
  readonly label: string;
  readonly weaponSet: number;
  readonly active: boolean;
  readonly skills: Skill[];
}

function paletteFlipAvailable(skill: Skill, availableFlips: SchedulerRecord, at: number): boolean {
  const value = availableFlips[skill.id] ?? availableFlips[skill.name];
  return typeof value === 'number' ? value > at : Boolean(value);
}

function isReplacementAttack(skill: Skill): boolean {
  return (
    Boolean(skill.ambush) ||
    (Boolean(skill.stealthAttack) && skill.slot === 'Weapon_1') ||
    Boolean(skill.unleashedAmbushSkill)
  );
}

function isAutoattackFlipLink(parent: Skill, child: Skill): boolean {
  return (
    (parent.chainRoot != null && child.chainRoot != null && Number(parent.chainRoot) === Number(child.chainRoot)) ||
    (parent.weaponBarChainRootId != null &&
      child.weaponBarChainRootId != null &&
      Number(parent.weaponBarChainRootId) === Number(child.weaponBarChainRootId)) ||
    (parent.nextChainId === child.id && child.nextChainId !== parent.id)
  );
}

interface PaletteFlipFamilies {
  readonly familyIdBySkillId: Map<number, number>;
  readonly membersByFamilyId: Map<number, readonly Skill[]>;
}

function paletteFlipFamilies(
  catalogSkills: readonly Skill[],
  skillById: ReadonlyMap<number, Skill>
): PaletteFlipFamilies {
  const neighborsBySkillId = new Map<number, Set<number>>();
  const catalogOrder = new Map(catalogSkills.map((skill, index) => [Number(skill.id), index]));
  const register = (parent: Skill, child: Skill): void => {
    if (
      parent.paletteFlip === false ||
      child.paletteFlip === false ||
      (child.simulatorExcluded && child.type === 'Weapon') ||
      isReplacementAttack(child) ||
      isAutoattackFlipLink(parent, child)
    ) {
      return;
    }

    const parentId = Number(parent.id);
    const childId = Number(child.id);
    const parentNeighbors = neighborsBySkillId.get(parentId) || new Set<number>();
    const childNeighbors = neighborsBySkillId.get(childId) || new Set<number>();
    parentNeighbors.add(childId);
    childNeighbors.add(parentId);
    neighborsBySkillId.set(parentId, parentNeighbors);
    neighborsBySkillId.set(childId, childNeighbors);
  };

  for (const child of catalogSkills) {
    if (child.paletteFlip === false || child.flipParentId == null || isReplacementAttack(child)) continue;
    const parent = skillById.get(Number(child.flipParentId));
    if (parent) register(parent, child);
  }

  for (const parent of catalogSkills) {
    if (parent.paletteFlip === false || parent.flipSkillId == null || parent.flipSkillId === parent.nextChainId)
      continue;
    const child = skillById.get(Number(parent.flipSkillId));
    if (child) register(parent, child);
  }

  // Some API records expose flips only as a reciprocal next-skill pair. Stable
  // catalog order identifies the root while chain metadata keeps autoattacks out.
  for (const skill of catalogSkills) {
    if (skill.nextChainId == null) continue;
    const linked = skillById.get(Number(skill.nextChainId));
    if (!linked || linked.nextChainId !== skill.id) continue;
    if ((catalogOrder.get(Number(skill.id)) || 0) > (catalogOrder.get(Number(linked.id)) || 0)) continue;
    register(skill, linked);
  }

  // Flip metadata can branch (one root with several state-dependent children).
  // Connected components keep every variant under one stable catalog-owned tile.
  const familyIdBySkillId = new Map<number, number>();
  const membersByFamilyId = new Map<number, readonly Skill[]>();
  const visited = new Set<number>();
  for (const skill of catalogSkills) {
    const startId = Number(skill.id);
    if (visited.has(startId) || !neighborsBySkillId.has(startId)) continue;
    const pending = [startId];
    const memberIds: number[] = [];
    while (pending.length) {
      const id = pending.pop() as number;
      if (visited.has(id)) continue;
      visited.add(id);
      memberIds.push(id);
      for (const neighbor of neighborsBySkillId.get(id) || []) {
        if (!visited.has(neighbor)) pending.push(neighbor);
      }
    }

    memberIds.sort(
      (left, right) =>
        (catalogOrder.get(left) ?? Number.MAX_SAFE_INTEGER) - (catalogOrder.get(right) ?? Number.MAX_SAFE_INTEGER)
    );
    const familyId = memberIds[0];
    const members = memberIds.flatMap((id) => {
      const member = skillById.get(id);
      return member ? [member] : [];
    });
    membersByFamilyId.set(familyId, members);
    for (const id of memberIds) familyIdBySkillId.set(id, familyId);
  }

  return { familyIdBySkillId, membersByFamilyId };
}

function paletteProjectionContext(app: ProfessionAppState): SchedulerRecord {
  const endState = paletteEndState(app);
  return {
    specialization: app.adapter ? activeSpecialization(app) : '',
    catalog: app.activeCatalog || app.profession.catalog,
    professionState: paletteProfessionState(app),
    cooldowns: endState?.cooldowns || {},
    activeWeaponSet: endState?.activeWeaponSet || app.build?.startingWeaponSet || 1,
    time: Number(endState?.time || 0) / 1000,
    build: app.build
  };
}

function paletteCandidateAvailable(app: ProfessionAppState, context: SchedulerRecord, skill: Skill): boolean | null {
  const availability = app.profession.ui?.paletteSkillAvailability;
  return typeof availability === 'function' ? availability(context, skill).available : null;
}

function paletteTileEntryKey(skill: Skill, flipFamilyIdBySkillId: ReadonlyMap<number, number>, index: number): string {
  if (skill.paletteTileId != null) return `declared:${String(skill.paletteTileId)}`;
  if (skill.chainRoot != null) return `autoattack:${String(skill.chainRoot)}`;
  const flipFamilyId = flipFamilyIdBySkillId.get(Number(skill.id));
  if (flipFamilyId != null) return `flip:${String(flipFamilyId)}`;
  if (skill.paletteLegendId != null) return `skill:${String(skill.id)}:legend:${String(skill.paletteLegendId)}`;
  return `skill:${String(skill.id)}:${index}`;
}

function paletteTileCandidateOrder(skill: Skill, fallback: number): number {
  const declared = Number(skill.paletteTileOrder);
  if (Number.isFinite(declared)) return declared;
  const chainStep = Number(skill.chainStep);
  return Number.isFinite(chainStep) ? chainStep : fallback;
}

/**
 * Projects every combat-bar family to one live palette identity. Catalog
 * autoattack roots and flip links work automatically; `paletteTileId` covers
 * UI-only families whose API records do not declare their shared tile.
 */
export function displayedSkillTiles(
  app: ProfessionAppState,
  skills: readonly Skill[],
  context: SchedulerRecord = paletteProjectionContext(app)
): Skill[] {
  const endState = paletteEndState(app);
  const professionState = paletteProfessionState(app);
  const availableFlips =
    professionState.availableFlips && typeof professionState.availableFlips === 'object'
      ? (professionState.availableFlips as SchedulerRecord)
      : {};
  const at = Number(endState?.time || 0) / 1000;
  const catalogSkills = app.skills || app.activeCatalog?.skills || app.profession.catalog.skills || skills;
  const skillById = new Map<number, Skill>(catalogSkills.map((skill) => [Number(skill.id), skill]));
  const { familyIdBySkillId, membersByFamilyId } = paletteFlipFamilies(catalogSkills, skillById);
  const autoattackChains =
    professionState.autoattackChains && typeof professionState.autoattackChains === 'object'
      ? (professionState.autoattackChains as SchedulerRecord)
      : {};
  const grouped = new Map<string, { readonly skill: Skill; readonly index: number }[]>();

  skills.forEach((skill, index) => {
    const key = paletteTileEntryKey(skill, familyIdBySkillId, index);
    const family = grouped.get(key) || [];
    family.push({ skill, index });
    grouped.set(key, family);
  });

  return [...grouped.values()].map((entries) => {
    const byId = new Map(entries.map((entry) => [Number(entry.skill.id), entry.skill]));
    const first = entries[0].skill;
    if (first.paletteTileId != null) {
      // UI-only declarations are catalog families too: a caller can contribute
      // one known side and still receive the live sibling through this hook.
      for (const candidate of catalogSkills.filter(
        (skill) => String(skill.paletteTileId) === String(first.paletteTileId)
      )) {
        if (!byId.has(Number(candidate.id))) {
          byId.set(Number(candidate.id), {
            ...candidate,
            ...(first.hotkeyAction ? { hotkeyAction: first.hotkeyAction } : {})
          });
        }
      }
    }

    const firstFlipFamilyId = familyIdBySkillId.get(Number(first.id));
    if (firstFlipFamilyId != null) {
      // Root-only callers (notably selected utilities) inherit every connected
      // branch while keeping the root tile's keyboard binding.
      for (const member of membersByFamilyId.get(firstFlipFamilyId) || []) {
        if (!byId.has(Number(member.id))) {
          byId.set(Number(member.id), {
            ...member,
            ...(first.hotkeyAction ? { hotkeyAction: first.hotkeyAction } : {})
          });
        }
      }
    }

    const candidates = [...byId.values()].sort(
      (left, right) =>
        paletteTileCandidateOrder(left, entries.find((entry) => entry.skill.id === left.id)?.index ?? skills.length) -
        paletteTileCandidateOrder(right, entries.find((entry) => entry.skill.id === right.id)?.index ?? skills.length)
    );
    const chainRoot = candidates.find((candidate) => candidate.chainRoot != null)?.chainRoot;
    if (chainRoot != null) {
      const expected = autoattackChains[String(chainRoot)] ?? chainRoot;
      const activeChainSkill = candidates.find(
        (candidate) => candidate.id === Number(expected) || candidate.name === expected
      );
      if (activeChainSkill) return activeChainSkill;
    }

    const activeFlips = candidates.filter((candidate) => paletteFlipAvailable(candidate, availableFlips, at));
    if (activeFlips.length) {
      const availableActiveFlips = activeFlips.filter(
        (candidate) => paletteCandidateAvailable(app, context, candidate) === true
      );
      return availableActiveFlips.length === 1 ? availableActiveFlips[0] : activeFlips.at(-1)!;
    }

    const availableCandidates = candidates.filter(
      (candidate) => paletteCandidateAvailable(app, context, candidate) === true
    );
    return availableCandidates.length === 1 ? availableCandidates[0] : candidates[0];
  });
}

/**
 * Collapses linked chains, autoattacks, flips, and ambush replacements to the
 * skill currently occupying each combat-bar tile as the live state changes.
 */
export function displayedWeaponSkills(
  app: ProfessionAppState,
  skills: readonly Skill[],
  weaponSet = Number(paletteEndState(app)?.activeWeaponSet || app.build.startingWeaponSet || 1),
  paletteContext: SchedulerRecord = paletteProjectionContext(app)
): Skill[] {
  const endState = paletteEndState(app);
  const professionState = paletteProfessionState(app);
  const equippedWeapons = weaponSet === 2 ? app.build.alternateWeapons : app.build.weapons;
  const matcher = app.adapter?.weaponSkillMatchesSet || defaultWeaponSkillMatchesSet;
  // Linked non-autoattack chains (currently Thief spear slots 2 and 3) use
  // their profession matcher to choose the stage occupying each combat-bar tile.
  const stagedSkills = skills.filter(
    (skill) =>
      skill.weaponBarChainRootId == null ||
      matcher(skill, equippedWeapons, {
        ...paletteContext,
        weaponData: app.weaponData,
        weaponSet,
        weaponBarPreview: false
      })
  );
  const projected = displayedSkillTiles(app, stagedSkills, paletteContext);

  const isWeaponOneReplacement = (skill: Skill): boolean => skill.slot === 'Weapon_1' && isReplacementAttack(skill);
  const activeWeaponSet = Number(endState?.activeWeaponSet || app.build.startingWeaponSet || 1);
  const availableAmbushName = String((professionState.availableAmbush as SchedulerRecord | undefined)?.name || '');
  const activeReplacement =
    weaponSet === activeWeaponSet
      ? projected.find((skill) => {
          if (!isWeaponOneReplacement(skill)) return false;
          if (skill.ambush) return skill.name === availableAmbushName;
          return app.profession.ui?.paletteSkillAvailability?.(paletteContext, skill).available === true;
        })
      : undefined;

  if (!activeReplacement) return projected.filter((skill) => !isWeaponOneReplacement(skill));

  // Ambush and stealth attacks occupy the standard autoattack's tile instead
  // of appearing beside it; inactive replacement variants stay out of the row.
  let insertedReplacement = false;
  const replaced = projected.flatMap((skill) => {
    if (isWeaponOneReplacement(skill)) return [];
    const sharesTile =
      skill.slot === activeReplacement.slot &&
      skill.weapon === activeReplacement.weapon &&
      (!skill.attunement || !activeReplacement.attunement || skill.attunement === activeReplacement.attunement);
    if (!sharesTile) return [skill];
    if (insertedReplacement) return [];
    insertedReplacement = true;
    return [activeReplacement];
  });
  return insertedReplacement ? replaced : [activeReplacement, ...replaced];
}

export function weaponPaletteRows(
  app: ProfessionAppState,
  activeWeaponSet = 1,
  context?: SchedulerRecord
): WeaponPaletteRow[] {
  const rows = [1, 2]
    .map((weaponSet) => ({
      id: `weapon-set-${weaponSet}`,
      label: `W${weaponSet}`,
      weaponSet,
      active: weaponSet === activeWeaponSet,
      skills: displayedWeaponSkills(app, weaponSkills(app, weaponSet), weaponSet, context)
    }))
    .filter((row) => row.skills.length);
  return rows.flatMap((row) => {
    const groups = groupWeaponSkillsByAttunement(row.skills, activeSpecialization(app));
    if (groups.length === 1 && groups[0].attunement == null) {
      return [row];
    }

    return groups.map(({ attunement, skills }) => ({
      ...row,
      id: `${row.id}-${String(attunement)
        .toLowerCase()
        .replace(/[^a-z]+/g, '-')}`,
      label: String(attunement),
      skills
    }));
  });
}

export function autoattackChainSkillAvailable(skill: Skill, chainState: SchedulerRecord = {}): boolean {
  if (!skill.chainRoot) return true;
  const chainRoot = String(skill.chainRoot);
  const expected = chainState[chainRoot] ?? skill.chainRoot;
  return skill.name === expected || skill.id === Number(expected);
}

export function currentAutoattackSkill(app: ProfessionAppState): Skill | null {
  const endState = paletteEndState(app);
  const activeWeaponSet = Number(endState?.activeWeaponSet || app.build.startingWeaponSet || 1);
  const professionState = paletteProfessionState(app);
  const autoattackChains = professionState.autoattackChains;
  const chainState =
    autoattackChains && typeof autoattackChains === 'object' ? (autoattackChains as SchedulerRecord) : {};
  return (
    weaponSkills(app, activeWeaponSet).find(
      (skill) => skill.slot === 'Weapon_1' && !skill.ambush && autoattackChainSkillAvailable(skill, chainState)
    ) || null
  );
}

export function paletteActionSkills(
  app: ProfessionAppState,
  specialization = activeSpecialization(app),
  context?: SchedulerRecord
): Skill[] {
  const professionState = paletteProfessionState(app);
  const actions = uniqueByName(
    app.skills.filter(
      (skill) =>
        skill.type === 'Action' &&
        // Shared actions are simulator-owned records. Positive API/Wiki IDs
        // classified as Action are usually trait procs, bundles, or encounter
        // skills and require an explicit opt-in before entering the palette.
        ((Number(skill.id) < 0 && skill.paletteAction !== false) || skill.paletteAction === true) &&
        (skill.name !== 'Swap Weapons' ||
          app.profession.ui?.weaponSwapChangesSet === false ||
          Boolean(app.build.alternateWeapons?.[0])) &&
        (!skill.specialization || skill.specialization === specialization) &&
        app.adapter.isSkillAvailable(skill, {
          build: app.build,
          specialization,
          professionState
        })
    )
  ).sort(
    (left, right) =>
      (PALETTE_ACTION_ORDER.get(left.name) ?? Number.MAX_SAFE_INTEGER) -
        (PALETTE_ACTION_ORDER.get(right.name) ?? Number.MAX_SAFE_INTEGER) || left.name.localeCompare(right.name)
  );
  const projectActions = app.profession.ui?.paletteActionSkills;
  return typeof projectActions === 'function'
    ? projectActions(
        context || {
          ...paletteProjectionContext(app),
          activeAutoattack: currentAutoattackSkill(app)
        },
        actions
      )
    : actions;
}

export function rotationSelectedSlotSkills(app: ProfessionAppState): Skill[] {
  if (app.adapter.slotLoadout) return [];
  return Object.values(app.build.selectedSkills).flatMap((name) => {
    const skill = app.skillByName.get(name);
    if (!skill?.attunement) return skill ? [skill] : [];
    const variantSuffix = ` (${String(skill.attunement)})`;
    const baseName = skill.name.endsWith(variantSuffix) ? skill.name.slice(0, -variantSuffix.length) : skill.name;
    const primaryAttunement = String(paletteProfessionState(app).primaryAttunement || app.build.startAttunement || '');
    const activeVariant = app.skillByName.get(`${baseName} (${primaryAttunement})`);
    return [activeVariant || skill];
  });
}

export function paletteSkillIsInstant(
  app: ProfessionAppState,
  context: SchedulerRecord,
  skill: Skill | null | undefined,
  name = skill?.name || ''
): boolean {
  return (
    name === '__combat_start' ||
    name === '__cooldown_reset' ||
    Number(skill?.castTimeMs || 0) === 0 ||
    (skill != null && app.profession.ui.isPaletteSkillInstant?.(context, skill) === true)
  );
}

export interface AmmoView {
  readonly current?: number;
  readonly maximum?: number;
  readonly pips?: readonly boolean[];
}

export interface PaletteStatusIconView {
  readonly icon: string;
  readonly label: string;
  readonly title?: string;
}

export interface PaletteControlView {
  readonly id: string;
  readonly label: string;
  readonly icon?: string;
  readonly title?: string;
  readonly color?: string;
  readonly className?: string;
  readonly active?: boolean;
  readonly pressed?: boolean;
  readonly muted?: boolean;
  readonly badge?: string;
}

export interface PaletteSkillView extends SchedulerRecord {
  readonly name?: string;
  readonly skillId?: SkillId | null;
  readonly hotkeyAction?: string;
  readonly title?: string;
  readonly icon?: string;
  readonly variantBadge?: string;
  readonly color?: string;
  readonly disabled?: boolean;
  readonly contextDisabled?: boolean;
  readonly concealed?: boolean;
  readonly highlighted?: boolean;
  readonly draggable?: boolean;
  readonly cooldownLabel?: string;
  readonly ammo?: AmmoView | null;
  readonly resource?: PaletteResourceView | null;
  readonly virtual?: boolean;
}

export interface PaletteGroupView {
  readonly id?: string;
  readonly label?: string;
  readonly color?: string;
  readonly className?: string;
  readonly skills?: readonly PaletteSkillView[];
  readonly controls?: readonly PaletteControlView[];
  readonly statusIcon?: PaletteStatusIconView;
}

export type RenderedPaletteGroup = ProfessionPaletteGroup & { skills: Skill[] };
export type PaletteContext = ProfessionSlotLoadoutContext & SchedulerRecord;

/** Builds the current context once for every palette render or interaction projection. */
export function createPaletteContext(app: ProfessionAppState): PaletteContext {
  const endState = paletteEndState(app);
  return {
    specialization: activeSpecialization(app),
    catalog: app.activeCatalog,
    professionState: paletteProfessionState(app),
    cooldowns: endState?.cooldowns || {},
    activeWeaponSet: endState?.activeWeaponSet || app.build.startingWeaponSet || 1,
    time: Number(endState?.time || 0) / 1000,
    build: app.build,
    activeAutoattack: currentAutoattackSkill(app),
    // Expose resolved traits so profession replacements only appear when their trait is selected.
    traits: new Set((app.attributeData?.activeTraits || []).flatMap((trait) => [trait.id, trait.name]))
  };
}

function currentCooldown(
  app: ProfessionAppState,
  name: string
): { readonly remaining: number; readonly readyAt: number } {
  return paletteEndState(app)?.cooldowns?.[name] || { remaining: 0, readyAt: 0 };
}

function currentAmmo(app: ProfessionAppState, skill: Skill): SchedulerRecord | null {
  const endState = paletteEndState(app);
  const ammoBySkillId = endState?.ammoBySkillId;
  // Prefer exact IDs so duplicate API names cannot leak another variant's ammo into this skill.
  const rawAmmo =
    ammoBySkillId && typeof ammoBySkillId === 'object' ? ammoBySkillId[String(skill.id)] : endState?.ammo?.[skill.name];
  if (!rawAmmo || typeof rawAmmo !== 'object') return null;
  const ammo = rawAmmo as SchedulerRecord;
  if (ammo.remaining != null) return ammo;
  // Scheduler ammo uses `nextRechargeAt` in seconds, while UI projections may
  // already expose `nextChargeAt` in milliseconds. Normalize both to UI time.
  const nextChargeAt =
    ammo.nextChargeAt != null
      ? Number(ammo.nextChargeAt)
      : ammo.nextRechargeAt == null
        ? 0
        : Number(ammo.nextRechargeAt) * 1000;
  return {
    ...ammo,
    nextChargeAt,
    remaining: nextChargeAt ? Math.max(0, nextChargeAt - Number(endState?.time || 0)) : 0
  };
}

/**
 * Projects a skill and the latest simulation state into generic palette UI.
 * `contextAvailable` is the caller's combined state/placement decision;
 * cooldown and ammo state are derived here so styling, dragging, and tooltips
 * share one decision.
 */
export function paletteSkillView(
  app: ProfessionAppState,
  skill: Skill,
  contextAvailable = true,
  contextMessage = '',
  contextRetryAt: number | null = null
): PaletteSkillView {
  const displayName = skill.displayName || skill.name;
  const cd = currentCooldown(app, skill.name);
  const endTime = Number(paletteEndState(app)?.time || 0);
  const contextReadyAt = Number(contextRetryAt) * 1000;
  const contextRemaining = Number.isFinite(contextReadyAt) ? Math.max(0, Math.round(contextReadyAt - endTime)) : 0;
  // A future retryAt is scheduler-queueable: keep the countdown styling, but
  // allow clicks so the inserted action can wait for the temporary lockout.
  const retryableContext =
    !contextAvailable && contextRetryAt != null && Number.isFinite(contextReadyAt) && contextReadyAt > endTime;
  // Context lockouts such as Tempest singularity share the cooldown badge;
  // show whichever restriction keeps the skill unavailable for longer.
  const remaining = Math.max(Number(cd.remaining || 0), contextRemaining);
  const readyAt = contextRemaining > Number(cd.remaining || 0) ? contextReadyAt : cd.readyAt;
  const ammo = currentAmmo(app, skill);
  const maximumAmmo = ammo?.maximum ?? Number(skill.ammo || 0);
  const recharge =
    maximumAmmo && Number(skill.ammoRecharge || 0) > 0 ? Number(skill.ammoRecharge) : Number(skill.cooldown || 0);
  const ammoDisplay = ammoDisplayView(ammo?.charges ?? maximumAmmo, maximumAmmo);
  // Show the cast lockout while disabled, then the next charge timer once usable; the tooltip reuses this precision.
  const displayedRemaining = remaining || Number(ammo?.remaining || 0);
  const cooldownLabel = displayedRemaining ? `${(displayedRemaining / 1000).toFixed(2)}s` : '';
  const unavailable = remaining > 0 || !contextAvailable;
  const highlighted = (Boolean(skill.ambush) || Boolean(skill.stealthAttack)) && !unavailable;
  const castTimeSeconds = Number(skill.castTimeMs || 0) / 1000;
  const hasEnergyCost = skill.energyCost != null;
  const energyCost = Number(skill.energyCost || 0);
  const title = [
    displayName,
    castTimeSeconds ? `Cast: ${castTimeSeconds.toFixed(2)}s` : 'Instant cast',
    hasEnergyCost ? `Energy cost: ${energyCost}` : '',
    recharge ? `${maximumAmmo ? 'Count recharge' : 'Cooldown'}: ${recharge}s` : '',
    !contextAvailable
      ? [contextMessage || 'Unavailable in the current state', remaining ? `Remaining: ${cooldownLabel}` : '']
          .filter(Boolean)
          .join(' · ')
      : ammoDisplay
        ? `${ammoDisplay.label}${
            displayedRemaining ? ` · ${remaining ? 'available' : 'next charge'} in ${cooldownLabel}` : ''
          }`
        : remaining
          ? `Remaining: ${cooldownLabel} · available at ${seconds(
              // Show absolute scheduler deadlines on the combat-relative rotation clock.
              readyAt - resultCombatReferenceMs(app.results)
            )}`
          : 'Available now',
    gw2ApiText(skill.description)
  ]
    .filter(Boolean)
    .join('\n');
  return {
    name: skill.name,
    skillId: skill.id,
    hotkeyAction:
      String(skill.hotkeyAction || '') ||
      rotationHotkeyActionForSkillSlot(skill.slot) ||
      rotationHotkeyActionForSkillName(skill.name),
    icon: skill.icon || ACTION_ICONS[skill.name] || PLACEHOLDER_ICON,
    variantBadge: String(skill.variantBadge || ''),
    title,
    color: unavailable ? '#625a73' : highlighted ? '#f0c766' : '#a88be8',
    disabled: unavailable,
    contextDisabled: !contextAvailable && !retryableContext,
    concealed: Boolean(skill.concealed),
    highlighted,
    draggable: contextAvailable,
    cooldownLabel,
    ammo: ammoDisplay,
    resource: paletteSkillResourceView(app, skill.id)
  };
}

/** Projects groups and availability once so every palette layout uses the same live state. */
export function projectPalette(app: ProfessionAppState, paletteContext: PaletteContext) {
  const spec = paletteContext.specialization;
  const professionState = paletteContext.professionState as SchedulerRecord;
  const professionGroups = paletteView(app.profession, paletteContext);
  const loadoutGroups = app.adapter.slotLoadout?.paletteGroups(paletteContext) || [];
  const renderGroups = (groups: readonly ProfessionPaletteGroup[]): RenderedPaletteGroup[] =>
    groups.map((group) => {
      const skillIds = group.skillIds || [];
      const reservedSkillIds = group.reservedSkillIds || [];
      // Reserved IDs keep a group's declared positions stable while inactive
      // alternatives remain concealed rather than disappearing from the model.
      const skills = [
        ...(reservedSkillIds.length ? reservedSkillIds : skillIds).flatMap((id) => {
          const skill = app.skillById.get(id);
          return skill && (group.includeActionSkills || skill.type !== 'Action')
            ? [
                {
                  ...skill,
                  concealed: reservedSkillIds.length > 0 && !skillIds.includes(skill.id)
                }
              ]
            : [];
        }),
        ...(group.skillEntries || []).flatMap((entry) => {
          const skill = app.skillById.get(Number(entry.skillId));
          return skill && (group.includeActionSkills || skill.type !== 'Action')
            ? [{ ...skill, ...entry, name: skill.name } as Skill]
            : [];
        })
      ];
      return {
        ...group,
        // Reserved groups intentionally retain stable placeholders; ordinary
        // profession groups project sequence families to the live bar tile.
        skills: reservedSkillIds.length ? skills : displayedSkillTiles(app, skills, paletteContext)
      };
    });
  const renderedProfessionGroups = renderGroups(professionGroups);
  const loadoutHotkeys = rotationLoadoutHotkeyActions(
    app.adapter.slotLoadout?.view(paletteContext).bars || [],
    (skillId) => app.adapter.slotLoadout?.skillChildren?.(paletteContext, skillId) || []
  );
  const renderedLoadoutGroups = renderGroups(loadoutGroups).map((group) => ({
    ...group,
    skills: group.skills.map((skill) => ({
      ...skill,
      hotkeyAction: loadoutHotkeys.get(Number(skill.id)) || ''
    }))
  }));
  const selected = rotationSelectedSlotSkills(app);
  // The shared projector discovers and selects descendants from the catalog;
  // selected utilities only need to contribute their root tile and hotkey.
  const selectedWithFlipChains = uniqueByName(selected).map((skill, index) => ({
    ...skill,
    hotkeyAction: rotationUtilityHotkeyAction(index)
  }));
  const groupedActionSkillIds = new Set(
    [...renderedProfessionGroups, ...renderedLoadoutGroups].flatMap((group) =>
      group.skills.filter((skill) => skill.type === 'Action' && !skill.concealed).map((skill) => String(skill.id))
    )
  );
  // Actions explicitly placed by a profession or loadout group must not also
  // appear in the shared action row.
  const actions = paletteActionSkills(app, spec, paletteContext).filter(
    (skill) => !groupedActionSkillIds.has(String(skill.id))
  );
  const weaponSwapActions = actions.filter((skill) => skill.name === 'Swap Weapons');
  const generalActions = actions.filter((skill) => skill.name !== 'Swap Weapons');
  const activeWeaponSet = Number(paletteContext.activeWeaponSet || 1);

  const availableAmbush =
    professionState.availableAmbush && typeof professionState.availableAmbush === 'object'
      ? (professionState.availableAmbush as SchedulerRecord)
      : null;

  const autoattackChains =
    professionState.autoattackChains && typeof professionState.autoattackChains === 'object'
      ? (professionState.autoattackChains as SchedulerRecord)
      : {};
  const loadoutUnavailableMessage = (skill: Skill): string =>
    app.adapter.slotLoadout?.unavailableReason(skill, paletteContext) || '';

  // Loadout and profession availability are independent vetoes. Cache the
  // structured profession result because both its flag and message are read.
  const paletteAvailabilityBySkill = new Map<Skill, PaletteSkillAvailability>();
  const professionPaletteAvailability = (skill: Skill): PaletteSkillAvailability => {
    if (!paletteAvailabilityBySkill.has(skill)) {
      paletteAvailabilityBySkill.set(skill, app.profession.ui.paletteSkillAvailability(paletteContext, skill));
    }

    return paletteAvailabilityBySkill.get(skill) as PaletteSkillAvailability;
  };

  const professionAllowsPaletteSkill = (skill: Skill): boolean =>
    !loadoutUnavailableMessage(skill) && professionPaletteAvailability(skill).available;

  const professionPaletteUnavailableMessage = (skill: Skill): string =>
    loadoutUnavailableMessage(skill) || professionPaletteAvailability(skill).message;

  const professionPaletteRetryAt = (skill: Skill): number | null =>
    professionPaletteAvailability(skill).retryAt ?? null;

  const weaponSkillAvailable = (skill: Skill, weaponSet: number): boolean => {
    if (weaponSet !== activeWeaponSet) return false;
    if (!professionAllowsPaletteSkill(skill)) return false;
    if (skill.ambush) return String(availableAmbush?.name || '') === skill.name;
    if (availableAmbush && skill.slot === 'Weapon_1') return false;
    return true;
  };

  const weaponSkillUnavailableMessage = (skill: Skill, weaponSet: number): string => {
    if (weaponSet !== activeWeaponSet) {
      return `Swap to weapon set ${weaponSet} to use this skill`;
    }

    if (!professionAllowsPaletteSkill(skill)) {
      return professionPaletteUnavailableMessage(skill);
    }

    if (skill.ambush) {
      return availableAmbush
        ? `Current ambush is ${String(availableAmbush.name || '')}`
        : 'Gain Mirage Cloak to use this ambush';
    }

    if (availableAmbush && skill.slot === 'Weapon_1') {
      return `${String(availableAmbush.name || '')} currently replaces weapon skill 1`;
    }

    return '';
  };

  const selectedWithFlips = displayedSkillTiles(app, selectedWithFlipChains, paletteContext);

  return {
    renderedProfessionGroups,
    renderedLoadoutGroups,
    actions,
    weaponSwapActions,
    generalActions,
    activeWeaponSet,
    autoattackChains,
    professionAllowsPaletteSkill,
    professionPaletteUnavailableMessage,
    professionPaletteRetryAt,
    weaponSkillAvailable,
    weaponSkillUnavailableMessage,
    selectedWithFlips
  };
}
