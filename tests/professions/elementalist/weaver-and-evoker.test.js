import assert from 'node:assert/strict';
import test from 'node:test';
import { runNative } from '../../helpers/elementalist-simulation.js';
import { skillBreakdownRows } from '#gw2/app/results/result-tables.js';
import { rotationSelectedSlotSkills } from '#gw2/app/rotation/palette/model.js';
import { elementalistAppAdapter } from '#gw2/professions/elementalist/app/app-definition.js';
import { elementalistCatalog } from '#gw2/professions/elementalist/catalog.js';
import { elementalistProfession } from '#gw2/professions/elementalist/definition.js';
import { targetAttunement } from '#gw2/professions/elementalist/core/mechanics/attunements.js';
import { createElementalistCoreState } from '#gw2/professions/elementalist/core/state.js';
import { applyPistolState } from '#gw2/professions/elementalist/core/mechanics/pistol-bullets.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import { availability as evokerAvailability } from '#gw2/professions/elementalist/specializations/evoker/mechanics/availability.js';
import { createEvokerState } from '#gw2/professions/elementalist/specializations/evoker/state.js';
import { weaverCastRules } from '#gw2/professions/elementalist/specializations/weaver/mechanics/dual-attunements.js';
import { onEventScheduled } from '#gw2/professions/elementalist/specializations/evoker/mechanics/event-handlers.js';
import { EVOKER_BALANCE_PROFILE_IDS } from '#gw2/professions/elementalist/specializations/evoker/profiles.js';
import { applyBalanceProfilePatch } from '#gw2/integrations/patches/authoring/patches.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import { WEAVER_BALANCE_PROFILE_IDS } from '#gw2/professions/elementalist/specializations/weaver/profiles.js';
import { handlePrimordialStanceTick } from '#gw2/professions/elementalist/specializations/weaver/mechanics/primordial-stance.js';

test('Elemental Balance reports the same patched duration used for its active window', () => {
  // Two qualifying entries arm the trait; its marker must explain the effective balance profile.
  const state = createEvokerState({ evokerElement: 'Fire' });
  const events = [];
  const context = {
    catalog: applyBalanceProfilePatch(elementalistCatalog, {
      balanceProfiles: {
        [EVOKER_BALANCE_PROFILE_IDS.elementalBalance]: {
          fields: { durationMultiplier: { from: 5, to: 8 } }
        }
      }
    }),
    traits: new Set(['Elemental Balance']),
    state: { profession: { specialization: { kind: 'Evoker', state } } },
    emit: (event) => events.push(event)
  };
  for (const at of [1, 2]) {
    onEventScheduled(context, { type: 'elementalist.attunement-enter', at, to: 'Fire' });
  }

  assert.equal(state.elementalBalanceUntil, 10);
  assert.equal(events.find((event) => event.name === 'Elemental Balance').detail, 'CDR armed (8s)');
});

test('Unravel requires Elements of Rage and disables new dual attacks without cancelling one in flight', () => {
  const unavailable = runNative({
    lines: [['Fire'], ['Air'], ['Weaver', '1-1-2']],
    rotation: ['Unravel'],
    startAttunement: 'Air',
    secondaryAttunement: 'Fire'
  });

  assert.equal(
    unavailable.events.some((event) => event.type === 'action' && event.skillName === 'Unravel'),
    false
  );
  assert.match(unavailable.warnings[0], /requires Elements of Rage/i);

  const dualAttack = runNative({
    lines: [['Fire'], ['Air'], ['Weaver', '1-1-1']],
    rotation: ['Unravel', 'Pyro Vortex'],
    startAttunement: 'Fire',
    secondaryAttunement: 'Air',
    weapons: ['Sword', 'Dagger']
  });

  assert.equal(
    dualAttack.events.some((event) => event.type === 'action' && event.skillName === 'Pyro Vortex'),
    false
  );
  assert.match(dualAttack.warnings[0], /while Unravel is active/i);

  const unravel = elementalistCatalog.skillsByName.get('Unravel');
  const queuedDualAttack = runNative({
    lines: [['Fire'], ['Air'], ['Weaver', '1-1-1']],
    rotation: [
      'Pyro Vortex',
      {
        type: 'cast',
        skillId: unravel.id,
        concurrentOffsetMs: 100
      }
    ],
    startAttunement: 'Fire',
    secondaryAttunement: 'Air',
    weapons: ['Sword', 'Dagger']
  });

  assert.deepEqual(queuedDualAttack.warnings, []);
  const vortex = queuedDualAttack.steps.find((step) => step.skill === 'Pyro Vortex');
  const unravelStep = queuedDualAttack.steps.find((step) => step.skill === 'Unravel');
  // Unravel changes future availability while the already selected dual attack completes.
  assert.ok(unravelStep.start > vortex.start && unravelStep.start < vortex.end);

  assert.equal(
    queuedDualAttack.resolvedEvents.some(
      (event) => event.type === 'damage' && event.skillName === 'Pyro Vortex' && event.at > unravelStep.start / 1000
    ),
    true
  );
});

test('cooldown reset also resets native attunement recharge', () => {
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Arcane']],
    rotation: ['Air Attunement', { type: 'cooldown-reset' }, 'Fire Attunement'],
    startAttunement: 'Fire',
    assumptions: {
      ...elementalistProfession.createBuildDefaults().assumptions,
      alacrity: false
    }
  });
  const fire = result.steps.find((step) => step.skill === 'Fire Attunement');

  assert.deepEqual(result.warnings, []);
  assert.equal(fire.start, 0);
});

test('autoattack chains carry across attunements until their third strike', () => {
  const fireRoot = elementalistCatalog.skillsByName.get('Fire Strike').id;
  const fireSecond = elementalistCatalog.skillsByName.get('Fire Swipe');
  const airRoot = elementalistCatalog.skillsByName.get('Charged Strike').id;

  assert.deepEqual(
    elementalistCatalog.autoattackChains
      .find((chain) => chain[0] === fireRoot)
      .map((id) => elementalistCatalog.skillsById.get(id).name),
    ['Fire Strike', 'Fire Swipe', 'Searing Slash']
  );

  const carried = runNative({
    lines: [['Fire'], ['Air'], ['Arcane']],
    rotation: ['Fire Strike', 'Air Attunement'],
    startAttunement: 'Fire',
    weapons: ['Sword', 'Dagger']
  });

  assert.deepEqual(carried.warnings, []);
  assert.deepEqual(carried.endState.profession.autoattackCarryover, {
    root: fireRoot,
    attunement: 'Fire'
  });
  assert.equal(carried.endState.profession.autoattackChains[fireRoot], fireSecond.id);
  assert.equal(
    elementalistProfession.ui.paletteSkillAvailability(
      {
        specialization: 'Core',
        professionState: carried.endState.profession,
        time: carried.endState.time / 1000,
        catalog: elementalistCatalog,
        build: { startAttunement: 'Fire' }
      },
      fireSecond
    ).available,
    true
  );

  const completed = runNative({
    lines: [['Fire'], ['Air'], ['Arcane']],
    rotation: ['Fire Strike', 'Air Attunement', 'Fire Swipe', 'Searing Slash', 'Charged Strike'],
    startAttunement: 'Fire',
    weapons: ['Sword', 'Dagger']
  });

  assert.deepEqual(completed.warnings, []);
  assert.equal(completed.endState.profession.autoattackCarryover, null);
  assert.equal(
    completed.endState.profession.autoattackChains[airRoot],
    elementalistCatalog.skillsByName.get('Polaric Slash').id
  );
});

test('a skill in the new attunement interrupts autoattack carryover', () => {
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Arcane']],
    rotation: ['Fire Strike', 'Air Attunement', 'Polaric Leap', 'Fire Swipe'],
    startAttunement: 'Fire',
    weapons: ['Sword', 'Dagger']
  });

  assert.equal(result.endState.profession.autoattackCarryover, null);
  assert.equal(
    result.events.some((event) => event.type === 'action' && event.skillName === 'Fire Swipe'),
    false
  );
  assert.equal(
    result.warnings.some((warning) => warning.includes('Fire Swipe')),
    true
  );
});

test('Weaver can cancel a carried autoattack by starting the current primary chain', () => {
  const airRoot = elementalistCatalog.skillsByName.get('Charged Strike').id;
  const fireRoot = elementalistCatalog.skillsByName.get('Fire Strike').id;
  const fireSecond = elementalistCatalog.skillsByName.get('Fire Swipe').id;
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Weaver', '1-1-1']],
    rotation: ['Charged Strike', 'Fire Attunement', 'Fire Strike'],
    startAttunement: 'Air',
    secondaryAttunement: 'Fire',
    weapons: ['Sword', 'Dagger']
  });

  assert.deepEqual(result.warnings, []);
  assert.equal(result.endState.profession.autoattackCarryover, null);
  assert.equal(result.endState.profession.autoattackChains[airRoot], undefined);
  assert.equal(result.endState.profession.autoattackChains[fireRoot], fireSecond);
});

test('a concurrent attunement swap preserves the in-flight auto chain', () => {
  const airAttunement = elementalistCatalog.skillsByName.get('Air Attunement');
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Arcane']],
    rotation: [
      'Fire Strike',
      {
        type: 'cast',
        skillId: airAttunement.id,
        concurrentOffsetMs: 100
      },
      'Fire Swipe'
    ],
    startAttunement: 'Fire',
    weapons: ['Sword', 'Dagger']
  });

  assert.deepEqual(result.warnings, []);
  assert.equal(
    result.events.some((event) => event.type === 'action' && event.skillName === 'Fire Swipe'),
    true
  );
});

test('Ride the Lightning preserves sword roots without exempting other dagger skills', () => {
  const preserved = runNative({
    lines: [['Fire'], ['Air'], ['Arcane']],
    rotation: ['Charged Strike', 'Ride the Lightning', 'Polaric Slash'],
    startAttunement: 'Air',
    weapons: ['Sword', 'Dagger']
  });
  const reset = runNative({
    lines: [['Fire'], ['Air'], ['Arcane']],
    rotation: ['Charged Strike', 'Updraft', 'Charged Strike'],
    startAttunement: 'Air',
    weapons: ['Sword', 'Dagger']
  });

  assert.deepEqual(preserved.warnings, []);
  assert.deepEqual(
    preserved.steps.map((step) => step.skill),
    ['Charged Strike', 'Ride the Lightning', 'Polaric Slash']
  );
  assert.deepEqual(reset.warnings, []);
  assert.deepEqual(
    reset.steps.map((step) => step.skill),
    ['Charged Strike', 'Updraft', 'Charged Strike']
  );
});

test('Relentless Fire preserves the sword autoattack chain', () => {
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Catalyst']],
    rotation: ['Charged Strike', 'Relentless Fire', 'Polaric Slash'],
    startAttunement: 'Air',
    weapons: ['Sword', 'Dagger'],
    selectedSkills: {
      Heal: 'Glyph of Elemental Harmony',
      Utility1: 'Relentless Fire',
      Utility2: 'Signet of Fire',
      Utility3: 'Arcane Wave',
      Elite: 'Glyph of Elementals'
    }
  });

  assert.deepEqual(result.warnings, []);
  assert.deepEqual(
    result.steps.map((step) => step.skill),
    ['Charged Strike', 'Relentless Fire', 'Polaric Slash']
  );
});

test('Ride the Lightning preserves the timed Aerial Agility flip sequence', () => {
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Arcane']],
    rotation: ['Aerial Agility', 'Ride the Lightning', 'Aerial Agility (chain)', 'Aerial Agility (dash)'],
    startAttunement: 'Air',
    weapons: ['Pistol', 'Dagger']
  });

  assert.deepEqual(result.warnings, []);
  assert.deepEqual(
    result.steps.map((step) => step.skill),
    ['Aerial Agility', 'Ride the Lightning', 'Aerial Agility (chain)', 'Aerial Agility (dash)']
  );
});

test('Aerial Agility expires while its original cooldown keeps counting down', () => {
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Arcane']],
    rotation: ['Aerial Agility', 5100],
    startAttunement: 'Air',
    weapons: ['Pistol', 'Dagger']
  });

  assert.equal(result.endState.profession.autoattackChains[ID.AERIAL_AGILITY], undefined);
  assert.ok(result.endState.cooldowns['Aerial Agility'].remaining > 0);
});

test('using the first Aerial Agility follow-up restarts its full cooldown', () => {
  const unused = runNative({
    lines: [['Fire'], ['Air'], ['Arcane']],
    rotation: ['Aerial Agility', 2000],
    startAttunement: 'Air',
    weapons: ['Pistol', 'Dagger']
  });
  const used = runNative({
    lines: [['Fire'], ['Air'], ['Arcane']],
    rotation: ['Aerial Agility', 2000, 'Aerial Agility (chain)'],
    startAttunement: 'Air',
    weapons: ['Pistol', 'Dagger']
  });
  const initialDuration = unused.endState.cooldowns['Aerial Agility'].readyAt - unused.steps[0].end;
  const followup = used.steps[2];

  assert.equal(used.endState.cooldowns['Aerial Agility'].readyAt - followup.end, initialDuration);
  assert.ok(used.endState.cooldowns['Aerial Agility'].readyAt > unused.endState.cooldowns['Aerial Agility'].readyAt);
});

test('rotation palette resolves equipped glyphs to the active attunement', () => {
  const build = elementalistAppAdapter.toApplicationBuild({
    ...elementalistProfession.createBuildDefaults(),
    selectedSkills: {
      ...elementalistProfession.createBuildDefaults().selectedSkills,
      Utility2: 'Glyph of Storms (Fire)'
    }
  });
  const app = {
    build,
    adapter: elementalistAppAdapter,
    profession: elementalistProfession,
    skills: elementalistCatalog.skills,
    skillByName: elementalistCatalog.skillsByName,
    skillById: elementalistCatalog.skillsById,
    results: {
      endState: { profession: { primaryAttunement: 'Air' } }
    }
  };

  assert.equal(
    rotationSelectedSlotSkills(app).some((skill) => skill.name === 'Glyph of Storms (Air)'),
    true
  );
  assert.equal(
    elementalistProfession.ui.paletteSkillAvailability(
      {
        build,
        specialization: 'Weaver',
        professionState: { primaryAttunement: 'Air' }
      },
      elementalistCatalog.skillsByName.get('Glyph of Storms (Air)')
    ).available,
    true
  );
});

test('equipped glyphs remain available across attunement variants', () => {
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Arcane']],
    rotation: ['Air Attunement', 'Glyph of Storms (Air)'],
    startAttunement: 'Fire',
    selectedSkills: {
      Heal: 'Glyph of Elemental Harmony',
      Utility1: 'Arcane Blast',
      Utility2: 'Glyph of Storms (Fire)',
      Utility3: 'Arcane Wave',
      Elite: 'Glyph of Elementals'
    }
  });

  assert.deepEqual(result.warnings, []);
  assert.equal(
    result.events.some((event) => event.type === 'action' && event.skillName === 'Glyph of Storms (Air)'),
    true
  );
});

test('attunement variants of an equipped glyph share their cooldown', () => {
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Arcane']],
    rotation: ['Air Attunement', 'Glyph of Storms (Air)', 10000, 'Fire Attunement', 'Glyph of Storms (Fire)'],
    startAttunement: 'Fire',
    selectedSkills: {
      Heal: 'Glyph of Elemental Harmony',
      Utility1: 'Arcane Blast',
      Utility2: 'Glyph of Storms (Fire)',
      Utility3: 'Arcane Wave',
      Elite: 'Glyph of Elementals'
    }
  });
  const casts = result.steps.filter((step) => String(step.skill).startsWith('Glyph of Storms'));

  assert.deepEqual(result.warnings, []);
  assert.equal(casts.length, 2);
  // Switching variants must preserve the first variant's recharge.
  const recharge = (elementalistCatalog.skillsByName.get('Glyph of Storms (Air)').cooldown * 1000) / 1.25;
  assert.ok(casts[1].start - casts[0].start >= recharge);
});

test('Primordial Stance schedules unique authored pulse times without emitting placeholder packets', () => {
  // Each variant uses the replacement registry and timing policy while retaining its activation owner.
  const runtime = elementalistProfession.resolveRuntime({ specialization: 'Weaver' });
  for (const id of [
    ID.PRIMORDIAL_STANCE_FIRE,
    ID.PRIMORDIAL_STANCE_WATER,
    ID.PRIMORDIAL_STANCE_AIR,
    ID.PRIMORDIAL_STANCE_EARTH
  ]) {
    const canonical = elementalistCatalog.skillsById.get(id);
    const effect = canonical.effects.find((candidate) => candidate.type === 'condition');
    const skill = {
      ...canonical,
      effects: [{ ...effect, ticks: [0, 1250, 1250, 3000].map((atMs) => ({ ...effect.ticks[0], atMs })) }]
    };
    const scheduled = [];
    const handler = runtime.skillHandlerFor(skill);
    assert.equal(handler.mode, 'replace');
    handler.beforeEffects(
      {
        start: 10,
        fullEnd: 10,
        effectiveEnd: 10,
        epsilon: 1e-9,
        reservationId: 'stance',
        schedulerPolicy: {
          effectTiming: (_context, _skill, authored) => ({
            ...authored,
            ticks: authored.ticks.map((tick) => ({ ...tick, atMs: tick.atMs * 2 }))
          })
        },
        tasks: { schedule: (task) => scheduled.push(task) },
        emit: () => assert.fail('Pulses must wait for their scheduled tasks'),
        replaceEvent: () => assert.fail('No placeholder packets should be emitted')
      },
      skill
    );
    assert.deepEqual(
      scheduled.map((task) => task.at),
      [12.5, 16]
    );
    assert.ok(scheduled.every((task) => task.ownerId === 'stance' && task.payload.sourceId === id));
  }
});

test('Primordial Stance retains dynamic profile patches and activation ownership within the observation window', () => {
  // A short tail includes the first pulse but must not resolve the following pulse or an activation-time strike.
  const profession = withPatchPreview(elementalistProfession, {
    id: 'stance-preview',
    label: 'Stance Preview',
    professions: {
      elementalist: {
        balanceProfiles: {
          [WEAVER_BALANCE_PROFILE_IDS.primordialStance]: {
            effects: [
              { type: 'strike', coefficient: { from: 0.33, to: 0.5 } },
              { type: 'condition', name: 'Fire', stacks: { from: 1, to: 3 }, duration: { from: 2, to: 4 } }
            ]
          }
        }
      }
    }
  });
  const result = simulateGw2({
    profession,
    config: {
      specialization: 'Weaver',
      patchId: 'stance-preview',
      startAttunement: 'Fire',
      secondaryAttunement: 'Fire',
      selectedSkills: ['Primordial Stance (Fire)'],
      stats: { power: 1000 },
      target: { armor: 2597 }
    },
    rotation: ['Primordial Stance (Fire)'],
    observationPolicy: { kind: 'tail', durationMs: 1500 }
  });
  assert.deepEqual(result.warnings, []);
  const action = result.events.find((event) => event.type === 'action');
  const pulses = result.events.filter(
    (event) => event.skillName === 'Primordial Stance' && (event.type === 'damage' || event.type === 'condition')
  );
  assert.ok(pulses.length > 0);
  assert.ok(
    pulses.every((event) => event.at > action.at && event.at <= 1.5 && event.activationId === action.activationId)
  );
  assert.equal(pulses.find((event) => event.type === 'damage').coefficient, 0.5);
  const burning = pulses.find((event) => event.type === 'condition');
  assert.equal(burning.stacks, 3);
  assert.equal(burning.duration, 4);
  assert.ok(result.events.every((event) => event.cancelled !== true));
});

test('Primordial Stance does not restore removed profile effects through fallback values', () => {
  // Removing the active attunement's condition and strike leaves this pulse with nothing to emit.
  handlePrimordialStanceTick(
    {
      catalog: applyBalanceProfilePatch(elementalistCatalog, {
        balanceProfiles: {
          [WEAVER_BALANCE_PROFILE_IDS.primordialStance]: {
            removeEffects: [{ type: 'strike' }, { type: 'condition', name: 'Fire' }]
          }
        }
      }),
      state: {
        profession: {
          core: { primaryAttunement: 'Fire' },
          specialization: { kind: 'Weaver', state: { secondaryAttunement: 'Fire' } }
        }
      },
      emit: () => assert.fail('Removed profile effects must not emit')
    },
    { at: 1, payload: { sourceId: ID.PRIMORDIAL_STANCE_FIRE } }
  );
});

test('Primordial Stance variants share charges and count recharge', () => {
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Weaver']],
    rotation: [
      'Primordial Stance (Fire)',
      'Air Attunement',
      'Primordial Stance (Air)',
      'Earth Attunement',
      'Primordial Stance (Earth)'
    ],
    startAttunement: 'Fire',
    secondaryAttunement: 'Fire',
    selectedSkills: {
      Heal: 'Glyph of Elemental Harmony',
      Utility1: 'Primordial Stance (Fire)',
      Utility2: 'Glyph of Storms (Fire)',
      Utility3: 'Arcane Wave',
      Elite: 'Weave Self'
    }
  });
  const casts = result.steps.filter((step) => String(step.skill).startsWith('Primordial Stance'));

  assert.deepEqual(result.warnings, []);
  assert.equal(casts.length, 3);
  // The first two variants spend the shared pool; the third waits for a charge.
  const recharge = (elementalistCatalog.skillsByName.get('Primordial Stance (Fire)').ammoRecharge * 1000) / 1.25;
  assert.ok(casts[1].start - casts[0].start < recharge);
  assert.ok(casts[2].start - casts[0].start >= recharge);
});

test('Primordial Stance pulses use the active attunements at each pulse', () => {
  const result = runNative({
    lines: [['Fire'], ['Earth'], ['Weaver']],
    rotation: ['Primordial Stance (Fire)', 1500, 'Earth Attunement', 4500],
    startAttunement: 'Fire',
    secondaryAttunement: 'Fire',
    selectedSkills: {
      Heal: 'Glyph of Elemental Harmony',
      Utility1: 'Primordial Stance (Fire)',
      Utility2: 'Signet of Fire',
      Utility3: 'Arcane Wave',
      Elite: 'Weave Self'
    }
  });
  const swap = result.events.find((event) => event.type === 'elementalist.attunement' && event.to === 'Earth');

  const hits = result.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.skillName === 'Primordial Stance'
  );
  const conditions = result.events.filter(
    (event) => event.type === 'condition' && event.skillName === 'Primordial Stance'
  );

  // Each pulse reads both live attunements instead of capturing them at activation.
  assert.ok(hits.some((event) => event.at < swap.at));
  assert.ok(hits.some((event) => event.at > swap.at));
  for (const hit of hits) {
    const applied = conditions
      .filter((event) => event.at === hit.at)
      .map((event) => event.condition)
      .sort();
    assert.deepEqual(applied, hit.at < swap.at ? ['Burning', 'Burning'] : ['Bleeding', 'Burning']);
  }
});

test("Evasive Arcana uses the active attunement's native trait skill", () => {
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Arcane', '1-1-1']],
    rotation: ['Dodge', 1000],
    startAttunement: 'Fire',
    selectedSkills: {
      Heal: 'Glyph of Elemental Harmony',
      Utility1: 'Arcane Blast',
      Utility2: 'Signet of Fire',
      Utility3: 'Arcane Wave',
      Elite: 'Conjure Fiery Greatsword'
    }
  });

  assert.equal(
    result.resolvedEvents.some((event) => event.type === 'damage' && event.skillName === 'Flame Burst (trait)'),
    true
  );
  assert.equal(
    result.events.some(
      (event) =>
        event.type === 'condition' && event.skillName === 'Flame Burst (trait)' && event.condition === 'Burning'
    ),
    true
  );
  assert.equal(
    result.procSteps.some((step) => step.skill === 'Flame Burst (trait)'),
    true
  );
});

test('Weaver mechanics execute through native hooks', () => {
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Weaver']],
    rotation: ['Weave Self', 'Water Attunement', 'Air Attunement', 'Earth Attunement', 'Tailored Victory'],
    startAttunement: 'Fire',
    secondaryAttunement: 'Fire',
    selectedSkills: {
      Heal: 'Glyph of Elemental Harmony',
      Utility1: 'Arcane Blast',
      Utility2: 'Signet of Fire',
      Utility3: 'Arcane Wave',
      Elite: 'Weave Self'
    }
  });

  assert.equal(
    result.events.some((event) => event.type === 'buff' && event.kind === 'perfect weave'),
    true
  );
  assert.equal(
    result.events.some((event) => event.type === 'action' && event.skillName === 'Tailored Victory'),
    true
  );
  assert.equal(result.endState.profession.perfectWeaveUntil, 0);

  const weaveSelf = result.events.find((event) => event.type === 'action' && event.skillName === 'Weave Self');
  const weaveSelfFire = result.events.find(
    (event) => event.type === 'buff' && event.source === 'Weave Self' && event.kind === 'weave self fire'
  );

  assert.ok(weaveSelfFire.at > weaveSelf.at);
  assert.ok(weaveSelfFire.at < weaveSelf.endsAt);
  assert.equal(
    weaveSelf.rechargeReadyAt - weaveSelfFire.at,
    elementalistCatalog.skillsByName.get('Weave Self').cooldown / 1.25
  );
});

test('Evoker mechanics execute through native hooks', () => {
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Evoker']],
    rotation: ['Lightning Blitz', 4000],
    evokerElement: 'Air',
    initialEvokerCharges: 6,
    initialEvokerEmpowered: 3
  });

  assert.equal(result.endState.profession.maximumCharges, 6);
  assert.equal(result.endState.profession.empowered, 0);
  assert.equal(
    result.resolvedEvents.filter((event) => event.type === 'damage' && event.skillName === 'Electric Enchantment')
      .length,
    3
  );
  assert.equal(
    result.procSteps.some((step) => step.skill === 'Electric Enchantment'),
    true
  );
});

test('Elementalist behavior follows skill IDs after display labels change', () => {
  const fireAttunement = { ...elementalistCatalog.skillsById.get(ID.FIRE_ATTUNEMENT), name: 'Renamed attunement' };
  const ignite = { ...elementalistCatalog.skillsById.get(ID.IGNITE), name: 'Renamed familiar' };
  const state = createEvokerState({ evokerElement: 'Fire', initialEvokerCharges: 6 });
  const context = {
    state: {
      profession: {
        core: {},
        specialization: { kind: 'Evoker', state }
      }
    },
    start: 0,
    epsilon: 1e-9,
    commandIndex: 0,
    config: { selectedTraitIds: [] }
  };

  assert.equal(targetAttunement(fireAttunement), 'Fire');
  assert.deepEqual(evokerAvailability(context, ignite), { ready: true });
  state.element = 'Water';
  assert.equal(evokerAvailability(context, ignite).code, 'elementalist.evoker-element');

  const unravel = { ...elementalistCatalog.skillsById.get(ID.UNRAVEL), name: 'Renamed unravel' };
  assert.equal(
    weaverCastRules.availability.handler({ config: { selectedTraitIds: [] } }, unravel).code,
    'elementalist.weaver-elements-of-rage'
  );

  const core = createElementalistCoreState({ pistolBullets: { Earth: true, Air: true } });
  const pistolEvents = [];
  const pistolContext = {
    state: { profession: { core } },
    effectiveEnd: 1,
    config: { selectedTraitIds: [] },
    emit: (event) => pistolEvents.push(event)
  };
  const shatteringStone = {
    ...elementalistCatalog.skillsById.get(ID.SHATTERING_STONE),
    name: 'Renamed core pistol skill'
  };
  applyPistolState(pistolContext, shatteringStone);
  assert.equal(core.pistolBullets.Earth, false);
  assert.equal(pistolEvents[0].kind, 'shattering stone');
  assert.equal(pistolEvents[0].skillId, shatteringStone.id);

  const purblindingPlasma = {
    ...elementalistCatalog.skillsById.get(ID.PURBLINDING_PLASMA),
    name: 'Renamed Weaver pistol skill'
  };
  assert.equal(weaverCastRules.modifyRechargeDuration({ ...pistolContext, skill: purblindingPlasma }, 15), 10);
});

test('Evoker weapon skills build familiar charges', () => {
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Evoker']],
    rotation: ['Flame Uprising'],
    startAttunement: 'Fire',
    weapons: ['Sword', 'Dagger'],
    evokerElement: 'Fire',
    initialEvokerCharges: 0
  });
  const charge = result.events.find(
    (event) => event.type === 'resource' && event.kind === 'evoker-charges' && event.source === 'Flame Uprising'
  );

  assert.ok(charge);
  assert.equal(charge.change, 2);
  assert.equal(result.endState.profession.charges, 2);
});

test('Fire-specialized Evoker gives Sunspot and Flame Expulsion independent cooldowns', () => {
  const simulate = (evokerElement) =>
    runNative({
      lines: [
        ['Fire', '1-1-2'],
        ['Earth', '2-1-2'],
        ['Evoker', '1-1-1']
      ],
      rotation: [
        'Raging Ricochet',
        'Earth Attunement',
        'Fire Attunement',
        'Water Attunement',
        'Fire Attunement',
        'Air Attunement',
        // Observe the last delayed explosion without changing any proc's ICD.
        1000
      ],
      startAttunement: 'Fire',
      weapons: ['Pistol', 'Dagger'],
      evokerElement
    });
  const attempts = (result, direction) =>
    result.events.filter(
      (event) =>
        event.type === 'elementalist.attunement' &&
        (direction === 'enter' ? event.to === 'Fire' : event.from === 'Fire')
    );
  const procs = (result, skillName) =>
    result.events.filter((event) => event.type === 'damage' && event.skillName === skillName);
  const fire = simulate('Fire');
  const fireEntries = attempts(fire, 'enter');
  const fireExits = attempts(fire, 'exit');

  const cooldown = elementalistCatalog.balanceProfilesById.get(EVOKER_BALANCE_PROFILE_IDS.evocation).internalCooldown;

  assert.deepEqual(fire.warnings, []);
  assert.equal(fireEntries.length, 2);
  assert.equal(fireExits.length, 3);
  assert.ok(fireEntries.at(-1).at - fireEntries[0].at < cooldown);
  assert.ok(fireExits.at(-1).at - fireExits[0].at < cooldown);
  assert.equal(procs(fire, 'Sunspot').length, 1);
  assert.equal(procs(fire, 'Flame Expulsion').length, 1);
  // Independent timers allow the first Sunspot while Flame Expulsion is already cooling down.
  assert.ok(procs(fire, 'Sunspot')[0].at - procs(fire, 'Flame Expulsion')[0].at < cooldown);

  const nonFire = simulate('Water');

  assert.equal(procs(nonFire, 'Sunspot').length, attempts(nonFire, 'enter').length);
  assert.equal(procs(nonFire, 'Flame Expulsion').length, attempts(nonFire, 'exit').length);
});

// Fire exit starts a delayed proc; its strike and Burning must land together.
test('Flame Expulsion delays both packets and uses its own icon in the damage breakdown', () => {
  const result = runNative({
    lines: [['Fire', '1-1-2'], ['Air'], ['Arcane']],
    rotation: ['Flame Uprising', 'Air Attunement', 1000],
    startAttunement: 'Fire',
    weapons: ['Sword', 'Dagger']
  });
  const expectedIcon = 'https://render.guildwars2.com/file/998095CB1FD2CF0164B8A36BABFDB911DF08DB02/1012313.png';
  const packet = result.events.find((event) => event.type === 'damage' && event.skillName === 'Flame Expulsion');
  const row = skillBreakdownRows(result).find((entry) => entry.name === 'Flame Expulsion');
  const exit = result.events.find((event) => event.type === 'elementalist.attunement' && event.from === 'Fire');
  const burning = result.events.find((event) => event.type === 'condition' && event.skillName === 'Flame Expulsion');

  assert.ok(packet.at > exit.at);
  assert.equal(burning.at, packet.at);
  assert.equal(packet?.icon, expectedIcon);
  assert.equal(row?.icon, expectedIcon);
});

test('Sunspot uses its own icon in the damage breakdown', () => {
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Arcane']],
    rotation: ['Lightning Strike', 'Fire Attunement'],
    startAttunement: 'Air',
    weapons: ['Scepter', 'Dagger']
  });
  const expectedIcon = 'https://render.guildwars2.com/file/1405047ED70DE30F80B1F6304A787B215BB50878/1012316.png';
  const packet = result.events.find((event) => event.type === 'damage' && event.skillName === 'Sunspot');
  const row = skillBreakdownRows(result).find((entry) => entry.name === 'Sunspot');

  assert.equal(packet?.icon, expectedIcon);
  assert.equal(row?.icon, expectedIcon);
});

// Both entry paths must retain trigger attribution through strike and Burning resolution.
for (const [specialization, startAttunement, rotation, trigger] of [
  ['Arcane', 'Air', ['Lightning Strike', 'Fire Attunement', 5000], 'Fire Attunement'],
  ['Tempest', 'Fire', [6000, 'Overload Fire', 5000], 'Overload Fire']
]) {
  test(`Sunspot attributes its strike and Burning to ${trigger}`, () => {
    const result = runNative({
      lines: [['Fire', '1-1-1'], ['Air'], [specialization]],
      rotation,
      startAttunement,
      weapons: ['Scepter', 'Dagger']
    });
    const packets = result.resolvedEvents.filter(
      (event) => event.skillName === 'Sunspot' && (event.type === 'damage' || event.type === 'condition')
    );
    assert.ok(packets.some((event) => event.type === 'damage' && event.damage > 0));
    assert.ok(packets.some((event) => event.type === 'condition' && event.damage > 0));
    assert.ok(packets.every((event) => event.triggeredBy === trigger));
    const row = skillBreakdownRows(result).find((entry) => entry.name === 'Sunspot');
    const attributed = row.procDamage.find((entry) => entry.sourceSkill === trigger);
    assert.ok(attributed);
    assert.ok(Math.abs(attributed.total - row.total) < 1e-6);
    assert.ok(Math.abs(attributed.dps - row.dps) < 1e-6);
  });
}

// Attunement and overload activations must retain both the effect icon and the actual damage trigger.
for (const [specialization, startAttunement, rotation, trigger] of [
  ['Arcane', 'Air', ['Lightning Strike', 'Earth Attunement'], 'Earth Attunement'],
  ['Tempest', 'Earth', [6000, 'Overload Earth'], 'Overload Earth']
]) {
  test(`Earthen Blast preserves its icon and attributes damage to ${trigger}`, () => {
    const result = runNative({
      lines: [['Earth'], ['Air'], [specialization]],
      rotation,
      startAttunement,
      weapons: ['Scepter', 'Dagger']
    });
    const expectedIcon = 'https://render.guildwars2.com/file/2531DCAFAEAB452C90C4572E1ADCE8236DCF5636/1012304.png';
    const packet = result.events.find((event) => event.type === 'damage' && event.skillName === 'Earthen Blast');
    const row = skillBreakdownRows(result).find((entry) => entry.name === 'Earthen Blast');

    assert.equal(packet?.icon, expectedIcon);
    assert.equal(row?.icon, expectedIcon);
    const damage = result.resolvedEvents.find(
      (event) => event.type === 'damage' && event.skillName === 'Earthen Blast'
    );
    assert.ok(damage?.damage > 0);
    assert.equal(damage.triggeredBy, trigger);
    const attributed = row.procDamage.find((entry) => entry.sourceSkill === trigger);
    assert.ok(attributed);
    assert.equal(attributed.total, row.total);
    assert.equal(attributed.dps, row.dps);
  });
}

test('Air-specialized Evoker leaves Electric Discharge without an internal cooldown', () => {
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Evoker']],
    rotation: [
      'Raging Ricochet',
      'Earth Attunement',
      'Air Attunement',
      'Water Attunement',
      'Air Attunement',
      'Fire Attunement'
    ],
    startAttunement: 'Fire',
    weapons: ['Pistol', 'Dagger'],
    evokerElement: 'Air'
  });
  const entries = result.events.filter((event) => event.type === 'elementalist.attunement' && event.to === 'Air');
  const discharges = result.events.filter(
    (event) => event.type === 'damage' && event.skillName === 'Electric Discharge'
  );

  const cooldown = elementalistCatalog.balanceProfilesById.get(EVOKER_BALANCE_PROFILE_IDS.evocation).internalCooldown;

  assert.deepEqual(result.warnings, []);
  assert.equal(entries.length, 2);
  assert.ok(entries.at(-1).at - entries[0].at < cooldown);
  assert.equal(discharges.length, entries.length);
});

test('Earth-specialized Evoker gives Earthen Blast and Rock Solid independent cooldowns', () => {
  const simulate = (evokerElement) =>
    runNative({
      lines: [['Earth', '1-2-2'], ['Air'], ['Evoker']],
      rotation: [
        'Raging Ricochet',
        'Air Attunement',
        'Earth Attunement',
        'Water Attunement',
        'Earth Attunement',
        'Fire Attunement'
      ],
      startAttunement: 'Fire',
      weapons: ['Pistol', 'Dagger'],
      evokerElement
    });
  const earthEntries = (result) =>
    result.events.filter((event) => event.type === 'elementalist.attunement' && event.to === 'Earth');
  const earthenBlasts = (result) =>
    result.events.filter((event) => event.type === 'damage' && event.skillName === 'Earthen Blast');
  const rockSolid = (result) => result.events.filter((event) => event.type === 'buff' && event.source === 'Rock Solid');
  const earth = simulate('Earth');
  const entries = earthEntries(earth);

  const cooldown = elementalistCatalog.balanceProfilesById.get(EVOKER_BALANCE_PROFILE_IDS.evocation).internalCooldown;

  assert.deepEqual(earth.warnings, []);
  assert.equal(entries.length, 2);
  assert.ok(entries.at(-1).at - entries[0].at < cooldown);
  assert.equal(earthenBlasts(earth).length, 1);
  assert.equal(rockSolid(earth).length, 1);

  const nonEarth = simulate('Water');

  assert.equal(earthenBlasts(nonEarth).length, earthEntries(nonEarth).length);
  assert.equal(rockSolid(nonEarth).length, earthEntries(nonEarth).length);
});

test('Specialized Elements grants three familiar charges per matching weapon skill', () => {
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Evoker', '1-1-3']],
    rotation: ['Flame Uprising'],
    startAttunement: 'Fire',
    weapons: ['Sword', 'Dagger'],
    evokerElement: 'Fire',
    initialEvokerCharges: 0
  });
  const charge = result.events.find(
    (event) => event.type === 'resource' && event.kind === 'evoker-charges' && event.source === 'Flame Uprising'
  );

  assert.equal(result.endState.profession.maximumCharges, 6);
  assert.ok(charge);
  assert.equal(charge.change, 3);
  assert.equal(result.endState.profession.charges, 3);
});

test('Specialized Elements familiar casts reduce active weapon recharge', () => {
  const simulate = (traits) =>
    runNative({
      lines: [['Fire'], ['Air'], ['Evoker', traits]],
      rotation: ['Flame Uprising', 'Ignite'],
      startAttunement: 'Fire',
      weapons: ['Sword', 'Dagger'],
      evokerElement: 'Fire'
    });
  const baseline = simulate('1-1-1');
  const specialized = simulate('1-1-3');

  assert.deepEqual(baseline.warnings, []);
  assert.deepEqual(specialized.warnings, []);
  // The basic familiar removes a fraction of the weapon's full recharge.
  const weapon = baseline.events.find((event) => event.type === 'action' && event.skillName === 'Flame Uprising');
  const reduction = (weapon.rechargeReadyAt - weapon.endsAt) * 1000 * 0.1;
  assert.ok(
    Math.abs(
      baseline.endState.cooldowns['Flame Uprising'].readyAt -
        specialized.endState.cooldowns['Flame Uprising'].readyAt -
        reduction
    ) < 1e-6
  );
});

test('Evoker can cast a basic familiar after configured start charges fill', () => {
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Evoker']],
    rotation: ['Flame Uprising', 'Ignite'],
    startAttunement: 'Fire',
    weapons: ['Sword', 'Dagger'],
    evokerElement: 'Fire',
    initialEvokerCharges: 4
  });

  assert.deepEqual(result.warnings, []);
  assert.equal(
    result.events.some((event) => event.type === 'action' && event.skillName === 'Ignite'),
    true
  );
  assert.equal(result.endState.profession.charges, 0);
  assert.equal(result.endState.profession.empowered, 1);
});

test('Evoker preserves off-attunement recharge while waiting for a swap', () => {
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Evoker']],
    rotation: [
      'Shattering Stone',
      'Water Attunement',
      'Frigid Flurry',
      'Air Attunement',
      'Dazing Discharge',
      'Fire Attunement'
    ],
    startAttunement: 'Earth',
    weapons: ['Pistol', 'Dagger'],
    evokerElement: 'Earth'
  });
  const dazing = result.events.find((event) => event.type === 'action' && event.skillName === 'Dazing Discharge');
  const fire = result.events.find((event) => event.type === 'action' && event.skillName === 'Fire Attunement');

  assert.deepEqual(result.warnings, []);
  assert.equal(fire.at, dazing.endsAt);
});

test('Evoker concurrent actions wait for an active familiar cast', () => {
  const earthAttunement = elementalistCatalog.skillsByName.get('Earth Attunement');
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Evoker']],
    rotation: [
      'Lightning Blitz',
      {
        type: 'cast',
        skillId: earthAttunement.id,
        concurrentOffsetMs: 100
      }
    ],
    startAttunement: 'Air',
    evokerElement: 'Air',
    initialEvokerEmpowered: 3
  });
  const familiar = result.events.find((event) => event.type === 'action' && event.skillName === 'Lightning Blitz');
  const attunement = result.events.find((event) => event.type === 'action' && event.skillName === 'Earth Attunement');

  assert.deepEqual(result.warnings, []);
  assert.ok(attunement.at >= familiar.endsAt);
});

test('Evoker applies parent charge progression after a concurrent basic familiar', () => {
  const calcify = elementalistCatalog.skillsByName.get('Calcify');
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Evoker']],
    rotation: [
      'Shatterstone',
      {
        type: 'cast',
        skillId: calcify.id,
        concurrentOffsetMs: 560
      }
    ],
    startAttunement: 'Water',
    weapons: ['Scepter', 'Dagger'],
    evokerElement: 'Earth',
    initialEvokerCharges: 6
  });

  assert.deepEqual(result.warnings, []);
  assert.equal(result.endState.profession.charges, 1);
  assert.equal(result.endState.profession.empowered, 1);
});

test('Evoker reapplies Rejuvenate after its concurrent basic familiar', () => {
  const calcify = elementalistCatalog.skillsByName.get('Calcify');
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Evoker']],
    rotation: [
      'Rejuvenate',
      {
        type: 'cast',
        skillId: calcify.id,
        concurrentOffsetMs: 800
      }
    ],
    evokerElement: 'Earth',
    initialEvokerCharges: 0,
    selectedSkills: {
      Heal: 'Rejuvenate',
      Utility1: "Fox's Fury",
      Utility2: 'Signet of Fire',
      Utility3: 'Arcane Wave',
      Elite: 'Elemental Procession'
    }
  });

  assert.deepEqual(result.warnings, []);
  assert.equal(result.endState.profession.charges, 6);
  assert.equal(result.endState.profession.empowered, 1);
});

test('Elemental Procession uses familiar weapon strength and lets Buoyant Deluge trigger Lightning Rod', () => {
  const result = runNative({
    lines: [['Fire'], ['Air', '1-1-3'], ['Evoker']],
    rotation: ['Elemental Procession', 4000],
    evokerElement: 'Earth',
    selectedSkills: {
      Heal: 'Rejuvenate',
      Utility1: "Fox's Fury",
      Utility2: 'Signet of Fire',
      Utility3: 'Arcane Wave',
      Elite: 'Elemental Procession'
    }
  });
  const processionStrikes = result.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.triggeredBy === 'Elemental Procession'
  );
  const otterControl = result.events.find((event) => event.type === 'control' && event.skillName === 'Buoyant Deluge');

  assert.deepEqual(result.warnings, []);
  assert.ok(processionStrikes.length > 0);
  assert.ok(processionStrikes.every((event) => event.weaponStrengthProfileId === 'nonweapon.profession-mechanic'));
  assert.ok(otterControl);
  assert.equal(
    result.resolvedEvents.filter(
      (event) => event.type === 'damage' && event.skillName === 'Lightning Rod' && event.at === otterControl.at
    ).length,
    1
  );
});

test('Evasive Arcana does not grant Evoker familiar charges', () => {
  const result = runNative({
    lines: [['Fire'], ['Arcane', '1-1-1'], ['Evoker']],
    rotation: ['Dodge', 1000],
    startAttunement: 'Fire',
    evokerElement: 'Fire',
    initialEvokerCharges: 0
  });

  assert.equal(
    result.resolvedEvents.some((event) => event.type === 'damage' && event.skillName === 'Flame Burst (trait)'),
    true
  );
  assert.equal(result.endState.profession.charges, 0);
});

test('Evoker materializes final Electric Enchantment stacks on prior hits', () => {
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Evoker']],
    rotation: ['Charged Strike', 'Polaric Slash', 'Zap'],
    startAttunement: 'Air',
    weapons: ['Sword', 'Dagger'],
    evokerElement: 'Air',
    initialEvokerCharges: 6
  });
  const enchantments = result.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.skillName === 'Electric Enchantment'
  );

  assert.equal(enchantments.length, 2);
  assert.equal(enchantments[0].triggeredBy, 'Charged Strike');
});

test('Specialized Elements forces and locks the selected attunement', () => {
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Evoker', '1-1-3']],
    rotation: ['Fire Attunement'],
    startAttunement: 'Fire',
    evokerElement: 'Air'
  });

  assert.equal(result.endState.profession.primaryAttunement, 'Air');
  assert.equal(result.endState.profession.maximumCharges, 6);
  assert.equal(
    result.events.some((event) => event.type === 'elementalist.attunement'),
    false
  );
  assert.equal(
    result.warnings.some((warning) =>
      String(warning).includes('attunement swapping is disabled by Specialized Elements')
    ),
    true
  );
});

test('conjured weapons enforce bundle access and preserve their pickup', () => {
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Arcane']],
    rotation: [
      'Conjure Frost Bow',
      'Frost Volley',
      '__drop_bundle',
      'Flame Uprising',
      '__pickup_Frost Bow',
      'Frost Volley'
    ],
    selectedSkills: {
      Heal: 'Glyph of Elemental Harmony',
      Utility1: 'Conjure Frost Bow',
      Utility2: 'Signet of Fire',
      Utility3: 'Arcane Wave',
      Elite: 'Conjure Fiery Greatsword'
    }
  });

  assert.deepEqual(
    result.events.filter((event) => event.type === 'action').map((event) => event.skillName),
    ['Conjure Frost Bow', 'Frost Volley', '__drop_bundle', 'Flame Uprising', '__pickup_Frost Bow', 'Frost Volley']
  );
  assert.equal(result.endState.profession.conjureEquipped, 'Frost Bow');
  assert.equal(result.warnings.length, 0);
});

test('Rock Barrier starts its root recharge when Hurl is used', () => {
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Arcane']],
    rotation: ['Rock Barrier', 'Hurl', 'Rock Barrier'],
    weapons: ['Scepter', 'Warhorn'],
    startAttunement: 'Earth'
  });
  const actions = result.events.filter((event) => event.type === 'action');
  const barriers = actions.filter((event) => event.skillName === 'Rock Barrier');
  const hurl = actions.find((event) => event.skillName === 'Hurl');

  assert.equal(barriers.length, 2);
  assert.equal(barriers[0].rechargeReadyAt, null);
  assert.equal(barriers[1].at - hurl.endsAt, elementalistCatalog.skillsByName.get('Rock Barrier').cooldown / 1.25);
});

test('Pistol bullets grant, consume, and apply their payload', () => {
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Arcane']],
    rotation: ['Raging Ricochet', 'Raging Ricochet'],
    weapons: ['Pistol', 'Warhorn']
  });

  assert.equal(result.endState.profession.pistolBullets.Fire, false);
  assert.equal(
    result.events.some(
      (event) => event.type === 'buff' && event.source === 'Raging Ricochet' && event.kind === 'might'
    ),
    true
  );

  const unavailableExplosion = runNative({
    lines: [['Fire'], ['Air'], ['Arcane']],
    rotation: ['Elemental Explosion'],
    weapons: ['Pistol', 'Warhorn']
  });

  assert.equal(
    unavailableExplosion.events.some((event) => event.type === 'action' && event.skillName === 'Elemental Explosion'),
    false
  );
  assert.match(unavailableExplosion.warnings[0], /all four elemental bullets/i);

  const explosion = runNative({
    lines: [['Fire'], ['Air'], ['Arcane']],
    rotation: ['Elemental Explosion'],
    weapons: ['Pistol', 'Warhorn'],
    pistolBullets: { Fire: true, Water: true, Air: true, Earth: true }
  });

  assert.deepEqual(explosion.warnings, []);
  assert.equal(
    explosion.events.some((event) => event.type === 'action' && event.skillName === 'Elemental Explosion'),
    true
  );
  assert.deepEqual(explosion.endState.profession.pistolBullets, {
    Fire: false,
    Water: false,
    Air: false,
    Earth: false
  });
});

test('Hammer orbs block reuse and Grand Finale cancels future packets', () => {
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Arcane']],
    rotation: ['Flame Wheel', 'Flame Wheel', 'Grand Finale', 8000],
    weapons: ['Hammer', ''],
    gear: Object.fromEntries(
      Object.keys(elementalistProfession.createBuildDefaults().gear).map((slot) => [slot, "Assassin's"])
    ),
    weaponSigils: [
      ['Air', 'Accuracy'],
      ['Air', 'Accuracy']
    ]
  });

  assert.equal(result.events.filter((event) => event.type === 'action' && event.skillName === 'Flame Wheel').length, 1);
  assert.equal(result.endState.profession.hammerOrbs.Fire, null);
  assert.equal(
    result.events.some((event) => event.cancelled && event.detail === 'cancelled by Grand Finale'),
    true
  );
  assert.equal(
    result.warnings.some((warning) => warning.includes('Grand Finale must consume the active orb')),
    true
  );
  const finale = result.events.find((event) => event.type === 'action' && event.skillName === 'Grand Finale');
  const finaleHits = result.events.filter((event) => event.type === 'damage' && event.skillName === 'Grand Finale');

  assert.equal(finaleHits.length, 1);
  assert.ok(finaleHits[0].at > finale.endsAt);
  const airProcs = result.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.skillName === 'Sigil of Air'
  );

  assert.equal(airProcs.length, 1);
  assert.equal(airProcs[0].triggeredBy, 'Grand Finale');
});

test('Hammer orb strikes carry Burning and feed Fresh Air', () => {
  const packets = runNative({
    lines: [['Fire'], ['Air'], ['Arcane']],
    rotation: ['Flame Wheel', 16000],
    weapons: ['Hammer', ''],
    startAttunement: 'Fire'
  });
  const strikes = packets.events.filter((event) => event.type === 'damage' && event.skillName === 'Flame Wheel');
  const burning = packets.events.filter((event) => event.type === 'condition' && event.skillName === 'Flame Wheel');

  // Orb conditions follow their strikes, independent of the authored pulse schedule.
  assert.ok(strikes.length > 1);
  assert.deepEqual(
    burning.map((event) => [event.at, event.condition]),
    strikes.map((event) => [event.at, 'Burning'])
  );

  const freshAir = runNative({
    lines: [['Fire'], ['Air', '3-3-2'], ['Arcane']],
    rotation: ['Fire Attunement', 'Flame Wheel', 'Air Attunement'],
    weapons: ['Hammer', ''],
    startAttunement: 'Air'
  });
  const returnToAir = freshAir.events.find((event) => event.type === 'elementalist.attunement' && event.to === 'Air');
  const reset = freshAir.events.find((event) => event.type === 'elementalist.fresh-air');

  assert.ok(reset);
  assert.equal(returnToAir.at, reset.at);
});

test('Spear etchings upgrade after three other casts', () => {
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Arcane']],
    rotation: ['Etching: Volcano', 'Flame Spear', 'Seethe', 'Blazing Barrage', 'Volcano'],
    weapons: ['Spear', '']
  });

  assert.equal(
    result.events.some((event) => event.type === 'action' && event.skillName === 'Volcano'),
    true
  );
  assert.equal(result.endState.profession.etchings['Etching: Volcano'], null);
});

test('Spear etching stages replace one another in the weapon palette', () => {
  const family = ['Etching: Volcano', 'Lesser Volcano', 'Volcano'].map((name) =>
    elementalistCatalog.skillsByName.get(name)
  );
  const displayed = (progress) =>
    elementalistProfession.ui
      .paletteWeaponSkills(
        {
          build: { weapons: ['Spear', ''] },
          professionState: {
            etchings: progress ? { 'Etching: Volcano': progress } : {}
          }
        },
        family
      )
      .map((skill) => skill.name);

  assert.deepEqual(displayed(null), ['Etching: Volcano']);
  assert.deepEqual(displayed({ stage: 'lesser', otherCasts: 0 }), ['Lesser Volcano']);
  assert.deepEqual(displayed({ stage: 'full', otherCasts: 3 }), ['Volcano']);
});

test('Alacrity shortens overload dwell and Lucid Singularity follows hit timing', () => {
  const simulate = (alacrity) =>
    runNative({
      lines: [['Fire'], ['Air'], ['Tempest', '1-2-2']],
      rotation: [1000, 'Fire Attunement', 'Overload Fire'],
      startAttunement: 'Air',
      assumptions: { ...elementalistProfession.createBuildDefaults().assumptions, alacrity }
    });
  const result = simulate(true);
  const baseline = simulate(false);

  const attunement = result.events.find((event) => event.type === 'elementalist.attunement' && event.to === 'Fire');
  const overload = result.events.find((event) => event.type === 'action' && event.skillName === 'Overload Fire');
  const alacrity = result.events.filter((event) => event.type === 'buff' && event.source === 'Lucid Singularity');

  const baseEntry = baseline.events.find((event) => event.type === 'elementalist.attunement' && event.to === 'Fire');
  const baseOverload = baseline.events.find((event) => event.type === 'action' && event.skillName === 'Overload Fire');
  // Dwell scales with Alacrity; the trait follows overload hits and rewards completion.
  assert.ok(Math.abs(overload.at - attunement.at - (baseOverload.at - baseEntry.at) / 1.25) < 0.001);
  const hits = result.events.filter((event) => event.type === 'damage' && event.skillName === 'Overload Fire');
  assert.ok(alacrity.length > 1);
  assert.ok(alacrity.every((buff) => hits.some((hit) => hit.at === buff.at) || buff.at === overload.endsAt));
  assert.ok(alacrity.at(-1).duration > alacrity[0].duration);
});

test('Tempest always starts with its initial overload available', () => {
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Tempest', '3-2-1']],
    rotation: ['Overload Air'],
    startAttunement: 'Air'
  });
  const overload = result.events.find((event) => event.type === 'action' && event.skillName === 'Overload Air');

  assert.equal(overload.at, 0);
});

test('Transcendent Tempest precedes same-time Overload completion damage', () => {
  const withTrait = runNative({
    lines: [['Fire'], ['Air'], ['Tempest', '3-2-1']],
    rotation: ['Overload Air'],
    startAttunement: 'Air'
  });
  const withoutTrait = runNative({
    lines: [['Fire'], ['Air'], ['Tempest', '3-2-2']],
    rotation: ['Overload Air'],
    startAttunement: 'Air'
  });
  const action = withTrait.events.find((event) => event.type === 'action' && event.skillName === 'Overload Air');
  const buff = withTrait.events.find((event) => event.type === 'buff' && event.kind === 'transcendent-tempest');
  const damageAtCompletion = (result, name) =>
    result.resolvedEvents
      .filter((event) => event.type === 'damage' && event.skillName === name)
      .sort((left, right) => left.at - right.at)
      .at(-1);
  const finalWithTrait = damageAtCompletion(withTrait, 'Overload Air');
  const finalWithoutTrait = damageAtCompletion(withoutTrait, 'Overload Air');
  const joltWithTrait = damageAtCompletion(withTrait, 'Lightning Jolt');
  const joltWithoutTrait = damageAtCompletion(withoutTrait, 'Lightning Jolt');
  const completionOrder = withTrait.events
    .filter((event) => Math.abs(event.at - action.endsAt) < 0.0001)
    .map((event) => event.kind || event.skillName);

  assert.equal(buff.at, action.endsAt);
  assert.ok(completionOrder.indexOf('transcendent-tempest') < completionOrder.indexOf('Lightning Jolt'));
  assert.equal(finalWithTrait.damage, finalWithoutTrait.damage);
  assert.ok(joltWithTrait.damage > joltWithoutTrait.damage);
});

test('Overload Air grants separate non-critical Lightning Jolts to the player and active elemental', () => {
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Tempest', '3-2-1']],
    rotation: ['Glyph of Elementals', 'Overload Air', 10000],
    startAttunement: 'Air',
    targetHealth: 0
  });
  const jolts = result.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.skillName === 'Lightning Jolt'
  );
  const playerJolt = jolts.find((event) => event.actorType === 'effect');
  const elementalJolt = jolts.find((event) => event.actorType === 'summon');
  const triggeringElementalStrike = result.resolvedEvents.find(
    (event) =>
      event.type === 'damage' &&
      event.actorType === 'summon' &&
      event.skillName !== 'Lightning Jolt' &&
      event.at === elementalJolt?.at
  );

  assert.equal(jolts.length, 2);
  assert.equal(playerJolt.weaponStrengthProfileId, 'nonweapon.unequipped');
  assert.equal(playerJolt.criticalChance, 0);
  assert.equal(elementalJolt.weaponStrengthProfileId, playerJolt.weaponStrengthProfileId);
  assert.equal(elementalJolt.criticalChance, 0);
  assert.equal(elementalJolt.independentSummonStrike, true);
  assert.equal(elementalJolt.summonUsesMight, false);
  assert.equal(elementalJolt.summonUsesProfessionModifiers, false);
  assert.ok(elementalJolt.at > playerJolt.at);
  assert.ok(triggeringElementalStrike);
});
