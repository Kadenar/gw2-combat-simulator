import assert from 'node:assert/strict';
import test from 'node:test';
import { runNative } from '../../helpers/elementalist-simulation.js';
import { elementalistCatalog } from '#gw2/professions/elementalist/catalog.js';
import { elementalistProfession } from '#gw2/professions/elementalist/definition.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import { applyBalanceProfilePatch } from '#gw2/integrations/patches/authoring/patches.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import { WEAVER_BALANCE_PROFILE_IDS } from '#gw2/professions/elementalist/specializations/weaver/profiles.js';
import { handlePrimordialStanceTick } from '#gw2/professions/elementalist/specializations/weaver/mechanics/primordial-stance.js';

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
