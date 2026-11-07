/** Glyph inputs select live payloads while saved equipment and recorded cast evidence keep separate identities. */
import assert from 'node:assert/strict';
import test from 'node:test';

import { clearedValues, createSkillDamagePlan, skillDamageControls } from '#gw2/app/build/skill-damage/plan.js';
import { resolveEntryDisplaySkill } from '#gw2/app/rotation/editing/actions.js';
import { capturePaletteInput } from '#gw2/app/rotation/palette/input.js';
import { dispatchPaletteActivation, resolvePaletteDropItem } from '#gw2/app/rotation/palette/interactions.js';
import { paletteSkillView, rotationSelectedSlotSkills } from '#gw2/app/rotation/palette/model.js';
import { paletteSkillHtml } from '#gw2/app/rotation/palette/view.js';
import { rotationSkillHighlightKey } from '#gw2/app/rotation/timeline/model.js';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import { SelectedSkillMigrationError } from '#gw2/platform/builds/codec.js';
import { resolveSkillSelector } from '#gw2/platform/skills/selectors.js';
import {
  createElementalistBuildDefaults,
  migrateElementalistBuild,
  toApplicationBuild,
  validateElementalistBuild
} from '#gw2/professions/elementalist/build/build.js';
import { elementalistCoreHooks } from '#gw2/professions/elementalist/core/hooks.js';
import { ELEMENTALIST_GLYPHS, validateElementalistGlyphs } from '#gw2/professions/elementalist/data/glyphs.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import { elementalistCatalog, elementalistProfession } from '#gw2/professions/elementalist/profession.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';
import { createNativeApp, runElementalist, runNative } from '#tests/helpers/elementalist-simulation.js';

const lines = [['Fire'], ['Air'], ['Arcane']];
const selectedSkillIds = {
  ...createElementalistBuildDefaults().selectedSkillIds,
  Utility1: ID.GLYPH_OF_STORMS,
  Utility2: ID.GLYPH_OF_ELEMENTAL_POWER
};

test('generic glyphs use primary attunement for both Core and Weaver', () => {
  for (const [root, variants] of Object.entries(ELEMENTALIST_GLYPHS)) {
    for (const [element, variant] of Object.entries(variants)) {
      for (const specialization of ['Arcane', 'Weaver']) {
        const result = runNative({
          lines: [['Fire'], ['Air'], [specialization]],
          selectedSkillIds,
          startAttunement: element,
          secondaryAttunement: element === 'Fire' ? 'Air' : 'Fire',
          rotation: [{ type: 'cast', skillId: Number(root) }]
        });
        assert.deepEqual(result.warnings, []);
        assert.equal(result.steps.find((step) => step.skillId === variant)?.invalid, undefined);
        assert.ok(result.steps.some((step) => step.skillId === variant));
        assert.ok(!result.steps.some((step) => step.skillId === Number(root)));
      }
    }
  }
});

test('a generic glyph follows a preceding swap and retains the accepted payload after a later swap', () => {
  const result = runNative({
    lines,
    selectedSkillIds,
    startAttunement: 'Fire',
    rotation: ['Air Attunement', 'Glyph of Storms', 'Earth Attunement', 3000]
  });
  assert.deepEqual(result.warnings, []);
  const cast = result.steps.find((step) => step.skillId === ID.GLYPH_OF_STORMS_AIR);
  const swap = result.steps.find((step) => step.skillId === ID.EARTH_ATTUNEMENT);
  assert.ok(cast && swap);
  const packets = result.events.filter((event) => event.type === 'damage' && event.activationId === cast.activationId);
  assert.ok(packets.some((event) => event.at > swap.end / 1000));
  assert.ok(packets.every((event) => event.skillId === ID.GLYPH_OF_STORMS_AIR));
});

test('explicit glyph casts preserve attunement and equipment validation', () => {
  const mismatch = runNative({
    lines,
    selectedSkillIds,
    startAttunement: 'Fire',
    rotation: ['Glyph of Storms (Air)']
  });
  assert.ok(mismatch.warnings.some((warning) => warning.message.includes('requires Air attunement')));
  const unequipped = runNative({ lines, startAttunement: 'Fire', rotation: ['Glyph of Storms'] });
  assert.ok(unequipped.warnings.some((warning) => warning.message.includes('not equipped')));
});

test('generic glyph inputs wait on the shared recharge after changing elements', () => {
  const result = runNative({
    lines,
    selectedSkillIds,
    startAttunement: 'Air',
    rotation: ['Glyph of Storms', 'Fire Attunement', 'Glyph of Storms']
  });
  assert.deepEqual(result.warnings, []);
  const air = result.steps.find((step) => step.skillId === ID.GLYPH_OF_STORMS_AIR);
  const fire = result.steps.find((step) => step.skillId === ID.GLYPH_OF_STORMS_FIRE);
  assert.ok(air && fire);
  const recharge = elementalistCatalog.skillsById.get(ID.GLYPH_OF_STORMS_AIR).cooldown / 1.25;
  assert.ok((fire.start - air.end) / 1000 >= recharge);
});

test('the resolver reads live state on each attempt and uses the selected catalog', () => {
  const root = elementalistCatalog.skillsById.get(ID.GLYPH_OF_STORMS);
  const patchedAir = { ...elementalistCatalog.skillsById.get(ID.GLYPH_OF_STORMS_AIR), cooldown: 17 };
  const catalog = { ...elementalistCatalog, skillsById: new Map(elementalistCatalog.skillsById) };
  catalog.skillsById.set(patchedAir.id, patchedAir);
  const context = { helpers: catalog, profession: { core: { primaryAttunement: 'Fire' } } };
  assert.equal(elementalistCoreHooks.resolveCastSkill(context, root).id, ID.GLYPH_OF_STORMS_FIRE);
  context.profession.core.primaryAttunement = 'Air';
  assert.equal(elementalistCoreHooks.resolveCastSkill(context, root), patchedAir);
  assert.equal(resolveSkillSelector(catalog, patchedAir, 'Fire'), patchedAir);
  catalog.skillsById.delete(patchedAir.id);
  assert.throws(() => validateElementalistGlyphs(catalog), /no valid Air choice/);
});

test('a queued generic glyph resolves again after a state transition during recharge', () => {
  const result = runElementalist(
    [{ type: 'cast', skillId: ID.GLYPH_OF_STORMS }],
    { specialization: 'Core', startAttunement: 'Fire', selectedSkillIds: Object.values(selectedSkillIds) },
    {
      initialize(runtime) {
        // Force a real readiness retry so the driver must discard its earlier Fire resolution.
        for (const id of Object.values(ELEMENTALIST_GLYPHS[ID.GLYPH_OF_STORMS]))
          runtime.cooldownController.setReadyAt(id, 2);
      },
      timeline: [
        {
          at: 1,
          run: (runtime) => {
            runtime.profession.core.primaryAttunement = 'Air';
          }
        }
      ]
    }
  );
  assert.deepEqual(result.warnings, []);
  const cast = result.steps.find((step) => step.skillId === ID.GLYPH_OF_STORMS_AIR);
  assert.ok(cast);
  assert.ok(cast.start >= 2000);
  assert.ok(!result.steps.some((step) => step.skillId === ID.GLYPH_OF_STORMS_FIRE));
});

test('old saves migrate equipped glyphs, preserve explicit rotations, and round trip without mutation', () => {
  for (const [root, variants] of Object.entries(ELEMENTALIST_GLYPHS)) {
    for (const variant of Object.values(variants)) {
      const saved = {
        ...createElementalistBuildDefaults(),
        schemaVersion: 5,
        selectedSkillIds: { ...selectedSkillIds, Utility1: variant, Utility2: null },
        rotation: [{ type: 'cast', skillId: variant, offTarget: true }]
      };
      const before = structuredClone(saved);
      const migrated = migrateElementalistBuild(saved);
      assert.equal(migrated.selectedSkillIds.Utility1, Number(root));
      assert.equal(migrated.schemaVersion, createElementalistBuildDefaults().schemaVersion);
      assert.deepEqual(migrated.rotation, saved.rotation);
      assert.deepEqual(saved, before);
      assert.equal(validateElementalistBuild(migrated).valid, true);
      assert.deepEqual(migrateElementalistBuild(JSON.parse(JSON.stringify(migrated))), migrated);
      assert.equal(toApplicationBuild(saved).selectedSkillIds.Utility1, Number(root));
    }
  }

  const saved = {
    ...createElementalistBuildDefaults(),
    schemaVersion: 5,
    selectedSkills: { Utility1: 'Glyph of Storms (Air)' },
    rotation: ['Glyph of Storms (Air)']
  };
  delete saved.selectedSkillIds;
  const migrated = migrateElementalistBuild(saved);
  assert.equal(migrated.selectedSkillIds.Utility1, ID.GLYPH_OF_STORMS);
  assert.equal(migrated.rotation[0].skillId, ID.GLYPH_OF_STORMS_AIR);
  assert.throws(
    () =>
      migrateElementalistBuild({
        ...migrated,
        selectedSkillIds: { ...migrated.selectedSkillIds, Utility1: ID.GLYPH_OF_STORMS_AIR }
      }),
    /must equip glyph roots/
  );
});

test('palette display, click, drag and modified activation retain generic input identity', () => {
  const { app } = createNativeApp({ lines, selectedSkillIds, startAttunement: 'Air' });
  app.analysis.state.results = {
    planningState: {
      availability: {},
      cooldownsBySkillId: {},
      ammoBySkillId: {},
      profession: { [STATE.PRIMARY_ATTUNEMENT]: 'Air' }
    }
  };
  const displayed = rotationSelectedSlotSkills(capturePaletteInput(app)).find(
    (skill) => skill.inputSkillId === ID.GLYPH_OF_STORMS
  );
  assert.equal(displayed.id, ID.GLYPH_OF_STORMS_AIR);
  const view = paletteSkillView(capturePaletteInput(app), displayed);
  assert.equal(view.skillId, ID.GLYPH_OF_STORMS);
  assert.equal(view.displaySkillId, ID.GLYPH_OF_STORMS_AIR);
  assert.match(paletteSkillHtml(view), /data-skill-id="5734"/);
  const added = [];
  app.addRotation = (_name, options) => added.push(options);
  const event = {
    currentTarget: {
      dataset: { skillId: String(view.skillId), displaySkillId: String(view.displaySkillId) },
      classList: { contains: () => false },
      querySelector: () => null
    },
    shiftKey: false,
    ctrlKey: false
  };
  dispatchPaletteActivation(app, displayed.name, event);
  assert.equal(added.pop().skillId, ID.GLYPH_OF_STORMS);
  let editor;
  dispatchPaletteActivation(
    app,
    displayed.name,
    { ...event, ctrlKey: true },
    {
      openActivation: (options) => {
        editor = options;
      }
    }
  );
  assert.ok(editor);
  editor.onApply(null);
  assert.equal(added.pop().skillId, ID.GLYPH_OF_STORMS);
  assert.equal(resolvePaletteDropItem(app, displayed.name, view.skillId).skillId, ID.GLYPH_OF_STORMS);
});

test('damage preview resolves generic glyph rows from detached state without duplicate selector payloads', () => {
  const { app } = createNativeApp({ lines, selectedSkillIds, startAttunement: 'Fire' });
  const before = structuredClone(app.build);
  const controls = skillDamageControls(app);
  const plan = createSkillDamagePlan(app, controls, { ...clearedValues(controls), damageAttunement: 'Air' });
  const occurrence = plan.request.occurrences.find((entry) => entry.id === `slot:${ID.GLYPH_OF_STORMS}`);
  assert.equal(occurrence.effect.id, ID.GLYPH_OF_STORMS_AIR);
  assert.equal(occurrence.config.profession.startAttunement, 'Air');
  assert.ok(
    !plan.request.occurrences.some((entry) => entry.effect.kind === 'skill' && entry.effect.id === ID.GLYPH_OF_STORMS)
  );
  assert.deepEqual(app.build, before);
});

// These assertions protect identity, migration, and reporting contracts rather than calibrating native cast times.
test('generic and explicit glyphs report identical accepted activity', () => {
  for (const [root, variants] of Object.entries(ELEMENTALIST_GLYPHS)) {
    const options = { lines, selectedSkillIds, startAttunement: 'Air' };
    const generic = runNative({ ...options, rotation: [{ type: 'cast', skillId: Number(root) }, 5000] });
    const explicit = runNative({ ...options, rotation: [{ type: 'cast', skillId: variants.Air }, 5000] });
    assert.ok(generic.rotationApm.castingTimeSeconds > 0);
    assert.deepEqual(generic.rotationApm, explicit.rotationApm);
  }
});

test('pending editors resolve concrete choices while retaining the saved command and executed choices take precedence', () => {
  const { app } = createNativeApp({ lines, selectedSkillIds, startAttunement: 'Air' });
  const command = { type: 'cast', skillId: ID.GLYPH_OF_STORMS, interruptAfterMs: 400 };
  const before = structuredClone(command);
  assert.equal(resolveEntryDisplaySkill(app, command).id, ID.GLYPH_OF_STORMS_AIR);
  assert.equal(resolveEntryDisplaySkill(app, command, ID.GLYPH_OF_STORMS_FIRE).id, ID.GLYPH_OF_STORMS_FIRE);
  assert.deepEqual(command, before);
});

test('glyph highlights group selector inputs and every explicit choice without grouping unrelated utilities', () => {
  const key = (id) => rotationSkillHighlightKey({ type: 'cast', skillId: id }, elementalistCatalog);
  for (const [root, variants] of Object.entries(ELEMENTALIST_GLYPHS))
    for (const id of Object.values(variants)) assert.equal(key(id), key(Number(root)));
  assert.notEqual(key(ID.GLYPH_OF_STORMS), key(ID.GLYPH_OF_ELEMENTAL_POWER));
});

test('root tooltip tabs retain each concrete payload facts and equipped selectors expose variant patches', () => {
  const { app } = createNativeApp({ lines, selectedSkillIds });
  for (const [root, variants] of Object.entries(ELEMENTALIST_GLYPHS)) {
    const model = app.adapter.skillTooltip(app.activeCatalog.skillsById.get(Number(root)), app.patch, app.build);
    for (const [element, id] of Object.entries(variants)) {
      const expected = app.adapter.skillTooltip(app.activeCatalog.skillsById.get(id), app.patch, app.build);
      assert.deepEqual(model.factTabs.find((tab) => tab.label === element).facts, expected.facts);
      assert.ok(expected.facts.length > 0);
    }
  }

  const patched = withPatchPreview(elementalistProfession, {
    id: 'glyph-relevance',
    label: 'Glyph relevance',
    professions: { elementalist: { skills: { [ID.GLYPH_OF_STORMS_FIRE]: { fields: { cooldown: 18 } } } } }
  });
  assert.equal(
    patched.patchOverviewFor({ selectedTraitIds: [], selectedSkillIds: [ID.GLYPH_OF_STORMS] }, []).length,
    1
  );
  assert.equal(patched.patchOverviewFor({ selectedTraitIds: [], selectedSkillIds: [] }, []).length, 0);
});

test('invalid projected attunements leave selector tiles usable from the saved build choice', () => {
  const { app } = createNativeApp({ lines, selectedSkillIds, startAttunement: 'Air' });
  for (const primary of ['', 'invalid']) {
    const projected = app.profession.ui.paletteSelectedSlotSkills(
      {
        catalog: app.activeCatalog,
        build: app.build,
        professionState: { [STATE.PRIMARY_ATTUNEMENT]: primary }
      },
      [app.activeCatalog.skillsById.get(ID.GLYPH_OF_STORMS)]
    );
    assert.equal(projected[0].id, ID.GLYPH_OF_STORMS_AIR);
  }
});

test('migration rejects duplicate glyph and stance selections instead of replacing a utility', () => {
  for (const pair of [
    [5737, 5736],
    [-1167, -1168]
  ]) {
    for (const names of [false, true]) {
      const labels =
        pair[0] > 0
          ? ['Glyph of Storms (Air)', 'Glyph of Storms (Fire)']
          : ['Primordial Stance (Water)', 'Primordial Stance (Air)'];
      const selected = names
        ? { selectedSkills: { Utility1: labels[0], Utility2: labels[1] } }
        : { selectedSkillIds: { Utility1: pair[0], Utility2: pair[1] } };
      const saved = { schemaVersion: 5, ...selected };
      const before = structuredClone(saved);
      for (const migrate of [migrateElementalistBuild, toApplicationBuild])
        assert.throws(
          () => migrate(saved),
          (error) => error instanceof SelectedSkillMigrationError && /Duplicate/.test(error.message)
        );
      assert.deepEqual(saved, before);
    }
  }
});

test('future schema errors are owned by the shared codec before glyph selection validation', () => {
  for (const migrate of [migrateElementalistBuild, toApplicationBuild])
    assert.throws(
      () => migrate({ schemaVersion: 99, selectedSkillIds: { Utility1: ID.GLYPH_OF_STORMS_AIR } }),
      (error) =>
        !(error instanceof SelectedSkillMigrationError) && /Unsupported build schema version/.test(error.message)
    );
});

// Immutable catalog identity makes repeated optimizer initialization cheap without trusting another patch's validation.
test('glyph validation caches successful catalogs and still rejects a distinct invalid catalog', () => {
  let reads = 0;
  class ObservedMap extends Map {
    get(id) {
      reads++;
      return super.get(id);
    }
  }
  const skillsById = new ObservedMap(elementalistCatalog.skillsById);
  validateElementalistGlyphs({ skillsById });
  const validatedReads = reads;
  assert.ok(validatedReads > 0);
  validateElementalistGlyphs({ skillsById });
  assert.equal(reads, validatedReads);
  const invalid = new Map(skillsById);
  invalid.delete(ID.GLYPH_OF_STORMS_AIR);
  assert.throws(() => validateElementalistGlyphs({ skillsById: invalid }), /no valid Air choice/);
});
