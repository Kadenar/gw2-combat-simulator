/**
 * Renders and binds the rotation builder's skill palette.
 *
 * Palette models supply profession, loadout, weapon, utility, and virtual
 * actions. This module combines them with the latest simulation state to
 * resolve cooldowns, ammo, flips, ambushes, autoattack chains, and profession
 * availability, then delegates generic skill markup and pointer handling to
 * `platform/ui/palette`.
 *
 * The palette is rebuilt after application changes; event handlers therefore
 * read current build and result state instead of retaining DOM-local state.
 */
import { ammoDisplayView } from "../../platform/ui/ammo-display.js";
import {
  bindPaletteInteractions,
  paletteGroupHtml,
  paletteSkillHtml,
  paletteView,
  virtualPaletteSkillHtml,
} from "../../platform/ui/palette.js";
import {
  clearTimelineDropIndicators,
  rotationEntryName,
} from "../../platform/ui/timeline.js";
import { escapeHtml as esc, gw2ApiText } from "../../platform/ui/html.js";
import { createRotationItem } from "./actions.js";
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
  REFRESH_ARROW_ICON,
  WAIT_ICON,
} from "./icons.js";
import {
  VINDICATOR_DODGE_AUTO_ACTION,
  appendVindicatorDodgeAuto,
  autoattackChainSkillAvailable,
  currentAutoattackSkill,
  paletteActionSkills,
  paletteSkillIsInstant,
  rotationLoadoutPaletteGroups,
  rotationPaletteGroups,
  rotationSelectedSlotSkills,
  rotationUtilityFlipByParent,
  uniqueByName,
  vindicatorDodgeAutoPaletteSkill,
  vindicatorDodgeAutoRotationEntries,
  weaponPaletteRows,
  weaponPaletteSectionHtml,
  weaponPaletteStackHtml,
  weaponSkills,
} from "./palette-model.js";
import { weaverWeaponPaletteLayout } from "../profession/weapon-attunement-groups.js";
import {
  activeResourceGroup,
  paletteSkillResourceView,
} from "./resource-view.js";
import type {
  LegacyRotationItem,
  PaletteSkillAvailability,
  ProfessionPaletteGroup,
  SchedulerRecord,
  Skill,
} from "../../platform/engine/types.js";
import type { PaletteSkillView } from "../../platform/ui/types.js";
import type { ProfessionAppState } from "../profession/types.js";

const CONCURRENT_OFFSET_MS = 100;

type RenderedPaletteGroup = ProfessionPaletteGroup & { skills: Skill[] };

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

export function parseWaitDurationMs(raw: string | null): number | null {
  if (raw == null) return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 1 ? Math.round(value) : null;
}

function promptWaitDurationMs(): number | null {
  return parseWaitDurationMs(prompt("Wait duration (ms):", "1000"));
}

/**
 * Converts a dragged palette identity into one or more rotation entries.
 * Returns `null` for cancelled waits, empty names, and duplicate combat-start
 * markers. Composite actions may return multiple entries.
 */
export function resolvePaletteDropItem(
  app: ProfessionAppState,
  name: string,
  skillId: number | null = null,
): LegacyRotationItem | LegacyRotationItem[] | null {
  if (!name) return null;
  if (name === VINDICATOR_DODGE_AUTO_ACTION) {
    return vindicatorDodgeAutoRotationEntries(app);
  }
  if (
    name === "__combat_start" &&
    app.build.rotation.some(
      (entry) => rotationEntryName(entry) === "__combat_start",
    )
  ) {
    return null;
  }
  if (name === "__wait") {
    const waitMs = promptWaitDurationMs();
    return waitMs == null ? null : createRotationItem(app, name, { waitMs });
  }
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

function addGroup(
  app: ProfessionAppState,
  label: string,
  skills: readonly Skill[],
  color = "#a88be8",
  isAvailable: (skill: Skill) => boolean = () => true,
  unavailableMessage: (skill: Skill) => string = () => "",
  className = "",
  statusIcon?: ProfessionPaletteGroup["statusIcon"],
): string {
  if (!skills.length && !statusIcon) return "";
  return paletteGroupHtml({
    label,
    color,
    className,
    statusIcon,
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
 * `contextAvailable` represents profession or loadout rules; cooldown and ammo
 * state are derived here so disabled styling and tooltips share one decision.
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
  const highlighted = Boolean(skill.ambush) && !unavailable;
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

type WeaponPaletteAvailability = (skill: Skill) => boolean;
type WeaponPaletteUnavailableMessage = (skill: Skill) => string;

interface WeaverWeaponPaletteHtml {
  readonly currentBar: string;
  readonly slotPreview: string;
}

function weaverAttunementBadge(attunement: unknown): string {
  return String(attunement || "")
    .split("+")
    .filter(Boolean)
    .map((element) => element[0])
    .join("/");
}

function weaverSkillCellHtml(
  app: ProfessionAppState,
  skill: Skill,
  isAvailable: WeaponPaletteAvailability,
  unavailableMessage: WeaponPaletteUnavailableMessage,
  options: {
    readonly badge?: boolean;
    readonly equipped?: boolean;
    readonly staticCooldown?: boolean;
  } = {},
): string {
  const available = isAvailable(skill);
  const projectedSkill = options.badge
    ? { ...skill, variantBadge: weaverAttunementBadge(skill.attunement) }
    : skill;
  const skillView = paletteSkillView(
    app,
    projectedSkill,
    options.staticCooldown ? true : available,
    options.staticCooldown ? "" : unavailableMessage(skill),
  );
  const staticTitle = options.staticCooldown
    ? ` title="${esc(skillView.title || skill.name)}"`
    : "";
  const equipped =
    !options.staticCooldown && (options.equipped || available)
      ? " is-equipped"
      : "";
  return `<div class="weaver-skill-cell${equipped}${options.staticCooldown ? " is-static" : ""}"
      data-attunement="${esc(String(skill.attunement || "Special"))}"
      ${options.staticCooldown ? 'data-palette-static="true"' : ""}${staticTitle}>
      ${paletteSkillHtml({
        ...skillView,
        ...(options.staticCooldown
          ? { draggable: false, hotkeyAction: "" }
          : {}),
      })}
    </div>`;
}

function weaverElementRowsHtml(
  app: ProfessionAppState,
  rows: readonly {
    readonly attunement: string;
    readonly skills: readonly Skill[];
  }[],
  selectedAttunement: string,
  autoattackChains: SchedulerRecord,
  isAvailable: WeaponPaletteAvailability,
  unavailableMessage: WeaponPaletteUnavailableMessage,
): string {
  return rows
    .map((row) => {
      const visibleSkills = row.skills.filter((skill) =>
        autoattackChainSkillAvailable(skill, autoattackChains),
      );
      if (!visibleSkills.length) return "";
      return `<div class="weaver-attunement-row${row.attunement === selectedAttunement ? " is-selected" : ""}"
          data-attunement="${esc(row.attunement)}">
          <span class="weaver-attunement-label">${esc(row.attunement)}</span>
          <div class="weaver-attunement-skills">${visibleSkills
            .map((skill) =>
              weaverSkillCellHtml(app, skill, isAvailable, unavailableMessage, {
                staticCooldown: true,
              }),
            )
            .join("")}</div>
        </div>`;
    })
    .join("");
}

function weaverWeaponPaletteHtml(
  app: ProfessionAppState,
  skills: readonly Skill[],
  primaryAttunement: string,
  secondaryAttunement: string,
  autoattackChains: SchedulerRecord,
  isAvailable: WeaponPaletteAvailability,
  unavailableMessage: WeaponPaletteUnavailableMessage,
): WeaverWeaponPaletteHtml {
  if (!skills.length) return { currentBar: "", slotPreview: "" };
  const layout = weaverWeaponPaletteLayout(skills);
  const active = (candidates: readonly Skill[]): Skill[] =>
    candidates.filter(isAvailable);
  const primarySkills = (
    layout.primaryRows.find((row) => row.attunement === primaryAttunement)
      ?.skills || []
  ).filter((skill) => Boolean(skill.chainRoot) || isAvailable(skill));
  const slotThreeSkills = active([
    ...layout.sameAttunementSkills,
    ...layout.dualSkills,
  ]);
  const secondarySkills = active(
    layout.secondaryRows.flatMap((row) => row.skills),
  );
  const currentCluster = (
    candidates: readonly Skill[],
    slots: string,
    badge = false,
  ): string => `<div class="weaver-current-cluster" data-slots="${slots}">
      ${candidates
        .map((skill) =>
          weaverSkillCellHtml(app, skill, isAvailable, unavailableMessage, {
            badge,
            equipped: true,
          }),
        )
        .join("")}
    </div>`;
  const slotThreeBank = (
    candidates: readonly Skill[],
    variant: "same" | "dual",
  ): string => `<div class="weaver-slot-three-row" data-weaver-variant="${variant}">
      <span class="weaver-slot-three-label">${variant === "same" ? "Same" : "Mixed"}</span>
      <div class="weaver-slot-three-skills">${candidates
        .map((skill) =>
          weaverSkillCellHtml(app, skill, isAvailable, unavailableMessage, {
            badge: true,
            staticCooldown: true,
          }),
        )
        .join("")}</div>
    </div>`;
  const extraSkills = layout.extraSkills.filter((skill) =>
    autoattackChainSkillAvailable(skill, autoattackChains),
  );
  const extrasHtml = extraSkills.length
    ? `<div class="weaver-extra-bank" data-role="weaver-extra-bank">
        <span class="weaver-bank-title">Other weapon skills</span>
        <div class="weaver-attunement-skills">${extraSkills
          .map((skill) =>
            weaverSkillCellHtml(app, skill, isAvailable, unavailableMessage),
          )
          .join("")}</div>
      </div>`
    : "";

  return {
    currentBar: `<div class="weaver-current-bar" data-role="weaver-current-bar"
        aria-label="Current Weaver weapon bar: ${esc(primaryAttunement)} and ${esc(secondaryAttunement)}">
        <div class="weaver-current-caption">
          <span>Current</span>
          <strong>${esc(`${primaryAttunement[0]}/${secondaryAttunement[0]}`)}</strong>
        </div>
        <div class="weaver-current-composition">
          ${currentCluster(primarySkills, "1-2")}
          <span class="weaver-current-divider" aria-hidden="true"></span>
          ${currentCluster(slotThreeSkills, "3", true)}
          <span class="weaver-current-divider" aria-hidden="true"></span>
          ${currentCluster(secondarySkills, "4-5")}
        </div>
      </div>`,
    slotPreview: `<div class="weaver-weapon-palette" data-role="weaver-weapon-palette">
        <div class="weaver-cooldown-bank" data-role="weaver-cooldown-bank">
        <section class="weaver-cooldown-lane" data-role="weaver-primary-bank">
          <div class="weaver-bank-title">Slots 1-2 <span>Primary</span></div>
          ${weaverElementRowsHtml(
            app,
            layout.primaryRows,
            primaryAttunement,
            autoattackChains,
            isAvailable,
            unavailableMessage,
          )}
        </section>
        <section class="weaver-cooldown-lane weaver-slot-three-bank"
            data-role="weaver-slot-three-bank">
          <div class="weaver-bank-title">Slot 3 <span>Same / dual</span></div>
          ${slotThreeBank(layout.sameAttunementSkills, "same")}
          ${slotThreeBank(layout.dualSkills, "dual")}
        </section>
        <section class="weaver-cooldown-lane" data-role="weaver-secondary-bank">
          <div class="weaver-bank-title">Slots 4-5 <span>Secondary</span></div>
          ${weaverElementRowsHtml(
            app,
            layout.secondaryRows,
            secondaryAttunement,
            autoattackChains,
            isAvailable,
            unavailableMessage,
          )}
        </section>
      </div>
      ${extrasHtml}
    </div>`,
  };
}

/**
 * Replaces the rotation palette markup and binds activation and drag behavior.
 *
 * Groups are ordered as profession mechanics/resources, selected slot skills,
 * fixed loadouts, weapons/actions, and timeline-only controls. Skill
 * activation supports Shift-click concurrent instants and Ctrl-click cast
 * interrupts before delegating the mutation to the application.
 */
export function renderPalette(app: ProfessionAppState): void {
  const element = document.getElementById("rotation-palette");
  if (!element) return;
  const isRevenant = app.profession.id === "revenant";
  const isEngineer = app.profession.id === "engineer";
  const spec = activeSpecialization(app);
  const endState = paletteEndState(app);
  const professionState = paletteProfessionState(app);
  const paletteContext = {
    specialization: spec,
    catalog: app.profession.catalog,
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
  const mechanics =
    renderedProfessionGroups.find((group) => group.id === "profession")
      ?.skills || [];
  if (spec === "Chronomancer") {
    const shift = app.skillByName.get("Continuum Shift");
    const splitIndex = mechanics.findIndex(
      (skill) => skill.name === "Continuum Split",
    );
    if (shift) mechanics.splice(splitIndex + 1, 0, shift);
  }
  const selected = rotationSelectedSlotSkills(app);
  // Follow complete utility flip chains so three-stage skills such as
  // Firebrand mantras can expose both their ordinary and final charges.
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
  const actions = paletteActionSkills(app, spec).filter(
    (skill) => !groupedActionSkillIds.has(String(skill.id)),
  );
  const dodgeAuto = vindicatorDodgeAutoPaletteSkill(app, spec);
  if (dodgeAuto) {
    const dodgeIndex = actions.findIndex((skill) => skill.name === "Dodge");
    actions.splice(dodgeIndex < 0 ? 0 : dodgeIndex + 1, 0, dodgeAuto);
  }
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
  // A charged mantra replaces its selected parent. Spending the final charge
  // removes every armed flip and brings the preparation skill back.
  const armedFlipFor = (skill: Skill): Skill | null => {
    return activeFlipDescendantFor(skill);
  };
  const selectedWithFlips = selectedWithFlipChains.filter((skill) =>
    usesStatefulFlip(skill)
      ? flipAvailable(skill)
      : !activeFlipDescendantFor(skill),
  );
  const utilitySkillAvailable = (skill: Skill): boolean => {
    if (!professionAllowsPaletteSkill(skill)) return false;
    if (usesStatefulFlip(skill)) return flipAvailable(skill);
    return !armedFlipFor(skill);
  };
  const utilitySkillUnavailableMessage = (skill: Skill): string => {
    if (!professionAllowsPaletteSkill(skill)) {
      return professionPaletteUnavailableMessage(skill);
    }
    if (usesStatefulFlip(skill) && !flipAvailable(skill)) {
      return `Unavailable until ${flipParentName(skill)} has been used`;
    }
    const flip = armedFlipFor(skill);
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
  const resourceGroupsHtml = activeResourceGroup(app, {
    excludeIds: attachedResourceIds,
  });
  let resourceAnchorRendered = false;
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
  const weaponSetOneProfessionGroups = renderedProfessionGroups.filter(
    (group) => group.placement === "weapon-set-1",
  );
  const standardProfessionGroups = renderedProfessionGroups.filter(
    (group) => group.placement !== "weapon-set-1",
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
  let weaponSwapEmbedded = false;
  let weaverCurrentBarHtml = "";
  const weaponGroupsHtml = (() => {
    if (spec === "Weaver") {
      const primaryAttunement = String(
        professionState.primaryAttunement ||
          app.build.startAttunement ||
          "Fire",
      );
      const secondaryAttunement = String(
        professionState.secondaryAttunement ||
          app.build.secondaryAttunement ||
          primaryAttunement,
      );
      const weaverPalette = weaverWeaponPaletteHtml(
        app,
        weaponSkills(app, 1),
        primaryAttunement,
        secondaryAttunement,
        autoattackChains,
        (skill) => weaponSkillAvailable(skill, 1),
        (skill) => weaponSkillUnavailableMessage(skill, 1),
      );
      weaverCurrentBarHtml = weaverPalette.currentBar;
      return [
        weaverPalette.slotPreview,
        ...weaponSetOneProfessionGroups.map(renderProfessionGroup),
      ].filter(Boolean);
    }

    const weaponRows = weaponPaletteRows(app, activeWeaponSet);
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
      return row.weaponSet === 1 && weaponRows[index + 1]?.weaponSet !== 1
        ? [
            renderedRow,
            ...weaponSetOneProfessionGroups.map(renderProfessionGroup),
          ]
        : [renderedRow];
    });
  })();
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
    isRevenant || isEngineer ? "action-palette-group" : "",
  );
  const primaryPaletteHtml =
    spec === "Weaver"
      ? `<div class="weaver-top-palette" data-role="weaver-top-palette">
          ${professionPaletteSectionHtml}
          ${weaverCurrentBarHtml}
          ${utilityGroupHtml}
          ${actionGroupHtml}
        </div>`
      : professionPaletteSectionHtml + utilityGroupHtml;
  element.innerHTML =
    primaryPaletteHtml +
    weaponPaletteSectionHtml(
      weaponGroupsHtml,
      spec === "Weaver" ? "" : actionGroupHtml,
    ) +
    loadoutUtilityGroup +
    // Timeline-only controls stay in a named region so responsive layouts can
    // move the row as one unit.
    timelineToolsHtml;

  bindPaletteInteractions(element, {
    onActivate(name, event) {
      const icon = event.currentTarget;
      if (name === VINDICATOR_DODGE_AUTO_ACTION) {
        appendVindicatorDodgeAuto(app);
        return;
      }
      const parsedSkillId = Number(icon.dataset.skillId);
      const skillId =
        icon.dataset.skillId != null && Number.isFinite(parsedSkillId)
          ? parsedSkillId
          : null;
      const identity = skillId == null ? {} : { skillId };
      if (name === "__combat_start" && icon.classList.contains("pal-disabled"))
        return;
      if (name === "__wait") {
        const waitMs = promptWaitDurationMs();
        if (waitMs == null) return;
        app.addRotation(name, { waitMs });
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
        const raw = prompt(
          `Interrupt ${name} after how many ms?`,
          String(suggestedPaletteInterruptMs(skill)),
        );
        if (raw == null || Number(raw) < 1) return;
        app.addRotation(name, {
          ...identity,
          interruptMs: Math.round(Number(raw)),
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
