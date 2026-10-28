import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';
import { baseAttributeInputs } from '#gw2/platform/attributes/inputs.js';
import { effectFields, effectPlanningState } from '#tests/helpers/effect-report.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { applyBalanceProfilePatch } from '#gw2/integrations/patches/authoring/patches.js';
import { engineerCatalog, engineerProfession } from '#gw2/professions/engineer/profession.js';
import { ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import { createObservedProfessionSimulator } from '#tests/helpers/observed-runtime.js';

const simulate = createObservedProfessionSimulator(engineerProfession, {
  attributeInputs: baseAttributeInputs({ power: 2000, precision: 1000, ferocity: 0, conditionDamage: 0 }),
  target: { armor: 2597, conditions: {} }
});

// Repeated commands isolate charge accumulation from weapon and kit trait interactions.
test('every mech command retains tool-belt classification and Tools reactions', () => {
  const commands = engineerCatalog.skills.filter(
    (skill) => skill.specialization === 'Mechanist' && skill.independentCast
  );
  assert.equal(commands.length, 9);
  assert.ok(commands.every((skill) => skill.countsAsToolbeltSkill === true));
  const result = simulate('Mechanist', ['Discharge Array'], {
    selectedTraitIds: [
      TRAIT.KINETIC_BATTERY,
      TRAIT.OPTIMIZED_ACTIVATION,
      TRAIT.STATIC_DISCHARGE,
      TRAIT.MECHANIZED_DEPLOYMENT
    ]
  });
  assert.deepEqual(result.warnings, []);
  assert.equal(result.planningState.profession[STATE.KINETIC_CHARGES], 1);
  assert.ok(result.events.some((event) => event.kind === 'vigor'));
  assert.ok(result.resolvedEvents.some((event) => event.name === 'Static Discharge'));
  assert.equal(result.planningState.cooldowns[63367].readyAt, 20400);
});

test('mech command charges count when issued, before the independent animation completes', () => {
  const result = simulate('Mechanist', ['Rolling Smash', 'Discharge Array', 'Fragmentation Shot'], {
    selectedTraitIds: [TRAIT.KINETIC_BATTERY]
  });
  const charges = result.events.filter((event) => event.type === 'engineer.kinetic-battery');
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(
    charges.map((event) => [event.at, event.kineticCharges]),
    [
      [0, 1],
      [0, 2]
    ]
  );
  assert.equal(result.steps.find((step) => step.skill === 'Fragmentation Shot').start, 0);
});

// Active State follows the inspected time, including before activation and at buff expiry.
test('Kinetic Battery charges and buff timer appear in Active State across Engineer specializations', () => {
  // Both displays must use the inspected patch's activation cap.
  const catalog = applyBalanceProfilePatch(engineerCatalog, {
    balanceProfiles: { [TRAIT.KINETIC_BATTERY]: { fields: { maximumStacks: 3 } } }
  });
  for (const specialization of ['Core', 'Mechanist', 'Holosmith', 'Scrapper', 'Amalgam']) {
    const context = {
      catalog,
      balanceContext: { catalog },
      specialization,
      config: { selectedTraitIds: [TRAIT.KINETIC_BATTERY] },
      professionState: { [STATE.KINETIC_CHARGES]: 2 }
    };
    assert.equal(
      engineerProfession.ui.resourceViews(context).some((view) => view.id === 'kineticCharges'),
      false
    );
    const snapshot = (atSeconds, charges) =>
      Object.fromEntries(
        engineerProfession.ui
          .rotationStateSnapshot({
            ...context,
            professionState: { [STATE.KINETIC_CHARGES]: charges },
            atSeconds,
            planningState: effectPlanningState(
              {
                ...effectFields(
                  [
                    {
                      type: 'buff',
                      resolvedAudience: {
                        includesSelf: true,
                        includesSummons: false,
                        companionIds: [],
                        alliedPlayerCount: 0,
                        recipientCount: 1
                      },
                      kind: 'kinetic-battery',
                      at: 10,
                      duration: 5
                    }
                  ],
                  120
                )
              },
              atSeconds
            )
          })
          .map((item) => [item.id, item.value])
      );
    assert.equal(snapshot(9, 2)['engineer-kinetic-charges'], '2/3');
    assert.equal(snapshot(9, 2)['engineer-kinetic-battery'], undefined);
    assert.equal(snapshot(10, 0)['engineer-kinetic-charges'], '0/3');
    assert.equal(snapshot(10, 0)['engineer-kinetic-battery'], '5.0s');
    assert.equal(snapshot(12, 1)['engineer-kinetic-charges'], '1/3');
    assert.equal(snapshot(12, 1)['engineer-kinetic-battery'], '3.0s');
    assert.equal(snapshot(15, 1)['engineer-kinetic-battery'], undefined);
    assert.equal(
      engineerProfession.ui
        .rotationStateSnapshot({ specialization, balanceContext: { catalog } })
        .some((item) => item.id === 'engineer-kinetic-charges'),
      false
    );
    const event = { type: 'engineer.kinetic-battery', kineticCharges: 2 };
    assert.match(engineerProfession.ui.eventLogRow(context, event).description, /2\/3/);
    event.kineticCharges = 0;
    assert.match(engineerProfession.ui.eventLogRow(context, event).description, /activated.*0\/3/);
  }
});
