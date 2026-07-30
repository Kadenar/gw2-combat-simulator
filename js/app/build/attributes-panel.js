import { escapeHtml as esc } from "../../platform/ui/html.js";
import {
  DERIVED_ATTRIBUTES,
  PERCENT_ATTRIBUTES,
  PRIMARY_ATTRIBUTES,
  SPECIFIC_CONDITION_DURATION_ATTRIBUTES,
} from "./options.js";

export function renderAttributes(app) {
  document.getElementById("attribute-weapon-set").value = String(
    app.attributeWeaponSet,
  );
  const attributes = app.attributeData.attributes;
  const section = (title, names) =>
    `<div class="attr-section"><h4>${title}</h4>${names
      .map((name) => {
        let value = attributes[name]?.final || 0;
        if (SPECIFIC_CONDITION_DURATION_ATTRIBUTES.has(name)) {
          value += attributes["Condition Duration"]?.final || 0;
        }
        const breakdown = attributes[name]
          ? Object.entries(attributes[name])
              .filter(([key, amount]) => key !== "final" && amount)
              .map(
                ([key, amount]) => `${key}: ${Math.round(amount * 100) / 100}`,
              )
              .join("\n")
          : "";
        return `<div class="attr-row" title="${esc(breakdown)}"><span class="attr-name">${name}</span>
                <span class="attr-val">${PERCENT_ATTRIBUTES.has(name) ? `${value.toFixed(2)}%` : Math.round(value).toLocaleString()}</span></div>`;
      })
      .join("")}</div>`;
  document.getElementById("attributes-list").innerHTML =
    section("Primary", PRIMARY_ATTRIBUTES) +
    section("Derived", DERIVED_ATTRIBUTES);
}
