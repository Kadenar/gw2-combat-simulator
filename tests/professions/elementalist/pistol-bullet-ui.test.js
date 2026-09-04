import assert from 'node:assert/strict';
import test from 'node:test';

import { renderPalette } from '#gw2/app/rotation/palette/view.js';
import { renderPaletteMarkup } from '../../helpers/palette.js';
import { elementalistAppAdapter } from '#gw2/professions/elementalist/app/app-definition.js';
import { elementalistCatalog } from '#gw2/professions/elementalist/catalog.js';
import { elementalistProfession } from '#gw2/professions/elementalist/definition.js';

function createPistolApp() {
  const build = elementalistAppAdapter.toApplicationBuild({
    ...elementalistProfession.createBuildDefaults(),
    weapons: ['Pistol', 'Warhorn'],
    pistolBullets: {
      Fire: true,
      Water: false,
      Air: false,
      Earth: false
    },
    specializations: [
      { name: 'Fire', traits: '1-1-1' },
      { name: 'Air', traits: '1-1-1' },
      { name: 'Tempest', traits: '1-1-1' }
    ]
  });
  let changeCount = 0;
  const app = {
    build,
    adapter: elementalistAppAdapter,
    profession: elementalistProfession,
    skills: elementalistCatalog.skills,
    skillByName: elementalistCatalog.skillsByName,
    skillById: elementalistCatalog.skillsById,
    weaponData: elementalistAppAdapter.weaponData,
    results: {
      endState: {
        activeWeaponSet: 1,
        time: 0,
        cooldowns: {},
        profession: {
          primaryAttunement: 'Air',
          secondaryAttunement: null,
          autoattackChains: {},
          pistolBullets: {
            Fire: false,
            Water: true,
            Air: true,
            Earth: false
          }
        }
      }
    },
    changed() {
      changeCount += 1;
    }
  };

  return { app, changeCount: () => changeCount };
}

test('Elementalist pistol palette distinguishes starting and current bullets', () => {
  const { app } = createPistolApp();
  const html = renderPaletteMarkup(app);

  assert.match(html, /data-palette-group="elementalist-pistol-bullets"/);
  assert.equal((html.match(/class="pal-control pistol-bullet/g) || []).length, 4);
  assert.match(
    html,
    /class="pal-control pistol-bullet pal-control-pressed pal-control-muted"[\s\S]*?data-palette-control-id="elementalist-pistol-bullet:Fire"[\s\S]*?aria-pressed="true"/
  );
  assert.match(
    html,
    /class="pal-control pistol-bullet pal-control-active pal-control-muted"[\s\S]*?data-palette-control-id="elementalist-pistol-bullet:Water"[\s\S]*?aria-pressed="false"/
  );
  assert.match(
    html,
    /class="pal-control pistol-bullet pal-control-active"[\s\S]*?data-palette-control-id="elementalist-pistol-bullet:Air"/
  );
  assert.match(html, /currently stocked; starts not stocked/);
  assert.match(html, /not currently stocked; starts stocked/);
  assert.match(html, /class="pal-control-badge"[^>]*>S<\/span>/);
  assert.match(html, new RegExp(elementalistCatalog.skillsByName.get('Scorching Shot').icon));
});

test('Elementalist pistol palette toggles the selected starting bullet', () => {
  const { app, changeCount } = createPistolApp();
  const bulletButtons = ['Fire', 'Water', 'Air', 'Earth'].map((element) => ({
    dataset: { paletteControlId: `elementalist-pistol-bullet:${element}` },
    onclick: null
  }));
  const palette = {
    innerHTML: '',
    querySelectorAll(selector) {
      return selector === '.pal-control[data-palette-control-id]' ? bulletButtons : [];
    }
  };
  const previousDocument = globalThis.document;

  globalThis.document = {
    getElementById: (id) => (id === 'rotation-palette' ? palette : null)
  };
  try {
    renderPalette(app);
    bulletButtons[1].onclick();
  } finally {
    globalThis.document = previousDocument;
  }

  assert.equal(app.build.pistolBullets.Water, true);
  assert.equal(changeCount(), 1);
});

test('Elemental Explosion replaces the active pistol autoattack at full stock', () => {
  const { app } = createPistolApp();

  const partialStock = renderPaletteMarkup(app);

  assert.doesNotMatch(partialStock, /data-skill="Elemental Explosion"/);
  assert.match(partialStock, /data-skill="Electric Exposure"/);
  assert.doesNotMatch(partialStock, />Special<\/div>/);

  app.results.endState.profession.pistolBullets = {
    Fire: true,
    Water: true,
    Air: true,
    Earth: true
  };
  const fullStock = renderPaletteMarkup(app);

  assert.match(fullStock, /data-skill="Elemental Explosion"/);
  assert.doesNotMatch(fullStock, /data-skill="Electric Exposure"/);
  assert.match(fullStock, /data-skill="Scorching Shot"/);
  assert.doesNotMatch(fullStock, />Special<\/div>/);

  const explosion = fullStock.indexOf('data-skill="Elemental Explosion"');
  const bullets = fullStock.indexOf('data-palette-group="elementalist-pistol-bullets"');
  const earthAutoattack = fullStock.indexOf('data-skill="Piercing Pebble"');

  // Starting-stock controls follow the complete attunement bank instead of
  // interrupting the active and Earth weapon rows.
  assert.ok(explosion < earthAutoattack);
  assert.ok(earthAutoattack < bullets);
});

test('Aerial Agility collapses its chain into one pistol palette tile', () => {
  const { app } = createPistolApp();
  const html = renderPaletteMarkup(app);

  assert.match(html, /data-skill="Aerial Agility"/);
  assert.doesNotMatch(html, /data-skill="Aerial Agility \(chain\)"/);
  assert.doesNotMatch(html, /data-skill="Aerial Agility \(dash\)"/);
});

test('Elementalist bullet controls stay hidden without a pistol', () => {
  const { app } = createPistolApp();

  app.build.weapons = ['Sword', 'Warhorn'];

  assert.doesNotMatch(renderPaletteMarkup(app), /data-palette-group="elementalist-pistol-bullets"/);
});
