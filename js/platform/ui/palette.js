import { escapeHtml } from "./html.js";

export function paletteView(profession, context) {
  const groups = profession.ui.paletteGroups(context);
  if (!Array.isArray(groups)) throw new TypeError("paletteGroups must return an array.");
  return groups.map(group => ({
    id: String(group.id),
    label: String(group.label || group.id),
    skillIds: [...(group.skillIds || [])],
    color: String(group.color || ""),
  }));
}

function ammoView(ammo) {
  if (!ammo) return null;
  const maximum = Math.max(0, Number(ammo.maximum || 0));
  const current = Math.max(0, Math.min(maximum, Number(ammo.current || 0)));
  const pips = Array.isArray(ammo.pips)
    ? ammo.pips
    : Array.from({ length: maximum }, (_, index) => index < current);
  return { current, maximum, pips };
}

export function paletteSkillHtml(view = {}) {
  const ammo = ammoView(view.ammo);
  const disabled = Boolean(view.disabled);
  const contextDisabled = Boolean(view.contextDisabled);
  const draggable = Boolean(view.draggable) && !disabled && !contextDisabled;
  const classes = [
    "pal-skill",
    disabled ? "pal-disabled" : "",
    contextDisabled ? "pal-context-disabled" : "",
    view.highlighted ? "pal-ambush-active" : "",
    ammo ? "pal-has-ammo" : "",
    ammo && ammo.current > 0 ? "pal-ammo-available" : "",
  ].filter(Boolean).join(" ");
  const ammoIndicator = ammo
    ? `<span class="pal-charges">${ammo.current}/${ammo.maximum}</span>
      <span class="pal-ammo-pips" aria-hidden="true">${ammo.pips.map(filled =>
        `<span class="pal-ammo-pip${filled ? " filled" : ""}"></span>`
      ).join("")}</span>`
    : "";
  const ariaLabel = ammo
    ? `${view.name || ""}: ${ammo.current}/${ammo.maximum} charges`
    : "";
  return `<div class="${classes}" data-skill="${escapeHtml(view.name)}"
    title="${escapeHtml(view.title || view.name)}" draggable="${draggable ? "true" : "false"}"
    ${ariaLabel ? `aria-label="${escapeHtml(ariaLabel)}"` : ""}
    style="--att-border:${escapeHtml(view.color || "#a88be8")}">
    <img src="${escapeHtml(view.icon)}" alt="" />
    ${view.cooldownLabel ? `<span class="pal-cd">${escapeHtml(view.cooldownLabel)}</span>` : ""}
    ${ammoIndicator}
  </div>`;
}

export function virtualPaletteSkillHtml(view = {}) {
  return paletteSkillHtml({
    color: "#8d7a57",
    draggable: true,
    ...view,
  });
}

export function paletteGroupHtml(view = {}) {
  const skills = view.skills || [];
  if (!skills.length) return "";
  return `<div class="pal-group${view.className ? ` ${escapeHtml(view.className)}` : ""}">
    <div class="pal-label" style="color:${escapeHtml(view.color || "#a88be8")}">${escapeHtml(view.label)}</div>
    <div class="pal-row">${skills.map(skill =>
      skill?.virtual ? virtualPaletteSkillHtml(skill) : paletteSkillHtml(skill)
    ).join("")}</div>
  </div>`;
}

export function bindPaletteInteractions(root, handlers = {}) {
  if (!root) return;
  for (const icon of root.querySelectorAll?.(".pal-skill[data-skill]") || []) {
    const name = icon.dataset.skill;
    const draggable = icon.getAttribute("draggable") === "true";
    icon.onclick = event => {
      if (icon.classList.contains("pal-context-disabled")) return;
      handlers.onActivate?.(name, event);
    };
    icon.ondragstart = event => {
      if (!draggable) {
        event.preventDefault();
        return;
      }
      if (handlers.onDragStart?.(name, event) === false) {
        event.preventDefault();
        return;
      }
      icon.classList.add("dragging");
      event.dataTransfer?.setData("text/plain", name);
      if (event.dataTransfer) event.dataTransfer.effectAllowed = "copy";
    };
    icon.ondragend = event => {
      icon.classList.remove("dragging");
      handlers.onDragEnd?.(name, event);
    };
  }
}
