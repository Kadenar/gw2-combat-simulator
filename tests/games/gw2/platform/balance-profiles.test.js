import assert from 'node:assert/strict';
import test from 'node:test';

import { defineSkillVariantProfile, defineTraitProfile } from '#gw2/platform/profession-definition/balance-profiles.js';
import { applyBalanceProfilePatch } from '#gw2/integrations/patches/authoring/patches.js';
import {
  balanceProfileFromContext,
  balanceProfileNumber,
  requireBalanceProfileFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';

test('balance-profile authoring helpers attach canonical trait and variant metadata', () => {
  assert.deepEqual(defineTraitProfile(101, 'Test Trait', { threshold: 3 }), {
    id: 101,
    name: 'Test Trait',
    profileKind: 'trait',
    categories: ['Trait'],
    skillFamily: 'Trait',
    effects: [],
    threshold: 3
  });
  assert.deepEqual(defineSkillVariantProfile('variant', 202, 'Test Variant', { resourceGain: 2 }), {
    id: 'variant',
    parentId: 202,
    name: 'Test Variant',
    profileKind: 'skill-variant',
    effects: [],
    resourceGain: 2
  });
  assert.deepEqual(defineSkillVariantProfile('mechanic-variant', 'Mechanic Variant', { threshold: 4 }), {
    id: 'mechanic-variant',
    name: 'Mechanic Variant',
    profileKind: 'skill-variant',
    categories: ['Skill variant'],
    effects: [],
    threshold: 4
  });
});

test('balance-profile lookup supports every runtime context shape and preserves precedence', () => {
  const profile = (name) => defineTraitProfile(101, name);
  const direct = profile('Direct catalog');
  const helper = profile('Resolver helpers');
  const profession = profile('Profession catalog');
  const runtime = profile('Application runtime');
  const map = (value) => new Map([[101, value]]);

  assert.equal(balanceProfileFromContext({ catalog: { balanceProfilesById: map(direct) } }, 101), direct);
  assert.equal(balanceProfileFromContext({ helpers: { balanceProfilesById: map(helper) } }, 101), helper);
  assert.equal(
    balanceProfileFromContext({ profession: { catalog: { balanceProfilesById: map(profession) } } }, 101),
    profession
  );
  assert.equal(
    balanceProfileFromContext({ runtime: { profession: { catalog: { balanceProfilesById: map(runtime) } } } }, 101),
    runtime
  );
  assert.equal(
    balanceProfileFromContext(
      {
        catalog: { balanceProfilesById: map(direct) },
        helpers: { balanceProfilesById: map(helper) },
        profession: { catalog: { balanceProfilesById: map(profession) } },
        runtime: { profession: { catalog: { balanceProfilesById: map(runtime) } } }
      },
      101
    ),
    direct
  );
  assert.equal(balanceProfileFromContext(null, 101), undefined);
  assert.equal(balanceProfileFromContext({}, 101), undefined);
  assert.equal(
    balanceProfileFromContext((id) => map(helper).get(id), 101),
    helper
  );
  assert.equal(balanceProfileFromContext({ balanceProfile: (id) => map(runtime).get(id) }, 101), runtime);
});

test('balance-profile numeric lookup returns patched values and rejects invalid fields', () => {
  const profile = defineTraitProfile(101, 'Patchable', { threshold: 3 });
  const catalog = {
    balanceProfiles: [profile],
    balanceProfilesById: new Map([[101, profile]]),
    balanceProfilesByName: new Map([[profile.name, profile]])
  };
  const patched = applyBalanceProfilePatch(catalog, {
    balanceProfiles: { 101: { fields: { threshold: 7 } } }
  });
  const resolved = requireBalanceProfileFromContext({ catalog: patched }, 101);

  assert.equal(balanceProfileNumber(resolved, 'threshold'), 7);
  assert.throws(() => balanceProfileNumber(resolved, 'missing'), /profile=101 field=missing/);
  assert.throws(() => requireBalanceProfileFromContext({ catalog: patched }, 102), /profile=102/);
});
