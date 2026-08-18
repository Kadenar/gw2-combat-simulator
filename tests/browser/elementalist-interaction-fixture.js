import { createElementalistBuildDefaults } from "../../js/professions/elementalist/build.js";

const output = document.getElementById("fixture-output");
const frame = document.getElementById("simulator");

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const waitFor = async (predicate, timeoutMs = 5000) => {
  const deadline = performance.now() + timeoutMs;
  while (performance.now() < deadline) {
    const value = predicate();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  return null;
};

frame.addEventListener("load", async () => {
  try {
    const window = frame.contentWindow;
    const document = frame.contentDocument;
    const app = await waitFor(() => window.professionApp);
    assert(app, "Elementalist application did not initialize");
    app.build = createElementalistBuildDefaults();
    app.changed();

    // The Elementalist control changes only the visible weapon-skill row and
    // retains that choice when the shared skill bar rerenders.
    let selector = document.querySelector(".attunement-preview-toggle-select");
    let previews = [...document.querySelectorAll(".weapon-attunement-preview")];
    const optionValues = [...selector.options].map((option) => option.value);
    assert(
      ["Fire", "Water", "Air", "Earth"].every((attunement) =>
        optionValues.includes(attunement),
      ),
      "attunement preview dropdown is missing a core attunement",
    );
    assert(
      previews.filter((preview) => !preview.hidden).length === 1 &&
        previews.find((preview) => !preview.hidden)?.dataset.attunement ===
          selector.value,
      "attunement dropdown does not initially show one matching preview",
    );

    selector.value = "Water";
    selector.dispatchEvent(new window.Event("change", { bubbles: true }));
    assert(
      previews.find((preview) => preview.dataset.attunement === "Water")
        ?.hidden === false &&
        previews
          .filter((preview) => preview.dataset.attunement !== "Water")
          .every((preview) => preview.hidden),
      "attunement dropdown did not switch the preview to Water",
    );

    app.changed();
    selector = document.querySelector(".attunement-preview-toggle-select");
    previews = [...document.querySelectorAll(".weapon-attunement-preview")];
    assert(
      selector.value === "Water" &&
        previews.find((preview) => preview.dataset.attunement === "Water")
          ?.hidden === false,
      "selected attunement preview was not preserved after rerendering",
    );
    assert(
      !document.querySelector("[data-weapon-set-toggle]"),
      "Elementalist rendered a weapon-set toggle instead of attunements",
    );

    output.dataset.status = "passed";
    output.textContent = JSON.stringify({
      profession: app.profession.id,
      attunement: selector.value,
      previewCount: previews.length,
    });
  } catch (error) {
    output.dataset.status = "failed";
    output.textContent = error.stack;
  }
});
