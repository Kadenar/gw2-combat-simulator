import assert from 'node:assert/strict';
import test from 'node:test';
import { createCanonicalCatalog } from '#gw2/platform/engine/skills/canonical-skill-catalog.js';
import { materializeSkillEffectApplications } from '#gw2/platform/engine/effects/materializer.js';
import { applyBalanceProfilePatch, applySkillPatch } from '#gw2/integrations/patches/authoring/patches.js';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import { defineNativeModule, defineNativeProfession } from '#gw2/platform/profession-definition/profession.js';
import {
  balanceProfileFromContext,
  balanceProfileNumberFromContext,
  effectNumberFromContext,
  requireBalanceProfileFromContext,
  requireEffectFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';

const first = { type: 'condition', name: 'First', condition: 'Burning', stacks: 1, duration: 2 };
const second = { type: 'condition', name: 'Second', condition: 'Bleeding', stacks: 2, duration: 3 };
const profile = {
  id: 1,
  name: 'Profile',
  profileKind: 'trait',
  procChance: 0,
  intervalMs: 0,
  effects: [first, second]
};
const skill = { id: 1, name: 'Skill', effects: [first, second] };
const fixture = () => createCanonicalCatalog({ generated: [skill], balanceProfiles: [profile] });

// The same ID and keys in different owner kinds must retain independent removal histories.
for (const [kind, section, apply, index] of [
  ['skill', 'skills', applySkillPatch, 'skillsById'],
  ['balance-profile', 'balanceProfiles', applyBalanceProfilePatch, 'balanceProfilesById']
]) {
  test(`${kind}: named removal, replacement, empty lists and successive overlays preserve identity`, () => {
    const live = fixture();
    const patch = (catalog, edit) => apply(catalog, { [section]: { 1: edit } });
    const read = (catalog, name) => requireEffectFromContext({ catalog }, kind, 1, 'condition', name);
    const packets = (catalog) =>
      ['First', 'Second'].flatMap((name) => {
        const effect = read(catalog, name);
        return effect ? materializeSkillEffectApplications({ skill, effect, start: 0, fullEnd: 0, baseEvent: {} }) : [];
      });
    const removed = patch(live, { removeEffects: [{ name: 'First' }] });
    assert.equal(read(removed, 'First'), undefined);
    assert.deepEqual(read(removed, 'Second'), second);
    assert.deepEqual(
      packets(removed),
      packets(live).filter((packet) => packet.event.condition === 'Bleeding')
    );
    assert.deepEqual(read(live, 'First'), first);
    assert.throws(() => read(removed, 'Typo'), /unknown effect key/);
    assert.deepEqual(
      requireEffectFromContext(
        { catalog: removed },
        kind === 'skill' ? 'balance-profile' : 'skill',
        1,
        'condition',
        'First'
      ),
      first
    );
    const edited = patch(removed, { effects: [{ name: 'Second', duration: 4 }] });
    assert.equal(read(edited, 'First'), undefined);
    assert.equal(read(edited, 'Second').duration, 4);
    const empty = patch(edited, { removeEffects: [{ name: 'Second' }] });
    assert.deepEqual(empty[index].get(1).effects, []);
    assert.equal(read(empty, 'First'), undefined);
    assert.equal(read(empty, 'Second'), undefined);
    assert.deepEqual(packets(empty), []);
    const replacement = { ...first, duration: 7 };
    for (const restored of [
      patch(live, { removeEffects: [{ name: 'First' }], addEffects: [replacement] }),
      patch(empty, { addEffects: [replacement] })
    ]) {
      assert.deepEqual(read(restored, 'First'), replacement);
      assert.equal(restored[index].get(1).removedEffectKeys.includes(JSON.stringify(['condition', 'First'])), false);
    }

    assert.throws(() => patch(live, { addEffects: [first] }), /duplicate effect key/);
    assert.throws(() => patch(live, { removeEffects: [{ name: 'Typo' }] }), /did not match an effect/);
    assert.equal(Object.isFrozen(empty[index].get(1).removedEffectKeys), true);
  });

  test(`${kind}: validate retained and added packets, including timelines and flat-only strikes`, () => {
    const live = fixture();
    const patch = (edit, catalog = live) => apply(catalog, { [section]: { 1: edit } });
    for (const duration of [undefined, null, '', false, '2', NaN, Infinity, 0, -1]) {
      assert.throws(() => patch({ addEffects: [{ ...first, name: 'Invalid', duration }] }), /duration/);
    }

    assert.throws(() => patch({ effects: [{ name: 'First', duration: 0 }] }), /positive stacks and duration/);
    assert.throws(
      () => patch({ addEffects: [{ type: 'strike', name: 'Invalid', coefficient: Infinity }] }),
      /coefficient/
    );
    assert.throws(
      () => patch({ addEffects: [{ type: 'strike', ticks: [{ atMs: 0, coefficient: '1' }] }] }),
      /coefficient/
    );
    assert.throws(
      () => patch({ addEffects: [{ type: 'strike', ticks: [{ atMs: 0, coefficient: 1, flatDamage: '3' }] }] }),
      /flatDamage/
    );
    assert.throws(
      () => patch({ addEffects: [{ type: 'condition', ticks: [{ atMs: 0, condition: 'Burning', stacks: 1 }] }] }),
      /duration/
    );
    const patched = patch({
      addEffects: [
        { type: 'strike', name: 'Flat', flatDamage: 0 },
        { type: 'strike', name: 'Timeline', ticks: [{ atMs: 0, coefficient: 0 }] },
        { type: 'condition', name: 'Timeline', ticks: [{ atMs: 0, condition: 'Burning', stacks: 1, duration: 2 }] },
        { type: 'boon', name: 'Status', boon: 'might', duration: 2 },
        { type: 'custom', name: 'Recurrence', eventType: 'fixture', event: {}, intervalMs: 0 }
      ]
    });
    assert.equal(requireEffectFromContext({ catalog: patched }, kind, 1, 'strike', 'Flat').coefficient, undefined);
    assert.equal(requireEffectFromContext({ catalog: patched }, kind, 1, 'strike', 'Flat').hits, 1);
    assert.equal(requireEffectFromContext({ catalog: patched }, kind, 1, 'boon', 'Status').stacks, 1);
    // Custom packets need both dispatch fields in declarations, patches, and direct procedural reads.
    const custom = { type: 'custom', name: 'Custom', eventType: 'fixture', event: {} };
    for (const field of ['eventType', 'event']) {
      for (const value of [undefined, null, false, 3, '', [], ...(field === 'eventType' ? [' ', {}] : ['payload'])]) {
        const invalid = { ...custom, [field]: value };
        const error = new RegExp(`effect=custom/Custom.*field=${field}`);
        assert.throws(() => patch({ addEffects: [invalid] }), error);
        assert.throws(
          () =>
            createCanonicalCatalog({
              generated: kind === 'skill' ? [{ ...skill, effects: [invalid] }] : [],
              balanceProfiles: kind === 'balance-profile' ? [{ ...profile, effects: [invalid] }] : []
            }),
          error
        );
        const owner = { ...live[index].get(1), effects: [invalid] };
        const catalog = { ...live, [index]: new Map([[1, owner]]), [section]: [owner] };
        assert.throws(() => requireEffectFromContext({ catalog }, kind, 1, 'custom', 'Custom'), error);
        assert.deepEqual(patch({ removeEffects: [{ name: 'Custom' }] }, catalog)[index].get(1).effects, []);
      }
    }

    const customCatalog = patch({ addEffects: [custom] });
    assert.deepEqual(requireEffectFromContext({ catalog: customCatalog }, kind, 1, 'custom', 'Custom'), custom);
    // Removing invalid source data is valid; retaining it is rejected before exposing an overlay.
    const brokenOwner = { ...live[index].get(1), effects: [{ ...first, duration: null }, second] };
    const broken = { ...live, [index]: new Map([[1, brokenOwner]]), [section]: [brokenOwner] };
    assert.throws(() => patch({}, broken), /duration/);
    assert.deepEqual(patch({ removeEffects: [{ name: 'First' }] }, broken)[index].get(1).effects, [second]);
  });
}

test('required reads select one source and retain strict numeric and diagnostic contracts', () => {
  const catalog = fixture();
  const selected = {
    ...catalog,
    balanceProfilesById: new Map(),
    balanceDataContext: { professionId: 'fixture', patchId: 'preview' }
  };
  const context = { catalog: selected, helpers: catalog, profession: { catalog }, balanceProfile: () => profile };
  assert.equal(balanceProfileFromContext(context, 1), undefined);
  assert.throws(() => requireBalanceProfileFromContext(context, 1), /profession=fixture patch=preview profile=1/);
  assert.throws(() => requireBalanceProfileFromContext(null, 1), /missing required profile\/catalog/);
  assert.throws(
    () => requireEffectFromContext({}, 'skill', 1, 'condition', 'First'),
    /missing required skill\/catalog/
  );
  for (const source of [
    { catalog },
    { helpers: catalog },
    { profession: { catalog } },
    { runtime: { profession: { catalog } } },
    { balanceProfile: () => profile },
    () => profile
  ]) {
    assert.equal(requireBalanceProfileFromContext(source, 1).id, 1);
    assert.equal(balanceProfileNumberFromContext(source, 1, 'procChance'), 0);
    assert.equal(balanceProfileNumberFromContext(source, 1, 'intervalMs'), 0);
  }

  for (const value of [undefined, null, false, '', '3', NaN, Infinity]) {
    const source = { catalog: { ...selected, balanceProfilesById: new Map([[1, { ...profile, procChance: value }]]) } };
    assert.throws(
      () => balanceProfileNumberFromContext(source, 1, 'procChance'),
      /profession=fixture patch=preview profile=1 field=procChance expected=finite number received=/
    );
    assert.throws(
      () => effectNumberFromContext(source, 'balance-profile', 1, { ...first, duration: value }, 'duration'),
      /effect=condition\/First field=duration/
    );
  }

  assert.equal(effectNumberFromContext({ catalog }, 'skill', 1, { type: 'strike', coefficient: 0 }, 'coefficient'), 0);
  const removed = applyBalanceProfilePatch(catalog, { balanceProfiles: { 1: { removeEffects: [{ name: 'First' }] } } });
  assert.equal(
    requireEffectFromContext((id) => removed.balanceProfilesById.get(id), 'balance-profile', 1, 'condition', 'First'),
    undefined
  );
  assert.throws(
    () =>
      requireEffectFromContext(
        () => ({ ...profile, effects: [first, first] }),
        'balance-profile',
        1,
        'condition',
        'First'
      ),
    /duplicate effect key/
  );
  assert.throws(
    () =>
      requireEffectFromContext(
        () => ({ ...profile, effects: [{ ...first, duration: null }] }),
        'balance-profile',
        1,
        'condition',
        'First'
      ),
    /duration/
  );
});

test('full previews and selected runtimes preserve removals without leaking across patches or specializations', () => {
  const family = withPatchPreview(
    defineNativeProfession({
      id: 'fixture',
      name: 'Fixture',
      modules: [
        defineNativeModule({ id: 'Core', data: {}, state: { scheduler: () => ({}) } }),
        defineNativeModule({
          id: 'Elite',
          data: { generatedSkills: [skill], balanceProfiles: [profile, { ...profile, id: 2, name: 'Unedited' }] },
          state: { scheduler: () => ({}) }
        })
      ]
    }),
    {
      id: 'preview',
      label: 'Preview',
      professions: {
        fixture: {
          skills: { 1: { removeEffects: [{ name: 'First' }] } },
          balanceProfiles: { 1: { removeEffects: [{ name: 'First' }] } }
        }
      }
    }
  );
  for (const catalog of [
    family.catalogFor('preview'),
    family.resolveRuntime({ specialization: 'Elite', patchId: 'preview' }).catalog
  ]) {
    for (const kind of ['skill', 'balance-profile']) {
      assert.equal(requireEffectFromContext({ catalog }, kind, 1, 'condition', 'First'), undefined);
      assert.deepEqual(requireEffectFromContext({ catalog }, kind, 1, 'condition', 'Second'), second);
      assert.throws(
        () => requireEffectFromContext({ catalog }, kind, 1, 'condition', 'Typo'),
        /profession=fixture patch=preview/
      );
    }

    // Both callback forms retain provenance for edited and unedited profiles in the selected catalog.
    const lookup = (id) => catalog.balanceProfilesById.get(id);
    for (const context of [lookup, { balanceProfile: lookup }]) {
      for (const id of [1, 2]) {
        assert.throws(
          () => balanceProfileNumberFromContext(context, id, 'missing'),
          /profession=fixture patch=preview/
        );
        assert.throws(
          () => requireEffectFromContext(context, 'balance-profile', id, 'condition', 'Typo'),
          /profession=fixture patch=preview/
        );
        const effect = requireEffectFromContext(context, 'balance-profile', id, 'condition', 'Second');
        assert.throws(
          () => effectNumberFromContext(context, 'balance-profile', id, effect, 'missing'),
          /profession=fixture patch=preview/
        );
      }
    }
  }

  for (const catalog of [family.catalogFor(), family.resolveRuntime({ specialization: 'Elite' }).catalog]) {
    assert.deepEqual(requireEffectFromContext({ catalog }, 'skill', 1, 'condition', 'First'), first);
    assert.deepEqual(requireEffectFromContext({ catalog }, 'balance-profile', 1, 'condition', 'First'), first);
  }

  const core = family.resolveRuntime({ specialization: 'Core', patchId: 'preview' });
  assert.equal(core.catalog.skillsById.has(1), false);
  assert.equal(core.catalog.balanceProfilesById.has(1), false);
  for (const section of ['skills', 'balanceProfiles']) {
    assert.throws(
      () => family.validatePatch({ [section]: { 1: { addEffects: [{ type: 'custom', name: 'Incomplete' }] } } }),
      /profession=fixture patch=preview.*field=eventType/
    );
    assert.throws(
      () => family.validatePatch({ [section]: { missing: { effects: [] } } }),
      /profession=fixture patch=preview.*unknown/
    );
  }

  assert.throws(
    () => family.validatePatch({ balanceProfiles: { 1: { fields: { procChance: Infinity } } } }),
    /profession=fixture patch=preview.*procChance/
  );
});

test('profile callbacks follow the latest overlay and never label an opaque source as current', () => {
  const live = fixture();
  const withSource = (catalog, patchId) => ({ ...catalog, balanceDataContext: { professionId: 'fixture', patchId } });
  const firstPatch = applyBalanceProfilePatch(withSource(live, 'first'), {
    balanceProfiles: { 1: { removeEffects: [{ name: 'First' }] } }
  });
  const secondPatch = applyBalanceProfilePatch(withSource(firstPatch, 'second'), {
    balanceProfiles: { 1: { effects: [{ name: 'Second', duration: 4 }] } }
  });
  const uneditedPatch = applyBalanceProfilePatch(withSource(secondPatch, 'unedited'), {});
  for (const [catalog, patchId] of [
    [firstPatch, 'first'],
    [secondPatch, 'second'],
    [uneditedPatch, 'unedited']
  ]) {
    const lookup = (id) => catalog.balanceProfilesById.get(id);
    assert.throws(
      () => balanceProfileNumberFromContext(lookup, 1, 'missing'),
      new RegExp(`profession=fixture patch=${patchId}`)
    );
    assert.equal(requireEffectFromContext(lookup, 'balance-profile', 1, 'condition', 'First'), undefined);
  }

  assert.equal(live.balanceProfilesById.get(1).balanceDataContext, undefined);
  assert.throws(() => requireBalanceProfileFromContext(() => undefined, 1), /patch=<unknown>/);
});
