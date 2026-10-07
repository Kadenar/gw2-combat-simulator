import { effectPlanningState } from '#tests/helpers/effect-report.js';
import assert from 'node:assert/strict';
import test from 'node:test';

import { paletteSkillView, paletteAvailability } from '#gw2/app/rotation/palette/model.js';
import { renderPaletteMarkup } from '#tests/helpers/palette.js';
import { runElementalist, runNative } from '#tests/helpers/elementalist-simulation.js';
import { elementalistAppAdapter } from '#gw2/professions/elementalist/app/app-definition.js';
import { elementalistProfession } from '#gw2/professions/elementalist/profession.js';

const catalog = elementalistProfession.catalog;

test('Tempest active state shows trait timers at the cursor and hides expired windows', () => {
  // Real aura grants must extend Aria without changing snapshots before the extension.
  const result = runNative({
    lines: [['Fire'], ['Air', '1-1-2'], ['Tempest', '1-1-1']],
    weapons: ['Dagger', 'Dagger'],
    startAttunement: 'Water',
    rotation: [{ type: 'combat-start' }, 'Frost Aura', 1000, 'Air Attunement', 'Shocking Aura', 'Overload Air', 15000]
  });
  assert.deepEqual(result.warnings, []);
  const snapshot = (atSeconds) =>
    new Map(
      elementalistProfession.ui
        .rotationStateSnapshot({
          balanceContext: { catalog, modifierRulesById: new Map() },
          specialization: 'Tempest',
          result,
          planningState: effectPlanningState(result, atSeconds),
          atSeconds
        })
        .map((item) => [item.id, item.value])
    );

  for (const [kind, id] of [
    ['fresh-air', 'fresh-air'],
    ['transcendent-tempest', 'transcendent-tempest']
  ]) {
    const buff = result.resolvedEvents.find((event) => event.type === 'buff' && event.kind === kind);
    assert.ok(buff, kind);
    assert.equal(snapshot(buff.at - 0.001).has(id), false);
    assert.equal(snapshot(buff.at + 1).get(id), `${(buff.duration - 1).toFixed(1)}s`);
    assert.equal(snapshot(buff.at + buff.duration).has(id), false);
  }

  const aria = result.procSteps.filter((proc) => proc.skill === 'Tempestuous Aria');
  assert.ok(aria.length >= 2);
  const first = aria[0];
  const extended = aria[1];
  assert.equal(first.expiresAt, first.start + 5000);
  assert.equal(extended.expiresAt, Math.min(first.expiresAt + 5000, extended.start + 10000));
  assert.equal(snapshot(first.start / 1000).get('tempestuous-aria'), '5.0s');
  assert.equal(
    snapshot(extended.start / 1000).get('tempestuous-aria'),
    `${((extended.expiresAt - extended.start) / 1000).toFixed(1)}s`
  );
  assert.equal(snapshot(extended.expiresAt / 1000).has('tempestuous-aria'), false);
});

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
  app.results = runElementalist(commands, elementalistAppAdapter.simulationConfig(app), {
    profession: elementalistProfession
  });

  return app;
}

function paletteContext(app) {
  return {
    specialization: 'Tempest',
    catalog,
    professionState: app.results.planningState.profession,
    cooldowns: app.results.planningState.cooldowns,
    time: app.results.planningState.atSeconds,
    build: app.build,
    traits: new Set(app.attributeData.activeTraits.map((trait) => trait.id))
  };
}

test('Tempest overload palette availability follows the active attunement', () => {
  const app = createTempestApp();
  const context = paletteContext(app);
  const air = catalog.skillsByName.get('Overload Air');
  const fire = catalog.skillsByName.get('Overload Fire');

  assert.deepEqual(paletteAvailability(app, context, air), {
    available: true,
    message: ''
  });
  assert.deepEqual(paletteAvailability(app, context, fire), {
    available: false,
    message: app.results.planningState.availability[fire.id].reason,
    retryAt: null
  });
});

test('Tempest overload singularity delays a newly entered attunement but not the rotation start', () => {
  const startingApp = createTempestApp();
  const startingAir = catalog.skillsByName.get('Overload Air');

  assert.deepEqual(paletteAvailability(startingApp, paletteContext(startingApp), startingAir), {
    available: true,
    message: ''
  });

  const enteredApp = createTempestApp(['Fire Attunement']);
  const fire = catalog.skillsByName.get('Overload Fire');
  const enteredAvailability = paletteAvailability(enteredApp, paletteContext(enteredApp), fire);
  const enteredView = paletteSkillView(
    enteredApp,
    fire,
    enteredAvailability.available,
    enteredAvailability.message,
    enteredAvailability.retryAt
  );

  assert.deepEqual(enteredAvailability, {
    available: false,
    message: enteredApp.results.planningState.availability[fire.id].reason,
    retryAt: 4.8
  });
  assert.equal(enteredView.disabled, true);
  assert.equal(enteredView.contextDisabled, false);
  assert.equal(enteredView.cooldownLabel, '4.800s');
  assert.match(
    renderPaletteMarkup(enteredApp),
    /class="pal-skill pal-disabled" data-skill="Overload Fire"[\s\S]*?<span class="pal-cd">4\.800s<\/span>/
  );

  const unbuffedApp = createTempestApp(['Fire Attunement'], { alacrity: false });

  assert.equal(paletteAvailability(unbuffedApp, paletteContext(unbuffedApp), fire).retryAt, 4.8);
  const transcendentApp = createTempestApp(['Fire Attunement'], { tempestTraits: '1-1-1' });

  assert.equal(paletteAvailability(transcendentApp, paletteContext(transcendentApp), fire).retryAt, 3.2);

  const dwelledApp = createTempestApp(['Fire Attunement', 4800]);

  assert.deepEqual(paletteAvailability(dwelledApp, paletteContext(dwelledApp), fire), {
    available: true,
    message: ''
  });
});

test('an overload with 0.1 seconds remaining stays click-queueable and casts when ready', () => {
  const nearlyReadyApp = createTempestApp(['Fire Attunement', 4700]);
  const fire = catalog.skillsByName.get('Overload Fire');
  const availability = paletteAvailability(nearlyReadyApp, paletteContext(nearlyReadyApp), fire);
  const view = paletteSkillView(
    nearlyReadyApp,
    fire,
    availability.available,
    availability.message,
    availability.retryAt
  );

  assert.equal(view.disabled, true);
  assert.equal(view.contextDisabled, false);
  assert.equal(view.cooldownLabel, '0.100s');
  assert.doesNotMatch(renderPaletteMarkup(nearlyReadyApp), /pal-context-disabled[^>]*data-skill="Overload Fire"/);

  const queuedApp = createTempestApp(['Fire Attunement', 4700, 'Overload Fire']);
  const overload = queuedApp.results.events.find(
    (event) => event.type === 'action' && event.skillName === 'Overload Fire'
  );

  assert.equal(overload.at, 4.8);
});

test('a time-zero attunement swap still enforces overload singularity', () => {
  const app = createTempestApp(['Fire Attunement', 'Overload Fire']);
  const overload = app.results.events.find((event) => event.type === 'action' && event.skillName === 'Overload Fire');

  assert.equal(app.results.planningState.profession.attunementEnteredAt, 0);
  assert.equal(overload.at, 4.8);
});

test('Tempest overload palette shows its active cooldown after use', () => {
  const app = createTempestApp(['Overload Air']);
  const air = catalog.skillsByName.get('Overload Air');
  const availability = paletteAvailability(app, paletteContext(app), air);
  const view = paletteSkillView(app, air, availability.available, availability.message);

  assert.equal(view.disabled, true);
  assert.equal(view.cooldownLabel, '16.000s');
  // Live cooldown text belongs to the tooltip's cast details.
  assert.match(view.castDetails, /Ready in: 16\.000s/);
});
