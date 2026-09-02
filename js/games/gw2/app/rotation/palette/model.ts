import type { ProfessionPaletteGroup, SchedulerRecord, Skill } from '#gw2/platform/engine/types.js';
import { defaultWeaponSkillMatchesSet } from '#gw2/platform/equipment/weapons/skill-matcher.js';
import type { NormalizedPaletteGroup } from '#gw2/app/presentation/rotation/palette.js';
import type { ProfessionAppContract, ProfessionAppState, ProfessionSlotLoadoutContext } from '#gw2/app/types.js';
import { groupWeaponSkillsByAttunement } from '#gw2/app/profession/weapon-attunement-groups.js';
import { activeSpecialization, paletteEndState, paletteProfessionState } from '#gw2/app/rotation/shared/context.js';

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
export function displayedSkillTiles(app: ProfessionAppState, skills: readonly Skill[]): Skill[] {
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
  const context = paletteProjectionContext(app);
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
  weaponSet = Number(paletteEndState(app)?.activeWeaponSet || app.build.startingWeaponSet || 1)
): Skill[] {
  const endState = paletteEndState(app);
  const professionState = paletteProfessionState(app);
  const catalog = app.activeCatalog || app.profession.catalog;
  const specialization = app.adapter?.eliteSpecialization?.(app.build) || '';
  const equippedWeapons = weaponSet === 2 ? app.build.alternateWeapons : app.build.weapons;
  const matcher = app.adapter?.weaponSkillMatchesSet || defaultWeaponSkillMatchesSet;
  const paletteContext = {
    build: app.build,
    specialization,
    professionState,
    catalog,
    cooldowns: endState?.cooldowns || {},
    activeWeaponSet: endState?.activeWeaponSet || app.build.startingWeaponSet || 1,
    time: Number(endState?.time || 0) / 1000
  };
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
  const projected = displayedSkillTiles(app, stagedSkills);

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

export function weaponPaletteRows(app: ProfessionAppState, activeWeaponSet = 1): WeaponPaletteRow[] {
  const rows = [1, 2]
    .map((weaponSet) => ({
      id: `weapon-set-${weaponSet}`,
      label: `W${weaponSet}`,
      weaponSet,
      active: weaponSet === activeWeaponSet,
      skills: displayedWeaponSkills(app, weaponSkills(app, weaponSet), weaponSet)
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

export function paletteActionSkills(app: ProfessionAppState, specialization = activeSpecialization(app)): Skill[] {
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
  const endState = paletteEndState(app);
  const projectActions = app.profession.ui?.paletteActionSkills;
  return typeof projectActions === 'function'
    ? projectActions(
        {
          specialization,
          catalog: app.activeCatalog,
          professionState,
          cooldowns: endState?.cooldowns || {},
          activeWeaponSet: endState?.activeWeaponSet || app.build.startingWeaponSet || 1,
          time: Number(endState?.time || 0) / 1000,
          build: app.build,
          activeAutoattack: currentAutoattackSkill(app)
        },
        actions
      )
    : actions;
}

export function rotationPaletteGroups(app: ProfessionAppState, context: SchedulerRecord): NormalizedPaletteGroup[] {
  return paletteView(app.profession, context);
}

export function rotationLoadoutPaletteGroups(
  app: ProfessionAppState,
  context: ProfessionSlotLoadoutContext
): ProfessionPaletteGroup[] {
  return app.adapter.slotLoadout?.paletteGroups(context) || [];
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
