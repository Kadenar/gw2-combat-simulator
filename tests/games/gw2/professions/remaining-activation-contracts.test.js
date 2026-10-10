import assert from 'node:assert/strict';
import test from 'node:test';
import { elementalistProfession } from '#gw2/professions/elementalist/profession.js';
import { necromancerProfession } from '#gw2/professions/necromancer/profession.js';
import { revenantProfession } from '#gw2/professions/revenant/profession.js';
import {
  ELEMENTALIST_ATTUNEMENT_SKILL_IDS as ATTUNEMENT,
  ELEMENTALIST_TRAIT_IDS as ET
} from '#gw2/professions/elementalist/data/ids.js';
import { NECROMANCER_SKILL_IDS as N, NECROMANCER_TRAIT_IDS as NT } from '#gw2/professions/necromancer/data/ids.js';
import {
  REVENANT_SKILL_IDS as R,
  REVENANT_TRAIT_IDS as RT,
  REVENANT_LEGEND_IDS as LEGEND
} from '#gw2/professions/revenant/data/ids.js';
import { reenterEvokerAttunement } from '#gw2/professions/elementalist/specializations/evoker/mechanics/attunements.js';
import { grantElectricEnchantments } from '#gw2/professions/elementalist/specializations/evoker/mechanics/electric-enchantment.js';
import { evokerState } from '#gw2/professions/elementalist/specializations/evoker/state.js';
import { createProfessionSimulator } from '#tests/helpers/profession-simulation.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';
import { skillEffectKey } from '#gw2/platform/effects/validation.js';
import { withProfile } from '#tests/helpers/catalog-overrides.js';

const combat = { type: 'combat-start' };
const wait = (durationMs) => ({ type: 'wait', durationMs });
const cause = (at, fields = {}) => ({
  at,
  source: 'Fixture',
  sourceId: 'fixture',
  skillName: 'Fixture',
  actorType: 'player',
  ...fields
});
const strike = (at, fields = {}) =>
  cause(at, {
    type: 'damage',
    coefficient: 1,
    skillWeapon: 'Unequipped',
    ...fields
  });
const packet = (event) => ({ at: event.at, run: (runtime) => runtime.effects.emit({ kind: 'packet', event }) });
const rewards = (result, id) => result.resolvedEvents.filter((event) => event.sourceId === id);

/** Exercise native admission separately from selected policies and explicitly supplied lifetime work. */
function run(family, rotation = [combat, wait(3000)], { traitTriggers = true, ...overrides } = {}, options = {}) {
  const result = createProfessionSimulator(family)(
    rotation,
    {
      specialization: 'Core',
      selectedTraitIds: [],
      initialResource: 0,
      boons: {},
      stats: { power: 1000, precision: 1000, vitality: 1000 },
      target: { armor: 2597, health: 0, conditions: {} },
      ...overrides
    },
    { ...options, profession: { runtimeFor: (config) => family.runtimeFor(config, { traitTriggers }) } }
  );
  assert.deepEqual(result.warnings, []);
  return { result, runtime: observedRuntime(result) };
}

test('Evoker real entry claims only selected enabled traits while retaining the native swap', () => {
  for (const selected of [false, true])
    for (const traitTriggers of [false, true]) {
      const { result, runtime } = run(elementalistProfession, [combat, ATTUNEMENT.Earth, wait(100)], {
        specialization: 'Evoker',
        startAttunement: 'Water',
        evokerElement: 'Earth',
        traitTriggers,
        selectedTraitIds: selected ? [ET.EARTHEN_BLAST, ET.ROCK_SOLID] : []
      });
      assert.equal(runtime.profession.core.primaryAttunement, 'Earth');
      for (const trait of [ET.EARTHEN_BLAST, ET.ROCK_SOLID])
        assert.equal(runtime.procs.deadline(String(trait)) > 0, selected && traitTriggers);
      assert.equal(
        result.procSteps.some((step) => step.skill === 'Earthen Blast'),
        selected && traitTriggers
      );
    }
});

test('Evoker familiar entry shares the real-entry claim and isolation cannot spend it', () => {
  for (const traitTriggers of [false, true]) {
    const claims = [];
    const { runtime } = run(
      elementalistProfession,
      [combat, ATTUNEMENT.Earth, wait(1100)],
      {
        specialization: 'Evoker',
        startAttunement: 'Water',
        evokerElement: 'Earth',
        traitTriggers,
        selectedTraitIds: [ET.EARTHEN_BLAST, ET.ROCK_SOLID]
      },
      {
        timeline: [
          {
            at: 1,
            run(runtime) {
              const skill = runtime.helpers.skillsById.get(ATTUNEMENT.Earth);
              claims.push(runtime.procs.deadline(String(ET.EARTHEN_BLAST)));
              reenterEvokerAttunement(
                runtime.mechanics,
                {
                  id: 'familiar-entry',
                  skill,
                  command: {},
                  start: 1,
                  effectiveEnd: 1,
                  fullEnd: 1
                },
                skill,
                'Earth'
              );
              claims.push(runtime.procs.deadline(String(ET.EARTHEN_BLAST)));
            }
          }
        ]
      }
    );
    assert.equal(claims[0], claims[1]);
    assert.equal(claims[0] > 0, traitTriggers);
    assert.equal(runtime.profession.core.primaryAttunement, 'Earth');
  }
});

test('Electric Discharge entry emits once without an Evocation cooldown claim', () => {
  const { result, runtime } = run(elementalistProfession, [combat, ATTUNEMENT.Air, wait(100)], {
    specialization: 'Evoker',
    startAttunement: 'Water',
    evokerElement: 'Air',
    selectedTraitIds: [ET.ELECTRIC_DISCHARGE]
  });
  assert.equal(result.procSteps.filter((step) => step.skill === 'Electric Discharge').length, 1);
  assert.equal(runtime.procs.deadline(String(ET.ELECTRIC_DISCHARGE)), 0);
});

test('Evoker admitted enchantments retain independent charge expiry under isolation', () => {
  const { result, runtime } = run(
    elementalistProfession,
    undefined,
    {
      specialization: 'Evoker',
      evokerElement: 'Air',
      traitTriggers: false
    },
    {
      timeline: [
        {
          at: 0.5,
          run(runtime) {
            grantElectricEnchantments(runtime.mechanics, {
              at: runtime.time,
              stacks: 1,
              duration: 1,
              skill: { id: 'fixture', name: 'Fixture' },
              procType: 'skill'
            });
          }
        },
        packet(strike(1)),
        packet(strike(2))
      ]
    }
  );
  assert.ok(rewards(result, 'elementalist.electric-enchantment').some((event) => event.type === 'damage'));
  assert.equal(
    evokerState.from(runtime).electricEnchantmentGrants.reduce((sum, grant) => sum + grant.charges, 0),
    0
  );
});

test('Necromancer heal and dagger admission respect selection and isolation', () => {
  for (const selected of [false, true])
    for (const traitTriggers of [false, true]) {
      const { result, runtime } = run(necromancerProfession, [combat, N.CONSUME_CONDITIONS, N.DARK_PACT, wait(100)], {
        primaryWeapon: 'Dagger',
        traitTriggers,
        selectedSkillIds: [N.CONSUME_CONDITIONS],
        selectedTraitIds: selected ? [NT.DARK_DEFENSE, NT.OVERFLOWING_THIRST] : []
      });
      assert.equal(runtime.procs.deadline('darkDefense') > 0, selected && traitTriggers);
      assert.equal(
        rewards(result, NT.DARK_DEFENSE).some((event) => event.kind === 'protection'),
        selected && traitTriggers
      );
      assert.equal(
        rewards(result, NT.OVERFLOWING_THIRST).some((event) => event.kind === 'taste-for-blood'),
        selected && traitTriggers
      );
    }
});

test('Dark Defense still claims Carapace when its independent Protection packet is removed', () => {
  const { result, runtime } = run(
    necromancerProfession,
    [combat, N.CONSUME_CONDITIONS],
    {
      selectedSkillIds: [N.CONSUME_CONDITIONS],
      selectedTraitIds: [NT.DARK_DEFENSE]
    },
    {
      catalog: (catalog) =>
        withProfile(catalog, NT.DARK_DEFENSE, {
          effects: [],
          removedEffectKeys: [skillEffectKey('boon', 'protection')]
        })
    }
  );
  assert.equal(runtime.profession.core.carapaceExpiries.length, 10);
  assert.ok(runtime.procs.deadline('darkDefense') > 0);
  assert.equal(rewards(result, NT.DARK_DEFENSE).length, 0);
});

test('Necromancer hit resource admission preserves actor, mark and target-health eligibility', () => {
  for (const selected of [false, true])
    for (const traitTriggers of [false, true])
      for (const actorType of ['player', 'summon', 'effect'])
        for (const below of [false, true]) {
          const { runtime } = run(
            necromancerProfession,
            [combat, wait(1500)],
            {
              traitTriggers,
              selectedTraitIds: selected ? [NT.SOUL_MARKS, NT.SPITEFUL_FORTITUDE, NT.GLUTTONY] : [],
              target: { armor: 2597, health: 1e12, startingHealthFraction: below ? 0.49 : 1, conditions: {} }
            },
            { timeline: [packet(strike(1, { skillId: N.MARK_OF_BLOOD, hitIndex: 1, actorType }))] }
          );
          const expected = selected && traitTriggers && actorType === 'player' ? (3 + Number(below)) * 1.1 : 0;
          assert.ok(Math.abs(runtime.profession.core.lifeForce.value - expected) < 1e-9);
        }

  const later = run(
    necromancerProfession,
    undefined,
    { selectedTraitIds: [NT.SOUL_MARKS] },
    {
      timeline: [packet(strike(1, { skillId: N.MARK_OF_BLOOD, hitIndex: 2 }))]
    }
  );
  assert.equal(later.runtime.profession.core.lifeForce.value, 0);
});

test('Eternal Life admits no isolated loop or readiness while native signets still operate', () => {
  for (const selected of [false, true])
    for (const traitTriggers of [false, true]) {
      const { runtime } = run(necromancerProfession, [combat, wait(3100)], {
        traitTriggers,
        selectedTraitIds: selected ? [NT.ETERNAL_LIFE] : []
      });
      assert.equal(runtime.profession.core.passiveNextAt['eternal-life'] != null, selected && traitTriggers);
      assert.equal(runtime.profession.core.lifeForce.value > 0, selected && traitTriggers);
      if (!selected || !traitTriggers) assert.equal(runtime.resourceController.readyAt('lifeForce', 3), null);
    }

  const signet = run(necromancerProfession, [combat, wait(3100)], {
    traitTriggers: false,
    selectedSkillIds: [N.SIGNET_OF_UNDEATH]
  });
  assert.ok(signet.runtime.profession.core.lifeForce.value > 0);
});

test('Eternal Life retained tasks deliver admitted work and keep the threshold cap under isolation', () => {
  const { runtime } = run(
    necromancerProfession,
    [combat, wait(1500)],
    {
      traitTriggers: false,
      selectedTraitIds: [NT.ETERNAL_LIFE],
      initialResource: 65
    },
    {
      timeline: [
        {
          at: 0.5,
          run(runtime) {
            runtime.schedule('necromancer.eternal-life', 1, { interval: 1, deadline: 1 });
          }
        }
      ]
    }
  );
  assert.equal(runtime.profession.core.lifeForce.value, 66);
  assert.equal(runtime.profession.core.passiveNextAt['eternal-life'], 2);
});

test('Taste for Blood retains finite independent self and ally charges under isolation', () => {
  const { result, runtime } = run(
    necromancerProfession,
    [combat, wait(4000)],
    {
      traitTriggers: false,
      selectedTraitIds: [NT.OVERFLOWING_THIRST],
      allies: { count: 1, strikesPerSecond: 1 }
    },
    {
      timeline: [
        packet(
          cause(0.5, {
            type: 'buff',
            kind: 'taste-for-blood',
            stacks: 1,
            duration: 3,
            audience: { recipients: 'party', maximumRecipients: 2 }
          })
        ),
        packet(strike(1.2)),
        packet(strike(1.3))
      ]
    }
  );
  const siphons = rewards(result, NT.OVERFLOWING_THIRST).filter((event) => event.type === 'damage');
  assert.equal(siphons.length, 2);
  assert.equal(
    runtime.profession.core.tasteForBloodGrants.self.reduce((sum, grant) => sum + grant.charges, 0),
    0
  );
  assert.equal(
    runtime.profession.core.tasteForBloodGrants['ally:1'].reduce((sum, grant) => sum + grant.charges, 0),
    0
  );
});

test('Harbinger shroud and finisher rewards obey isolation while shroud remains intrinsic', () => {
  for (const selected of [false, true])
    for (const traitTriggers of [false, true]) {
      const { result, runtime } = run(necromancerProfession, [combat, N.HARBINGER_SHROUD, N.DARK_BARRAGE, wait(100)], {
        specialization: 'Harbinger',
        traitTriggers,
        initialResource: 50,
        selectedTraitIds: selected ? [NT.DEATHLY_HASTE] : [],
        allies: { count: 2 }
      });
      assert.equal(runtime.profession.core.activeShroud, 'harbinger');
      const boons = rewards(result, NT.DEATHLY_HASTE).filter((event) => event.type === 'buff');
      assert.equal(boons.length > 0, selected && traitTriggers);
      if (boons.length) assert.ok(boons.every((event) => event.resolvedAudience.alliedPlayerCount === 2));
    }
});

test('Revenant startup is isolated while supplied Battle Scars still consume once', () => {
  for (const traitTriggers of [false, true]) {
    const { result, runtime } = run(
      revenantProfession,
      [wait(1000), combat, wait(2100)],
      {
        traitTriggers,
        selectedTraitIds: [RT.ASSASSINS_PRESENCE, RT.THRILL_OF_COMBAT],
        selectedLegends: [LEGEND.ASSASSIN, LEGEND.DEMON],
        startingLegend: LEGEND.ASSASSIN
      },
      {
        timeline: [
          {
            at: 1.5,
            run(runtime) {
              runtime.profession.core.battleScars.push(10);
            }
          },
          packet(strike(2))
        ]
      }
    );
    assert.equal(
      rewards(result, RT.ASSASSINS_PRESENCE).some((event) => event.kind === 'fury'),
      traitTriggers
    );
    assert.equal(rewards(result, 'revenant.battle-scars').filter((event) => event.type === 'damage').length, 1);
    assert.equal(runtime.profession.core.battleScars.length, Number(traitTriggers));
  }
});

test('Herald isolates new retention and upkeep rewards without suppressing native facets', () => {
  for (const traitTriggers of [false, true]) {
    const { result, runtime } = run(
      revenantProfession,
      [
        combat,
        R.FACET_OF_STRENGTH,
        R.FACET_OF_DARKNESS,
        R.FACET_OF_ELEMENTS,
        R.FACET_OF_LIGHT,
        R.BURST_OF_STRENGTH,
        wait(100)
      ],
      {
        specialization: 'Herald',
        initialResource: 100,
        traitTriggers,
        selectedLegends: [LEGEND.DRAGON, LEGEND.ASSASSIN],
        startingLegend: LEGEND.DRAGON,
        selectedTraitIds: [RT.DRACONIC_ECHO, RT.ELEVATED_COMPASSION]
      }
    );
    assert.equal(runtime.profession.core.activeUpkeeps.length, 3);
    assert.equal(Boolean(runtime.profession.specialization.state.lingeringFacets[R.FACET_OF_STRENGTH]), traitTriggers);
    assert.equal(
      rewards(result, RT.ELEVATED_COMPASSION).some((event) => event.kind === 'quickness'),
      traitTriggers
    );
  }
});
