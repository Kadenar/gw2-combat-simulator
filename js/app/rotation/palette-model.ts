import type { ProfessionPaletteGroup, SchedulerRecord, Skill } from '../../platform/engine/types.js';
import { defaultWeaponSkillMatchesSet } from '../../platform/gw2/weapon-skill-matcher.js';
import { paletteView } from '../../platform/ui/palette.js';
import type { NormalizedPaletteGroup } from '../../platform/ui/types.js';
import type { ProfessionAppState, ProfessionSlotLoadoutContext } from '../profession/types.js';
import { groupWeaponSkillsByAttunement } from '../profession/weapon-attunement-groups.js';
import { activeSpecialization, paletteEndState, paletteProfessionState } from './context.js';

const PALETTE_ACTION_ORDER = new Map<string, number>([
  ['Dodge', 0],
  ['Dodge / Mirage Cloak', 0],
  ['Pick Up Mirage Mirror', 1],
  ['Swap Weapons', 2]
]);

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
    parent.nextChainId === child.id ||
    (parent.chainRoot != null && child.chainRoot != null && Number(parent.chainRoot) === Number(child.chainRoot))
  );
}

/**
 * Projects any declared flip family to one live identity. Explicit child
 * back-references are preferred, while parent-only API links are inferred for
 * sequence skills that are neither autoattack steps nor replacement attacks.
 */
export function displayedFlipSkills(app: ProfessionAppState, skills: readonly Skill[]): Skill[] {
  const endState = paletteEndState(app);
  const professionState = paletteProfessionState(app);
  const availableFlips =
    professionState.availableFlips && typeof professionState.availableFlips === 'object'
      ? (professionState.availableFlips as SchedulerRecord)
      : {};
  const at = Number(endState?.time || 0) / 1000;
  const skillById = app.skillById || app.activeCatalog?.skillsById || app.profession.catalog.skillsById;
  const catalogSkills = app.skills || app.activeCatalog?.skills || app.profession.catalog.skills || skills;
  const candidateById = new Map(skills.map((skill) => [Number(skill.id), skill]));
  const flipByParentId = new Map<number, Skill>();
  const parentByFlipId = new Map<number, Skill>();

  for (const child of catalogSkills) {
    if (child.paletteFlip === false || child.flipParentId == null || isReplacementAttack(child)) continue;
    const parent = skillById.get(Number(child.flipParentId));
    if (!parent || isAutoattackFlipLink(parent, child)) continue;
    flipByParentId.set(Number(parent.id), child);
    parentByFlipId.set(Number(child.id), parent);
  }

  for (const parent of catalogSkills) {
    if (parent.paletteFlip === false || parent.flipSkillId == null || parent.flipSkillId === parent.nextChainId)
      continue;
    const child = skillById.get(Number(parent.flipSkillId));
    if (
      !child ||
      child.paletteFlip === false ||
      isReplacementAttack(child) ||
      isAutoattackFlipLink(parent, child) ||
      flipByParentId.has(Number(parent.id))
    ) {
      continue;
    }

    flipByParentId.set(Number(parent.id), child);
    parentByFlipId.set(Number(child.id), parent);
  }

  const displayedIds = new Set<number>();
  return skills.flatMap((skill) => {
    const parent = parentByFlipId.get(Number(skill.id));
    if (parent && candidateById.has(Number(parent.id))) return [];

    let displayed = skill;
    let current = skill;
    const visited = new Set<number>();
    while (!visited.has(Number(current.id))) {
      visited.add(Number(current.id));
      const flip = flipByParentId.get(Number(current.id));
      if (!flip) break;
      if (paletteFlipAvailable(flip, availableFlips, at)) {
        displayed = candidateById.get(Number(flip.id)) || flip;
      }

      current = flip;
    }

    if (displayedIds.has(Number(displayed.id))) return [];
    displayedIds.add(Number(displayed.id));
    return [displayed];
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
  const autoattackChains =
    professionState.autoattackChains && typeof professionState.autoattackChains === 'object'
      ? (professionState.autoattackChains as SchedulerRecord)
      : {};
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
  const displayedIds = new Set<number>();
  const projected = displayedFlipSkills(app, stagedSkills).flatMap((displayed) => {
    if (!autoattackChainSkillAvailable(displayed, autoattackChains) || displayedIds.has(Number(displayed.id))) {
      return [];
    }

    displayedIds.add(Number(displayed.id));
    return [displayed];
  });

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

export function weaponPaletteStackHtml(groups: readonly string[] = []): string {
  const content = groups.filter(Boolean).join('');
  if (!content) return '';
  return (
    `<div class="weapon-palette-stack" data-role="weapon-set-stack" ` +
    `style="display:flex;flex-direction:row;flex-wrap:wrap;align-items:flex-start;gap:6px">${content}</div>`
  );
}

export function weaponPaletteSectionHtml(
  weaponGroups: readonly string[] = [],
  actionGroup = '',
  trailingGroup = ''
): string {
  const weapons = weaponPaletteStackHtml(weaponGroups);
  if (!weapons && !actionGroup && !trailingGroup) return '';
  return (
    `<div class="weapon-palette-section" data-role="weapon-palette-section" ` +
    `style="display:flex;align-items:flex-start;gap:6px">` +
    `${weapons}${actionGroup}${trailingGroup}</div>`
  );
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

export function rotationUtilityFlipByParent(app: ProfessionAppState): Map<string, Skill> {
  const skillById = app.skillById || app.activeCatalog.skillsById;
  const flips = new Map<string, Skill>();
  for (const skill of app.skills) {
    if (
      !(skill.flipParent || skill.flipParentId != null) ||
      skill.type === 'Weapon' ||
      skill.kit ||
      skill.paletteFlip === false
    ) {
      continue;
    }

    const parentName = String(skill.flipParent || skillById.get(Number(skill.flipParentId))?.name || '');
    if (parentName) flips.set(parentName, skill);
  }

  return flips;
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
