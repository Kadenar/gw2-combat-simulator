import { createNecromancerBuildDefaults } from '../../js/professions/necromancer/build.js';

const output = document.getElementById('fixture-output');
const frame = document.getElementById('simulator');

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const icon = (document, name) =>
  [...document.querySelectorAll('.pal-skill')].find((element) => element.dataset.skill === name);
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
    const app = await waitFor(() => window.necromancerApp);

    assert(app, 'Necromancer application did not initialize');
    app.build = createNecromancerBuildDefaults();
    app.changed();

    // Verify the prototype keeps both bars in one card and presents mechanics
    // before the selectable heal, utility, and elite skills.
    const combatLoadout = document.querySelector('.combat-loadout');
    const skillBarSections = [...document.querySelectorAll('#skill-bar > .combat-loadout-skill-section')];

    assert(
      combatLoadout?.contains(document.getElementById('weapon-bar')) &&
        combatLoadout.contains(document.getElementById('skill-bar')),
      'combat loadout does not contain both weapon and selectable skill bars'
    );
    assert(
      skillBarSections[0]?.classList.contains('combat-loadout-mechanics') &&
        skillBarSections[1]?.classList.contains('combat-loadout-selected-skills'),
      'profession mechanics are not displayed before selectable skills'
    );
    const weaponSetToggleButtons = [...document.querySelectorAll('[data-weapon-set-toggle]')];
    const weaponSetPreviews = [...document.querySelectorAll('[data-weapon-set-preview]')];

    assert(
      weaponSetToggleButtons.length === 2 &&
        weaponSetPreviews.length === 2 &&
        !weaponSetPreviews[0].hidden &&
        weaponSetPreviews[1].hidden,
      'weapon-set toggle does not initially show only set 1'
    );
    weaponSetToggleButtons[1].click();
    assert(
      weaponSetPreviews[0].hidden &&
        !weaponSetPreviews[1].hidden &&
        weaponSetToggleButtons[1].getAttribute('aria-pressed') === 'true',
      'weapon-set toggle did not switch the preview to set 2'
    );
    app.changed();
    assert(
      document.querySelector('[data-weapon-set-preview="1"]')?.hidden &&
        !document.querySelector('[data-weapon-set-preview="2"]')?.hidden,
      'selected weapon-set preview was not preserved after rerendering'
    );
    document.querySelector('[data-weapon-set-toggle="1"]').click();

    assert(document.getElementById('loading-overlay').classList.contains('hidden'), 'loading overlay did not clear');
    assert(document.querySelector('[data-resource-id="life-force"]'), 'Life Force display is missing');
    const blightInput = document.querySelector('input[data-resource-key="initialBlight"]');

    assert(blightInput, 'starting Blight control is missing');
    blightInput.value = '7';
    blightInput.dispatchEvent(new window.Event('change', { bubbles: true }));
    assert(app.build.initialBlight === 7, 'starting Blight did not update');

    icon(document, 'Harbinger Shroud').click();
    assert(app.results.endState.profession.activeShroud === 'harbinger', 'Harbinger Shroud did not activate');
    assert(icon(document, 'Tainted Bolts'), 'Harbinger skill bar is missing');
    const weaponSkill = [...document.querySelectorAll('.pal-group')]
      .find((group) => group.querySelector('.pal-label')?.textContent === 'W1')
      ?.querySelector('.pal-skill');

    assert(weaponSkill?.classList.contains('pal-context-disabled'), 'normal weapon skill stayed enabled in shroud');
    icon(document, 'Tainted Bolts').click();
    assert(app.results.strikeDamage > 0, 'Harbinger strike did not resolve');
    icon(document, 'Exit Harbinger Shroud').click();
    assert(app.results.endState.profession.activeShroud === '', 'Harbinger Shroud did not exit');

    app.build.rotation = [];
    app.build.weapons = ['Spear', ''];
    app.changed();
    assert(
      document.querySelector('[data-resource-id="soul-shards"][data-resource-count="0"] .necromancer-soul-shards'),
      'Soul shard display is missing its empty state'
    );
    assert(icon(document, 'Dark Slash'), 'Necromancer spear is missing');
    icon(document, 'Dark Slash').click();
    assert(
      icon(document, 'Deadly Slice') && !icon(document, 'Deadly Slice').classList.contains('pal-context-disabled'),
      'Necromancer spear chain did not advance'
    );
    icon(document, 'Deadly Slice').click();
    assert(
      document.querySelector('[data-resource-id="soul-shards"][data-resource-count="1"] .necromancer-soul-shards'),
      'Soul shard display did not update after generating a shard'
    );

    app.build.rotation = [];
    app.build.specializations[2] = {
      name: 'Scourge',
      traits: '1-1-2'
    };
    app.changed();
    assert(icon(document, 'Manifest Sand Shade'), 'Scourge F1 is missing');
    assert(
      document.querySelector('[data-resource-id="active-shades"][data-resource-count="0"] .necromancer-scourge-shades'),
      'Scourge shade display is missing its empty state'
    );
    icon(document, 'Manifest Sand Shade').click();
    icon(document, 'Manifest Sand Shade').click();
    icon(document, 'Manifest Sand Shade').click();
    assert(app.results.endState.profession.shades.length === 3, 'Scourge did not retain three shades');
    assert(
      document.querySelector('[data-resource-id="active-shades"][data-resource-count="3"] .necromancer-scourge-shades'),
      'Scourge shade display did not update to three active shades'
    );
    assert(
      icon(document, 'Manifest Sand Shade').classList.contains('pal-disabled'),
      'spent shade ammo is not disabled'
    );
    assert(document.querySelector('#rotation-timeline .rot-skill'), 'rotation timeline did not render casts');
    assert(document.querySelector('#rotation-results .res-label'), 'result metrics did not render');
    output.textContent = JSON.stringify({
      profession: app.profession.id,
      shades: app.results.endState.profession.shades.length,
      rotationLength: app.build.rotation.length,
      totalDamage: app.results.totalDamage
    });
    output.dataset.status = 'passed';
  } catch (error) {
    output.textContent = error.stack;
    output.dataset.status = 'failed';
  }
});
