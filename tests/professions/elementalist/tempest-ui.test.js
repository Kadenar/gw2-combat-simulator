import assert from 'node:assert/strict';
import test from 'node:test';

import { paletteSkillView, renderPalette } from '#gw2/app/rotation/palette/view.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { elementalistAppAdapter } from '#gw2/content/professions/elementalist/app/app-definition.js';
import { elementalistProfession } from '#gw2/content/professions/elementalist/definition.js';

const catalog = elementalistProfession.catalog;

function createTempestApp(rotation = [], { tempestTraits = '1-1-2', alacrity = true } = {}) {
  const commands = rotation.map((entry) =>
    typeof entry === 'number'
      ? { type: 'wait', durationMs: entry }
      : {
          type: 'cast',
          skillId: catalog.skillsByName.get(entry).id
        }
  );
  const defaults = elementalistProfession.createBuildDefaults();
  const build = elementalistAppAdapter.toApplicationBuild({
    ...defaults,
    assumptions: {
      ...defaults.assumptions,
      alacrity
    },
    specializations: [
      { name: 'Fire', traits: '1-1-1' },
      { name: 'Air', traits: '1-1-1' },
      { name: 'Tempest', traits: tempestTraits }
    ],
    rotation: commands,
    startAttunement: 'Air'
  });
  const app = {
    build,
    adapter: elementalistAppAdapter,
    profession: elementalistProfession,
    skills: catalog.skills,
    activeCatalog: catalog,
    skillByName: catalog.skillsByName,
    skillById: catalog.skillsById,
    weaponData: elementalistAppAdapter.weaponData,
    attributeWeaponSet: 1,
    results: null
  };

  elementalistAppAdapter.recalculate(app);
  app.results = simulateGw2({
    profession: elementalistProfession,
    rotation: commands,
    config: elementalistAppAdapter.simulationConfig(app)
  });

  return app;
}

function paletteContext(app) {
  return {
    specialization: 'Tempest',
    catalog,
    professionState: app.results.endState.profession,
    cooldowns: app.results.endState.cooldowns,
    time: app.results.endState.time / 1000,
    build: app.build,
    traits: new Set(app.attributeData.activeTraits.flatMap((trait) => [trait.id, trait.name]))
  };
}

function paletteHtml(app) {
  const palette = { innerHTML: '', querySelectorAll: () => [] };
  const previousDocument = globalThis.document;

  globalThis.document = {
    getElementById: (id) => (id === 'rotation-palette' ? palette : null)
  };
  try {
    renderPalette(app);
  } finally {
    globalThis.document = previousDocument;
  }

  return palette.innerHTML;
}

test('Tempest overload palette availability follows the active attunement', () => {
  const app = createTempestApp();
  const context = paletteContext(app);
  const air = catalog.skillsByName.get('Overload Air');
  const fire = catalog.skillsByName.get('Overload Fire');

  assert.deepEqual(elementalistProfession.ui.paletteSkillAvailability(context, air), {
    available: true,
    message: ''
  });
  assert.deepEqual(elementalistProfession.ui.paletteSkillAvailability(context, fire), {
    available: false,
    message: 'Requires Fire attunement.'
  });
});

test('Tempest overload singularity delays a newly entered attunement but not the rotation start', () => {
  const startingApp = createTempestApp();
  const startingAir = catalog.skillsByName.get('Overload Air');

  assert.deepEqual(elementalistProfession.ui.paletteSkillAvailability(paletteContext(startingApp), startingAir), {
    available: true,
    message: ''
  });

  const enteredApp = createTempestApp(['Fire Attunement']);
  const fire = catalog.skillsByName.get('Overload Fire');
  const enteredAvailability = elementalistProfession.ui.paletteSkillAvailability(paletteContext(enteredApp), fire);
  const enteredView = paletteSkillView(
    enteredApp,
    fire,
    enteredAvailability.available,
    enteredAvailability.message,
    enteredAvailability.retryAt
  );

  assert.deepEqual(enteredAvailability, {
    available: false,
    message: 'Attunement singularity has not formed.',
    retryAt: 4.8
  });
  assert.equal(enteredView.disabled, true);
  assert.equal(enteredView.contextDisabled, false);
  assert.equal(enteredView.cooldownLabel, '4.8s');
  assert.match(
    paletteHtml(enteredApp),
    /class="pal-skill pal-disabled" data-skill="Overload Fire"[\s\S]*?<span class="pal-cd">4\.8s<\/span>/
  );

  const unbuffedApp = createTempestApp(['Fire Attunement'], { alacrity: false });

  assert.equal(elementalistProfession.ui.paletteSkillAvailability(paletteContext(unbuffedApp), fire).retryAt, 6);
  const transcendentApp = createTempestApp(['Fire Attunement'], { tempestTraits: '1-1-1' });

  assert.equal(elementalistProfession.ui.paletteSkillAvailability(paletteContext(transcendentApp), fire).retryAt, 3.2);

  const dwelledApp = createTempestApp(['Fire Attunement', 4800]);

  assert.deepEqual(elementalistProfession.ui.paletteSkillAvailability(paletteContext(dwelledApp), fire), {
    available: true,
    message: ''
  });
});

test('an overload with 0.1 seconds remaining stays click-queueable and casts when ready', () => {
  const nearlyReadyApp = createTempestApp(['Fire Attunement', 4700]);
  const fire = catalog.skillsByName.get('Overload Fire');
  const availability = elementalistProfession.ui.paletteSkillAvailability(paletteContext(nearlyReadyApp), fire);
  const view = paletteSkillView(
    nearlyReadyApp,
    fire,
    availability.available,
    availability.message,
    availability.retryAt
  );

  assert.equal(view.disabled, true);
  assert.equal(view.contextDisabled, false);
  assert.equal(view.cooldownLabel, '0.1s');
  assert.doesNotMatch(paletteHtml(nearlyReadyApp), /pal-context-disabled[^>]*data-skill="Overload Fire"/);

  const queuedApp = createTempestApp(['Fire Attunement', 4700, 'Overload Fire']);
  const overload = queuedApp.results.events.find(
    (event) => event.type === 'action' && event.skillName === 'Overload Fire'
  );

  assert.equal(overload.at, 4.8);
});

test('a time-zero attunement swap still enforces overload singularity', () => {
  const app = createTempestApp(['Fire Attunement', 'Overload Fire']);
  const overload = app.results.events.find((event) => event.type === 'action' && event.skillName === 'Overload Fire');

  assert.equal(app.results.endState.profession.attunementEnteredAt, 0);
  assert.equal(overload.at, 4.8);
});

test('Tempest overload palette shows its active cooldown after use', () => {
  const app = createTempestApp(['Overload Air']);
  const air = catalog.skillsByName.get('Overload Air');
  const availability = elementalistProfession.ui.paletteSkillAvailability(paletteContext(app), air);
  const view = paletteSkillView(app, air, availability.available, availability.message);

  assert.equal(view.disabled, true);
  assert.equal(view.cooldownLabel, '16s');
  assert.match(view.title, /Remaining: 16s/);
});
