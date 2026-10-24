import assert from 'node:assert/strict';
import test from 'node:test';
import { previewAssumptionNotice } from '#gw2/app/patch-preview/assumptions.js';
import {
  canonicalAssumptionValue,
  displayAssumptionValue,
  previewAssumptionCounts,
  previewAssumptionGroups
} from '#gw2/app/patch-preview/assumptions-model.js';
import { renderPatchComparison } from '#gw2/app/patch-preview/view.js';
import { defineProfessionApp } from '#gw2/app/define-profession-app.js';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import { replaceProvisionalEffect } from '#gw2/integrations/patches/authoring/provisional-values.js';
import { guardianAppAdapter as adapter } from '#gw2/professions/guardian/app/app-definition.js';
import { guardianProfession } from '#gw2/professions/guardian/profession.js';
import { engineerAppAdapter } from '#gw2/professions/engineer/app/app-definition.js';
import { revenantAppAdapter } from '#gw2/professions/revenant/app/app-definition.js';
import { grenadier } from '#gw2/professions/engineer/core/traits/explosives/index.js';
import { engineerExplosivesTooltips } from '#gw2/professions/engineer/app/tooltips/explosives.js';
import { FIREBRAND_REWORK_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/specializations/firebrand/ids.js';
import { GUARDIAN_SKILL_IDS as SKILL } from '#gw2/professions/guardian/data/ids.js';

const profession = adapter.profession;
const preview = profession.preview;

// Capture content and event wiring without asserting browser layout, focus, or native input behavior.
function element(tag) {
  return {
    tag,
    children: [],
    dataset: {},
    listeners: {},
    append(...children) {
      this.children.push(...children);
    },
    prepend(child) {
      this.children.unshift(child);
    },
    setAttribute() {},
    querySelector() {
      return null;
    },
    addEventListener(name, callback) {
      this.listeners[name] = callback;
    },
    createTBody() {
      const child = element('tbody');
      this.append(child);
      return child;
    },
    insertRow() {
      const child = element('tr');
      this.append(child);
      return child;
    },
    insertCell() {
      const child = element('td');
      this.append(child);
      return child;
    }
  };
}

function appFor(patchId = 'current') {
  const build = adapter.toApplicationBuild(profession.createBuildDefaults());
  build.specializations = [{ name: 'Firebrand', traits: '2-1-1', patchTraits: { [preview.id]: '2-1-1' } }];
  return {
    adapter,
    profession,
    contentId: 'guardian',
    build,
    patch: profession.resolvePatch({ id: patchId, values: { fervidCharges: 3 } }),

    changed() {}
  };
}

test('Preview comparison notes use preview trait positions and experimental tuning', () => {
  const app = appFor(preview.id);
  app.patchComparison = { current: { dps: 0, events: [] }, preview: { dps: 0, events: [] } };
  const container = element('div');
  const previous = globalThis.document;
  globalThis.document = { createElement: element };
  try {
    renderPatchComparison(container, app);
  } finally {
    globalThis.document = previous;
  }

  const html = container.children[0].innerHTML;
  assert.match(html, /Fervid Conviction/);
  assert.match(html, /Righteous Flames/);
  assert.doesNotMatch(html, /Stoic Demeanor/);
  assert.match(html, /[Ss]tacks set to 3/);
  assert.equal((html.match(/[Ss]tacks set to 3/g) ?? []).length, 1);
});

// Live choices never fill a relaid preview line, so the comparison asks for them instead of reporting an empty line.
test('Preview comparison asks for relaid trait choices before reporting DPS', () => {
  const app = appFor(preview.id);
  delete app.build.specializations[0].patchTraits;
  app.patchComparison = { current: { dps: 1000, events: [] }, preview: { dps: 500, events: [] } };
  const container = element('div');
  const previous = globalThis.document;
  globalThis.document = { createElement: element };
  try {
    renderPatchComparison(container, app);
  } finally {
    globalThis.document = previous;
  }

  const html = container.children[0].innerHTML;
  assert.match(html, /Choose Firebrand traits for /);
  assert.doesNotMatch(html, /500/);
});

// Relevance follows the preview's reworked trait positions, including opt-outs for passive minor traits.
test('assumption counts include only equipped preview traits and their overrides', () => {
  const app = appFor(preview.id);
  const groups = previewAssumptionGroups(app);
  assert.deepEqual(
    groups.filter(({ selected }) => selected).map(({ name }) => name),
    ['Imbued Haste', 'Righteous Flames', 'Fervid Conviction']
  );
  assert.deepEqual(previewAssumptionCounts(groups), { total: 4, custom: 1 });
  const ashes = groups.find(({ name }) => name === 'Righteous Flames').values;
  assert.deepEqual(
    ashes.map(({ parameter, value }) => [parameter.id, parameter.unit, value]),
    [
      ['ashesDuration', 's', 3],
      ['ashesStacks', 'stacks', 1]
    ]
  );
  assert.match(previewAssumptionNotice(app), /1 user override/);

  app.build.specializations[0] = {
    name: 'Firebrand',
    traits: '1-2-3',
    disabledMinorTraits: [2],
    patchTraits: { [preview.id]: '1-2-3' }
  };
  const other = previewAssumptionGroups(app);
  assert.deepEqual(
    other.filter(({ selected }) => selected).map(({ name }) => name),
    ['Unrelenting Criticism', 'Stalwart Speed']
  );
  assert.deepEqual(previewAssumptionCounts(other), { total: 3, custom: 0 });
  assert.match(previewAssumptionNotice(app), /Preview defaults/);
  assert.equal(other.find(({ name }) => name === 'Fervid Conviction').values[0].value, 3);

  app.build.specializations = [];
  assert.deepEqual(previewAssumptionGroups(app), []);
  assert.equal(previewAssumptionNotice(app), '');
  assert.deepEqual(previewAssumptionCounts(previewAssumptionGroups(app)), { total: 0, custom: 0 });
});

// Removing a trait line hides all its controls, while selecting it retains alternate traits for tuning.
for (const [testAdapter, contentId, equipped, unrelated] of [
  [revenantAppAdapter, 'revenant', 'Vindicator', ['Corruption', 'Invocation', 'Renegade']],
  [adapter, 'guardian', 'Firebrand', ['Radiance', 'Virtues', 'Dragonhunter']],
  [engineerAppAdapter, 'engineer', 'Explosives', ['Firearms', 'Tools', 'Mechanist']]
]) {
  test(`${contentId} preview assumptions follow equipped trait lines`, () => {
    const profession = testAdapter.profession;
    const app = {
      profession,
      contentId,
      patch: profession.resolvePatch({ id: profession.preview.id }),
      build: { specializations: unrelated.map((name) => ({ name, traits: '1-1-1' })) }
    };
    assert.deepEqual(previewAssumptionGroups(app), []);
    assert.equal(previewAssumptionNotice(app), '');

    app.build.specializations[0] = { name: equipped, traits: '0-0-0', disabledMinorTraits: [0, 1, 2] };
    const groups = previewAssumptionGroups(app);
    assert.ok(groups.length > 0);
    assert.ok(groups.every(({ values }) => values.every(({ parameter }) => parameter.specialization === equipped)));
    assert.ok(groups.every(({ selected }) => !selected));

    app.build.specializations[0] = { name: unrelated[0], traits: '1-1-1' };
    assert.deepEqual(previewAssumptionGroups(app), []);
    assert.equal(previewAssumptionNotice(app), '');
  });
}

test('Live clears overrides and does not show an assumptions result notice', () => {
  const app = appFor(preview.id);
  app.patch = profession.resolvePatch({ id: 'current', values: app.patch.values });
  assert.equal(app.patch.values, undefined);
  assert.equal(previewAssumptionNotice(app), '');
  app.patch = profession.resolvePatch({ id: preview.id });
  assert.deepEqual(previewAssumptionCounts(previewAssumptionGroups(app)), { total: 4, custom: 0 });
});

// Engineer and Firebrand bonuses share fractional units through edits and resets.
test('Grenadier edits percentage bonuses using the same fractional units as Firebrand', () => {
  const profession = engineerAppAdapter.profession;
  const app = {
    profession,
    contentId: 'engineer',
    patch: profession.resolvePatch({ id: profession.preview.id }),
    build: { specializations: [{ name: 'Explosives', traits: '1-1-1' }] }
  };
  const { parameter, value } = previewAssumptionGroups(app)[0].values[0];
  assert.equal(displayAssumptionValue(parameter, value), 10);
  assert.equal(displayAssumptionValue(parameter, parameter.minimum), 0);
  const changed = canonicalAssumptionValue(parameter, 15);
  assert.equal(changed, 0.15);
  app.patch = profession.resolvePatch({ id: profession.preview.id, values: { [parameter.id]: changed } });
  assert.equal(app.patch.catalog.balanceProfiles.find(({ id }) => String(id) === '514').damageIncrease, 0.15);
  assert.equal(grenadier.modifierRules[0].factor({ catalog: app.patch.catalog }), 1.15);
  assert.match(
    engineerExplosivesTooltips[514]({ catalog: app.patch.catalog }).facts.find(
      ({ name }) => name === 'Explosion strike damage'
    ).detail,
    /15%/
  );
  assert.deepEqual(previewAssumptionCounts(previewAssumptionGroups(app)), { total: 1, custom: 1 });
  app.patch = profession.resolvePatch({ id: profession.preview.id });
  assert.equal(displayAssumptionValue(parameter, previewAssumptionGroups(app)[0].values[0].value), 10);
  assert.equal(grenadier.modifierRules[0].factor({ catalog: profession.resolvePatch({ id: 'current' }).catalog }), 1);

  const percent = preview.professions.guardian.provisional.find(({ id }) => id === 'bleedingDuration');
  assert.equal(displayAssumptionValue(percent, 0.33), 33);
  assert.equal(canonicalAssumptionValue(percent, 33), 0.33);
});

test('session effect edits preserve other fields and authored assumptions without duplicating selectors', () => {
  const parameter = preview.professions.guardian.provisional.find(({ id }) => id === 'fervidCharges');
  const unrelated = { type: 'boon', boon: 'Quickness', duration: 9 };
  const edits = [{ ...parameter.effect, stacks: 1, duration: 7 }, unrelated];
  assert.deepEqual(replaceProvisionalEffect(edits, parameter, 3), [
    unrelated,
    { ...parameter.effect, stacks: 3, duration: 7 }
  ]);
  const notes = profession.patchOverviewFor(
    {
      specialization: 'Firebrand',
      patchId: preview.id,
      selectedTraitIds: [TRAIT.FERVID_CONVICTION],
      previewValues: { fervidCharges: 3 }
    },
    []
  );
  const text = notes.find(({ subject }) => subject === 'Fervid Conviction').text;
  assert.ok(text.includes(preview.professions.guardian.balanceProfiles[TRAIT.FERVID_CONVICTION].assumption));
  assert.match(text, /Session values override/);
});

test('provisional declarations validate profiles, selectors and patched defaults during construction', () => {
  const source = preview.professions.guardian;
  const parameter = source.provisional.find(({ id }) => id === 'fervidCharges');
  const make = (control, balanceProfiles = source.balanceProfiles) => ({
    ...preview,
    professions: { guardian: { ...source, provisional: [control], balanceProfiles } }
  });
  for (const [control, pattern] of [
    [{ ...parameter, traitId: 'missing' }, /Unknown provisional trait/],
    [{ ...parameter, traitId: '' }, /Invalid provisional parameter/],
    [{ ...parameter, profileId: 'missing' }, /Unknown provisional profile/],
    [{ ...parameter, effect: { type: 'condition', condition: 'missing' } }, /select one effect/],
    [{ ...parameter, field: 'missing' }, /numeric field/],
    [{ ...parameter, minimum: 8, maximum: 9 }, /outside its allowed range/]
  ]) {
    assert.throws(() => withPatchPreview(guardianProfession, make(control)), pattern);
    assert.throws(() => profession.validatePatch(make(control).professions.guardian), pattern);
  }

  const patched = make(
    { ...parameter, minimum: 3, maximum: 3 },
    {
      ...source.balanceProfiles,
      [parameter.profileId]: { effects: [{ ...parameter.effect, stacks: 3 }] }
    }
  );
  assert.doesNotThrow(() => withPatchPreview(guardianProfession, patched));
  assert.equal(profession.validatePatch(patched.professions.guardian), true);
  const ambiguous = make(
    { ...parameter, effect: { type: 'buff' } },
    {
      ...source.balanceProfiles,
      [parameter.profileId]: { addEffects: [{ type: 'buff', name: 'second', kind: 'second', stacks: 1, duration: 1 }] }
    }
  );
  assert.throws(() => withPatchPreview(guardianProfession, ambiguous), /select one effect/);
});

test('skill tooltip caches distinguish experimental balance contexts', () => {
  const tunedAdapter = defineProfessionApp({
    profession,
    createBuildContext: adapter.createBuildContext,
    toApplicationBuild: adapter.toApplicationBuild,
    tooltips: {
      traits: {},
      reworks: { 'firebrand-rework': { traits: {} } },
      skills: {
        [SKILL.SEARING_SPELL]: (context) => ({
          description: String(context.catalog.balanceProfilesById.get(TRAIT.FERVID_CONVICTION).effects[0].stacks),
          facts: []
        })
      }
    }
  });
  const skill = profession.resolvePatch({ id: preview.id }).catalog.skillsById.get(SKILL.SEARING_SPELL);
  const initial = tunedAdapter.skillTooltip(
    skill,
    tunedAdapter.profession.resolvePatch({ id: preview.id, values: { fervidCharges: 2 } }),
    undefined
  );
  const updated = tunedAdapter.skillTooltip(
    skill,
    tunedAdapter.profession.resolvePatch({ id: preview.id, values: { fervidCharges: 3 } }),
    undefined
  );
  assert.equal(initial.description, '2');
  assert.equal(updated.description, '3');
  assert.equal(
    tunedAdapter.skillTooltip(
      skill,
      tunedAdapter.profession.resolvePatch({ id: preview.id, values: { fervidCharges: 2 } }),
      undefined
    ),
    initial
  );
});
