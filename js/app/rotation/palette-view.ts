/**
 * Renders and binds the rotation builder's skill palette.
 *
 * Palette models supply the standard skill rows, while profession UI contracts
 * can project groups, controls, actions, and custom weapon layouts. This module
 * combines those declarations with the latest simulation state to resolve
 * cooldowns, ammo, flips, ambushes, autoattack chains, and availability, then
 * delegates generic markup and pointer handling to `platform/ui/palette`.
 *
 * The palette is rebuilt after application changes; event handlers therefore
 * read current build and result state instead of retaining DOM-local state.
 */
import { ammoDisplayView } from "../../platform/ui/ammo-display.js";
import { openActivationEditor } from "../../platform/ui/activation-editor.js";
import {
  openDurationEditor,
  validateDurationMs,
} from "../../platform/ui/duration-editor.js";
import {
  bindPaletteInteractions,
  paletteGroupHtml,
  paletteSkillHtml,
  virtualPaletteSkillHtml,
} from "../../platform/ui/palette.js";
import {
  clearTimelineDropIndicators,
  rotationEntryName,
} from "../../platform/ui/timeline.js";
import { escapeHtml as esc, gw2ApiText } from "../../platform/ui/html.js";
import { createRotationItem, insertRotationItems } from "./actions.js";
import { openDragonSlashReleaseEditor } from "./charge-release.js";
import {
  hasConfigurableDoubleEdgeOutcome,
  openDoubleEdgeEditor,
} from "./double-edge.js";
import { normalizeRotationInsertionIndex } from "../../platform/ui/insertion-cursor.js";
import {
  rotationHotkeyActionForSkillSlot,
  rotationLoadoutHotkeyActions,
  rotationUtilityHotkeyAction,
} from "./hotkeys.js";
import {
  activeSpecialization,
  paletteEndState,
  paletteProfessionState,
  seconds,
} from "./context.js";
import {
  ACTION_ICONS,
  COMBAT_START_ICON,
  COOLDOWN_RESET_ICON,
  PLACEHOLDER_ICON,
  WAIT_ICON,
} from "./icons.js";
import {
  autoattackChainSkillAvailable,
  currentAutoattackSkill,
  paletteActionSkills,
  paletteSkillIsInstant,
  rotationLoadoutPaletteGroups,
  rotationPaletteGroups,
  rotationSelectedSlotSkills,
  rotationUtilityFlipByParent,
  uniqueByName,
  weaponPaletteRows,
  weaponPaletteSectionHtml,
  weaponSkills,
} from "./palette-model.js";
import {
  activeResourceGroup,
  paletteSkillResourceView,
} from "./resource-view.js";
import type {
  LegacyRotationItem,
  ProfessionPaletteSkillRenderOptions,
  PaletteSkillAvailability,
  ProfessionPaletteGroup,
  SchedulerRecord,
  Skill,
} from "../../platform/engine/types.js";
import type { PaletteSkillView } from "../../platform/ui/types.js";
import type { ProfessionAppState } from "../profession/types.js";

const CONCURRENT_OFFSET_MS = 100;

type RenderedPaletteGroup = ProfessionPaletteGroup & { skills: Skill[] };

/** Chooses a valid default interruption point just before a cast completes. */
export function suggestedPaletteInterruptMs(
  skill: Skill | null | undefined,
): number {
  const fullCastMs = Math.round(Number(skill?.castTimeMs || 0));
  const configured = Number(skill?.paletteInterruptMs);
  return Number.isFinite(configured) &&
    configured >= 1 &&
    configured < fullCastMs
    ? Math.round(configured)
    : Math.max(1, fullCastMs - 1);
}

/** Normalizes a user-entered wait to a positive whole number of milliseconds. */
export function parseWaitDurationMs(raw: string | null): number | null {
  if (raw == null) return null;
  const validation = validateDurationMs(raw);
  return validation.valid ? validation.value : null;
}

/**
 * Builds fresh action context for clicks and drops, which may occur after the
 * palette markup was produced from an earlier simulation result.
 */
function paletteActionContext(app: ProfessionAppState): SchedulerRecord {
  const endState = paletteEndState(app);
  return {
    specialization: activeSpecialization(app),
    catalog: app.activeCatalog,
    professionState: paletteProfessionState(app),
    cooldowns: endState?.cooldowns || {},
    activeWeaponSet:
      endState?.activeWeaponSet || app.build.startingWeaponSet || 1,
    time: Number(endState?.time || 0) / 1000,
    build: app.build,
    activeAutoattack: currentAutoattackSkill(app),
  };
}

function resolveProfessionPaletteAction(
  app: ProfessionAppState,
  name: string,
  skillId: number | null,
): LegacyRotationItem | LegacyRotationItem[] | null | undefined {
  const resolveAction = app.profession.ui?.resolvePaletteAction;
  return typeof resolveAction === "function"
    ? resolveAction(paletteActionContext(app), { name, skillId })
    : undefined;
}

/**
 * Converts a dragged palette identity into one or more rotation entries.
 * Returns `null` for waits that require editor input, empty names, and duplicate
 * combat-start markers. Profession-owned actions resolve through their UI
 * contract before ordinary skills are converted; composite actions may return
 * multiple items.
 */
export function resolvePaletteDropItem(
  app: ProfessionAppState,
  name: string,
  skillId: number | null = null,
): LegacyRotationItem | LegacyRotationItem[] | null {
  if (!name) return null;
  const professionAction = resolveProfessionPaletteAction(app, name, skillId);
  if (professionAction !== undefined) return professionAction;
  if (
    name === "__combat_start" &&
    app.build.rotation.some(
      (entry) => rotationEntryName(entry) === "__combat_start",
    )
  ) {
    return null;
  }
  if (name === "__wait") return null;
  return createRotationItem(app, name, skillId == null ? {} : { skillId });
}

function currentCooldown(
  app: ProfessionAppState,
  name: string,
): { readonly remaining: number; readonly readyAt: number } {
  return (
    paletteEndState(app)?.cooldowns?.[name] || { remaining: 0, readyAt: 0 }
  );
}

function currentAmmo(
  app: ProfessionAppState,
  name: string,
): SchedulerRecord | null {
  const endState = paletteEndState(app);
  const rawAmmo = endState?.ammo?.[name];
  if (!rawAmmo || typeof rawAmmo !== "object") return null;
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
    remaining: nextChargeAt
      ? Math.max(0, nextChargeAt - Number(endState?.time || 0))
      : 0,
  };
}

/** Adapts a resolved skill list and optional controls to generic group markup. */
function addGroup(
  app: ProfessionAppState,
  label: string,
  skills: readonly Skill[],
  color = "#a88be8",
  isAvailable: (skill: Skill) => boolean = () => true,
  unavailableMessage: (skill: Skill) => string = () => "",
  className = "",
  statusIcon?: ProfessionPaletteGroup["statusIcon"],
  controls: ProfessionPaletteGroup["controls"] = [],
  id = "",
): string {
  if (!skills.length && !controls.length && !statusIcon) return "";
  return paletteGroupHtml({
    id,
    label,
    color,
    className,
    statusIcon,
    controls,
    skills: skills.map((skill) =>
      paletteSkillView(
        app,
        skill,
        isAvailable(skill),
        unavailableMessage(skill),
      ),
    ),
  });
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
  contextMessage = "",
): PaletteSkillView {
  const displayName = skill.displayName || skill.name;
  const cd = currentCooldown(app, skill.name);
  const ammo = currentAmmo(app, skill.name);
  const maximumAmmo = ammo?.maximum ?? Number(skill.ammo || 0);
  const recharge =
    maximumAmmo && Number(skill.ammoRecharge || 0) > 0
      ? Number(skill.ammoRecharge)
      : Number(skill.cooldown || 0);
  const ammoDisplay = ammoDisplayView(
    ammo?.charges ?? maximumAmmo,
    maximumAmmo,
  );
  const unavailable = cd.remaining > 0 || !contextAvailable;
  const highlighted = (Boolean(skill.ambush) || Boolean(skill.stealthAttack)) && !unavailable;
  const castTimeSeconds = Number(skill.castTimeMs || 0) / 1000;
  const hasEnergyCost = skill.energyCost != null;
  const energyCost = Number(skill.energyCost || 0);
  const title = [
    displayName,
    castTimeSeconds ? `Cast: ${castTimeSeconds.toFixed(2)}s` : "Instant cast",
    hasEnergyCost ? `Energy cost: ${energyCost}` : "",
    recharge
      ? `${maximumAmmo ? "Count recharge" : "Cooldown"}: ${recharge}s`
      : "",
    !contextAvailable
      ? contextMessage || "Unavailable in the current state"
      : ammoDisplay
        ? `${ammoDisplay.label}${
            ammo?.remaining
              ? ` · next charge in ${seconds(Number(ammo.remaining))}`
              : ""
          }`
        : cd.remaining
          ? `Remaining: ${seconds(cd.remaining)} · available at ${seconds(cd.readyAt)}`
          : "Available now",
    gw2ApiText(skill.description),
  ]
    .filter(Boolean)
    .join("\n");
  return {
    name: skill.name,
    skillId: skill.id,
    hotkeyAction:
      String(skill.hotkeyAction || "") ||
      rotationHotkeyActionForSkillSlot(skill.slot),
    icon: skill.icon || ACTION_ICONS[skill.name] || PLACEHOLDER_ICON,
    variantBadge: String(skill.variantBadge || ""),
    title,
    color: unavailable ? "#625a73" : highlighted ? "#f0c766" : "#a88be8",
    disabled: unavailable,
    contextDisabled: !contextAvailable,
    concealed: Boolean(skill.concealed),
    highlighted,
    draggable: contextAvailable,
    cooldownLabel: cd.remaining ? seconds(cd.remaining) : "",
    ammo: ammoDisplay,
    resource: paletteSkillResourceView(app, skill.id),
  };
}

/**
 * Replaces the rotation palette markup and binds activation and drag behavior.
 *
 * The standard surface composes profession groups/resources, selected slot
 * skills, loadout groups, weapon rows/actions, and timeline controls. Profession
 * contracts may position individual groups or replace the weapon layout while
 * reusing the generic skill renderer. Activation also supports profession-owned
 * composite actions, Shift-click concurrent instants, and Ctrl-click interrupts.
 */
export function renderPalette(app: ProfessionAppState): void {
  const element = document.getElementById("rotation-palette");
  if (!element) return;
  const spec = activeSpecialization(app);
  const endState = paletteEndState(app);
  const professionState = paletteProfessionState(app);
  const paletteContext = {
    specialization: spec,
    catalog: app.activeCatalog,
    professionState,
    cooldowns: endState?.cooldowns || {},
    activeWeaponSet:
      endState?.activeWeaponSet || app.build.startingWeaponSet || 1,
    time: Number(endState?.time || 0) / 1000,
    build: app.build,
  };
  const professionGroups = rotationPaletteGroups(app, paletteContext);
  const loadoutGroups = rotationLoadoutPaletteGroups(app, paletteContext);
  const renderGroups = (
    groups: readonly ProfessionPaletteGroup[],
  ): RenderedPaletteGroup[] =>
    groups.map((group) => {
      const skillIds = group.skillIds || [];
      const reservedSkillIds = group.reservedSkillIds || [];
      // Reserved IDs keep a group's declared positions stable while inactive
      // alternatives remain concealed rather than disappearing from the model.
      return {
        ...group,
        skills: [
          ...(reservedSkillIds.length ? reservedSkillIds : skillIds).flatMap(
            (id) => {
              const skill = app.skillById.get(id);
              return skill &&
                (group.includeActionSkills || skill.type !== "Action")
                ? [
                    {
                      ...skill,
                      concealed:
                        reservedSkillIds.length > 0 &&
                        !skillIds.includes(skill.id),
                    },
                  ]
                : [];
            },
          ),
          ...(group.skillEntries || []).flatMap((entry) => {
            const skill = app.skillById.get(Number(entry.skillId));
            return skill &&
              (group.includeActionSkills || skill.type !== "Action")
              ? [{ ...skill, ...entry, name: skill.name } as Skill]
              : [];
          }),
        ],
      };
    });
  const renderedProfessionGroups = renderGroups(professionGroups);
  const loadoutHotkeys = rotationLoadoutHotkeyActions(
    app.adapter.slotLoadout?.view(paletteContext).bars || [],
    (skillId) =>
      app.adapter.slotLoadout?.skillChildren?.(paletteContext, skillId) || [],
  );
  const renderedLoadoutGroups = renderGroups(loadoutGroups).map((group) => ({
    ...group,
    skills: group.skills.map((skill) => ({
      ...skill,
      hotkeyAction: loadoutHotkeys.get(Number(skill.id)) || "",
    })),
  }));
  const selected = rotationSelectedSlotSkills(app);
  // Walk every declared descendant so utilities with more than one flip stage
  // remain complete without the shell knowing the depth of a particular chain.
  const utilityFlipByParent = rotationUtilityFlipByParent(app);
  const selectedWithFlipChains = uniqueByName(selected).flatMap(
    (skill, index) => {
      const chain: Skill[] = [];
      const visited = new Set<number>();
      let current: Skill | undefined = skill;
      while (current && !visited.has(Number(current.id))) {
        chain.push(current);
        visited.add(Number(current.id));
        current = utilityFlipByParent.get(current.name);
      }
      return chain.map((candidate) => ({
        ...candidate,
        hotkeyAction: rotationUtilityHotkeyAction(index),
      }));
    },
  );
  const groupedActionSkillIds = new Set(
    [...renderedProfessionGroups, ...renderedLoadoutGroups].flatMap((group) =>
      group.skills
        .filter((skill) => skill.type === "Action" && !skill.concealed)
        .map((skill) => String(skill.id)),
    ),
  );
  // Actions explicitly placed by a profession or loadout group must not also
  // appear in the shared action row.
  const actions = paletteActionSkills(app, spec).filter(
    (skill) => !groupedActionSkillIds.has(String(skill.id)),
  );
  const weaponSwapActions = actions.filter(
    (skill) => skill.name === "Swap Weapons",
  );
  const generalActions = actions.filter(
    (skill) => skill.name !== "Swap Weapons",
  );
  const activeWeaponSet = endState?.activeWeaponSet || 1;
  const availableFlips =
    professionState.availableFlips &&
    typeof professionState.availableFlips === "object"
      ? (professionState.availableFlips as SchedulerRecord)
      : {};
  const availableAmbush =
    professionState.availableAmbush &&
    typeof professionState.availableAmbush === "object"
      ? (professionState.availableAmbush as SchedulerRecord)
      : null;
  const autoattackChains =
    professionState.autoattackChains &&
    typeof professionState.autoattackChains === "object"
      ? (professionState.autoattackChains as SchedulerRecord)
      : {};
  const loadoutUnavailableMessage = (skill: Skill): string =>
    app.adapter.slotLoadout?.unavailableReason(skill, paletteContext) || "";
  // Loadout and profession availability are independent vetoes. Cache the
  // structured profession result because both its flag and message are read.
  const paletteAvailabilityBySkill = new Map<Skill, PaletteSkillAvailability>();
  const professionPaletteAvailability = (
    skill: Skill,
  ): PaletteSkillAvailability => {
    if (!paletteAvailabilityBySkill.has(skill)) {
      paletteAvailabilityBySkill.set(
        skill,
        app.profession.ui.paletteSkillAvailability(paletteContext, skill),
      );
    }
    return paletteAvailabilityBySkill.get(skill) as PaletteSkillAvailability;
  };
  const professionAllowsPaletteSkill = (skill: Skill): boolean =>
    !loadoutUnavailableMessage(skill) &&
    professionPaletteAvailability(skill).available;
  const professionPaletteUnavailableMessage = (skill: Skill): string =>
    loadoutUnavailableMessage(skill) ||
    professionPaletteAvailability(skill).message;
  const flipAvailable = (skill: Skill): boolean =>
    Boolean(availableFlips[skill.id] ?? availableFlips[skill.name]);
  const flipParentName = (skill: Skill): string =>
    String(
      skill.flipParent ||
        app.skillById.get(Number(skill.flipParentId))?.name ||
        "its parent skill",
    );
  const usesStatefulFlip = (skill: Skill): boolean =>
    skill.paletteFlip !== false &&
    Boolean(skill.flipParent || skill.flipParentId != null);
  const chainExpected = (skill: Skill): unknown => {
    const root = String(skill.chainRoot || "");
    return autoattackChains[root] || root;
  };
  const weaponSkillAvailable = (skill: Skill, weaponSet: number): boolean => {
    if (weaponSet !== activeWeaponSet) return false;
    if (!professionAllowsPaletteSkill(skill)) return false;
    if (skill.ambush) return String(availableAmbush?.name || "") === skill.name;
    if (availableAmbush && skill.slot === "Weapon_1") return false;
    if (usesStatefulFlip(skill) && !flipAvailable(skill)) return false;
    return autoattackChainSkillAvailable(skill, autoattackChains);
  };
  const weaponSkillUnavailableMessage = (
    skill: Skill,
    weaponSet: number,
  ): string => {
    if (weaponSet !== activeWeaponSet) {
      return `Swap to weapon set ${weaponSet} to use this skill`;
    }
    if (!professionAllowsPaletteSkill(skill)) {
      return professionPaletteUnavailableMessage(skill);
    }
    if (skill.ambush) {
      return availableAmbush
        ? `Current ambush is ${String(availableAmbush.name || "")}`
        : "Gain Mirage Cloak to use this ambush";
    }
    if (availableAmbush && skill.slot === "Weapon_1") {
      return `${String(availableAmbush.name || "")} currently replaces weapon skill 1`;
    }
    if (usesStatefulFlip(skill) && !flipAvailable(skill)) {
      return `Unavailable until ${flipParentName(skill)} has been used`;
    }
    if (skill.chainRoot) {
      const expected = chainExpected(skill);
      if (skill.name !== expected && skill.id !== Number(expected)) {
        const expectedSkill = app.skillById.get(Number(expected));
        return `Cast ${expectedSkill?.name || expected} first`;
      }
    }
    return "";
  };
  const activeFlipDescendantFor = (skill: Skill): Skill | null => {
    const visited = new Set<number>();
    let flip = utilityFlipByParent.get(skill.name);
    while (flip && !visited.has(Number(flip.id))) {
      if (flipAvailable(flip)) return flip;
      visited.add(Number(flip.id));
      flip = utilityFlipByParent.get(flip.name);
    }
    return null;
  };
  const selectedWithFlips = selectedWithFlipChains.filter((skill) =>
    usesStatefulFlip(skill)
      ? flipAvailable(skill)
      : !activeFlipDescendantFor(skill),
  );
  const utilitySkillAvailable = (skill: Skill): boolean => {
    if (!professionAllowsPaletteSkill(skill)) return false;
    if (usesStatefulFlip(skill)) return flipAvailable(skill);
    return !activeFlipDescendantFor(skill);
  };
  const utilitySkillUnavailableMessage = (skill: Skill): string => {
    if (!professionAllowsPaletteSkill(skill)) {
      return professionPaletteUnavailableMessage(skill);
    }
    if (usesStatefulFlip(skill) && !flipAvailable(skill)) {
      return `Unavailable until ${flipParentName(skill)} has been used`;
    }
    const flip = activeFlipDescendantFor(skill);
    if (flip) return `Unavailable while ${flip.name} has charges`;
    return "";
  };

  const professionSkillAvailable = (skill: Skill): boolean => {
    if (!professionAllowsPaletteSkill(skill)) return false;
    if (usesStatefulFlip(skill) && !flipAvailable(skill)) {
      return false;
    }
    if (!autoattackChainSkillAvailable(skill, autoattackChains)) {
      return false;
    }
    return true;
  };
  const professionSkillUnavailableMessage = (skill: Skill): string => {
    if (!professionAllowsPaletteSkill(skill)) {
      return professionPaletteUnavailableMessage(skill);
    }
    if (usesStatefulFlip(skill) && !flipAvailable(skill)) {
      return `Unavailable until ${flipParentName(skill)} has been used`;
    }
    if (skill.chainRoot) {
      const expected = chainExpected(skill);
      if (skill.name !== expected && skill.id !== Number(expected)) {
        const expectedSkill = app.skillById.get(Number(expected));
        return `Cast ${expectedSkill?.name || expected} first`;
      }
    }
    return "";
  };
  const loadoutHasResourceAnchor = renderedLoadoutGroups.some(
    (group) => group.resourceAnchor,
  );
  const loadoutStackHtml = renderedLoadoutGroups.length
    ? `<div class="weapon-palette-stack loadout-palette-stack"
            data-role="loadout-palette-stack"
            style="display:flex;flex-direction:column;align-items:stretch;gap:6px">${renderedLoadoutGroups
              .map((group) =>
                addGroup(
                  app,
                  group.label,
                  group.skills,
                  group.color || "#c49cff",
                  professionSkillAvailable,
                  professionSkillUnavailableMessage,
                  group.className,
                  group.statusIcon,
                ),
              )
              .join("")}</div>`
    : "";
  const attachedResourceIds = renderedProfessionGroups.flatMap(
    (group) => group.resourceIds || [],
  );
  // Resources attached to a specific group are rendered with that group and
  // excluded from the remaining unpositioned resource block.
  const resourceGroupsHtml = activeResourceGroup(app, {
    excludeIds: attachedResourceIds,
  });
  let resourceAnchorRendered = false;
  // The first eligible anchor consumes the unpositioned resource block; later
  // anchors must not duplicate it.
  const stackWithResources = (
    groupHtml: string,
    anchored: boolean | undefined,
  ): string => {
    if (!anchored || !resourceGroupsHtml) return groupHtml;
    resourceAnchorRendered = true;
    return `<div class="profession-resource-stack"
            data-role="profession-resource-stack">
                ${groupHtml}
                ${resourceGroupsHtml}
            </div>`;
  };
  const loadoutStack = stackWithResources(
    loadoutStackHtml,
    loadoutHasResourceAnchor,
  );
  const loadoutAfterActions =
    app.adapter.slotLoadout?.palettePlacement === "after-actions";
  const loadoutBeforeWeapons = loadoutAfterActions ? "" : loadoutStack;
  const loadoutUtilityGroup =
    loadoutAfterActions && loadoutStack
      ? `<div class="utility-palette-group loadout-utility-palette-group"
            data-role="loadout-utility-palette-group">${loadoutStack}</div>`
      : "";
  // A group either stays in the profession section, follows weapon set one,
  // or sits beside the currently active weapon row.
  const weaponSetOneProfessionGroups = renderedProfessionGroups.filter(
    (group) => group.placement === "weapon-set-1",
  );
  const activeWeaponProfessionGroups = renderedProfessionGroups.filter(
    (group) => group.placement === "active-weapon",
  );
  const standardProfessionGroups = renderedProfessionGroups.filter(
    (group) => group.placement === "profession" || !group.placement,
  );
  const renderProfessionGroup = (group: RenderedPaletteGroup): string => {
    const groupHtml = addGroup(
      app,
      group.label,
      group.skills,
      group.color || "#c49cff",
      professionSkillAvailable,
      professionSkillUnavailableMessage,
      group.className,
      group.statusIcon,
      group.controls,
      group.id,
    );
    const attachedResourcesHtml = group.resourceIds?.length
      ? activeResourceGroup(app, { includeIds: group.resourceIds })
      : "";
    if (!groupHtml || !attachedResourcesHtml) return groupHtml;
    const resourcesFirst = group.resourcePlacement === "above";
    return `<div class="profession-palette-resource-group resource-${esc(group.resourcePlacement || "below")}">
              ${resourcesFirst ? attachedResourcesHtml : groupHtml}
              ${resourcesFirst ? groupHtml : attachedResourcesHtml}
            </div>`;
  };
  const renderedStackIds = new Set<string>();
  const professionGroupsHtml = standardProfessionGroups
    .map((group) => {
      if (!group.stackId) {
        return stackWithResources(
          renderProfessionGroup(group),
          group.resourceAnchor && !loadoutHasResourceAnchor,
        );
      }
      if (renderedStackIds.has(group.stackId)) return "";
      renderedStackIds.add(group.stackId);
      const stackedGroups = standardProfessionGroups.filter(
        (candidate) => candidate.stackId === group.stackId,
      );
      const stackHtml = `<div class="profession-palette-stack"
            data-palette-stack="${esc(group.stackId)}">${stackedGroups
              .map(renderProfessionGroup)
              .join("")}</div>`;
      return stackWithResources(
        stackHtml,
        !loadoutHasResourceAnchor &&
          stackedGroups.some((candidate) => candidate.resourceAnchor),
      );
    })
    .join("");
  const unanchoredResourceGroupsHtml = resourceAnchorRendered
    ? ""
    : resourceGroupsHtml;
  const professionPaletteContent =
    professionGroupsHtml + unanchoredResourceGroupsHtml + loadoutBeforeWeapons;
  const professionPaletteSectionHtml = professionPaletteContent
    ? `<div class="profession-palette-section"
          data-role="profession-palette-section">${professionPaletteContent}</div>`
    : "";
  const utilityGroupHtml = addGroup(
    app,
    "Skill",
    selectedWithFlips,
    "#cbb8ea",
    utilitySkillAvailable,
    utilitySkillUnavailableMessage,
    "utility-palette-group",
  );
  const paletteWeaponSkills = (
    skills: readonly Skill[],
    context: SchedulerRecord = {},
  ): Skill[] =>
    app.profession.ui.paletteWeaponSkills(
      { ...paletteContext, ...context },
      skills,
    );
  // Custom weapon layouts still receive generic availability, tooltip, and
  // interaction markup instead of rebuilding those policies themselves.
  const renderWeaponSkill = (
    skill: Skill,
    options: ProfessionPaletteSkillRenderOptions = {},
  ): string => {
    const contextAvailable =
      options.contextAvailable ?? weaponSkillAvailable(skill, 1);
    const contextMessage =
      options.contextMessage ?? weaponSkillUnavailableMessage(skill, 1);
    return paletteSkillHtml({
      ...paletteSkillView(app, skill, contextAvailable, contextMessage),
      ...((options.view || {}) as PaletteSkillView),
    });
  };
  const customWeaponPalette = app.profession.ui.renderWeaponPalette({
    ...paletteContext,
    skills: paletteWeaponSkills(weaponSkills(app, 1), { weaponSet: 1 }),
    autoattackChains,
    isSkillAvailable: (skill) => weaponSkillAvailable(skill, 1),
    unavailableMessage: (skill) => weaponSkillUnavailableMessage(skill, 1),
    renderSkill: renderWeaponSkill,
  });
  const positionedActiveWeaponGroups = new Set<string>();
  // Standard layouts place weapon swap in the first active weapon row and then
  // omit it from the shared action row.
  let weaponSwapEmbedded = false;
  const weaponGroupsHtml = (() => {
    if (customWeaponPalette) {
      return [
        ...customWeaponPalette.weaponGroupsHtml,
        ...weaponSetOneProfessionGroups.map(renderProfessionGroup),
      ].filter(Boolean);
    }

    const weaponRows = weaponPaletteRows(app, activeWeaponSet)
      .map((row) => ({
        ...row,
        skills: paletteWeaponSkills(row.skills, {
          weaponSet: row.weaponSet,
          weaponRow: row,
        }),
      }))
      .filter((row) => row.skills.length);
    return weaponRows.flatMap((row, index) => {
      const rowWeaponSwapActions =
        row.active && !weaponSwapEmbedded ? weaponSwapActions : [];
      if (rowWeaponSwapActions.length) weaponSwapEmbedded = true;
      const renderedRow = addGroup(
        app,
        row.label,
        [...row.skills, ...rowWeaponSwapActions],
        row.active ? "#a98fd8" : "#625a73",
        (skill) =>
          skill.name === "Swap Weapons"
            ? professionSkillAvailable(skill)
            : weaponSkillAvailable(skill, row.weaponSet),
        (skill) =>
          skill.name === "Swap Weapons"
            ? professionSkillUnavailableMessage(skill)
            : weaponSkillUnavailableMessage(skill, row.weaponSet),
      );
      const positionedGroups = activeWeaponProfessionGroups.filter(
        (group) =>
          row.active &&
          !positionedActiveWeaponGroups.has(group.id) &&
          (!group.weaponRowLabel || group.weaponRowLabel === row.label),
      );
      positionedGroups.forEach((group) =>
        positionedActiveWeaponGroups.add(group.id),
      );
      return [
        renderedRow,
        ...positionedGroups.map(renderProfessionGroup),
        ...(row.weaponSet === 1 && weaponRows[index + 1]?.weaponSet !== 1
          ? weaponSetOneProfessionGroups.map(renderProfessionGroup)
          : []),
      ];
    });
  })();
  if (!customWeaponPalette) {
    weaponGroupsHtml.push(
      ...activeWeaponProfessionGroups
        .filter((group) => !positionedActiveWeaponGroups.has(group.id))
        .map(renderProfessionGroup),
    );
  }
  const activeWeaponPrimaryHtml = customWeaponPalette
    ? activeWeaponProfessionGroups.map(renderProfessionGroup).join("")
    : "";
  const timelineControlsHtml = `<div class="pal-group"><div class="pal-label" style="color:#d66d2f">Cmb</div>
            <div class="pal-row">${virtualPaletteSkillHtml({
              name: "__combat_start",
              title: "Combat Start",
              icon: COMBAT_START_ICON,
              disabled: app.build.rotation.some(
                (item) => rotationEntryName(item) === "__combat_start",
              ),
            })}</div>
        </div>
        <div class="pal-group"><div class="pal-label" style="color:#7e9ac7">Rst</div>
            <div class="pal-row">${virtualPaletteSkillHtml({
              name: "__cooldown_reset",
              title: "Cooldown Reset",
              icon: COOLDOWN_RESET_ICON,
            })}</div>
        </div>
        <div class="pal-group"><div class="pal-label" style="color:#8d7a57">W8</div>
            <div class="pal-row">${virtualPaletteSkillHtml({
              name: "__wait",
              title: "Wait",
              icon: WAIT_ICON,
            })}</div>
        </div>`;
  const timelineToolsHtml = `<div class="timeline-tools-palette-stack"
        data-role="timeline-tools-palette-stack">
          <div class="pal-break"></div>
          ${timelineControlsHtml}
      </div>`;
  const actionGroupHtml = addGroup(
    app,
    "Act",
    weaponSwapEmbedded ? generalActions : actions,
    "#70b6d0",
    professionSkillAvailable,
    professionSkillUnavailableMessage,
    "action-palette-group",
  );
  const primaryPaletteHtml = customWeaponPalette
    ? `<div class="${esc(customWeaponPalette.primaryClassName || "profession-weapon-primary")}" data-role="${esc(customWeaponPalette.primaryRole || "profession-weapon-primary")}">
          ${professionPaletteSectionHtml}
          ${customWeaponPalette.activeWeaponHtml || ""}
          ${activeWeaponPrimaryHtml}
          ${customWeaponPalette.placeUtilityInPrimary ? utilityGroupHtml : ""}
          ${customWeaponPalette.placeActionsInPrimary ? actionGroupHtml : ""}
        </div>${customWeaponPalette.placeUtilityInPrimary ? "" : utilityGroupHtml}`
    : professionPaletteSectionHtml + utilityGroupHtml;
  element.innerHTML =
    primaryPaletteHtml +
    weaponPaletteSectionHtml(
      weaponGroupsHtml,
      customWeaponPalette?.placeActionsInPrimary ? "" : actionGroupHtml,
    ) +
    loadoutUtilityGroup +
    // Timeline-only controls stay in a named region so responsive layouts can
    // move the row as one unit.
    timelineToolsHtml;

  bindPaletteInteractions(element, {
    onControlActivate(controlId) {
      if (app.profession.ui.updatePaletteControl(paletteContext, controlId)) {
        app.changed();
      }
    },
    onActivate(name, event) {
      const icon = event.currentTarget;
      const parsedSkillId = Number(icon.dataset.skillId);
      const skillId =
        icon.dataset.skillId != null && Number.isFinite(parsedSkillId)
          ? parsedSkillId
          : null;
      const identity = skillId == null ? {} : { skillId };
      const professionAction = resolveProfessionPaletteAction(
        app,
        name,
        skillId,
      );
      // `undefined` means the profession does not own the action. `null` means
      // it handled the activation intentionally without inserting an item.
      if (professionAction !== undefined) {
        if (professionAction !== null) {
          insertRotationItems(
            app,
            Array.isArray(professionAction)
              ? professionAction
              : [professionAction],
          );
        }
        return;
      }
      if (name === "__combat_start" && icon.classList.contains("pal-disabled"))
        return;
      if (name === "__wait") {
        openDurationEditor({
          anchor: icon,
          heading: "Add wait",
          name: "Wait",
          icon: WAIT_ICON,
          label: "Duration",
          value: 1000,
          onApply(waitMs) {
            app.addRotation(name, { waitMs });
          },
        });
        return;
      }
      const skill =
        skillId == null
          ? app.skillByName.get(name)
          : app.skillById.get(skillId);
      if (skill?.dragonSlash) {
        const insertionIndex =
          normalizeRotationInsertionIndex(
            app.rotationInsertionIndex,
            app.build.rotation.length,
          ) ?? app.build.rotation.length;
        openDragonSlashReleaseEditor({
          app,
          anchor: icon,
          skill,
          insertionIndex,
          onApply(releaseAtCharges) {
            app.addRotation(name, {
              ...identity,
              ...(releaseAtCharges == null ? {} : { releaseAtCharges }),
            });
          },
        });
        return;
      }
      if (hasConfigurableDoubleEdgeOutcome(skill)) {
        openDoubleEdgeEditor({
          anchor: icon,
          skillName: String(skill.displayName || skill.name),
          icon: skill.icon || undefined,
          outcome: "success",
          onApply(outcome) {
            app.addRotation(name, {
              ...identity,
              doubleEdgeOutcome: outcome,
            });
          },
        });
        return;
      }
      const instant = paletteSkillIsInstant(app, paletteContext, skill, name);
      if (
        event.shiftKey &&
        instant &&
        skill?.canCastConcurrently !== false &&
        app.build.rotation.length
      ) {
        app.addRotation(name, {
          ...identity,
          offset: CONCURRENT_OFFSET_MS,
        });
      } else if (event.ctrlKey && !instant) {
        const suggestedInterruptMs = suggestedPaletteInterruptMs(skill);
        openActivationEditor({
          anchor: icon,
          skillName: String(skill?.displayName || skill?.name || name),
          icon:
            skill?.icon ||
            icon.querySelector("img")?.getAttribute("src") ||
            undefined,
          interruptMs: suggestedInterruptMs,
          fullCastMs: Number(skill?.castTimeMs) || null,
          suggestedInterruptMs,
          onApply(interruptMs) {
            app.addRotation(name, {
              ...identity,
              ...(interruptMs == null ? {} : { interruptMs }),
            });
          },
        });
      } else {
        app.addRotation(name, identity);
      }
    },
    onDragStart(name, event) {
      const parsedSkillId = Number(event.currentTarget.dataset.skillId);
      app.dragState = {
        source: "palette",
        name,
        ...(event.currentTarget.dataset.skillId != null &&
        Number.isFinite(parsedSkillId)
          ? { skillId: parsedSkillId }
          : {}),
      };
    },
    onDragEnd() {
      app.dragState = null;
      clearTimelineDropIndicators(document.getElementById("rotation-timeline"));
    },
  });
}
