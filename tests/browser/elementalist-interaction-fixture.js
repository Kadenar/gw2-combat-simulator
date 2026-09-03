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

    // The build editor now keeps only build choices, with selectable skills directly beside traits.
    const section = document.querySelector('.skill-selection-section');
    const traits = document.getElementById('traits-panel');
    const selectablePanel = document.querySelector('.selectable-skills-panel');
    const selectedSkills = [...document.querySelectorAll('#skill-bar .skill-bar-slot[data-key]')];

    assert(
      section?.firstElementChild === traits && section.lastElementChild === selectablePanel,
      'selectable skills are not directly to the right of traits'
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
