import { PLACEHOLDER_ICON } from "./gw2-api.js";
import {
  clearTimelineDropIndicators,
  formatConcurrentTimelineBadge,
  formatInterruptTimelineBadge,
  formatTimelineCastDetails,
  formatTimelineDuration,
  getSkillDropInsertionIndex,
  timelineDeadTimeMarkers,
  updateRotationEntry,
  updateSkillDropIndicator,
} from "../../../platform/ui/timeline.js";
import {
  closeActivationEditor,
  openActivationEditor,
  suggestedActivationInterruptMs,
} from "../../../platform/ui/activation-editor.js";
import { escapeHtml as esc } from "../../../platform/ui/html.js";
import {
  mountRotationInsertionCursor,
  normalizeRotationInsertionIndex,
  rotationInsertionGapHtml,
  rotationTimelineEntryHtml,
} from "../../../platform/ui/insertion-cursor.js";

const DEFAULT_CONCURRENT_OFFSET_MS = 100;
const MIN_CONCURRENT_OFFSET_MS = 1;
const MIN_INTERRUPT_MS = 1;
const MIN_WAIT_MS = 1;

function promptInterruptMs(skill, currentValue = null) {
  const castMs = Math.round((skill?.castTime || 0) * 1000);
  const suggested = currentValue ?? Math.max(MIN_INTERRUPT_MS, castMs - 1);
  const raw = prompt(
    `Interrupt time for ${skill?.name || "skill"} (ms from cast start, blank to cancel/remove):`,
    suggested,
  );
  if (raw === null) return { cancelled: true };

  const trimmed = raw.trim();
  if (trimmed === "") return { cleared: true };

  const parsed = parseInt(trimmed, 10);
  if (Number.isNaN(parsed) || parsed < MIN_INTERRUPT_MS)
    return { invalid: true };
  return { value: parsed };
}

function editTimelineActivation(app, index, anchor) {
  const item = app.sim.rotation[index];
  if (item === undefined) return;
  const name = typeof item === "string" ? item : item.name;
  const skill = app.data.skills.find((candidate) => candidate.name === name);
  if (!skill) return;

  const step = app.sim.results?.steps?.find(
    (candidate) => candidate.ri === index && !candidate.invalid,
  );
  const catalogCastMs = Math.round(Number(skill.castTime || 0) * 1000);
  const fullCastMs = Math.round(Number(step?.fullCastMs) || catalogCastMs);
  const interruptMs = typeof item === "object" ? item.interruptMs : null;
  openActivationEditor({
    anchor,
    skillName: skill.name,
    icon: anchor.querySelector("img")?.getAttribute("src") || undefined,
    interruptMs,
    fullCastMs,
    suggestedInterruptMs: suggestedActivationInterruptMs(
      fullCastMs,
      catalogCastMs,
    ),
    onApply(nextInterruptMs) {
      const currentItem = app.sim.rotation[index];
      if (currentItem === undefined) return;
      app.sim.rotation[index] = updateRotationEntry(currentItem, {
        interruptMs: nextInterruptMs ?? undefined,
      });
      app._autoRun();
    },
  });
}

function promptWaitMs(currentValue = 1000) {
  const raw = prompt(
    "Wait duration (ms):",
    Math.max(MIN_WAIT_MS, currentValue),
  );
  if (raw === null) return { cancelled: true };
  const trimmed = raw.trim();
  if (trimmed === "") return { invalid: true };
  const parsed = parseInt(trimmed, 10);
  if (Number.isNaN(parsed) || parsed < MIN_WAIT_MS) return { invalid: true };
  return { value: parsed };
}

function resolvePaletteDropItem(app, skillName) {
  if (!skillName) return null;
  if (skillName === "__combat_start" && !app._isVirtualAvailable(skillName))
    return null;
  if (skillName === "__wait") {
    const wait = promptWaitMs();
    if (wait.cancelled || wait.invalid) return null;
    return { skillName, options: { waitMs: wait.value } };
  }
  return { skillName, options: {} };
}

function applyTimelineDrop(app, insertAt) {
  const drag = app.dragState;
  if (!drag) return false;

  if (drag.source === "timeline") {
    app.rotationInsertionIndex = null;
    app._moveRotationItem(drag.idx, insertAt);
    app.dragState = null;
    return true;
  }

  if (drag.source === "palette") {
    const payload = resolvePaletteDropItem(app, drag.skillName);
    app.dragState = null;
    if (!payload) return false;
    app.rotationInsertionIndex = null;
    app._insertIntoRotation(insertAt, payload.skillName, payload.options);
    return true;
  }

  return false;
}

function addPaletteRotationItem(app, skillName, options = {}) {
  const insertionIndex = normalizeRotationInsertionIndex(
    app.rotationInsertionIndex,
    app.sim?.rotation.length || 0,
  );
  if (insertionIndex === null) {
    app.rotationInsertionIndex = null;
    app._addToRotation(skillName, options);
    return;
  }

  app.rotationInsertionIndex = insertionIndex + 1;
  app._insertIntoRotation(insertionIndex, skillName, options);
}

function mountInsertionCursor(app, root) {
  app.rotationInsertionIndex = mountRotationInsertionCursor({
    root,
    insertionIndex: app.rotationInsertionIndex,
    rotationLength: app.sim?.rotation.length || 0,
    onSelect(index) {
      app.rotationInsertionIndex = index;
      app._renderTimeline();
    },
    onClear() {
      app.rotationInsertionIndex = null;
      app._renderTimeline();
    },
  });
}

export function renderRotationBuilder(app) {
  app._renderStartAttSelector();
  app._renderPalette();
  app._renderTimeline();
}

export function renderPalette(
  app,
  {
    ATTUNEMENTS,
    ATTUNEMENT_COLORS,
    CATALYST_ENERGY_MAX,
    SLOT_LABELS,
    TH_WEAPONS,
    CONJURE_MAP,
    DROP_BUNDLE_ICON,
    DODGE_ICON,
    COMBAT_START_ICON,
    WAIT_ICON,
    ETCHING_CHAINS_UI,
    PISTOL_BULLET_ICONS,
    PISTOL_BULLET_LABELS,
  },
) {
  const el = document.getElementById("rotation-palette");
  const skills = app.data.skills;
  const { weapons: weps } = app.data.attributes;
  const mh = weps[0] || "";
  const oh = weps[1] || "";
  const is2h = TH_WEAPONS.has(mh);
  const elite = app._getEliteSpec();
  const es = app.sim?.results?.endState;
  const wielding = es?.conjureEquipped || null;
  let h = "";

  h +=
    '<div class="pal-group"><div class="pal-label">Att</div><div class="pal-row">';
  for (const att of ATTUNEMENTS) {
    const sw = skills.find((s) => s.name === `${att} Attunement`);
    if (sw) h += app._palIcon(sw, app._isSkillAvailable(sw.name));
  }
  h += "</div></div>";

  const dodgeSkill = skills.find(
    (s) => s.type === "Dodge" || s.slot === "Dodge" || s.name === "Dodge",
  );
  if (dodgeSkill) {
    const endurance = Math.round(es?.endurance ?? 100);
    h += `<div class="pal-group"><div class="pal-label" style="color:#7fb6d8">Ddg</div><div class="pal-row" style="align-items:center">`;
    h += app._palIcon(dodgeSkill, app._isSkillAvailable(dodgeSkill.name));
    h += `<div class="endurance-readout" title="Current Endurance">${endurance}/100</div>`;
    h += "</div></div>";
  }

  h += `<div class="pal-group"><div class="pal-label" style="color:#d66d2f">Cmb</div><div class="pal-row">`;
  h += `<div class="pal-skill${app._isVirtualAvailable("__combat_start") ? "" : " pal-disabled"}" data-skill="__combat_start" title="Combat Start" style="--att-border:#d66d2f">
        <img src="${COMBAT_START_ICON}" /></div>`;
  h += "</div></div>";

  h += `<div class="pal-group"><div class="pal-label" style="color:#8d7a57">W8</div><div class="pal-row">`;
  h += `<div class="pal-skill" data-skill="__wait" title="Wait" style="--att-border:#8d7a57">
        <img src="${WAIT_ICON}" /></div>`;
  h += "</div></div>";

  if (elite === "Tempest") {
    h +=
      '<div class="pal-group"><div class="pal-label">OL</div><div class="pal-row">';
    for (const att of ATTUNEMENTS) {
      const ol = skills.find((s) => s.name === `Overload ${att}`);
      if (ol) h += app._palIcon(ol, app._isSkillAvailable(ol.name));
    }
    h += "</div></div>";
  }

  if (elite === "Catalyst") {
    const energy = es ? (es.energy ?? 30) : 30;
    const pct = Math.round((energy / CATALYST_ENERGY_MAX) * 100);
    const sphereActive =
      es?.sphereWindows?.some((w) => w.start <= es.time && w.end > es.time) ??
      false;
    h += `<div class="pal-group"><div class="pal-label" style="color:#44ddaa">F5</div><div class="pal-row" style="flex-wrap:wrap;gap:4px">`;
    h += `<div class="energy-bar-wrap">
            <div class="energy-bar-fill${sphereActive ? " sphere-active" : ""}" style="width:${pct}%"></div>
            <span class="energy-bar-text">${energy}/${CATALYST_ENERGY_MAX}</span>
        </div>`;
    for (const att of ATTUNEMENTS) {
      const js = skills.find(
        (s) => s.type === "Jade Sphere" && s.attunement === att,
      );
      if (js) h += app._palIcon(js, app._isSkillAvailable(js.name));
    }
    h += "</div></div>";
  }

  if (elite === "Weaver") {
    const activeTraits = app.data.attributes?.activeTraits || [];
    const hasElementsOfRage = activeTraits.some(
      (t) => t.name === "Elements of Rage",
    );
    if (hasElementsOfRage) {
      const unravel = skills.find((s) => s.name === "Unravel");
      if (unravel) {
        h += `<div class="pal-group"><div class="pal-label" style="color:#ff4444">F5</div><div class="pal-row">`;
        h += app._palIcon(unravel, app._isSkillAvailable(unravel.name));
        h += "</div></div>";
      }
    }
  }

  if (elite === "Evoker") {
    const EVOKER_SELECTORS = new Set(["Ignite", "Splash", "Zap", "Calcify"]);
    const curEl = es?.evokerElement || app.evokerElement || null;
    const charges =
      es?.evokerCharges ??
      Math.max(0, Math.min(6, app.evokerStartCharges ?? 6));
    const maxCharges = es?.evokerMaxCharges ?? 6;
    const empowered =
      es?.evokerEmpowered ??
      Math.max(0, Math.min(3, app.evokerStartEmpowered ?? 0));
    const elLabel = curEl ? curEl[0] : "?";
    h += `<div class="pal-group"><div class="pal-label" style="color:${curEl ? ATTUNEMENT_COLORS[curEl] : "#888"}">F5<br><small>${elLabel}</small></div><div class="pal-row" style="flex-wrap:wrap;gap:4px">`;
    if (curEl) {
      h += `<div class="evoker-charge-wrap">`;
      h += `<div class="evoker-charge-outer">`;
      for (let i = 0; i < maxCharges; i++)
        h += `<span class="evoker-pip${i < charges ? " filled" : ""}"></span>`;
      h += `</div>`;
      h += `<div class="evoker-charge-inner">`;
      for (let i = 0; i < 3; i++)
        h += `<span class="evoker-emp${i < empowered ? " filled" : ""}"></span>`;
      h += `</div>`;
      h += `</div>`;
      if (empowered >= 3) {
        const basicSkill = skills.find(
          (s) =>
            s.type === "Familiar" &&
            EVOKER_SELECTORS.has(s.name) &&
            s.attunement === curEl,
        );
        const empSkill = skills.find(
          (s) =>
            s.type === "Familiar" &&
            !EVOKER_SELECTORS.has(s.name) &&
            s.attunement === curEl,
        );
        if (empSkill) {
          h += app._palIcon(
            empSkill,
            app._isSkillAvailable(empSkill.name),
            basicSkill
              ? {
                  cooldownSkill: basicSkill,
                  title: `${empSkill.name} (basic cooldown: ${basicSkill.name})`,
                }
              : {},
          );
        }
      } else {
        const basicSkill = skills.find(
          (s) =>
            s.type === "Familiar" &&
            EVOKER_SELECTORS.has(s.name) &&
            s.attunement === curEl,
        );
        if (basicSkill)
          h += app._palIcon(basicSkill, app._isSkillAvailable(basicSkill.name));
      }
    } else {
      h +=
        '<span style="color:#888;font-size:11px;padding:4px">Select familiar (F5) above</span>';
    }
    h += "</div></div>";
  }

  if (es?.aaCarryover) {
    const carryRoot = es.aaCarryover.root;
    const carryAtt = es.aaCarryover.att;
    let cur = es.chainState?.[carryRoot];
    const remaining = [];
    const visited = new Set();
    while (cur && cur !== carryRoot && !visited.has(cur)) {
      const sk = skills.find((s) => s.name === cur);
      if (!sk) break;
      remaining.push(sk);
      visited.add(cur);
      cur = sk.chainSkill;
    }
    if (remaining.length > 0) {
      const color = ATTUNEMENT_COLORS[carryAtt];
      h += `<div class="pal-group"><div class="pal-label" style="color:${color}">AA</div><div class="pal-row">`;
      for (const sk of remaining)
        h += app._palIcon(sk, app._isSkillAvailable(sk.name));
      h += "</div></div>";
    }
  }

  if (wielding) {
    const cs = skills.filter((s) => s.weapon === wielding);
    if (cs.length) {
      h += `<div class="pal-group"><div class="pal-label" style="color:#ffcc44">${wielding}</div><div class="pal-row">`;
      for (const sk of cs)
        h += app._palIcon(sk, app._isSkillAvailable(sk.name));
      h += "</div></div>";
    }
    h += `<div class="pal-group"><div class="pal-label" style="color:#ffcc44">Act</div><div class="pal-row">`;
    h += `<div class="pal-skill" data-skill="__drop_bundle" title="Drop ${esc(wielding)}" style="--att-border:#ffcc44">
            <img src="${DROP_BUNDLE_ICON}" /></div>`;
    h += "</div></div>";
  } else if (elite === "Weaver") {
    const priAtt = es?.att || app.activeAttunement;
    const secAtt = es?.att2 || app.secondaryAttunement;
    const allBullets = app._allPistolBulletsHeld();
    h += `<div class="pal-group"><div class="pal-label" style="color:${ATTUNEMENT_COLORS[priAtt]}">1-2</div><div class="pal-row">`;
    for (let slot = 1; slot <= 2; slot++) {
      const weapon = is2h ? mh : slot <= 3 ? mh : oh;
      if (slot === 1 && weapon === "Pistol" && allBullets) {
        const eeSk = skills.find((s) => s.name === "Elemental Explosion");
        if (eeSk) {
          h += app._palIcon(eeSk, app._isSkillAvailable(eeSk.name));
          continue;
        }
      }
      const chain = app._getChainOrder(
        app._getSkillsForSlot(weapon, priAtt, String(slot)),
      );
      for (const sk of chain)
        h += app._palIcon(sk, app._isSkillAvailable(sk.name));
    }
    h += "</div></div>";

    const weapon3 = is2h ? mh : mh;
    if (priAtt !== secAtt) {
      const dualKey1 = `${priAtt}+${secAtt}`;
      const dualKey2 = `${secAtt}+${priAtt}`;
      const dualSkills = skills.filter(
        (s) =>
          (s.attunement === dualKey1 || s.attunement === dualKey2) &&
          s.slot === "3" &&
          s.weapon === weapon3,
      );
      if (dualSkills.length) {
        h += `<div class="pal-group"><div class="pal-label" style="background:linear-gradient(${ATTUNEMENT_COLORS[priAtt]}, ${ATTUNEMENT_COLORS[secAtt]});-webkit-background-clip:text;-webkit-text-fill-color:transparent">3</div><div class="pal-row">`;
        for (const sk of dualSkills)
          h += app._palIcon(sk, app._isSkillAvailable(sk.name));
        h += "</div></div>";
      }
    } else {
      const fallback3 = app._getChainOrder(
        app._getSkillsForSlot(weapon3, priAtt, "3"),
      );
      if (fallback3.length) {
        h += `<div class="pal-group"><div class="pal-label" style="color:${ATTUNEMENT_COLORS[priAtt]}">3</div><div class="pal-row">`;
        for (const sk of fallback3)
          h += app._palIcon(sk, app._isSkillAvailable(sk.name));
        h += "</div></div>";
      }
    }

    h += `<div class="pal-group"><div class="pal-label" style="color:${ATTUNEMENT_COLORS[secAtt]}">4-5</div><div class="pal-row">`;
    for (let slot = 4; slot <= 5; slot++) {
      const weapon = is2h ? mh : oh;
      const chain = app._getChainOrder(
        app._getSkillsForSlot(weapon, secAtt, String(slot)),
      );
      for (const sk of chain)
        h += app._palIcon(sk, app._isSkillAvailable(sk.name));
    }
    h += "</div></div>";
  } else {
    const allBullets = app._allPistolBulletsHeld();
    for (const att of ATTUNEMENTS) {
      h += `<div class="pal-group"><div class="pal-label" style="color:${ATTUNEMENT_COLORS[att]}">${att[0]}</div><div class="pal-row">`;
      for (let slot = 1; slot <= 5; slot++) {
        const weapon = is2h ? mh : slot <= 3 ? mh : oh;
        if (slot === 1 && weapon === "Pistol" && allBullets) {
          if (att === ATTUNEMENTS[0]) {
            const eeSk = skills.find((s) => s.name === "Elemental Explosion");
            if (eeSk) h += app._palIcon(eeSk, app._isSkillAvailable(eeSk.name));
          }
          continue;
        }
        const chain = app._getChainOrder(
          app._getSkillsForSlot(weapon, att, String(slot)),
        );
        for (const sk of chain)
          h += app._palIcon(sk, app._isSkillAvailable(sk.name));
      }
      h += "</div></div>";
    }
  }

  const spearEquipped = mh === "Spear" || oh === "Spear";
  if (spearEquipped) {
    const etchingSkills = [];
    for (const chain of Object.values(ETCHING_CHAINS_UI)) {
      const lesserSk = skills.find((s) => s.name === chain.lesser);
      const fullSk = skills.find((s) => s.name === chain.full);
      if (lesserSk) etchingSkills.push(lesserSk);
      if (fullSk) etchingSkills.push(fullSk);
    }
    if (etchingSkills.length > 0) {
      h +=
        '<div class="pal-group"><div class="pal-label" style="color:#cc8844">Etch</div><div class="pal-row">';
      for (const sk of etchingSkills)
        h += app._palIcon(sk, app._isSkillAvailable(sk.name));
      h += "</div></div>";
    }
  }

  const pistolEquipped = mh === "Pistol" || oh === "Pistol";
  if (pistolEquipped) {
    const liveBullets = es?.pistolBullets;
    const presetBullets = app._presetPistolBullets || {
      Fire: false,
      Water: false,
      Air: false,
      Earth: false,
    };
    const displayBullets = liveBullets || presetBullets;

    h +=
      '<div class="pal-group"><div class="pal-label" style="color:#ddbb88">Bullet</div><div class="pal-row">';
    for (const elName of ATTUNEMENTS) {
      const active = displayBullets[elName];
      const presetActive = presetBullets[elName];
      const icon = PISTOL_BULLET_ICONS[elName];
      const label = PISTOL_BULLET_LABELS[elName];
      const color = ATTUNEMENT_COLORS[elName];
      const inAtt = !es || es.att === elName || es.att2 === elName;
      const titleSuffix = active
        ? ` (held — preset start: ${presetActive ? "on" : "off"})`
        : ` (not held — preset start: ${presetActive ? "on" : "off"})`;
      h += `<div class="pistol-bullet${active ? " bullet-active" : ""}${!inAtt ? " bullet-off-att" : ""}"
                data-bullet-el="${esc(elName)}"
                title="${esc(label)}${titleSuffix} — click to toggle start"
                style="--att-border:${color};${active ? `box-shadow:0 0 6px ${color};` : ""}${!active ? "opacity:0.35;" : ""}">
                <img src="${icon}" /></div>`;
    }
    h += "</div></div>";
  }

  const hammerEquipped = mh === "Hammer" || oh === "Hammer";
  if (hammerEquipped) {
    const gfSk = skills.find(
      (s) => s.name === "Grand Finale" && s.weapon === "Hammer",
    );
    if (gfSk) {
      h +=
        '<div class="pal-group"><div class="pal-label" style="color:#ff9944">GF</div><div class="pal-row">';
      h += app._palIcon(gfSk, app._isSkillAvailable(gfSk.name));
      h += "</div></div>";
    }
  }

  const selSkills = [];
  const currentAtt = es?.att || app.activeAttunement;
  for (const slotKey of SLOT_LABELS) {
    const sel = app.selectedSkills[slotKey];
    if (!sel) continue;
    const base =
      sel.displayName ||
      sel.name.replace(/\s*\((?:Fire|Water|Air|Earth)\)$/, "");
    const hasVars = ATTUNEMENTS.some((a) =>
      skills.find((s) => s.name === `${base} (${a})`),
    );
    if (hasVars) {
      const v = skills.find((s) => s.name === `${base} (${currentAtt})`);
      if (v) selSkills.push(v);
    } else {
      selSkills.push(sel);
    }
  }
  if (selSkills.length > 0) {
    h +=
      '<div class="pal-group"><div class="pal-label">Skill</div><div class="pal-row">';
    for (const sk of selSkills)
      h += app._palIcon(sk, app._isSkillAvailable(sk.name));
    h += "</div></div>";
  }

  if (!wielding) {
    for (const slotKey of SLOT_LABELS) {
      const sel = app.selectedSkills[slotKey];
      if (sel?.type === "Conjure") {
        const cw = CONJURE_MAP[sel.name];
        if (cw) {
          const cs = skills.filter((s) => s.weapon === cw);
          if (cs.length) {
            h += `<div class="pal-group"><div class="pal-label" style="color:${ATTUNEMENT_COLORS.Fire}">${cw[0]}</div><div class="pal-row">`;
            for (const sk of cs)
              h += app._palIcon(sk, app._isSkillAvailable(sk.name));
            h += "</div></div>";
          }
        }
      }
    }
  }

  const availablePickups = (es?.conjurePickups || []).filter(
    (p) => es.time <= p.expiresAt,
  );
  if (availablePickups.length > 0 && !wielding) {
    h += `<div class="pal-group"><div class="pal-label" style="color:#ffcc44">Pick</div><div class="pal-row">`;
    for (const pickup of availablePickups) {
      const pw = pickup.weapon;
      const pickupName = `__pickup_${pw}`;
      const conjSkillName = Object.entries(CONJURE_MAP).find(
        ([, v]) => v === pw,
      )?.[0];
      const pickupIcon = conjSkillName
        ? app.api.getSkillIcon(conjSkillName)
        : null;
      const remaining = ((pickup.expiresAt - es.time) / 1000).toFixed(1);
      h += `<div class="pal-skill" data-skill="${esc(pickupName)}" title="Pick up ${esc(pw)} (${remaining}s left)" style="--att-border:#ffcc44; box-shadow: 0 0 6px #ffcc44">
                <img src="${pickupIcon || PLACEHOLDER_ICON}" /></div>`;
    }
    h += "</div></div>";
  }

  el.innerHTML = h;
  el.querySelectorAll(".pal-skill").forEach((p) => {
    const skillName = p.dataset.skill;
    const draggable = !!skillName && !p.classList.contains("pal-disabled");
    p.setAttribute("draggable", draggable ? "true" : "false");
    p.addEventListener("click", (e) => {
      if (!skillName) return;
      if (skillName === "__combat_start" && !app._isVirtualAvailable(skillName))
        return;
      if (skillName === "__wait") {
        const wait = promptWaitMs();
        if (wait.cancelled || wait.invalid) return;
        addPaletteRotationItem(app, skillName, { waitMs: wait.value });
        return;
      }
      const sk = app.data.skills.find((s) => s.name === skillName);
      const isInstant =
        skillName === "__combat_start" || (sk && (sk.castTime || 0) === 0);
      if (e.shiftKey && isInstant && app.sim?.rotation.length > 0) {
        addPaletteRotationItem(app, skillName, {
          offset: DEFAULT_CONCURRENT_OFFSET_MS,
        });
      } else if (e.ctrlKey && !isInstant) {
        const interrupt = promptInterruptMs(sk);
        if (interrupt.cancelled || interrupt.cleared || interrupt.invalid)
          return;
        addPaletteRotationItem(app, skillName, {
          interruptMs: interrupt.value,
        });
      } else {
        addPaletteRotationItem(app, skillName);
      }
    });
    p.addEventListener("dragstart", (e) => {
      if (!draggable || !skillName) {
        e.preventDefault();
        return;
      }
      app.dragState = { source: "palette", skillName };
      p.classList.add("dragging");
      e.dataTransfer.effectAllowed = "copy";
      e.dataTransfer.setData("text/plain", skillName);
    });
    p.addEventListener("dragend", () => {
      p.classList.remove("dragging");
      app.dragState = null;
      clearTimelineDropIndicators(document.getElementById("rotation-timeline"));
    });
  });

  el.querySelectorAll(".pistol-bullet").forEach((btn) => {
    btn.addEventListener("click", () => {
      const element = btn.dataset.bulletEl;
      if (!element) return;
      app._presetPistolBullets = app._presetPistolBullets || {
        Fire: false,
        Water: false,
        Air: false,
        Earth: false,
      };
      app._presetPistolBullets[element] = !app._presetPistolBullets[element];
      if (app.sim?.rotation.length > 0) {
        app._autoRun();
      } else {
        app._renderPalette();
      }
    });
  });
}

export function renderStartAttSelector(
  app,
  { ATTUNEMENTS, ATTUNEMENT_COLORS },
) {
  const el = document.getElementById("start-att-selector");
  if (!el) return;
  const elite = app._getEliteSpec();
  const isWeaver = elite === "Weaver";
  let h = "";

  h += `<span class="start-att-label">${isWeaver ? "Pri:" : "Start:"}</span>`;
  for (const att of ATTUNEMENTS) {
    const icon = app.api.getSkillIcon(`${att} Attunement`);
    const color = ATTUNEMENT_COLORS[att];
    const active = att === app.activeAttunement ? " active" : "";
    h += `<button class="start-att-btn${active}" data-att="${att}" data-role="primary" style="--att-c:${color}" title="${isWeaver ? "Primary" : "Start"}: ${att}">
            <img src="${icon || PLACEHOLDER_ICON}" /></button>`;
  }

  if (isWeaver) {
    h += `<span class="start-att-label" style="margin-left:6px">Sec:</span>`;
    for (const att of ATTUNEMENTS) {
      const icon = app.api.getSkillIcon(`${att} Attunement`);
      const color = ATTUNEMENT_COLORS[att];
      const active = att === app.secondaryAttunement ? " active" : "";
      h += `<button class="start-att-btn${active}" data-att="${att}" data-role="secondary" style="--att-c:${color}" title="Secondary: ${att}">
                <img src="${icon || PLACEHOLDER_ICON}" /></button>`;
    }
  }

  if (elite === "Evoker") {
    const EVOKER_SEL_NAMES = {
      Fire: "Ignite",
      Water: "Splash",
      Air: "Zap",
      Earth: "Calcify",
    };
    const startCharges = Math.max(0, Math.min(6, app.evokerStartCharges ?? 6));
    const startEmpowered = Math.max(
      0,
      Math.min(3, app.evokerStartEmpowered ?? 0),
    );
    h += `<span class="start-att-label" style="margin-left:6px">F5:</span>`;
    for (const att of ATTUNEMENTS) {
      const selName = EVOKER_SEL_NAMES[att];
      const icon = app.api.getSkillIcon(selName);
      const color = ATTUNEMENT_COLORS[att];
      const active = app.evokerElement === att ? " active" : "";
      h += `<button class="start-att-btn${active}" data-att="${att}" data-role="evoker" style="--att-c:${color}" title="Familiar: ${selName} (${att})">
                <img src="${icon || PLACEHOLDER_ICON}" /></button>`;
    }
    h += `<span class="start-att-label" style="margin-left:8px">Start:</span>`;
    h += `<div class="evoker-charge-wrap" title="Starting familiar charges">
            <div class="evoker-charge-outer">`;
    for (let i = 0; i < 6; i++) {
      h += `<span class="evoker-pip${i < startCharges ? " filled" : ""}" data-role="evoker-start-basic" data-count="${i + 1}" title="Starting familiar charges: ${i + 1}"></span>`;
    }
    h += `</div><div class="evoker-charge-inner">`;
    for (let i = 0; i < 3; i++) {
      h += `<span class="evoker-emp${i < startEmpowered ? " filled" : ""}" data-role="evoker-start-emp" data-count="${i + 1}" title="Starting empowered charges: ${i + 1}"></span>`;
    }
    h += `</div></div>`;
  }

  el.innerHTML = h;
  el.querySelectorAll(".start-att-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.dataset.role === "secondary") {
        if (btn.dataset.att === app.secondaryAttunement) return;
        app.secondaryAttunement = btn.dataset.att;
        app._renderStartAttSelector();
        app.renderWeaponBar();
        if (app.sim?.rotation.length > 0) app._autoRun();
        else app._renderPalette();
      } else if (btn.dataset.role === "evoker") {
        const att = btn.dataset.att;
        if (att === app.evokerElement) return;
        app.evokerElement = att;
        app._renderStartAttSelector();
        app.renderAttributes();
        app.renderSkillInfoTable();
        if (app.sim?.rotation.length > 0) app._autoRun();
        else app._renderPalette();
      } else {
        app.setAttunement(btn.dataset.att);
        app._renderStartAttSelector();
      }
    });
  });

  el.querySelectorAll(
    '[data-role="evoker-start-basic"], [data-role="evoker-start-emp"]',
  ).forEach((pip) => {
    pip.addEventListener("click", () => {
      const count = parseInt(pip.dataset.count || "", 10);
      if (!Number.isFinite(count)) return;

      if (pip.dataset.role === "evoker-start-basic") {
        const next = app.evokerStartCharges === count ? count - 1 : count;
        if (next === app.evokerStartCharges) return;
        app.evokerStartCharges = Math.max(0, Math.min(6, next));
      } else {
        const next = app.evokerStartEmpowered === count ? count - 1 : count;
        if (next === app.evokerStartEmpowered) return;
        app.evokerStartEmpowered = Math.max(0, Math.min(3, next));
      }

      app._renderStartAttSelector();
      if (app.sim?.rotation.length > 0) app._autoRun();
      else app._renderPalette();
    });
  });
}

export function renderTimeline(
  app,
  {
    ATTUNEMENT_COLORS,
    DROP_BUNDLE_ICON,
    DODGE_ICON,
    COMBAT_START_ICON,
    WAIT_ICON,
    CONJURE_MAP,
    TH_WEAPONS,
  },
) {
  closeActivationEditor();
  const el = document.getElementById("rotation-timeline");
  el.ondragover = null;
  el.ondragleave = null;
  el.ondrop = null;
  if (!app.sim || app.sim.rotation.length === 0) {
    el.innerHTML =
      '<div class="rot-empty">Click skills above to build rotation</div>';
    el.ondragover = (e) => {
      if (!app.dragState) return;
      e.preventDefault();
      el.classList.add("drag-over-empty");
    };
    el.ondragleave = (e) => {
      if (e.target === el) el.classList.remove("drag-over-empty");
    };
    el.ondrop = (e) => {
      if (!app.dragState) return;
      e.preventDefault();
      el.classList.remove("drag-over-empty");
      applyTimelineDrop(app, 0);
    };
    mountInsertionCursor(app, el);
    return;
  }

  const stepMap = {};
  if (app.sim.results?.steps) {
    for (const st of app.sim.results.steps) stepMap[st.ri] = st;
  }
  const deadTimes = timelineDeadTimeMarkers(app.sim.results?.steps || []);
  const deadTimesByIndex = new Map();
  for (const marker of deadTimes) {
    const markers = deadTimesByIndex.get(marker.insertionIndex) || [];
    markers.push(marker);
    deadTimesByIndex.set(marker.insertionIndex, markers);
  }
  const renderDeadTime = (marker) => {
    const duration = formatTimelineDuration(marker.durationMs);
    const detail = [
      `Dead time: ${duration} wasted`,
      `No skill cast from ${app._formatResultsTimeMs(marker.start, 2)} to ${app._formatResultsTimeMs(marker.end, 2)}`,
    ].join("\n");
    return `<div class="rot-skill rot-injected rot-dead-time" role="note"
            aria-label="${esc(detail)}" title="${esc(detail)}">
            <span class="rot-dead-time-label">Dead</span>
            <strong class="rot-dead-time-duration">${esc(duration)}</strong>
        </div>`;
  };

  const elite = app._getEliteSpec();
  const isWeaver = elite === "Weaver";
  const rows = [];
  let curAtt = app.activeAttunement || "Fire";
  let curAtt2 = isWeaver ? app.secondaryAttunement || curAtt : null;
  rows.push({ att: curAtt, att2: curAtt2, skills: [] });

  for (let i = 0; i < app.sim.rotation.length; i++) {
    const rotItem = app.sim.rotation[i];
    const name = typeof rotItem === "string" ? rotItem : rotItem.name;
    const offset = typeof rotItem === "object" ? rotItem.offset : undefined;
    const interruptMs =
      typeof rotItem === "object" ? rotItem.interruptMs : undefined;
    const waitMs = typeof rotItem === "object" ? rotItem.waitMs : undefined;
    const isGapFill = typeof rotItem === "object" && rotItem.gapFill === true;
    const skill = app.data.skills.find((s) => s.name === name);
    const isSwap =
      skill?.type === "Attunement" && !skill.name.startsWith("Overload");

    if (isSwap) {
      const target = skill.name.replace(" Attunement", "");
      if (isWeaver) curAtt2 = curAtt;
      curAtt = target;
      if (i > 0) rows.push({ att: curAtt, att2: curAtt2, skills: [] });
      else {
        rows[0].att = curAtt;
        rows[0].att2 = curAtt2;
      }
    }
    rows[rows.length - 1].skills.push({
      name,
      idx: i,
      step: stepMap[i],
      offset,
      interruptMs,
      waitMs,
      isGapFill,
    });
  }

  let tlHtml = rows
    .map((row, rowIndex) => {
      const color = ATTUNEMENT_COLORS[row.att] || "var(--border-light)";
      const label =
        isWeaver && row.att2 ? `${row.att[0]}/${row.att2[0]}` : row.att;
      const skillsHtml = row.skills
        .map(({ name, idx, step, offset, interruptMs, waitMs, isGapFill }) => {
          const skill = app.data.skills.find((s) => s.name === name);
          let icon;
          let displayName;
          if (name === "__drop_bundle") {
            icon = DROP_BUNDLE_ICON;
            displayName = "Drop Bundle";
          } else if (name === "__combat_start") {
            icon = COMBAT_START_ICON;
            displayName = "Combat Start";
          } else if (name === "__wait") {
            icon = WAIT_ICON;
            displayName = "Wait";
          } else if (name.startsWith("__pickup_")) {
            const pw = name.slice(9);
            const conjName = Object.entries(CONJURE_MAP).find(
              ([, v]) => v === pw,
            )?.[0];
            icon = conjName ? app.api.getSkillIcon(conjName) : null;
            displayName = `Pick up ${pw}`;
          } else if (
            skill?.type === "Dodge" ||
            skill?.slot === "Dodge" ||
            name === "Dodge"
          ) {
            icon = DODGE_ICON;
            displayName = "Dodge";
          } else {
            icon = app.api.getSkillIcon(name);
            displayName = name;
          }
          const c = app._skillColor(skill, name);
          const pf = step?.partialFill;
          const ts = pf
            ? app._formatResultsTimeMs(pf.startMs, 2)
            : step
              ? app._formatResultsTimeMs(step.start, 2)
              : "";
          const castInfo = step
            ? `\n${formatTimelineCastDetails(step, (time) =>
                app._formatResultsTimeMs(time, 2),
              )}`
            : "";
          const isConcurrent = offset !== undefined;
          const offsetBadge = isConcurrent
            ? `<span class="rot-offset-badge rot-timed-action-badge" data-idx="${idx}" title="Fires ${offset}ms into previous cast at ${esc(ts)} (click to edit)">${esc(formatConcurrentTimelineBadge(offset, ts))}</span>`
            : "";
          const interruptBadge =
            interruptMs !== undefined
              ? `<span class="rot-gapfill-badge rot-interrupt-badge rot-timed-action-badge" data-idx="${idx}" title="Interrupt at ${interruptMs}ms from cast start at ${esc(ts)} (click to edit)">${esc(formatInterruptTimelineBadge(interruptMs, ts))}</span>`
              : "";
          const waitBadge =
            waitMs !== undefined
              ? `<span class="rot-gapfill-badge rot-wait-badge" data-idx="${idx}" title="Wait ${waitMs}ms (click to edit)">⌛${waitMs}ms</span>`
              : "";
          const gapFillBadge = isGapFill
            ? `<span class="rot-gapfill-badge" title="${pf ? `${pf.durationMs}ms of ${pf.skill} filled gap` : "Gap-fill: channels filler until this skill is ready"}">⟳${pf ? pf.durationMs + "ms" : ""}</span>`
            : "";
          const concurClass = isConcurrent ? " rot-concurrent" : "";
          const gapFillClass = isGapFill ? " rot-gapfill" : "";
          const concurInfo = isConcurrent
            ? `\n⊙ Fires ${offset}ms into previous cast`
            : "";
          const interruptInfo =
            interruptMs !== undefined
              ? `\n✂ Interrupt at ${interruptMs}ms from cast start${step?.interrupted ? ` (full cast ${step.fullCastMs}ms)` : ""}`
              : "";
          const waitInfo = waitMs !== undefined ? `\n⌛ Wait ${waitMs}ms` : "";
          const gapFillInfo = pf
            ? `\n⟳ ${pf.durationMs}ms of ${pf.skill} filled gap before cast`
            : isGapFill
              ? "\n⟳ Gap-fill enabled (no gap at sim time)"
              : "";
          const catalogCastMs = Math.round(Number(skill?.castTime || 0) * 1000);
          const fullCastMs = Math.round(
            Number(step?.fullCastMs) || catalogCastMs,
          );
          const canEditActivation =
            Boolean(skill) &&
            (interruptMs !== undefined || fullCastMs > 0 || catalogCastMs > 0);
          const deadTimeHtml = (deadTimesByIndex.get(idx) || [])
            .map(renderDeadTime)
            .join("");
          return `${deadTimeHtml}${rotationTimelineEntryHtml(
            idx,
            app.rotationInsertionIndex,
            `<div class="rot-skill${concurClass}${gapFillClass}" draggable="true" data-idx="${idx}" title="${esc(displayName)}${castInfo}${concurInfo}${interruptInfo}${waitInfo}${gapFillInfo}" style="--att-border:${c}">
                    <img src="${icon || PLACEHOLDER_ICON}" />
                    ${
                      canEditActivation
                        ? `<button type="button" class="rot-edit-activation" data-idx="${idx}"
                            title="Edit cast behavior" aria-label="Edit ${esc(displayName)} cast behavior" aria-haspopup="dialog">&#9998;</button>`
                        : ""
                    }
                    <span class="rot-x">\u00d7</span>
                    ${ts && !isConcurrent && interruptMs === undefined ? `<span class="rot-time">${ts}</span>` : ""}
                    ${offsetBadge}${interruptBadge}${waitBadge}${gapFillBadge}
                </div>`,
          )}`;
        })
        .join("");
      const finalGap =
        rowIndex === rows.length - 1
          ? rotationInsertionGapHtml(
              app.sim.rotation.length,
              app.rotationInsertionIndex,
            )
          : "";
      const rowInsertIdx =
        row.skills.length > 0 ? row.skills[row.skills.length - 1].idx + 1 : 0;
      return `<div class="rot-row" style="--row-color:${color}">
            <div class="rot-row-label">${label}</div>
            <div class="rot-row-skills" data-insert-idx="${rowInsertIdx}">${skillsHtml}${finalGap}</div>
        </div>`;
    })
    .join("");

  const PROC_COLORS = {
    relic_proc: "#ddaa33",
    sigil_proc: "#4488cc",
    trait_proc: "#77cc77",
    skill_proc: "#bb88ff",
  };
  const procSteps = (app.sim.results?.steps || [])
    .filter(
      (s) =>
        s.ri === -1 &&
        (s.type === "relic_proc" ||
          s.type === "sigil_proc" ||
          s.type === "trait_proc" ||
          s.type === "skill_proc"),
    )
    .sort((a, b) => a.start - b.start);
  if (procSteps.length > 0) {
    const procsHtml = procSteps
      .map((s) => {
        const ts = app._formatResultsTimeMs(s.start, 2);
        const pc = PROC_COLORS[s.type] || "var(--border-light)";
        const typeLabel =
          s.type === "relic_proc"
            ? "Relic"
            : s.type === "sigil_proc"
              ? "Sigil"
              : s.type === "trait_proc"
                ? "Trait"
                : "Skill";
        const detailLine = s.detail ? `\n${s.detail}` : "";
        const stackLabel =
          s.skill === "Relic of Aristocracy"
            ? String(s.detail || "").match(/^(\d+\/\d+)\s+stacks$/)?.[1] || ""
            : "";
        return `<div class="proc-icon" title="${esc(s.skill)}\n${typeLabel} proc @ ${ts}${esc(detailLine)}" style="--proc-color:${pc}">
                <img src="${s.icon || PLACEHOLDER_ICON}" />
                ${stackLabel ? `<span class="proc-stack">${esc(stackLabel)}</span>` : ""}
                <span class="proc-time">${ts}</span>
            </div>`;
      })
      .join("");
    tlHtml += `<div class="rot-row rot-procs-row">
            <div class="rot-row-label">Procs</div>
            <div class="rot-row-skills proc-icons-row">${procsHtml}</div>
        </div>`;
  }

  el.innerHTML = tlHtml;
  mountInsertionCursor(app, el);
  clearTimelineDropIndicators(el);

  el.querySelectorAll(".rot-offset-badge").forEach((badge) => {
    badge.addEventListener("click", (e) => {
      e.stopPropagation();
      const idx = parseInt(badge.dataset.idx);
      const item = app.sim.rotation[idx];
      const current =
        typeof item === "object"
          ? Math.max(item.offset ?? 1, MIN_CONCURRENT_OFFSET_MS)
          : MIN_CONCURRENT_OFFSET_MS;
      const val = prompt("Offset (ms) from start of preceding cast:", current);
      if (val === null) return;
      const parsed = parseInt(val);
      if (!isNaN(parsed) && parsed >= MIN_CONCURRENT_OFFSET_MS) {
        const nextItem =
          typeof item === "string" ? { name: item } : { ...item };
        nextItem.offset = Math.max(parsed, MIN_CONCURRENT_OFFSET_MS);
        app.sim.rotation[idx] = nextItem;
        app._autoRun();
      }
    });
  });

  el.querySelectorAll(".rot-edit-activation, .rot-interrupt-badge").forEach(
    (control) => {
      control.addEventListener("click", (e) => {
        e.stopPropagation();
        const idx = parseInt(control.dataset.idx, 10);
        const anchor = control.closest(".rot-skill");
        if (Number.isInteger(idx) && anchor) {
          editTimelineActivation(app, idx, anchor);
        }
      });
    },
  );

  el.querySelectorAll(".rot-wait-badge").forEach((badge) => {
    badge.addEventListener("click", (e) => {
      e.stopPropagation();
      const idx = parseInt(badge.dataset.idx, 10);
      const item = app.sim.rotation[idx];
      const current =
        typeof item === "object"
          ? Math.max(item.waitMs ?? 1000, MIN_WAIT_MS)
          : 1000;
      const wait = promptWaitMs(current);
      if (wait.cancelled || wait.invalid) return;
      const nextItem =
        typeof item === "string" ? { name: "__wait" } : { ...item };
      nextItem.waitMs = wait.value;
      app.sim.rotation[idx] = nextItem;
      app._autoRun();
    });
  });

  el.querySelectorAll(".rot-skill").forEach((s) => {
    const idx = parseInt(s.dataset.idx, 10);
    const removeBtn = s.querySelector(".rot-x");
    if (removeBtn) {
      removeBtn.setAttribute("draggable", "false");
      removeBtn.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
      removeBtn.addEventListener("dragstart", (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
      removeBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        app.rotationInsertionIndex = null;
        if (e.shiftKey) app._truncateRotationAfter(idx);
        else app._removeFromRotation(idx);
      });
    }
    const editButton = s.querySelector(".rot-edit-activation");
    if (editButton) {
      editButton.setAttribute("draggable", "false");
      editButton.addEventListener("mousedown", (e) => e.stopPropagation());
      editButton.addEventListener("dragstart", (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
    }
    s.addEventListener("dragstart", (e) => {
      app.dragState = { source: "timeline", idx };
      s.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", String(idx));
    });
    s.addEventListener("dragend", () => {
      s.classList.remove("dragging");
      app.dragState = null;
      clearTimelineDropIndicators(el);
    });
    s.addEventListener("dragover", (e) => {
      if (!app.dragState) return;
      e.preventDefault();
      clearTimelineDropIndicators(el);
      updateSkillDropIndicator(s, e.clientX);
    });
    s.addEventListener("dragleave", () =>
      s.classList.remove("drag-insert-before", "drag-insert-after"),
    );
    s.addEventListener("drop", (e) => {
      if (!app.dragState) return;
      e.preventDefault();
      e.stopPropagation();
      const insertAt = getSkillDropInsertionIndex(s, e.clientX);
      clearTimelineDropIndicators(el);
      if (insertAt !== null) applyTimelineDrop(app, insertAt);
    });
  });

  el.querySelectorAll(".rot-row-skills").forEach((rowSkills) => {
    rowSkills.addEventListener("dragover", (e) => {
      if (!app.dragState || e.target.closest(".rot-skill")) return;
      e.preventDefault();
      clearTimelineDropIndicators(el);
      rowSkills.classList.add("drag-over");
    });
    rowSkills.addEventListener("dragleave", (e) => {
      if (e.target === rowSkills) rowSkills.classList.remove("drag-over");
    });
    rowSkills.addEventListener("drop", (e) => {
      if (!app.dragState || e.target.closest(".rot-skill")) return;
      e.preventDefault();
      const insertAt = parseInt(rowSkills.dataset.insertIdx, 10);
      clearTimelineDropIndicators(el);
      if (Number.isFinite(insertAt)) applyTimelineDrop(app, insertAt);
    });
  });

  el.ondragover = (e) => {
    if (!app.dragState || e.target.closest(".rot-row-skills")) return;
    e.preventDefault();
    clearTimelineDropIndicators(el);
    el.classList.add("drag-over-empty");
  };
  el.ondragleave = (e) => {
    if (e.target === el) el.classList.remove("drag-over-empty");
  };
  el.ondrop = (e) => {
    if (!app.dragState || e.target.closest(".rot-row-skills")) return;
    e.preventDefault();
    clearTimelineDropIndicators(el);
    applyTimelineDrop(app, app.sim.rotation.length);
  };
}
