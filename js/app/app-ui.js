import { escapeHtml as esc } from "../platform/ui/html.js";
import {
  CONDITION_DURATION_ATTRIBUTES,
  PRIMARY_ATTRIBUTES,
} from "../platform/gw2/attributes.js";

export { PRIMARY_ATTRIBUTES };

export const DERIVED_ATTRIBUTES = Object.freeze([
  "Critical Chance",
  "Critical Damage",
  "Condition Duration",
  "Boon Duration",
  "Bleeding Duration",
  "Burning Duration",
  "Confusion Duration",
  "Poison Duration",
  "Torment Duration",
]);

export const PERCENT_ATTRIBUTES = new Set(DERIVED_ATTRIBUTES);

export const SPECIFIC_CONDITION_DURATION_ATTRIBUTES = new Set([
  ...CONDITION_DURATION_ATTRIBUTES,
]);

export const PERMANENT_TARGET_CONDITIONS = Object.freeze([
  "Vulnerability",
  "Weakness",
  "Blindness",
  "Slow",
  "Chilled",
  "Cripple",
  "Immobilize",
  "Burning",
  "Bleeding",
  "Torment",
  "Confusion",
  "Poisoned",
]);

export const STACKING_TARGET_CONDITIONS = new Set([
  "Vulnerability",
  "Bleeding",
  "Torment",
  "Confusion",
]);

export function option(value, selected, label = value, disabled = false) {
  return `<option value="${esc(value)}"${value === selected ? " selected" : ""}${disabled ? " disabled" : ""}>${esc(label)}</option>`;
}

export function groupedOptions(
  groups,
  selected,
  labelFor = value => value,
  disabledFor = () => false,
) {
  return groups.map(group =>
    `<optgroup label="${esc(group.label)}">${group.items
      .map(item => option(
        item,
        selected,
        labelFor(item),
        disabledFor(item),
      ))
      .join("")}</optgroup>`
  ).join("");
}
