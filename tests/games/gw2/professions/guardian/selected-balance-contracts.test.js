import { effectFields, effectPlanningState } from '#tests/helpers/effect-report.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { luminaryImpactAt } from '#gw2/professions/guardian/specializations/luminary/skills/radiant-forge-skills.js';
import { guardianProfession } from '#gw2/professions/guardian/profession.js';
import { guardianTooltips } from '#gw2/professions/guardian/app/tooltips.js';
import { GUARDIAN_SKILL_IDS as ID, GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';
import { LUMINARY_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/guardian/specializations/luminary/profiles.js';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import { rotationStateSnapshot } from '#gw2/app/rotation/state-snapshot/model.js';
import { runGuardian } from '#tests/helpers/guardian-simulation.js';

test('Luminary linked effects follow the selected packet anchor and scaling', () => {
  // Synthetic casts isolate timing projection from authored cast speeds and interruption thresholds.
  for (const [timingAnchor, timingScale, expected] of [
    ['castStart', 'fixed', 10.5],
    ['castEnd', 'fixed', 11.5],
    ['castStart', 'cast', 10.25],
    ['castEnd', 'cast', 11.25]
  ]) {
    for (const payload of [{ coefficient: 1, atMs: 500 }, { ticks: [{ coefficient: 1, atMs: 500 }] }]) {
      const cast = {
        start: 10,
        fullEnd: 11,
        effectiveEnd: 10.8,
        skill: { castTimeMs: 2000, effects: [{ type: 'strike', timingAnchor, timingScale, ...payload }] }
      };
      assert.equal(luminaryImpactAt(cast), expected);
    }
  }

  assert.equal(luminaryImpactAt({ effectiveEnd: 10.8, skill: { effects: [] } }), 10.8);
});

test('a cast-end stance impact grants its buff and detonates its aura at the packet boundary', () => {
  const profession = withPatchPreview(guardianProfession, {
    id: 'guardian-impact',
    label: 'Guardian impact',
    professions: {
      guardian: {
        skills: {
          [ID.PIERCING_STANCE]: {
            effects: [{ effectIndex: 0, atMs: 500, timingAnchor: 'castEnd', timingScale: 'fixed' }]
          }
        }
      }
    }
  });
  // A delayed packet must not consume the existing aura or grant its stance during the cast.
  const result = runGuardian(
    ['Effulgent Stance', 'Piercing Stance', { type: 'wait', durationMs: 1000 }],
    { specialization: 'Luminary', patchId: 'guardian-impact', selectedTraitIds: [TRAIT.SOVEREIGN_OF_LIGHT] },
    { initialize: () => {}, profession: profession }
  );
  assert.deepEqual(result.warnings, []);
  const strike = result.events.find((event) => event.type === 'damage' && event.skillId === ID.PIERCING_STANCE);
  const buff = result.events.find((event) => event.type === 'buff' && event.kind === 'guardian-piercing-stance');
  const detonation = result.events.find(
    (event) => event.type === 'damage' && event.skillId === ID.SOVEREIGN_OF_LIGHT_DAMAGE
  );
  assert.ok(strike);
  assert.equal(buff.at, strike.at);
  assert.equal(detonation.at, strike.at);
});

test('Guardian snapshots display selected caps and modifier bonuses', () => {
  const profession = withPatchPreview(guardianProfession, {
    id: 'guardian-snapshot',
    label: 'Guardian snapshot',
    professions: {
      guardian: {
        balanceProfiles: {
          [TRAIT.SYMBOLIC_AVENGER]: { fields: { maximumStacks: 7 } },
          [PROFILE.effulgentStance]: { fields: { maximumStacks: 12 } }
        },
        modifierRules: {
          'guardian.radiant-armaments': { amount: 0.09 },
          'guardian.piercing-stance': { amount: 0.125 },
          'guardian.daring-advance': { factor: 1.2 }
        }
      }
    }
  });
  const events = ['radiant-armaments', 'piercing-stance', 'daring-advance'].map((kind) => ({
    type: 'buff',
    kind: `guardian-${kind}`,
    at: 0,
    duration: 10,
    stacks: 1,
    resolvedAudience: {
      includesSelf: true,
      includesSummons: false,
      alliedPlayerCount: 0,
      companionIds: [],
      recipientCount: 1
    },
    metadata: { radiantWeapon: 'hammer' }
  }));
  // Both caps and bonuses must come from the selected balance context without a separate app catalog.
  const app = {
    build: { rotation: [] },
    profession,
    patchId: 'guardian-snapshot',
    adapter: { eliteSpecialization: () => 'Luminary' },
    results: {
      events,
      ...effectFields(events, 120),
      planningState: {
        ...effectPlanningState(effectFields(events, 120), 1),
        profession: { symbolicAvengerExpirations: [5, 6], effulgentStacks: 12, effulgentActiveUntil: 4 }
      }
    }
  };
  const items = new Map(rotationStateSnapshot(app).items.map((item) => [item.id, item]));
  assert.equal(items.get('guardian-symbolic-avenger').value, '2/7 · 5.0s');
  assert.equal(items.get('luminary-effulgent-stance').value, '12/12 · 3.0s');
  assert.equal(items.get('luminary-radiant-armaments').title, 'Dazzling Hammer: +9% strike damage');
  assert.equal(items.get('luminary-piercing-stance').title, 'Piercing Stance: +12.5% strike damage');
  assert.equal(items.get('luminary-daring-advance').title, 'Daring Advance: +20% strike damage');
  // Public observations are detached from the source events.
  events[0].metadata.radiantWeapon = 'staff';
  assert.equal(
    rotationStateSnapshot(app).items.some((item) => item.id === 'luminary-radiant-armaments'),
    true
  );
});

test('the retained Courage variant describes its implemented behavior separately', () => {
  const context = withPatchPreview(guardianProfession, null).balanceContextFor();
  const describe = (id) => guardianTooltips.skills[id](context, context.catalog.skillsById.get(id));
  assert.match(describe(ID.TOME_OF_COURAGE).description, /^Open this tome/);
  const variant = describe(ID.TOME_OF_COURAGE_ID_42371);
  assert.match(variant.description, /no simulated effects/);
  assert.deepEqual(variant.facts, []);
});
