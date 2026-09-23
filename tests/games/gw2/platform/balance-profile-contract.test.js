import assert from 'node:assert/strict';
import test from 'node:test';
import { createCanonicalCatalog } from '#gw2/platform/engine/skills/canonical-skill-catalog.js';
import { materializeSkillEffectApplications } from '#gw2/platform/engine/effects/materializer.js';
import { applyBalanceProfilePatch, applySkillPatch } from '#gw2/integrations/patches/authoring/patches.js';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import { defineNativeModule, defineNativeProfession } from '#gw2/platform/profession-definition/profession.js';
import {
  balanceProfileFromContext,
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
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
// Callers select an owner once; skills come from the catalog, profiles from the context-based resolver.
const ownerOf = (catalog, kind) =>
  kind === 'skill' ? catalog.skillsById.get(1) : requireBalanceProfileFromContext({ catalog }, 1);

test('resolved owners preserve strict effect reads without another catalog lookup', () => {
  const catalog = applyBalanceProfilePatch(
    { ...fixture(), balanceDataContext: { professionId: 'fixture', patchId: 'preview' } },
    { balanceProfiles: { 1: { removeEffects: [{ name: 'First' }] } } }
  );
  let lookups = 0;
  const selected = requireBalanceProfileFromContext(() => {
    assert.equal(++lookups, 1);
    return catalog.balanceProfilesById.get(1);
  }, 1);
  assert.equal(requireEffect(selected, 'condition', 'First'), undefined);
  const effect = requireEffect(selected, 'condition', 'Second');
  assert.deepEqual(effect, second);
  assert.equal(effectNumber(selected, effect, 'duration'), 3);
  assert.equal(effectNumber(selected, { ...effect, atMs: 0 }, 'atMs'), 0);
  assert.equal(balanceProfileNumber(selected, 'intervalMs'), 0);
  assert.throws(
    () => balanceProfileNumber(selected, 'missing'),
    /profession=fixture patch=preview profile=1 field=missing expected=finite number/
  );
  assert.throws(
    () => requireEffect(selected, 'condition', 'Typo'),
    /profession=fixture patch=preview balance-profile=1 effect=condition\/Typo unknown effect key/
  );
  for (const value of [undefined, null, false, '', '3', NaN, Infinity]) {
    assert.throws(
      () => effectNumber(selected, { ...effect, duration: value }, 'duration'),
      /profession=fixture patch=preview balance-profile=1 effect=condition\/Second field=duration expected=finite number/
    );
  }

  assert.equal(lookups, 1);

  // Skill records use the same checks and label diagnostics from their own source metadata.
  for (const owner of [selected, { ...skill, balanceDataContext: selected.balanceDataContext }]) {
    assert.throws(
      () => requireEffect({ ...owner, effects: [second, second] }, 'condition', 'Second'),
      /duplicate effect key/
    );
    assert.throws(
      () => requireEffect({ ...owner, effects: [{ ...second, duration: null }] }, 'condition', 'Second'),
      /duration/
    );
    assert.equal(
      requireEffect(
        { ...owner, effects: [{ type: 'boon', name: 'Status', boon: 'might', duration: 2 }] },
        'boon',
        'Status'
      ).stacks,
      1
    );
    assert.throws(() => effectNumber(owner, second, 'missing'), /profession=fixture patch=preview/);
  }
});

// The same ID and keys in different owner kinds must retain independent removal histories.
for (const [kind, section, apply, index] of [
  ['skill', 'skills', applySkillPatch, 'skillsById'],
  ['balance-profile', 'balanceProfiles', applyBalanceProfilePatch, 'balanceProfilesById']
]) {
  test(`${kind}: named removal, replacement, empty lists and successive overlays preserve identity`, () => {
    const live = fixture();
    const patch = (catalog, edit) => apply(catalog, { [section]: { 1: edit } });
    const read = (catalog, name) => requireEffect(ownerOf(catalog, kind), 'condition', name);
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
      requireEffect(ownerOf(removed, kind === 'skill' ? 'balance-profile' : 'skill'), 'condition', 'First'),
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
    const patchedOwner = ownerOf(patched, kind);
    assert.equal(requireEffect(patchedOwner, 'strike', 'Flat').coefficient, undefined);
    assert.equal(requireEffect(patchedOwner, 'strike', 'Flat').hits, 1);
    assert.equal(requireEffect(patchedOwner, 'boon', 'Status').stacks, 1);
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
        assert.throws(() => requireEffect(owner, 'custom', 'Custom'), error);
        assert.deepEqual(patch({ removeEffects: [{ name: 'Custom' }] }, catalog)[index].get(1).effects, []);
      }
    }

    const customCatalog = patch({ addEffects: [custom] });
    assert.deepEqual(requireEffect(ownerOf(customCatalog, kind), 'custom', 'Custom'), custom);
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
  for (const source of [
    { catalog },
    { helpers: catalog },
    { profession: { catalog } },
    { runtime: { profession: { catalog } } },
    { balanceProfile: () => profile },
    () => profile
  ]) {
    const selectedProfile = requireBalanceProfileFromContext(source, 1);
    assert.equal(selectedProfile.id, 1);
    assert.equal(balanceProfileNumber(selectedProfile, 'procChance'), 0);
    assert.equal(balanceProfileNumber(selectedProfile, 'intervalMs'), 0);
  }

  for (const value of [undefined, null, false, '', '3', NaN, Infinity]) {
    const invalid = { ...profile, procChance: value, balanceDataContext: selected.balanceDataContext };
    const source = { catalog: { ...selected, balanceProfilesById: new Map([[1, invalid]]) } };
    assert.throws(
      () => balanceProfileNumber(requireBalanceProfileFromContext(source, 1), 'procChance'),
      /profession=fixture patch=preview profile=1 field=procChance expected=finite number received=/
    );
    assert.throws(
      () => effectNumber(requireBalanceProfileFromContext(source, 1), { ...first, duration: value }, 'duration'),
      /effect=condition\/First field=duration/
    );
  }

  assert.equal(effectNumber(catalog.skillsById.get(1), { type: 'strike', coefficient: 0 }, 'coefficient'), 0);
  const removed = applyBalanceProfilePatch(catalog, { balanceProfiles: { 1: { removeEffects: [{ name: 'First' }] } } });
  assert.equal(
    requireEffect(
      requireBalanceProfileFromContext((id) => removed.balanceProfilesById.get(id), 1),
      'condition',
      'First'
    ),
    undefined
  );
  assert.throws(
    () =>
      requireEffect(
        requireBalanceProfileFromContext(() => ({ ...profile, effects: [first, first] }), 1),
        'condition',
        'First'
      ),
    /duplicate effect key/
  );
  assert.throws(
    () =>
      requireEffect(
        requireBalanceProfileFromContext(() => ({ ...profile, effects: [{ ...first, duration: null }] }), 1),
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
      const owner = ownerOf(catalog, kind);
      assert.equal(requireEffect(owner, 'condition', 'First'), undefined);
      assert.deepEqual(requireEffect(owner, 'condition', 'Second'), second);
      // Only balance profiles carry patch metadata, so skill diagnostics name the owner and effect alone.
      assert.throws(
        () => requireEffect(owner, 'condition', 'Typo'),
        kind === 'skill' ? /skill=1 effect=condition\/Typo unknown effect key/ : /profession=fixture patch=preview/
      );
    }

    // Both callback forms retain provenance for edited and unedited profiles in the selected catalog.
    const lookup = (id) => catalog.balanceProfilesById.get(id);
    for (const context of [lookup, { balanceProfile: lookup }]) {
      for (const id of [1, 2]) {
        const selectedProfile = requireBalanceProfileFromContext(context, id);
        assert.throws(() => balanceProfileNumber(selectedProfile, 'missing'), /profession=fixture patch=preview/);
        assert.throws(() => requireEffect(selectedProfile, 'condition', 'Typo'), /profession=fixture patch=preview/);
        const effect = requireEffect(selectedProfile, 'condition', 'Second');
        assert.throws(() => effectNumber(selectedProfile, effect, 'missing'), /profession=fixture patch=preview/);
      }
    }
  }

  for (const catalog of [family.catalogFor(), family.resolveRuntime({ specialization: 'Elite' }).catalog]) {
    assert.deepEqual(requireEffect(ownerOf(catalog, 'skill'), 'condition', 'First'), first);
    assert.deepEqual(requireEffect(ownerOf(catalog, 'balance-profile'), 'condition', 'First'), first);
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
    const selectedProfile = requireBalanceProfileFromContext(lookup, 1);
    assert.throws(
      () => balanceProfileNumber(selectedProfile, 'missing'),
      new RegExp(`profession=fixture patch=${patchId}`)
    );
    assert.equal(requireEffect(selectedProfile, 'condition', 'First'), undefined);
  }

  assert.equal(live.balanceProfilesById.get(1).balanceDataContext, undefined);
  assert.throws(() => requireBalanceProfileFromContext(() => undefined, 1), /patch=<unknown>/);
});
