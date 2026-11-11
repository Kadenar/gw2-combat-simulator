// Exercise live trait selection, page ownership, and the health-or-Aegis damage gate.
import assert from 'node:assert/strict';
import test from 'node:test';

import { activePatchPreview } from '#gw2/integrations/patches/active-preview.js';
import { GUARDIAN_SKILL_IDS as ID, GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';
import { guardianCatalog, guardianProfession } from '#gw2/professions/guardian/profession.js';
import { resolveAshes } from '#gw2/professions/guardian/specializations/firebrand/ashes-tuning.js';
import {
  firebrandControlAccepted,
  swiftScholarPagesGranted
} from '#gw2/professions/guardian/specializations/firebrand/mechanics/trigger-points.js';
import { ashesBurningSkill } from '#gw2/professions/guardian/specializations/firebrand/skills/tome-skills.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';
import { withSkill } from '#tests/helpers/catalog-overrides.js';
import { wait } from '#tests/helpers/commands.js';
import { runGuardian } from '#tests/helpers/guardian-simulation.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';

test('the live Firebrand layout replaces retired traits without a preview overlay', () => {
  assert.equal(activePatchPreview, null);
  const line = guardianCatalog.specializations.find((line) => line.name === 'Firebrand');
  assert.deepEqual(
    line.majorTraits.map((tier) => tier.map((trait) => trait.name)),
    [
      ['Unrelenting Criticism', 'Revelation', 'Bastion'],
      ['Fervid Conviction', 'Stalwart Speed', 'Legendary Lore'],
      ['Righteous Flames', 'Stoic Demeanor', 'Deliverance']
    ]
  );
});

test('final mantra charges refund a baseline page and Revelation adds one independently', () => {
  for (const selected of [false, true])
    for (const traitTriggers of [false, true]) {
      const result = runGuardian(
        [ID.POTENT_HASTE, ID.POTENT_HASTE, ID.OVERWHELMING_CELERITY],
        {
          specialization: 'Firebrand',
          initialTomePages: 0,
          selectedSkillIds: [ID.MANTRA_OF_POTENCE],
          selectedTraitIds: selected ? [TRAIT.REVELATION] : []
        },
        { profession: { runtimeFor: (config) => guardianProfession.runtimeFor(config, { traitTriggers }) } }
      );
      assert.deepEqual(result.warnings, []);
      const pages = result.planningState.profession[STATE.TOME_PAGES];
      assert.equal(pages.maximum, 8);
      assert.equal(pages.interval, 6);
      assert.equal(pages.value, 1 + Number(selected && traitTriggers));
      assert.ok(!result.resolvedEvents.some((event) => event.condition === 'Slow'));
    }
});

// Aegis adds its own bonus while the health-or-Aegis multiplier applies only once.
test('Unscathed Contender combines its Aegis bonus with the health-or-Aegis multiplier', () => {
  const native = guardianProfession.runtimeFor({ specialization: 'Core' });
  for (const [health, aegis, expected] of [
    [1, false, 112],
    [1, true, 117.6],
    [0.75, false, 100],
    [0.75, true, 117.6]
  ]) {
    const context = {
      catalog: native.catalog,
      config: { selectedTraitIds: [TRAIT.UNSCATHED_CONTENDER], boons: { aegis } },
      runtime: { boons: new Map(), buffs: new Map() },
      time: 0,
      event: { actorType: 'player' },
      attributePreviewPlayerHealthFraction: health
    };
    assert.ok(Math.abs(native.calculations.modifyStrikeDamage(context, 100) - expected) < 1e-9);
    delete context.attributePreviewPlayerHealthFraction;
    assert.ok(Math.abs(native.calculations.modifyStrikeDamage(context, 100) - (aegis ? 117.6 : 112)) < 1e-9);
  }
});

// Other additive bonuses share the Aegis bucket; unselected traits and condition damage receive neither bonus.
test('Unscathed Contender adds Aegis damage to the existing strike bucket only when selected', () => {
  const native = guardianProfession.runtimeFor({ specialization: 'Core' });
  for (const selected of [false, true]) {
    const context = {
      catalog: native.catalog,
      config: { selectedTraitIds: selected ? [TRAIT.UNSCATHED_CONTENDER] : [], boons: { aegis: true } },
      runtime: { boons: new Map(), buffs: new Map() },
      time: 0,
      event: { actorType: 'player' },
      damageInputs: { strikeSigilBonus: 0.1 }
    };
    const expected = selected ? 128.8 : 110;
    assert.ok(Math.abs(native.calculations.modifyStrikeDamage(context, 100) - expected) < 1e-9);
    assert.equal(native.calculations.modifyConditionDamage(context, 100), 100);
  }
});

test('Swift Scholar refunds trigger the selected live reward', () => {
  for (const trait of [TRAIT.FERVID_CONVICTION, TRAIT.STALWART_SPEED]) {
    const result = runGuardian([ID.TOME_OF_JUSTICE, ID.SEARING_SPELL, ID.IGNITING_BURST, ID.HEATED_REBUKE], {
      specialization: 'Firebrand',
      selectedTraitIds: [trait]
    });
    assert.deepEqual(result.warnings, []);
    assert.ok(result.procSteps.some((step) => step.skill === 'Swift Scholar'));
    assert.ok(
      trait === TRAIT.FERVID_CONVICTION
        ? result.procSteps.some((step) => step.skill === 'Fervid Conviction')
        : result.events.some(
            (event) => event.traitId === TRAIT.STALWART_SPEED && event.kind === 'quickness' && event.duration === 4.5
          )
    );
  }
});

// Count distinct boons once, regardless of Might stacks, and stop the bonus at five.
test('Inspired Virtue caps its damage bonus at five boon types', () => {
  const native = guardianProfession.runtimeFor({ specialization: 'Core' });
  const kinds = ['might', 'fury', 'quickness', 'alacrity', 'protection', 'regeneration'];
  for (const count of [0, 1, 4, 5, 6]) {
    const context = {
      catalog: native.catalog,
      config: {
        selectedTraitIds: [TRAIT.INSPIRED_VIRTUE],
        boons: Object.fromEntries(kinds.slice(0, count).map((kind) => [kind, kind === 'might' ? 25 : true]))
      },
      runtime: { boons: new Map(), buffs: new Map() },
      time: 0,
      event: { actorType: 'player' }
    };
    assert.ok(Math.abs(native.calculations.modifyStrikeDamage(context, 100) - (100 + Math.min(count, 5) * 1.5)) < 1e-9);
  }
});

// An earned refund grants independent charge pools with one shared expiration.
test('Fervid grants two self charges and one per ally for ten seconds', () => {
  const result = runGuardian(
    [wait(100)],
    {
      specialization: 'Firebrand',
      selectedTraitIds: [TRAIT.FERVID_CONVICTION],
      allies: { count: 4, strikesPerSecond: 1 }
    },
    {
      timeline: [
        {
          at: 0.01,
          run(runtime) {
            runtime.fireTrigger(swiftScholarPagesGranted, {
              cast: { id: 'refund', skill: runtime.helpers.skillsById.get(ID.SEARING_SPELL) }
            });
          }
        }
      ]
    }
  );
  assert.deepEqual(result.warnings, []);
  const state = observedRuntime(result).profession.specialization.state;
  assert.equal(state.ashes.charges, 2);
  assert.equal(Object.keys(state.alliedAshes).length, 4);
  assert.ok(state.ashes.expiresAt >= 10.01 && state.ashes.expiresAt <= 10.05);
  for (const grant of Object.values(state.alliedAshes)) {
    assert.equal(grant.charges, 1);
    assert.equal(grant.expiresAt, state.ashes.expiresAt);
  }
});

test('Righteous Flames multiplies selected base duration without changing Burning stacks', () => {
  for (const duration of [2, 4]) {
    const catalog = withSkill(guardianCatalog, ashesBurningSkill.id, {
      effects: [{ type: 'condition', name: 'Burning', condition: 'Burning', stacks: 2, duration }]
    });
    const resolved = resolveAshes({ catalog, traits: new Set([TRAIT.RIGHTEOUS_FLAMES]) });
    assert.equal(resolved.burning.baseDurationSeconds, duration * 1.5);
    assert.equal(resolved.burning.stacks, 2);
  }
});

// Bleeding and Quickness bonuses multiply independently; other conditions receive only Imbued Haste.
test('live Firebrand condition bonuses use the supplied values and condition gates', () => {
  const native = guardianProfession.runtimeFor({ specialization: 'Firebrand' });
  for (const quickness of [false, true])
    for (const condition of ['Bleeding', 'Burning']) {
      const context = {
        catalog: native.catalog,
        time: 0,
        condition,
        config: { selectedTraitIds: [TRAIT.UNRELENTING_CRITICISM, TRAIT.IMBUED_HASTE], boons: { quickness } },
        runtime: { boons: new Map(), buffs: new Map() }
      };
      const expected = 100 * (condition === 'Bleeding' ? 1.05 : 1) * (quickness ? 1.1 : 1);
      assert.ok(Math.abs(native.calculations.modifyConditionDamage(context, 100) - expected) < 1e-9);
    }

  assert.equal(native.catalog.balanceProfilesById.get(TRAIT.UNRELENTING_CRITICISM).conditionDurationBonus, 0.2);
});

// Nearby controls cannot claim another reduction until the quarter-second cooldown has elapsed.
test('Stoic Demeanor reduces recharge by three seconds with a quarter-second internal cooldown', () => {
  const changes = [];
  const result = runGuardian(
    [wait(500)],
    {
      specialization: 'Firebrand',
      selectedTraitIds: [TRAIT.STOIC_DEMEANOR],
      boons: { alacrity: false }
    },
    {
      initialize(runtime) {
        runtime.cooldownController.setReadyAt(ID.UNBROKEN_LINES, 20);
      },
      timeline: [0.01, 0.2, 0.261].map((at) => ({
        at,
        run(runtime) {
          const before = runtime.cooldownController.readyAt(ID.UNBROKEN_LINES);
          runtime.fireTrigger(firebrandControlAccepted, {
            cause: { type: 'control', actorType: 'player', at: runtime.time }
          });
          changes.push(
            (before - runtime.cooldownController.readyAt(ID.UNBROKEN_LINES)) *
              runtime.cooldownController.rate(runtime.helpers.skillsById.get(ID.UNBROKEN_LINES))
          );
        }
      }))
    }
  );
  assert.deepEqual(result.warnings, []);
  for (const [index, expected] of [3, 0, 3].entries()) assert.ok(Math.abs(changes[index] - expected) < 1e-9);
});
