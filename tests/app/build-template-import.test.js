import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  applyBuildTemplatePreview,
  BuildTemplateProfessionMismatchError,
  previewBuildTemplateCode
} from '#gw2/app/build/io/build-template-import.js';
import { elementalistCatalog } from '#gw2/content/professions/elementalist/catalog.js';
import { elementalistAppAdapter } from '#gw2/content/professions/elementalist/app/app-definition.js';
import { engineerCatalog } from '#gw2/content/professions/engineer/catalog.js';
import { engineerAppAdapter } from '#gw2/content/professions/engineer/app/app-definition.js';
import { mesmerCatalog } from '#gw2/content/professions/mesmer/catalog.js';
import { mesmerAppAdapter } from '#gw2/content/professions/mesmer/app/app-definition.js';

const ELEMENTALIST_CODE = '[&DQYfHSkvMBfHEicPwxIAAL4BAADLAMsAJgCWAAAAAAAAAAAAAAAAAAAAAAADVgBnAC8AAA==]';
const ENGINEER_CODE = '[&DQMGJyY5SzYqDwAAhgAAAAcBAACTAQAAex0AAAAAAAAAAAAAAAAAAAAAAAACCQE2AAA=]';

test('in-game build import replaces selections without discarding gear or rotation', () => {
  const current = elementalistAppAdapter.toApplicationBuild({});

  current.gear.Head = "Viper's";
  current.rotation = [
    { type: 'cast', skillId: 'Fireball' },
    { type: 'wait', durationMs: 250 }
  ];
  let changedCalls = 0;
  const app = {
    adapter: elementalistAppAdapter,
    activeCatalog: elementalistCatalog,
    build: current,
    changed() {
      changedCalls += 1;
    }
  };

  const preview = previewBuildTemplateCode(app, ELEMENTALIST_CODE);
  const warnings = applyBuildTemplatePreview(app, preview);

  assert.deepEqual(app.build.specializations, [
    { name: 'Fire', traits: '1-3-1' },
    { name: 'Air', traits: '3-3-2' },
    { name: 'Tempest', traits: '3-1-1' }
  ]);
  assert.deepEqual(app.build.selectedSkills, {
    Heal: 'Wash the Pain Away!',
    Utility1: 'Feel the Burn!',
    Utility2: 'Glyph of Storms (Fire)',
    Utility3: 'Signet of Fire',
    Elite: 'Glyph of Elementals'
  });
  assert.equal(app.build.gear.Head, "Viper's");
  assert.deepEqual(app.build.weapons, ['Scepter', 'Warhorn']);
  assert.deepEqual(app.build.rotation, current.rotation);
  assert.equal(changedCalls, 1);
  assert.equal(warnings.length, 1);
});

test('Engineer build import equips the inferred primary spear', () => {
  const current = engineerAppAdapter.toApplicationBuild({});
  const alternateWeapons = [...current.alternateWeapons];
  const app = {
    adapter: engineerAppAdapter,
    activeCatalog: engineerCatalog,
    build: current,
    changed() {}
  };

  const preview = previewBuildTemplateCode(app, ENGINEER_CODE);
  const warnings = applyBuildTemplatePreview(app, preview);

  assert.deepEqual(app.build.weapons, ['Spear', '']);
  assert.deepEqual(app.build.alternateWeapons, alternateWeapons);
  assert.match(warnings[0], /Choose the intended weapon set/);

  applyBuildTemplatePreview(app, preview, preview.weaponOptions[1]);
  assert.deepEqual(app.build.weapons, ['Pistol', 'Pistol']);
});

test('cross-profession imports identify the build and offer its simulator', () => {
  const app = {
    adapter: mesmerAppAdapter,
    activeCatalog: mesmerCatalog,
    build: mesmerAppAdapter.toApplicationBuild({})
  };

  assert.throws(
    () => previewBuildTemplateCode(app, ENGINEER_CODE),
    (error) => {
      assert.ok(error instanceof BuildTemplateProfessionMismatchError);
      assert.equal(error.message, 'This build code is for Engineer. You are currently viewing the Mesmer simulator.');
      assert.equal(error.actualProfession.route, 'engineer.html');

      return true;
    }
  );
});

test('GW2 contributes build-code controls that use a review dialog instead of browser prompts', () => {
  const pageControls = readFileSync(new URL('../../js/games/gw2/app/build/page-controls.ts', import.meta.url), 'utf8');
  const buildEditor = readFileSync(new URL('../../js/games/gw2/app/build-editor.ts', import.meta.url), 'utf8');
  const dialog = readFileSync(
    new URL('../../js/games/gw2/app/build/io/build-template-import-dialog.ts', import.meta.url),
    'utf8'
  );

  assert.doesNotMatch(pageControls, /\bprompt\s*\(/);
  assert.match(pageControls, /buildEditor\.bindControls/);
  assert.doesNotMatch(pageControls, /\.selectable-skills-title|Import GW2 Build/);
  assert.match(buildEditor, /\.selectable-skills-title/);
  assert.match(buildEditor, /build-template-import/);
  assert.match(buildEditor, /title\.append\(button\)/);
  assert.doesNotMatch(pageControls, /importBuildButton\.insertAdjacentElement/);
  assert.match(dialog, /createElement\(['"]dialog['"]\)/);
  assert.match(dialog, /data-build-template-weapon-select/);
  assert.match(dialog, /Preview build/);
  assert.match(dialog, /Apply build/);
});
