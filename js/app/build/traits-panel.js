import { escapeHtml as esc, gw2ApiText } from "../../platform/ui/html.js";

const SPEC_BG = (name) =>
  `https://wiki.guildwars2.com/wiki/Special:FilePath/${encodeURIComponent(
    name,
  )}_specialization.png`;

export function renderTraits(app) {
  const container = document.getElementById("traits-panel");
  const selectedNames = app.build.specializations.map((spec) => spec.name);
  container.innerHTML = app.build.specializations
    .map((selection, lineIndex) => {
      const spec =
        app.specializations.find(
          (candidate) => candidate.name === selection.name,
        ) || app.specializations[0];
      const picks = selection.traits.split("-").map(Number);
      return `<div class="spec-row" style="--spec-bg:url('${esc(SPEC_BG(spec.name))}')">
                <div class="spec-bg"></div><div class="spec-content">
                    <div class="spec-header-col">
                        <div class="spec-icon-wrap"><img src="${esc(spec.icon)}" alt=""></div>
                        <select class="spec-select" data-line="${lineIndex}">
                            ${app.specializations
                              .map((candidate) => {
                                const used =
                                  selectedNames.includes(candidate.name) &&
                                  candidate.name !== selection.name;
                                return `<option value="${esc(candidate.name)}"${candidate.name === selection.name ? " selected" : ""}${used ? " disabled" : ""}>${esc(candidate.name)}</option>`;
                              })
                              .join("")}
                        </select>
                    </div>
                    <div class="spec-tiers">${[0, 1, 2]
                      .map((tier) => {
                        const minor = spec.minorTraits[tier];
                        return `${tier ? '<span class="spec-line"></span>' : ""}
                            <div class="spec-tier">
                                <div class="spec-trait-minor" title="${esc(minor.name)}\n${esc(gw2ApiText(minor.description))}"><img src="${esc(minor.icon)}" alt=""></div>
                                <div class="spec-trait-majors">${spec.majorTraits[
                                  tier
                                ]
                                  .map(
                                    (trait, position) =>
                                      `<div class="spec-trait-major ${picks[tier] === position + 1 ? "sel" : "dim"}"
                                        data-line="${lineIndex}" data-tier="${tier}" data-pick="${position + 1}"
                                        title="${esc(trait.name)}\n${esc(gw2ApiText(trait.description))}"><img src="${esc(trait.icon)}" alt=""></div>`,
                                  )
                                  .join("")}</div>
                            </div>`;
                      })
                      .join("")}</div>
                </div></div>`;
    })
    .join("");
  container.querySelectorAll(".spec-select").forEach((select) => {
    select.addEventListener("change", () => {
      app.build.specializations[Number(select.dataset.line)] = {
        name: select.value,
        traits: "1-1-1",
      };
      const newSpec = app.specializations.find(
        (spec) => spec.name === select.value,
      );
      if (newSpec.elite) {
        app.build.specializations.forEach((other, index) => {
          if (index === Number(select.dataset.line)) return;
          const otherSpec = app.specializations.find(
            (spec) => spec.name === other.name,
          );
          if (otherSpec?.elite) {
            app.build.specializations[index] = {
              name: app.adapter.specializationFallback,
              traits: "1-1-1",
            };
          }
        });
      }
      const definition = app.resourceDefinition(
        app.adapter.eliteSpecialization(app.build),
      );
      if (definition) {
        app.build.initialResource = Math.min(
          app.build.initialResource,
          definition.maximum,
        );
      }
      app.changed();
    });
  });
  container.querySelectorAll(".spec-trait-major").forEach((trait) => {
    trait.addEventListener("click", () => {
      const spec = app.build.specializations[Number(trait.dataset.line)];
      const picks = spec.traits.split("-");
      picks[Number(trait.dataset.tier)] = trait.dataset.pick;
      spec.traits = picks.join("-");
      app.changed();
    });
  });
}
