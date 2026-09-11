import { createElementalistBuildDefaults } from '#gw2/professions/elementalist/build/build.js';

const output = document.getElementById('fixture-output');
const frame = document.getElementById('simulator');

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

frame.addEventListener('load', async () => {
  try {
    const window = frame.contentWindow;
    const document = frame.contentDocument;
    const app = await waitFor(() => window.professionApp);

    assert(app, 'Elementalist application did not initialize');
    app.build = createElementalistBuildDefaults();
    app.changed();

    // Equipped skill selectors precede traits, with weapon controls following the trait lines.
    const section = document.querySelector('.workspace-build-choices');
    const traits = document.getElementById('traits-panel');
    const weapons = document.getElementById('weapon-select');
    const selectedSkills = [...document.querySelectorAll('#skill-bar .skill-bar-slot[data-key]')];

    assert(
      section?.contains(traits) && weapons?.parentElement === section,
      'weapon selection is not grouped beneath traits'
    );
    assert(selectedSkills.length === 5, 'heal, utility, and elite selections are missing');
    assert(
      !document.querySelector('[data-weapon-set-preview], .weapon-attunement-preview'),
      'removed weapon previews are still rendered'
    );

    output.dataset.status = 'passed';
    output.textContent = JSON.stringify({
      profession: app.profession.id,
      selectableSkillCount: selectedSkills.length
    });
  } catch (error) {
    output.dataset.status = 'failed';
    output.textContent = error.stack;
  }
});
