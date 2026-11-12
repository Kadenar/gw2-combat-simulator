/** Project palette selection, readiness, resources, and placement from captured facts without reading application state. */
import type { ProfessionIsSkillAvailable } from '#gw2/app/build/types.js';
import type { RotationProfessionState } from '#gw2/app/rotation/context.js';
import { rotationHotkeyActionForSkillName, rotationLoadoutHotkeyActions } from '#gw2/app/rotation/hotkeys.js';
import {
  activeResourceDefinitions,
  paletteSkillResourceView,
  type PaletteResourceView
} from '#gw2/app/rotation/palette/resource-view.js';
import type { PaletteSkill } from '#gw2/app/rotation/skill-types.js';
import { rotationEntryName } from '#gw2/app/rotation/timeline/model.js';
import { ACTION_ICONS, COMBAT_START_ICON, COOLDOWN_RESET_ICON, WAIT_ICON } from '#gw2/app/shared/icons.js';
import { PLACEHOLDER_ICON } from '#gw2/app/shared/placeholder-icon.js';
import type { SimulationTooltip } from '#gw2/app/shared/simulation-tooltip.js';
import type { ProfessionAppContract } from '#gw2/app/types.js';
import { isBuildSkillAvailable } from '#gw2/platform/builds/selected-skills.js';
import { resolveSelectedSkillLoadout } from '#gw2/platform/builds/skill-loadout.js';
import type { FixedSlotLoadout, SlotLoadoutContext } from '#gw2/platform/builds/slot-loadout.js';
import type { Gw2CanonicalBuild } from '#gw2/platform/builds/types.js';
import { defaultWeaponSkillMatchesSet } from '#gw2/platform/equipment/weapons/skill-matcher.js';
import type { Gw2WeaponDataEntry, Gw2WeaponSkillMatcher } from '#gw2/platform/equipment/weapons/types.js';
import { autoattackChainSkillAvailable } from '#gw2/platform/execution/autoattack-chains.js';
import { summonQuicknessCastTimeMs } from '#gw2/platform/execution/cast-timing.js';
import { skillFlipVisible, type SkillFlipWindows } from '#gw2/platform/execution/skill-flips.js';
import type {
  ProfessionPaletteContext,
  ProfessionPaletteControl,
  ProfessionPaletteGroup,
  ProfessionPaletteSkillEntry,
  ProfessionPaletteStatusIcon,
  ProfessionResourceView,
  ProfessionUiContract
} from '#gw2/platform/profession-presentation/types.js';
import type { Gw2PlanningAmmo, Gw2SimulationPlanningState } from '#gw2/platform/results/types.js';
import { inputControlForSkillSlot } from '#gw2/platform/skills/input-controls.js';
import type { CanonicalCatalog, Skill, SkillId } from '#gw2/platform/skills/types.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';
import { ammoDisplayView, type AmmoDisplayView } from '#ui/rotation/ammo-display.js';

/** Owns the normalized palette declaration consumed by this feature's views. */
interface NormalizedPaletteGroup extends Omit<ProfessionPaletteGroup, 'skillEntries'> {
  readonly skillEntries: ProfessionPaletteSkillEntry[];
  readonly color: string;
  readonly className: string;
  readonly stackId: string;
  readonly placement: 'profession' | 'weapon-set-1' | 'active-weapon' | 'utility';
  readonly weaponRowLabel: string;
  readonly resourceAnchor: boolean;
  readonly resourceIds: readonly string[];
  readonly resourcePlacement: 'above' | 'beside';
}

const PALETTE_ACTION_ORDER = new Map<string, number>([
  ['Dodge', 0],
  ['Swap Weapons', 2]
]);

/**
 * Normalizes profession-owned palette declarations into isolated app view
 * models so generic renderers cannot mutate catalog-owned definitions.
 */
export function paletteView(
  profession: Pick<ProfessionAppContract, 'ui'>,
  context: ProfessionPaletteContext
): NormalizedPaletteGroup[] {
  const groups = profession.ui.paletteGroups(context);

  if (!Array.isArray(groups)) {
    throw new TypeError('paletteGroups must return an array.');
  }

  return groups.map((group) => ({
    id: String(group.id),
    label: String(group.label || group.id),
    skillIds: [...(group.skillIds || [])],
    skillEntries: (group.skillEntries || []).map((entry) => ({ ...entry })),
    color: String(group.color || ''),
    className: String(group.className || ''),
    stackId: String(group.stackId || ''),
    placement:
      group.placement === 'weapon-set-1' || group.placement === 'active-weapon' || group.placement === 'utility'
        ? group.placement
        : 'profession',
    weaponRowLabel: String(group.weaponRowLabel || ''),
    resourceAnchor: Boolean(group.resourceAnchor),
    resourceIds: (group.resourceIds || []).map(String),
    resourcePlacement: group.resourcePlacement === 'beside' ? 'beside' : 'above',
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

function uniqueById(skills: readonly PaletteSkill[]): PaletteSkill[] {
  const unique = new Map<SkillId, PaletteSkill>();
  for (const skill of skills) {
    if (!unique.has(skill.id)) unique.set(skill.id, skill);
  }

  return [...unique.values()];
}

// Authored tile families choose the active specialization without conflating unrelated display labels.
function weaponVariantRank(skill: PaletteSkill, specialization: string): number {
  const spec = String(skill.specialization || '');

  if (spec === specialization) return 0;

  if (spec === '') return 1;

  return 2;
}

function uniqueBySpecializedIdentity(skills: readonly PaletteSkill[], specialization: string): PaletteSkill[] {
  const byIdentity = new Map<SkillId, PaletteSkill>();
  for (const skill of skills) {
    const identity = skill.weaponVariantRootId ?? skill.id;
    const existing = byIdentity.get(identity);

    if (!existing || weaponVariantRank(skill, specialization) < weaponVariantRank(existing, specialization)) {
      byIdentity.set(identity, skill);
    }
  }

  return [...byIdentity.values()];
}

/** No observation means build-start state; queries never obtain or simulate a rotation prefix themselves. */
export interface PaletteQueryInput {
  readonly catalog: CanonicalCatalog;
  readonly build: Gw2CanonicalBuild;
  readonly specialization: string;
  readonly weaponData: Readonly<Record<string, Gw2WeaponDataEntry>>;
  readonly isSkillAvailable: ProfessionIsSkillAvailable;
  readonly weaponSkillMatchesSet?: Gw2WeaponSkillMatcher;
  readonly projectActions?: ProfessionAppContract['ui']['paletteActionSkills'];
  readonly selectedTraitIds: readonly SkillId[];
  readonly planning?: Gw2SimulationPlanningState | null;
}

/** Complete presentation dependencies captured by the application before synchronous projection. */
export interface PaletteInput extends PaletteQueryInput {
  readonly ui: ProfessionUiContract;
  readonly slotLoadout: FixedSlotLoadout<Gw2CanonicalBuild> | null;
  readonly canSwapWeaponSetsInCombat: boolean;
  /** The displayed result's combat origin, which may differ from the cursor observation's origin. */
  readonly combatReferenceMs: number;
  readonly tooltip: (skill: Skill) => SimulationTooltip;
}

function queryProfessionState(query: PaletteQueryInput): RotationProfessionState {
  const state = query.planning?.profession;
  return state && typeof state === 'object' ? (state as RotationProfessionState) : {};
}

export function queryWeaponSkills(query: PaletteQueryInput, weaponSet = 1): PaletteSkill[] {
  // Equipment enumeration also serves isolated previews, independently of live combat restrictions.
  const [mainHand, offHand] = weaponSet === 2 ? query.build.alternateWeapons : query.build.weapons;
  return uniqueBySpecializedIdentity(
    query.catalog.skills.filter((skill) => {
      // Temporary bars and supplemental effects are exposed by profession
      // palette groups, never as skills on an equipped weapon set.
      if (skill.type !== 'Weapon' || !skill.weapon) return false;

      if (
        !query.isSkillAvailable(skill, {
          catalog: query.catalog,
          build: query.build,
          specialization: query.specialization
        })
      ) {
        return false;
      }

      return (query.weaponSkillMatchesSet || defaultWeaponSkillMatchesSet)(skill, [mainHand, offHand], {
        build: query.build,
        specialization: query.specialization,
        professionState: queryProfessionState(query),
        catalog: query.catalog,
        weaponData: query.weaponData,
        weaponSet,
        weaponBarPreview: true
      });
    }),
    query.specialization
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

interface WeaponPaletteRow {
  readonly label: string;
  readonly weaponSet: number;
  readonly active: boolean;
  readonly skills: PaletteSkill[];
}

function paletteFlipAvailable(skill: PaletteSkill, availableFlips: Readonly<SkillFlipWindows>, at: number): boolean {
  return skillFlipVisible(availableFlips[skill.id], at);
}

function isReplacementAttack(skill: PaletteSkill): boolean {
  return (
    Boolean(skill.ambush) ||
    (Boolean(skill.stealthAttack) && skill.slot === 'Weapon_1') ||
    Boolean(skill.unleashedAmbushSkill)
  );
}

function isAutoattackFlipLink(parent: PaletteSkill, child: PaletteSkill): boolean {
  return (
    (parent.chainRoot != null && child.chainRoot != null && Number(parent.chainRoot) === Number(child.chainRoot)) ||
    (parent.weaponBarChainRootId != null &&
      child.weaponBarChainRootId != null &&
      Number(parent.weaponBarChainRootId) === Number(child.weaponBarChainRootId))
  );
}

interface PaletteFlipFamilies {
  readonly familyIdBySkillId: Map<number, number>;
  readonly membersByFamilyId: Map<number, readonly PaletteSkill[]>;
}

function paletteFlipFamilies(
  catalogSkills: readonly PaletteSkill[],
  skillById: ReadonlyMap<SkillId, PaletteSkill>
): PaletteFlipFamilies {
  const neighborsBySkillId = new Map<number, Set<number>>();
  const catalogOrder = new Map(catalogSkills.map((skill, index) => [Number(skill.id), index]));
  const register = (parent: PaletteSkill, child: PaletteSkill): void => {
    if (
      parent.paletteFlip === false ||
      child.paletteFlip === false ||
      (child.rotationInputExcluded && child.type === 'Weapon') ||
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

  // Flip metadata can branch (one root with several state-dependent children).
  // Connected components keep every variant under one stable catalog-owned tile.
  const familyIdBySkillId = new Map<number, number>();
  const membersByFamilyId = new Map<number, readonly PaletteSkill[]>();
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

interface PaletteSkillAvailability {
  readonly available: boolean;
  readonly message: string;
  readonly retryAt?: number | null;
}

/** UI-only actions inherit their existing cast components' gates without changing the commands they insert. */
function compositePaletteAvailability(
  input: PaletteInput,
  context: ProfessionPaletteContext,
  skill: PaletteSkill,
  planning: Gw2SimulationPlanningState
): PaletteSkillAvailability {
  const missing = { available: false, message: 'No runtime availability verdict for this skill.' };

  // A missing ordinary skill verdict remains an error; only profession-owned UI actions can expand into components.
  if (input.catalog.skillsById.has(skill.id)) return missing;

  const action = input.ui?.resolvePaletteAction?.(context, { name: skill.name, skillId: skill.id });
  const commands = Array.isArray(action) ? action : action ? [action] : [];

  if (!commands.length) return missing;

  let result: PaletteSkillAvailability = { available: true, message: '' };
  for (const command of commands) {
    if (command.type !== 'cast') return missing;

    const component = input.catalog.skillsById.get(command.skillId);
    const verdict = planning.availability[command.skillId];

    if (!component || !verdict) return missing;

    if (!isBuildSkillAvailable(component, { specialization: context.specialization }))
      return { available: false, message: `${component.name} is unavailable for this build.` };

    if (verdict.ready) continue;

    // A permanent denial vetoes the action; otherwise retain the latest component retry for ordinary waitable insertion.
    const denied = { available: false, message: verdict.reason, retryAt: verdict.retryAt };

    if (verdict.retryAt == null) return denied;

    if (result.available || verdict.retryAt > (result.retryAt ?? 0)) result = denied;
  }

  return result;
}

/** Read current default-command gates; missing completed verdicts are denied, while startup is explicitly unevaluated. */
export function paletteAvailability(
  input: PaletteInput,
  context: ProfessionPaletteContext,
  skill: PaletteSkill
): PaletteSkillAvailability {
  if (!isBuildSkillAvailable(skill, { specialization: context.specialization }))
    return { available: false, message: `${skill.name} is unavailable for this build.` };

  const planning = input.planning;

  if (!planning) return { available: true, message: 'Runtime availability has not been evaluated yet.' };

  const verdict = planning.availability[skill.id];

  if (!verdict) return compositePaletteAvailability(input, context, skill, planning);

  const override = input.ui?.paletteOverride?.(context, skill);

  if (override?.available != null) return { available: override.available, message: override.message || '' };

  return verdict.ready
    ? { available: true, message: '' }
    : { available: false, message: verdict.reason, retryAt: verdict.retryAt };
}

function paletteCandidateActive(
  input: PaletteInput,
  context: ProfessionPaletteContext,
  skill: PaletteSkill
): boolean | null {
  return input.ui?.paletteOverride?.(context, skill)?.tileActive ?? null;
}

function paletteTileEntryKey(
  skill: PaletteSkill,
  flipFamilyIdBySkillId: ReadonlyMap<number, number>,
  index: number
): string {
  if (skill.paletteTileId != null) return `declared:${String(skill.paletteTileId)}`;

  if (skill.chainRoot != null) return `autoattack:${String(skill.chainRoot)}`;

  const flipFamilyId = flipFamilyIdBySkillId.get(Number(skill.id));

  if (flipFamilyId != null) return `flip:${String(flipFamilyId)}`;

  if (skill.paletteLegendId != null) return `skill:${String(skill.id)}:legend:${String(skill.paletteLegendId)}`;

  return `skill:${String(skill.id)}:${index}`;
}

function paletteTileCandidateOrder(skill: PaletteSkill, fallback: number): number {
  const declared = Number(skill.paletteTileOrder);

  if (Number.isFinite(declared)) return declared;

  const chainStep = Number(skill.chainStep);
  return Number.isFinite(chainStep) ? chainStep : fallback;
}

/**
 * Projects every combat-bar family to one live palette identity. Catalog
 * autoattack roots and flip links work automatically; `paletteTileId` covers
 * UI-only families group related skill declarations on one shared tile.
 */
export function displayedSkillTiles(
  input: PaletteInput,
  skills: readonly PaletteSkill[],
  context: ProfessionPaletteContext = queryPaletteContext(input)
): PaletteSkill[] {
  const planningState = input.planning;
  const professionState = queryProfessionState(input);
  const availableFlips = professionState[STATE.AVAILABLE_FLIPS] ?? {};
  const at = Number(planningState?.atSeconds || 0);
  const catalogSkills = input.catalog.skills;
  // Resolve flip links through the catalog's existing index instead of rebuilding it for each palette projection.
  const { familyIdBySkillId, membersByFamilyId } = paletteFlipFamilies(catalogSkills, input.catalog.skillsById);
  const autoattackChains = professionState[STATE.AUTOATTACK_CHAINS] ?? {};
  const grouped = new Map<string, { readonly skill: PaletteSkill; readonly index: number }[]>();

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
      const activeChainSkill = candidates.find((candidate) => candidate.id === expected);

      if (activeChainSkill) return activeChainSkill;
    }

    const activeFlips = candidates.filter((candidate) => paletteFlipAvailable(candidate, availableFlips, at));

    if (activeFlips.length) {
      const availableActiveFlips = activeFlips.filter(
        (candidate) => paletteCandidateActive(input, context, candidate) !== false
      );
      return availableActiveFlips.length === 1 ? availableActiveFlips[0] : activeFlips.at(-1)!;
    }

    const availableCandidates = candidates.filter(
      (candidate) => paletteCandidateActive(input, context, candidate) === true
    );
    return availableCandidates.length === 1 ? availableCandidates[0] : candidates[0];
  });
}

/**
 * Collapses linked chains, autoattacks, flips, and ambush replacements to the
 * skill currently occupying each combat-bar tile as the live state changes.
 */
export function displayedWeaponSkills(
  input: PaletteInput,
  skills: readonly PaletteSkill[],
  weaponSet = Number(input.planning?.activeWeaponSet || input.build.startingWeaponSet || 1),
  paletteContext: ProfessionPaletteContext = queryPaletteContext(input)
): PaletteSkill[] {
  const planningState = input.planning;
  const professionState = queryProfessionState(input);
  const equippedWeapons = weaponSet === 2 ? input.build.alternateWeapons : input.build.weapons;
  const matcher = input.weaponSkillMatchesSet || defaultWeaponSkillMatchesSet;
  // Linked non-autoattack chains (currently Thief spear slots 2 and 3) use
  // their profession matcher to choose the stage occupying each combat-bar tile.
  const stagedSkills = skills.filter(
    (skill) =>
      skill.weaponBarChainRootId == null ||
      matcher(skill, equippedWeapons, {
        ...paletteContext,
        weaponData: input.weaponData,
        weaponSet,
        weaponBarPreview: false
      })
  );
  const projected = displayedSkillTiles(input, stagedSkills, paletteContext);

  const isWeaponOneReplacement = (skill: PaletteSkill): boolean =>
    skill.slot === 'Weapon_1' && isReplacementAttack(skill);
  const activeWeaponSet = Number(planningState?.activeWeaponSet || input.build.startingWeaponSet || 1);
  const availableAmbushName = String(professionState[STATE.AVAILABLE_AMBUSH]?.name || '');
  const activeReplacement =
    weaponSet === activeWeaponSet
      ? projected.find((skill) => {
          if (!isWeaponOneReplacement(skill)) return false;

          if (skill.ambush) return skill.name === availableAmbushName;

          return paletteCandidateActive(input, paletteContext, skill) === true;
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
  input: PaletteInput,
  activeWeaponSet = 1,
  context?: ProfessionPaletteContext
): WeaponPaletteRow[] {
  const planning = input.planning;
  const canSwap = input.canSwapWeaponSetsInCombat;
  // Precombat exposes both sets; combat keeps only the reachable bar for restricted builds.
  const rows = [1, 2]
    .filter((set) => !planning?.combatActive || canSwap || set === activeWeaponSet)
    .map((weaponSet) => ({
      label: `W${weaponSet}`,
      weaponSet,
      active: weaponSet === activeWeaponSet,
      skills: displayedWeaponSkills(input, queryWeaponSkills(input, weaponSet), weaponSet, context)
    }))
    .filter((row) => row.skills.length);
  return rows.flatMap((row) => {
    const groups = input.ui.paletteWeaponGroups(
      { ...(context || queryPaletteContext(input)), weaponSet: row.weaponSet },
      row.skills
    );
    // Profession grouping changes labels and contents; shared rows retain weapon-set identity and placement.
    return groups == null
      ? [row]
      : groups.map((group) => ({
          ...row,
          label: group.label,
          skills: [...group.skills]
        }));
  });
}

function queryAutoattackSkill(query: PaletteQueryInput): PaletteSkill | null {
  const planningState = query.planning;
  const activeWeaponSet = Number(planningState?.activeWeaponSet || query.build.startingWeaponSet || 1);
  const professionState = queryProfessionState(query);
  const autoattackChains = professionState[STATE.AUTOATTACK_CHAINS];
  const chainState = autoattackChains && typeof autoattackChains === 'object' ? autoattackChains : {};
  return (
    queryWeaponSkills(query, activeWeaponSet).find(
      (skill) => skill.slot === 'Weapon_1' && !skill.ambush && autoattackChainSkillAvailable(skill, chainState)
    ) || null
  );
}

export function queryPaletteActions(query: PaletteQueryInput, context?: ProfessionPaletteContext): PaletteSkill[] {
  const professionState = queryProfessionState(query);
  const actions = uniqueById(
    query.catalog.skills.filter(
      (skill) =>
        skill.type === 'Action' &&
        // The shared action row starts with synthetic actions; profession presentation
        // filters contextual controls while ordinary skills remain on their owning bars.
        Number(skill.id) < 0 &&
        (skill.inputCategory !== 'weapon-swap' || Boolean(query.build.alternateWeapons?.[0])) &&
        (!skill.specialization || skill.specialization === query.specialization) &&
        query.isSkillAvailable(skill, {
          catalog: query.catalog,
          build: query.build,
          specialization: query.specialization,
          professionState
        })
    )
  ).sort(
    (left, right) =>
      (PALETTE_ACTION_ORDER.get(left.name) ?? Number.MAX_SAFE_INTEGER) -
        (PALETTE_ACTION_ORDER.get(right.name) ?? Number.MAX_SAFE_INTEGER) || left.name.localeCompare(right.name)
  );
  const projectActions = query.projectActions;
  return typeof projectActions === 'function'
    ? projectActions(context ?? queryPaletteContext(query), actions)
    : actions;
}

export function rotationSelectedSlotSkills(
  input: PaletteInput,
  context: ProfessionPaletteContext = queryPaletteContext(input)
): PaletteSkill[] {
  if (input.slotLoadout) return [];

  const skills = Object.values(input.build.selectedSkillIds).flatMap((id) => {
    const skill = id === null ? undefined : input.catalog.skillsById.get(id);
    return skill ? [skill] : [];
  });
  return input.ui.paletteSelectedSlotSkills(context, skills);
}

export function paletteSkillIsInstant(
  input: PaletteInput,
  context: ProfessionPaletteContext,
  skill: PaletteSkill | null | undefined,
  name = skill?.name || ''
): boolean {
  return (
    name === '__combat_start' ||
    name === '__cooldown_reset' ||
    Number(skill?.castTimeMs || 0) === 0 ||
    (skill != null && input.ui.isPaletteSkillInstant?.(context, skill) === true)
  );
}

export interface PaletteSkillView {
  /** Concrete bar face used by editors when the inserted input has a separate identity. */
  readonly displaySkillId?: SkillId;
  readonly tooltip?: SimulationTooltip;
  readonly skill?: PaletteSkill;
  readonly name?: string;
  readonly skillId?: SkillId | null;
  readonly hotkeyAction?: string;
  readonly title?: string;
  readonly castDetails?: string;
  readonly notice?: string;
  readonly icon?: string;
  readonly variantBadge?: string;
  readonly color?: string;
  readonly disabled?: boolean;
  readonly contextDisabled?: boolean;
  readonly highlighted?: boolean;
  readonly draggable?: boolean;
  readonly cooldownLabel?: string;
  readonly ammo?: AmmoDisplayView | null;
  readonly resource?: PaletteResourceView | null;
}

export interface PaletteGroupView {
  readonly resourceIds?: readonly string[];
  readonly resourcePlacement?: 'above' | 'beside';
  readonly id?: string;
  readonly label?: string;
  readonly color?: string;
  readonly className?: string;
  readonly skills?: readonly PaletteSkillView[];
  readonly controls?: readonly ProfessionPaletteControl[];
  readonly statusIcon?: ProfessionPaletteStatusIcon;
}

type SelectedPaletteGroup = ProfessionPaletteGroup & { skills: PaletteSkill[] };

/** Final tiles retain their profession-owned placement metadata. */
export type ProjectedPaletteGroup = PaletteGroupView &
  Pick<ProfessionPaletteGroup, 'id' | 'placement' | 'weaponRowLabel' | 'stackId' | 'resourceAnchor'> & {
    readonly skills: readonly PaletteSkillView[];
  };

export type PaletteContext = SlotLoadoutContext &
  ProfessionPaletteContext & {
    readonly build: Gw2CanonicalBuild;
    readonly catalog: CanonicalCatalog;
    readonly specialization: string;
  };

/** Project either build-start or supplied planning facts without consulting editor state. */
export function queryPaletteContext(query: PaletteQueryInput): PaletteContext {
  const planningState = query.planning;
  return {
    specialization: query.specialization,
    catalog: query.catalog,
    professionState: queryProfessionState(query),
    cooldownsBySkillId: planningState?.cooldownsBySkillId || {},
    activeWeaponSet: planningState?.activeWeaponSet || query.build.startingWeaponSet || 1,
    time: Number(planningState?.atSeconds || 0),
    build: query.build,
    activeAutoattack: queryAutoattackSkill(query),
    // Expose selected IDs so profession replacements use the same membership contract as simulation.
    traits: new Set(query.selectedTraitIds)
  };
}

function currentCooldown(
  input: PaletteInput,
  skill: PaletteSkill
): { readonly remainingMs: number; readonly readyAtMs: number } {
  // Match ammo and availability identity so same-name variants retain independent deadlines.
  return input.planning?.cooldownsBySkillId?.[String(skill.id)] || { remainingMs: 0, readyAtMs: 0 };
}

/** Exact skill IDs prevent variant collisions; convert scheduler seconds to the displayed countdown. */
function currentAmmo(
  input: PaletteInput,
  skill: PaletteSkill
): (Gw2PlanningAmmo & { readonly remaining: number }) | null {
  const planningState = input.planning;
  const ammo = planningState?.ammoBySkillId[String(skill.id)];

  if (!ammo) return null;

  return {
    ...ammo,
    remaining: ammo.nextRechargeAt == null ? 0 : Math.max(0, (ammo.nextRechargeAt - planningState.atSeconds) * 1000)
  };
}

interface PaletteSkillViewOptions {
  readonly contextAvailable?: boolean;
  readonly contextMessage?: string;
  readonly contextRetryAt?: number | null;
  readonly resources?: readonly ProfessionResourceView[];
  readonly paletteContext?: PaletteContext;
}

/**
 * Projects a skill and the latest simulation state into generic palette UI.
 * `contextAvailable` is the caller's combined state/placement decision;
 * cooldown and ammo state are derived here so styling, dragging, and tooltips
 * share one decision. Whole-palette projection supplies its context to avoid
 * repeating catalog queries for each tile; isolated callers derive it once here.
 */
export function paletteSkillView(
  input: PaletteInput,
  skill: PaletteSkill,
  {
    contextAvailable = true,
    contextMessage = '',
    contextRetryAt = null,
    resources = activeResourceDefinitions(input),
    paletteContext = queryPaletteContext(input)
  }: PaletteSkillViewOptions = {}
): PaletteSkillView {
  const cd = currentCooldown(input, skill);
  const editorAccess =
    input.planning?.availability[skill.id] != null &&
    isBuildSkillAvailable(skill, { specialization: input.specialization }) &&
    input.ui?.paletteOverride?.(paletteContext, skill)?.editorAccess === true &&
    input.ui.castEditor({ build: input.build, catalog: input.catalog, specialization: input.specialization }, skill) !=
      null;
  const endTime = Number(input.planning?.atSeconds || 0) * 1000;
  const contextReadyAt = Number(contextRetryAt) * 1000;
  const contextRemaining = Number.isFinite(contextReadyAt) ? Math.max(0, Math.round(contextReadyAt - endTime)) : 0;
  // A future check remains insertable; pending events can change the verdict before the scheduler checks again.
  const retryableContext =
    !contextAvailable && contextRetryAt != null && Number.isFinite(contextReadyAt) && contextReadyAt > endTime;
  const remaining = Number(cd.remainingMs || 0);
  const readyAt = cd.readyAtMs;
  const ammo = currentAmmo(input, skill);
  const maximumAmmo = ammo?.maximum ?? Number(skill.ammo || 0);
  const ammoDisplay = ammoDisplayView(ammo?.charges ?? maximumAmmo, maximumAmmo);
  // Show the cast lockout while disabled, then the next charge timer, with millisecond precision shared by tooltips.
  const displayedRemaining = remaining || Number(ammo?.remaining || 0);
  // Keep icon labels compact; tooltips distinguish known cooldownsBySkillId from the next resource or state check.
  const cooldownLabel = displayedRemaining
    ? `${(displayedRemaining / 1000).toFixed(3)}s`
    : contextRemaining
      ? `${(contextRemaining / 1000).toFixed(3)}s`
      : '';
  const unavailable = remaining > 0 || !contextAvailable;
  // Available unleashed ambushes use the same glow as cloak and stealth attacks.
  const highlighted =
    (Boolean(skill.ambush) || Boolean(skill.stealthAttack) || Boolean(skill.unleashedAmbushSkill)) && !unavailable;
  const castTimeSeconds = Number(skill.castTimeMs || 0) / 1000;
  // Preserve millisecond precision for every duration and deadline in cast details.
  const castDetails = [
    // A palette entry has no activation yet; show both speeds instead of presenting the base as a live duration.
    skill.independentCast && castTimeSeconds > 0
      ? `Cast time (normal): ${castTimeSeconds.toFixed(3)}s\nCast time (Quickness): ${(summonQuicknessCastTimeMs(skill) / 1000).toFixed(3)}s`
      : `Cast time: ${castTimeSeconds ? `${castTimeSeconds.toFixed(3)}s` : 'Instant'}`,
    !contextAvailable
      ? remaining
        ? `Ready in: ${cooldownLabel}`
        : ''
      : ammoDisplay
        ? `Ammunition: ${ammoDisplay.current}/${ammoDisplay.maximum}${
            displayedRemaining ? `\n${remaining ? 'Ready in' : 'Next charge in'}: ${cooldownLabel}` : ''
          }`
        : remaining
          ? `Ready in: ${cooldownLabel}\nAvailable at: ${((readyAt - input.combatReferenceMs) / 1000).toFixed(3)}s`
          : 'Status: Available now',
    contextRemaining ? `Availability rechecked in: ${(contextRemaining / 1000).toFixed(3)}s` : ''
  ]
    .filter(Boolean)
    .join('\n');
  return {
    name: skill.name,
    skill,
    tooltip: input.tooltip(skill),
    skillId: skill.inputSkillId ?? skill.id,
    ...(skill.inputSkillId == null ? {} : { displaySkillId: skill.id }),
    hotkeyAction:
      // Preserve the selected bar position through rendering, including utility and elite replacements.
      skill.hotkeyAction ||
      String(skill.inputControl || '') ||
      inputControlForSkillSlot(skill.slot) ||
      rotationHotkeyActionForSkillName(skill.name),
    icon: skill.icon || ACTION_ICONS[skill.name] || PLACEHOLDER_ICON,
    variantBadge: String(skill.variantBadge || ''),
    castDetails,
    notice: contextAvailable
      ? contextMessage
      : (contextMessage || 'Unavailable in the current state').replace(
          /^Swap to (.+) to use this skill$/,
          'Requires $1'
        ),
    color: unavailable ? '#625a73' : highlighted ? '#f0c766' : '#a88be8',
    disabled: unavailable,
    contextDisabled: !contextAvailable && !retryableContext && !editorAccess,
    highlighted,
    draggable: contextAvailable,
    cooldownLabel,
    ammo: ammoDisplay,
    resource: paletteSkillResourceView(resources, skill.id)
  };
}

/** Select profession and loadout skills without building tooltips or display state, also used by warnings. */
export function paletteSkillGroups(input: PaletteInput, paletteContext: PaletteContext) {
  const professionGroups = paletteView({ ui: input.ui }, paletteContext);
  const loadoutGroups = input.slotLoadout?.paletteGroups(paletteContext) || [];
  const renderGroups = (groups: readonly ProfessionPaletteGroup[]): SelectedPaletteGroup[] =>
    groups.map((group) => {
      const skillIds = group.skillIds || [];
      const skills = [
        ...skillIds.flatMap((id) => {
          const skill = input.catalog.skillsById.get(id);
          return skill && (group.includeActionSkills || skill.type !== 'Action') ? [skill] : [];
        }),
        ...(group.skillEntries || []).flatMap((entry) => {
          const skill = input.catalog.skillsById.get(Number(entry.skillId));
          return skill && (group.includeActionSkills || skill.type !== 'Action')
            ? [{ ...skill, ...entry, name: skill.name } as PaletteSkill]
            : [];
        })
      ];
      return {
        ...group,
        // Project sequence families to the skill currently occupying each live palette tile.
        skills: displayedSkillTiles(input, skills, paletteContext)
      };
    });
  const renderedProfessionGroups = renderGroups(professionGroups);
  const loadoutHotkeys = rotationLoadoutHotkeyActions(
    input.slotLoadout?.view(paletteContext).bars || [],
    (skillId) => input.slotLoadout?.skillChildren?.(paletteContext, skillId) || []
  );
  const renderedLoadoutGroups = renderGroups(loadoutGroups).map((group) => ({
    ...group,
    skills: group.skills.map((skill) => ({
      ...skill,
      hotkeyAction: loadoutHotkeys.get(Number(skill.id)) || ''
    }))
  }));
  return { renderedProfessionGroups, renderedLoadoutGroups };
}

/** Resolve tile state and weapon placement before rendering. All palette views use these values. */
export function projectPalette(input: PaletteInput) {
  const paletteContext = queryPaletteContext(input);
  const professionState = paletteContext.professionState as RotationProfessionState;
  const { renderedProfessionGroups, renderedLoadoutGroups } = paletteSkillGroups(input, paletteContext);
  const selected = rotationSelectedSlotSkills(input, paletteContext);
  const selectedHotkeys = rotationLoadoutHotkeyActions(resolveSelectedSkillLoadout(input.build).bars);
  // The shared projector discovers and selects descendants from the catalog;
  // selected utilities only need to contribute their root tile and hotkey.
  const selectedWithFlipChains = uniqueById(selected).map((skill) => ({
    ...skill,
    // Empty slots and transformed faces retain the binding of the selected skill.
    hotkeyAction: selectedHotkeys.get(Number(skill.inputSkillId ?? skill.id)) || ''
  }));
  const groupedActionSkillIds = new Set(
    [...renderedProfessionGroups, ...renderedLoadoutGroups].flatMap((group) =>
      group.skills.filter((skill) => skill.type === 'Action').map((skill) => String(skill.id))
    )
  );
  // Actions explicitly placed by a profession or loadout group must not also
  // appear in the shared action row.
  const actions = queryPaletteActions(input, paletteContext).filter(
    (skill) => !groupedActionSkillIds.has(String(skill.id))
  );
  const weaponSwapActions = actions.filter((skill) => skill.name === 'Swap Weapons');
  const generalActions = actions.filter((skill) => skill.name !== 'Swap Weapons');
  const activeWeaponSet = Number(paletteContext.activeWeaponSet || 1);

  const availableAmbush =
    professionState[STATE.AVAILABLE_AMBUSH] && typeof professionState[STATE.AVAILABLE_AMBUSH] === 'object'
      ? professionState[STATE.AVAILABLE_AMBUSH]
      : null;

  const autoattackChains = professionState[STATE.AUTOATTACK_CHAINS] ?? {};
  const loadoutUnavailableMessage = (skill: PaletteSkill): string =>
    input.slotLoadout?.unavailableReason(skill, paletteContext) || '';

  // Loadout and profession availability are independent vetoes. Cache the
  // structured profession result because both its flag and message are read.
  const paletteAvailabilityBySkill = new Map<PaletteSkill, PaletteSkillAvailability>();
  const professionPaletteAvailability = (skill: PaletteSkill): PaletteSkillAvailability => {
    if (!paletteAvailabilityBySkill.has(skill)) {
      paletteAvailabilityBySkill.set(skill, paletteAvailability(input, paletteContext, skill));
    }

    return paletteAvailabilityBySkill.get(skill) as PaletteSkillAvailability;
  };

  const professionAllowsPaletteSkill = (skill: PaletteSkill): boolean =>
    !loadoutUnavailableMessage(skill) && professionPaletteAvailability(skill).available;

  const professionPaletteUnavailableMessage = (skill: PaletteSkill): string =>
    loadoutUnavailableMessage(skill) || professionPaletteAvailability(skill).message;

  const professionPaletteRetryAt = (skill: PaletteSkill): number | null =>
    loadoutUnavailableMessage(skill) ? null : (professionPaletteAvailability(skill).retryAt ?? null);

  // A resource retry cannot bypass weapon placement or the currently active replacement attack.
  const weaponSkillMatchesContext = (skill: PaletteSkill, weaponSet: number): boolean => {
    if (weaponSet !== activeWeaponSet) return false;

    if (skill.ambush) return String(availableAmbush?.name || '') === skill.name;

    if (availableAmbush && skill.slot === 'Weapon_1') return false;

    return true;
  };

  const weaponSkillAvailable = (skill: PaletteSkill, weaponSet: number): boolean =>
    weaponSkillMatchesContext(skill, weaponSet) && professionAllowsPaletteSkill(skill);

  const weaponSkillRetryAt = (skill: PaletteSkill, weaponSet: number): number | null =>
    weaponSkillMatchesContext(skill, weaponSet) ? professionPaletteRetryAt(skill) : null;

  const weaponSkillUnavailableMessage = (skill: PaletteSkill, weaponSet: number): string => {
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

  const selectedWithFlips = displayedSkillTiles(input, selectedWithFlipChains, paletteContext);

  const resources = activeResourceDefinitions(input);
  const professionTile = (skill: PaletteSkill): PaletteSkillView =>
    paletteSkillView(input, skill, {
      contextAvailable: professionAllowsPaletteSkill(skill),
      contextMessage: professionPaletteUnavailableMessage(skill),
      contextRetryAt: professionPaletteRetryAt(skill),
      resources,
      paletteContext
    });
  const weaponTile = (skill: PaletteSkill, weaponSet: number): PaletteSkillView =>
    paletteSkillView(input, skill, {
      contextAvailable: weaponSkillAvailable(skill, weaponSet),
      contextMessage: weaponSkillUnavailableMessage(skill, weaponSet),
      contextRetryAt: weaponSkillRetryAt(skill, weaponSet),
      resources,
      paletteContext
    });
  const projectGroup = (group: SelectedPaletteGroup): ProjectedPaletteGroup => ({
    id: group.id,
    label: group.label,
    color: group.color || '#c49cff',
    className: group.className,
    controls: group.controls,
    statusIcon: group.statusIcon,
    placement: group.placement,
    weaponRowLabel: group.weaponRowLabel,
    stackId: group.stackId,
    resourceAnchor: group.resourceAnchor,
    resourceIds: group.resourceIds,
    resourcePlacement: group.resourcePlacement,
    skills: group.skills.map(professionTile)
  });
  const professionGroups = renderedProfessionGroups.map(projectGroup);
  const paletteWeaponSkills = (skills: readonly PaletteSkill[], weaponSet: number): PaletteSkill[] =>
    input.ui.paletteWeaponSkills({ ...paletteContext, weaponSet }, skills);
  const customLayout = input.ui.projectWeaponPalette({
    ...paletteContext,
    skills: paletteWeaponSkills(
      displayedWeaponSkills(input, queryWeaponSkills(input, activeWeaponSet), activeWeaponSet, paletteContext),
      activeWeaponSet
    ),
    autoattackChains,
    isSkillAvailable: (skill) => weaponSkillAvailable(skill, activeWeaponSet)
  });
  // Reference occurrences share cooldowns with their live tiles but never expose activation or dragging.
  const customWeaponPalette = customLayout
    ? {
        skills: customLayout.skills.map(({ skill, referenceOnly }) =>
          referenceOnly
            ? {
                ...paletteSkillView(input, skill, { resources, paletteContext }),
                draggable: false,
                hotkeyAction: ''
              }
            : weaponTile(skill, activeWeaponSet)
        ),
        render: customLayout.render
      }
    : null;
  const weaponSetOneGroups = professionGroups.filter((group) => group.placement === 'weapon-set-1');
  const activeWeaponGroups = professionGroups.filter((group) => group.placement === 'active-weapon');
  const weaponGroups: PaletteGroupView[] = [];
  let weaponSwapEmbedded = false;

  if (customWeaponPalette) {
    weaponGroups.push(...weaponSetOneGroups);
  } else {
    // Filter transformed rows first so an empty row cannot consume the embedded swap action.
    const rows = weaponPaletteRows(input, activeWeaponSet, paletteContext)
      .map((row) => ({ ...row, skills: paletteWeaponSkills(row.skills, row.weaponSet) }))
      .filter((row) => row.skills.length);
    const positioned = new Set<string>();
    rows.forEach((row, index) => {
      const swaps = row.active && !weaponSwapEmbedded ? weaponSwapActions : [];

      if (swaps.length) weaponSwapEmbedded = true;

      weaponGroups.push({
        label: row.label,
        color: row.active ? '#a98fd8' : '#625a73',
        skills: [...row.skills.map((skill) => weaponTile(skill, row.weaponSet)), ...swaps.map(professionTile)]
      });
      const attached = activeWeaponGroups.filter(
        (group) =>
          row.active && !positioned.has(group.id) && (!group.weaponRowLabel || group.weaponRowLabel === row.label)
      );
      attached.forEach((group) => positioned.add(group.id));
      weaponGroups.push(...attached);

      if (row.weaponSet === 1 && rows[index + 1]?.weaponSet !== 1) weaponGroups.push(...weaponSetOneGroups);
    });
    weaponGroups.push(...activeWeaponGroups.filter((group) => !positioned.has(group.id)));
  }

  const virtualTile = (view: PaletteSkillView): PaletteSkillView => ({ color: '#8d7a57', draggable: true, ...view });
  return {
    paletteContext,
    renderedProfessionGroups: professionGroups,
    renderedLoadoutGroups: renderedLoadoutGroups.map(projectGroup),
    resources,
    loadoutAfterActions: input.slotLoadout?.palettePlacement === 'after-actions',
    customWeaponPalette,
    weaponGroups,
    activeWeaponPrimaryGroups: customWeaponPalette ? activeWeaponGroups : [],
    utilityGroup: {
      label: 'Skill',
      color: '#cbb8ea',
      className: 'utility-palette-group',
      skills: selectedWithFlips.map(professionTile)
    },
    actionGroup: {
      label: 'Act',
      color: '#70b6d0',
      className: 'action-palette-group',
      skills: (weaponSwapEmbedded ? generalActions : actions).map(professionTile)
    },
    timelineControls: [
      {
        label: 'Cmb',
        color: '#d66d2f',
        skills: [
          virtualTile({
            name: '__combat_start',
            title: 'Combat Start',
            icon: COMBAT_START_ICON,
            contextDisabled: input.build.rotation.some((item) => rotationEntryName(item) === '__combat_start')
          })
        ]
      },
      {
        label: 'Rst',
        color: '#7e9ac7',
        skills: [virtualTile({ name: '__cooldown_reset', title: 'Cooldown Reset', icon: COOLDOWN_RESET_ICON })]
      },
      { label: 'W8', color: '#8d7a57', skills: [virtualTile({ name: '__wait', title: 'Wait', icon: WAIT_ICON })] }
    ]
  };
}

export type PaletteProjection = ReturnType<typeof projectPalette>;
