import { ammoDisplayView } from "../../platform/ui/ammo-display.js";
import {
  bindPaletteInteractions,
  paletteGroupHtml,
  paletteView,
  virtualPaletteSkillHtml,
} from "../../platform/ui/palette.js";
import { clearTimelineDropIndicators } from "../../platform/ui/timeline.js";
import { escapeHtml as esc, gw2ApiText } from "../../platform/ui/html.js";
import {
  activeSpecialization,
  professionEndState,
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
} from "./palette-model.js";
import { activeResourceGroup } from "./resource-view.js";

const CONCURRENT_OFFSET_MS = 100;

function rotationItem(app, name, options = {}) {
  const skillId = options.skillId == null ? null : Number(options.skillId);
  const skill = Number.isFinite(skillId)
    ? app.skillById.get(skillId)
    : app.skillByName.get(name);
  const defaultInterruptMs = skill?.defaultInterruptMs;
  const resolvedOptions =
    defaultInterruptMs != null && options.interruptMs == null
      ? { interruptMs: defaultInterruptMs, ...options }
      : options;
  return Object.keys(resolvedOptions).length
    ? { name, ...resolvedOptions }
    : name;
}

export function resolvePaletteDropItem(app, name, skillId = null) {
  if (!name) return null;
  if (name === VINDICATOR_DODGE_AUTO_ACTION) {
    return vindicatorDodgeAutoRotationEntries(app);
  }
  if (
    name === "__combat_start" &&
    app.build.rotation.some(
      (entry) => (entry.name || entry) === "__combat_start",
    )
  ) {
    return null;
  }
  if (name === "__wait") {
    const raw = prompt("Wait duration (ms):", "1000");
    if (raw == null || Number(raw) < 1) return null;
    return rotationItem(app, name, { waitMs: Math.round(Number(raw)) });
  }
  return rotationItem(app, name, skillId == null ? {} : { skillId });
}

function currentCooldown(app, name) {
  return (
    app.results?.endState?.cooldowns?.[name] || { remaining: 0, readyAt: 0 }
  );
}

function currentAmmo(app, name) {
  const ammo = app.results?.endState?.ammo?.[name];
  if (!ammo) return null;
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
      ? Math.max(0, nextChargeAt - Number(app.results?.endState?.time || 0))
      : 0,
  };
}

function addGroup(
  app,
  label,
  skills,
  color = "#a88be8",
  isAvailable = () => true,
  unavailableMessage = () => "",
  className = "",
) {
  if (!skills.length) return "";
  return paletteGroupHtml({
    label,
    color,
    className,
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

export function paletteSkillView(
  app,
  skill,
  contextAvailable = true,
  contextMessage = "",
) {
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
              ? ` · next charge in ${seconds(ammo.remaining)}`
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
    icon: skill.icon || ACTION_ICONS[skill.name] || PLACEHOLDER_ICON,
    title,
    color: unavailable ? "#625a73" : highlighted ? "#f0c766" : "#a88be8",
    disabled: unavailable,
    contextDisabled: !contextAvailable,
    concealed: Boolean(skill.concealed),
    highlighted,
    draggable: contextAvailable,
    cooldownLabel: cd.remaining ? seconds(cd.remaining) : "",
    ammo: ammoDisplay,
  };
}

export function renderPalette(app) {
  const element = document.getElementById("rotation-palette");
  const spec = activeSpecialization(app);
  const paletteContext = {
    specialization: spec,
    catalog: app.profession.catalog,
    professionState: professionEndState(app.results),
    cooldowns: app.results?.endState?.cooldowns || {},
    activeWeaponSet:
      app.results?.endState?.activeWeaponSet ||
      app.build.startingWeaponSet ||
      1,
    time: Number(app.results?.endState?.time || 0) / 1000,
    build: app.build,
  };
  const professionGroups = rotationPaletteGroups(app, paletteContext);
  const loadoutGroups = rotationLoadoutPaletteGroups(app, paletteContext);
  const renderGroups = (groups) =>
    groups.map((group) => {
      const skillIds = group.skillIds || [];
      const reservedSkillIds = group.reservedSkillIds || [];
      return {
        ...group,
        skills: [
          ...(reservedSkillIds.length ? reservedSkillIds : skillIds)
            .map((id) => app.skillById.get(id))
            .filter(
              (skill) =>
                skill && (group.includeActionSkills || skill.type !== "Action"),
            )
            .map((skill) => ({
              ...skill,
              concealed:
                reservedSkillIds.length > 0 && !skillIds.includes(skill.id),
            })),
          ...(group.skillEntries || []).flatMap((entry) => {
            const skill = app.skillById.get(Number(entry.skillId));
            return skill &&
              (group.includeActionSkills || skill.type !== "Action")
              ? [{ ...skill, ...entry, name: skill.name }]
              : [];
          }),
        ],
      };
    });
  const renderedProfessionGroups = renderGroups(professionGroups);
  const renderedLoadoutGroups = renderGroups(loadoutGroups);
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
  // Non-weapon flips (Mantra of Pain → Power Spike) ride alongside their
  // selected parent so the palette can offer the flip while it is armed.
  const utilityFlipByParent = rotationUtilityFlipByParent(app);
  const selectedWithFlips = uniqueByName(selected).flatMap((skill) => {
    const flip = utilityFlipByParent.get(skill.name);
    return flip ? [skill, flip] : [skill];
  });
  const actions = paletteActionSkills(app, spec);
  const dodgeAuto = vindicatorDodgeAutoPaletteSkill(app, spec);
  if (dodgeAuto) {
    const dodgeIndex = actions.findIndex((skill) => skill.name === "Dodge");
    actions.splice(dodgeIndex < 0 ? 0 : dodgeIndex + 1, 0, dodgeAuto);
  }
  const activeWeaponSet = app.results?.endState?.activeWeaponSet || 1;
  const professionState = professionEndState(app.results);
  const availableFlips = professionState.availableFlips || {};
  const availableAmbush = professionState.availableAmbush || null;
  const autoattackChains = professionState.autoattackChains || {};
  const loadoutUnavailableMessage = (skill) =>
    app.adapter.slotLoadout?.unavailableReason(skill, paletteContext) || "";
  const paletteAvailabilityBySkill = new Map();
  const professionPaletteAvailability = (skill) => {
    if (!paletteAvailabilityBySkill.has(skill)) {
      paletteAvailabilityBySkill.set(
        skill,
        app.profession.ui.paletteSkillAvailability(paletteContext, skill),
      );
    }
    return paletteAvailabilityBySkill.get(skill);
  };
  const professionAllowsPaletteSkill = (skill) =>
    !loadoutUnavailableMessage(skill) &&
    professionPaletteAvailability(skill).available;
  const professionPaletteUnavailableMessage = (skill) =>
    loadoutUnavailableMessage(skill) ||
    professionPaletteAvailability(skill).message;
  const flipAvailable = (skill) =>
    Boolean(availableFlips[skill.id] ?? availableFlips[skill.name]);
  const flipParentName = (skill) =>
    skill.flipParent ||
    app.skillById.get(Number(skill.flipParentId))?.name ||
    "its parent skill";
  const usesStatefulFlip = (skill) =>
    skill.paletteFlip !== false &&
    (skill.flipParent || skill.flipParentId != null);
  const chainExpected = (skill) => {
    const root = skill.chainRoot;
    return autoattackChains[root] || root;
  };
  const weaponSkillAvailable = (skill, weaponSet) => {
    if (weaponSet !== activeWeaponSet) return false;
    if (!professionAllowsPaletteSkill(skill)) return false;
    if (skill.ambush) return availableAmbush?.name === skill.name;
    if (availableAmbush && skill.slot === "Weapon_1") return false;
    if (usesStatefulFlip(skill) && !flipAvailable(skill)) return false;
    return autoattackChainSkillAvailable(skill, autoattackChains);
  };
  const weaponSkillUnavailableMessage = (skill, weaponSet) => {
    if (weaponSet !== activeWeaponSet) {
      return `Swap to weapon set ${weaponSet} to use this skill`;
    }
    if (!professionAllowsPaletteSkill(skill)) {
      return professionPaletteUnavailableMessage(skill);
    }
    if (skill.ambush) {
      return availableAmbush
        ? `Current ambush is ${availableAmbush.name}`
        : "Gain Mirage Cloak to use this ambush";
    }
    if (availableAmbush && skill.slot === "Weapon_1") {
      return `${availableAmbush.name} currently replaces weapon skill 1`;
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
  // A charged mantra shows its flip (Power Spike); the parent (Mantra of Pain)
  // stays locked until every charge is spent and the flip reverts.
  const armedFlipFor = (skill) => {
    const flip = utilityFlipByParent.get(skill.name);
    return flip && availableFlips[flip.name] ? flip : null;
  };
  const utilitySkillAvailable = (skill) => {
    if (!professionAllowsPaletteSkill(skill)) return false;
    if (usesStatefulFlip(skill)) return flipAvailable(skill);
    return !armedFlipFor(skill);
  };
  const utilitySkillUnavailableMessage = (skill) => {
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

  const professionSkillAvailable = (skill) => {
    if (!professionAllowsPaletteSkill(skill)) return false;
    if (usesStatefulFlip(skill) && !flipAvailable(skill)) {
      return false;
    }
    return true;
  };
  const professionSkillUnavailableMessage = (skill) => {
    if (!professionAllowsPaletteSkill(skill)) {
      return professionPaletteUnavailableMessage(skill);
    }
    if (usesStatefulFlip(skill) && !flipAvailable(skill)) {
      return `Unavailable until ${flipParentName(skill)} has been used`;
    }
    return "";
  };
  const loadoutStack = renderedLoadoutGroups.length
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
                ),
              )
              .join("")}</div>`
    : "";
  const loadoutAfterActions =
    app.adapter.slotLoadout?.palettePlacement === "after-actions";
  const loadoutBeforeWeapons = loadoutAfterActions ? "" : loadoutStack;
  const loadoutBesideActions = loadoutAfterActions ? loadoutStack : "";
  const resourceGroupsHtml = activeResourceGroup(app);
  let resourceAnchorRendered = false;
  const stackWithResources = (groupHtml, anchored) => {
    if (!anchored || !resourceGroupsHtml) return groupHtml;
    resourceAnchorRendered = true;
    return `<div class="profession-resource-stack"
            data-role="profession-resource-stack">
                ${groupHtml}
                ${resourceGroupsHtml}
            </div>`;
  };
  const renderedStackIds = new Set();
  const professionGroupsHtml = renderedProfessionGroups
    .map((group) => {
      const renderGroup = (candidate) =>
        addGroup(
          app,
          candidate.label,
          candidate.skills,
          candidate.color || "#c49cff",
          professionSkillAvailable,
          professionSkillUnavailableMessage,
          candidate.className,
        );
      if (!group.stackId) {
        return stackWithResources(renderGroup(group), group.resourceAnchor);
      }
      if (renderedStackIds.has(group.stackId)) return "";
      renderedStackIds.add(group.stackId);
      const stackedGroups = renderedProfessionGroups.filter(
        (candidate) => candidate.stackId === group.stackId,
      );
      const stackHtml = `<div class="profession-palette-stack"
            data-palette-stack="${esc(group.stackId)}">${stackedGroups
              .map(renderGroup)
              .join("")}</div>`;
      return stackWithResources(
        stackHtml,
        stackedGroups.some((candidate) => candidate.resourceAnchor),
      );
    })
    .join("");
  const unanchoredResourceGroupsHtml = resourceAnchorRendered
    ? ""
    : resourceGroupsHtml;
  element.innerHTML =
    professionGroupsHtml +
    unanchoredResourceGroupsHtml +
    loadoutBeforeWeapons +
    weaponPaletteSectionHtml(
      weaponPaletteRows(app, activeWeaponSet).map((row) =>
        addGroup(
          app,
          row.label,
          row.skills,
          row.active ? "#a98fd8" : "#625a73",
          (skill) => weaponSkillAvailable(skill, row.weaponSet),
          (skill) => weaponSkillUnavailableMessage(skill, row.weaponSet),
        ),
      ),
      addGroup(
        app,
        "Act",
        actions,
        "#70b6d0",
        professionSkillAvailable,
        professionSkillUnavailableMessage,
      ),
      loadoutBesideActions,
    ) +
    addGroup(
      app,
      "Skill",
      selectedWithFlips,
      "#cbb8ea",
      utilitySkillAvailable,
      utilitySkillUnavailableMessage,
    ) +
    // Timeline-only controls stay on their own row.
    '<div class="pal-break"></div>' +
    `<div class="pal-group"><div class="pal-label" style="color:#d66d2f">Cmb</div>
            <div class="pal-row">${virtualPaletteSkillHtml({
              name: "__combat_start",
              title: "Combat Start",
              icon: COMBAT_START_ICON,
              disabled: app.build.rotation.some(
                (item) => (item.name || item) === "__combat_start",
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
        const raw = prompt("Wait duration (ms):", "1000");
        if (raw == null || Number(raw) < 1) return;
        app.addRotation(name, { waitMs: Math.round(Number(raw)) });
        return;
      }
      const skill =
        skillId == null
          ? app.skillByName.get(name)
          : app.skillById.get(skillId);
      const instant = paletteSkillIsInstant(app, paletteContext, skill, name);
      if (event.shiftKey && instant && app.build.rotation.length) {
        app.addRotation(name, {
          ...identity,
          offset: CONCURRENT_OFFSET_MS,
        });
      } else if (event.ctrlKey && !instant) {
        const full = Math.round(Number(skill?.castTimeMs || 0));
        const raw = prompt(
          `Interrupt ${name} after how many ms?`,
          String(Math.max(1, full - 1)),
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
