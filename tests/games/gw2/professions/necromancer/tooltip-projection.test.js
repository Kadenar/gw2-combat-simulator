import { describeSimulationSkill, describeSimulationTrait } from '#gw2/app/shared/simulation-tooltip.js';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import { necromancerTooltips } from '#gw2/professions/necromancer/app/tooltips.js';
import { necromancerStrike } from '#gw2/professions/necromancer/core/mechanics/combat-boundaries.js';
import { bindTriggerPoints } from '#tests/helpers/trigger-points.js';
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import { necromancerProfession } from '#gw2/professions/necromancer/profession.js';
import { darkBarrageEffects } from '#gw2/professions/necromancer/specializations/harbinger/mechanics/dark-barrage.js';
import { spiritDefinition } from '#gw2/professions/necromancer/specializations/ritualist/mechanics/spirits.js';
import { captureEffectEmissions } from '#tests/helpers/effect-emission.js';
import { createObservedProfessionSimulator } from '#tests/helpers/observed-runtime.js';
import assert from 'node:assert/strict';
import test from 'node:test';

const BARRAGE = 'necromancer.harbinger.dark-barrage-doom-approaches';
const SHADE = 'necromancer.scourge.shade';
const WANDERLUST = 'necromancer.ritualist.spirit.wanderlust';

// Trait selection changes displayed ally grants without mutating the shared skill or ignoring patched counts.
test('weapon-spell tooltips project Wielders Boon from the build and selected skill values', () => {
  const profession = preview({
    skills: Object.fromEntries(
      [ID.NIGHTMARE_WEAPON, ID.SPLINTER_WEAPON].map((id) => [
        id,
        {
          effects: [{ type: 'buff', stacks: 7, allyStacks: 2 }]
        }
      ])
    )
  });
  for (const [patchId, personal, allied] of [
    ['current', 5, 3],
    ['tooltip-projection', 7, 2]
  ]) {
    const context = profession.balanceContextFor(patchId);

    for (const id of [ID.NIGHTMARE_WEAPON, ID.SPLINTER_WEAPON]) {
      const skill = context.catalog.skillsById.get(id);
      for (const enabled of [false, true, false]) {
        const build = { specializations: [{ name: 'Ritualist', traits: enabled ? '1-1-1' : '1-1-2' }] };
        const model = describeSimulationSkill(context, skill, necromancerTooltips, build);
        const grant = model.facts.find(({ name }) => name === skill.name);
        assert.ok(
          grant.detail.includes(`${personal} charges on yourself · ${enabled ? personal : allied} charges on each ally`)
        );
        assert.equal(grant.stacks, personal);
        assert.equal(grant.icon, skill.icon);
        assert.equal(skill.effects.find(({ type }) => type === 'buff').allyStacks, allied);
      }
    }

    const trait = context.catalog.traits.find(({ id }) => id === TRAIT.WIELDERS_BOON);
    const model = describeSimulationTrait(context, trait, necromancerTooltips);
    for (const name of ['Nightmare Weapon', 'Splinter Weapon']) {
      assert.equal(model.facts.find((fact) => fact.name === name).detail, `${allied} → ${personal} charges per ally`);
    }
  }
});

/** One selected preview drives both tooltip construction and minimal native simulations. */
function preview(edits) {
  return withPatchPreview(necromancerProfession, {
    id: 'tooltip-projection',
    label: 'Tooltip projection',
    professions: { necromancer: edits }
  });
}

function skillFacts(context, id) {
  const model = describeSimulationSkill(context, context.catalog.skillsById.get(id), necromancerTooltips);
  assert.ok(!model.incomplete);
  return model.facts;
}

function simulate(profession, patchId, specialization, rotation, selectedTraitIds = []) {
  const result = createObservedProfessionSimulator(profession, {
    stats: { power: 2000, precision: 1000, conditionDamage: 1000, expertise: 0 },
    target: { armor: 2597, health: 1_000_000 }
  })(specialization, rotation, { patchId, initialResource: 100, selectedTraitIds });
  assert.deepEqual(result.warnings, []);
  return result;
}

// A volley edit controls both consumers; unsupported effects must not acquire invented repeated applications.
test('Dark Barrage shares selected pulse expansion and ignores added boons in combat and tooltips', () => {
  const profession = preview({
    balanceProfiles: {
      [BARRAGE]: {
        effects: [
          { type: 'strike', name: 'Strike', coefficient: 0.75 },
          { type: 'condition', name: 'Torment', stacks: 2, duration: 5 }
        ],
        addEffects: [{ type: 'boon', name: 'Unused Might', boon: 'might', stacks: 9, duration: 7 }]
      }
    }
  });
  for (const patchId of ['current', 'tooltip-projection']) {
    const patched = patchId === 'tooltip-projection';
    const count = 8;
    const facts = skillFacts(profession.balanceContextFor(patchId), ID.DARK_BARRAGE).filter(({ detail }) =>
      detail.includes('with Doom Approaches;')
    );
    assert.equal(
      facts.some(({ name }) => name === 'Might'),
      false
    );
    assert.equal(
      facts.find(({ name }) => name === 'Strike damage').detail,
      `${patched ? '6' : '4.8'} coefficient total · ${count} hits — with Doom Approaches; replaces base volley · Strike`
    );
    const torment = facts.find(({ name }) => name === 'Torment');
    assert.equal(torment.applications, count);
    assert.equal(torment.stacks, patched ? 2 : 1);
    const result = simulate(
      profession,
      patchId,
      'Harbinger',
      ['Harbinger Shroud', 'Dark Barrage', { type: 'wait', durationMs: 1000 }],
      [TRAIT.DOOM_APPROACHES]
    );
    const packets = result.events.filter((event) => event.skillId === ID.DARK_BARRAGE);
    const strikes = packets.filter(({ type }) => type === 'damage');
    assert.equal(strikes.length, count);
    assert.ok(strikes.every(({ coefficient }) => coefficient === (patched ? 0.75 : 0.6)));
    const conditions = packets.filter(({ type, condition }) => type === 'condition' && condition === 'Torment');
    assert.equal(conditions.length, count);
    assert.ok(conditions.every(({ stacks, duration }) => stacks === torment.stacks && duration === (patched ? 5 : 3)));
    assert.equal(
      result.resolvedEvents.some((event) => event.type === 'buff' && event.kind === 'might' && event.stacks === 9),
      false
    );
  }
});

// Independently removed packets and an empty profile must not fall back to a base volley or an untimed effect.
test('Dark Barrage preserves strike and condition removal and an empty selected volley', () => {
  for (const mode of ['strike', 'condition', 'empty']) {
    const profession = preview({
      balanceProfiles: {
        [BARRAGE]:
          mode === 'empty'
            ? {
                removeEffects: [
                  { type: 'strike', name: 'Strike' },
                  { type: 'condition', name: 'Torment' }
                ]
              }
            : { removeEffects: [{ type: mode, name: mode === 'strike' ? 'Strike' : 'Torment' }] }
      }
    });
    const facts = skillFacts(profession.balanceContextFor('tooltip-projection'), ID.DARK_BARRAGE).filter(({ detail }) =>
      detail.includes('with Doom Approaches;')
    );
    const result = simulate(
      profession,
      'tooltip-projection',
      'Harbinger',
      ['Harbinger Shroud', 'Dark Barrage', { type: 'wait', durationMs: 1000 }],
      [TRAIT.DOOM_APPROACHES]
    );
    const packets = result.events.filter((event) => event.skillId === ID.DARK_BARRAGE);
    assert.equal(
      facts.some(({ name }) => name === 'Strike damage'),
      mode === 'condition'
    );
    assert.equal(
      packets.some(({ type }) => type === 'damage'),
      mode === 'condition'
    );
    assert.equal(
      facts.some(({ name }) => name === 'Torment'),
      mode === 'strike'
    );
    assert.equal(
      packets.some(({ type, condition }) => type === 'condition' && condition === 'Torment'),
      mode === 'strike'
    );
  }
});

// Core retains trait tuning while each selected elite supplies only its own duration and cooldown overrides.
test('Dhuumfire tooltip and combat agree on selected stacks and specialization durations', () => {
  const profession = preview({
    skills: { [ID.TAINTED_BOLTS]: { fields: { dhuumfireDuration: 5 } } },
    balanceProfiles: {
      [TRAIT.DHUUMFIRE]: { effects: [{ type: 'condition', name: 'Burning', stacks: 2, duration: 7 }] },
      [SHADE]: { fields: { dhuumfireDuration: 4, dhuumfireInterval: 2 } }
    }
  });
  for (const [specialization, rotation, live, patched] of [
    ['Core', ['Death Shroud', 'Life Blast'], 3, 7],
    ['Harbinger', ['Harbinger Shroud', 'Tainted Bolts'], 1, 5],
    ['Scourge', ['Manifest Sand Shade'], 2, 4]
  ]) {
    for (const patchId of ['current', 'tooltip-projection']) {
      const context = profession.balanceContextFor(patchId);
      const facts = describeSimulationTrait(
        context,
        context.catalog.traits.find(({ id }) => id === TRAIT.DHUUMFIRE),
        necromancerTooltips,
        specialization
      ).facts;
      const burning = facts.find(({ name }) => name === 'Burning');
      const duration = patchId === 'current' ? live : patched;
      assert.ok(burning.detail.startsWith(`${duration}s`));
      assert.equal(burning.stacks, patchId === 'current' ? 1 : 2);
      if (specialization === 'Scourge')
        assert.equal(
          facts.find(({ name }) => name === 'Internal cooldown').detail,
          patchId === 'current' ? '1s' : '2s'
        );
      const result = simulate(
        profession,
        patchId,
        specialization,
        [...rotation, { type: 'wait', durationMs: 1000 }],
        [TRAIT.DHUUMFIRE]
      );
      const applications = result.resolvedEvents.filter(
        (event) => event.sourceId === TRAIT.DHUUMFIRE && event.type === 'condition'
      );
      assert.ok(applications.length > 0);
      assert.ok(applications.every((event) => event.duration === duration));
      // Resolution splits intensity stacks into individual entries; each isolated hit has its own timestamp.
      const stacksByImpact = new Map();
      for (const event of applications)
        stacksByImpact.set(event.at, (stacksByImpact.get(event.at) ?? 0) + event.stacks);
      assert.ok([...stacksByImpact.values()].every((stacks) => stacks === burning.stacks));
    }
  }
});

// Removed Burning neither claims the proc cooldown nor exposes unrelated profile effects as Dhuumfire payloads.
test('Dhuumfire removal leaves the cooldown unclaimed and unrelated conditions out of the tooltip', () => {
  const profession = preview({
    balanceProfiles: {
      [TRAIT.DHUUMFIRE]: {
        removeEffects: [{ type: 'condition', name: 'Burning' }],
        addEffects: [{ type: 'condition', name: 'Unused Poison', condition: 'Poisoned', stacks: 9, duration: 7 }]
      }
    }
  });
  const context = profession.balanceContextFor('tooltip-projection');
  const emitted = captureEffectEmissions();
  let claims = 0;
  const runtime = {
    catalog: context.catalog,
    config: { selectedTraitIds: [TRAIT.DHUUMFIRE] },
    effects: emitted.effects,
    procs: {
      claimCooldown() {
        claims++;
        return true;
      }
    }
  };
  dhuumfireOpportunity(
    runtime,
    { type: 'damage', at: 0, skillName: 'Fixture', metadata: { dhuumfireDuration: 4, dhuumfireInterval: 2 } },
    5,
    true
  );
  assert.equal(claims, 0);
  assert.deepEqual(emitted.events, []);
  for (const specialization of ['Core', 'Harbinger', 'Scourge']) {
    const facts = describeSimulationTrait(
      context,
      context.catalog.traits.find(({ id }) => id === TRAIT.DHUUMFIRE),
      necromancerTooltips,
      specialization
    ).facts;
    assert.equal(
      facts.some(({ name }) => name === 'Burning' || name === 'Poisoned'),
      false
    );
  }
});

// Metadata wins over the skill and trait; a zero cooldown permits independent same-time reactions.
test('Dhuumfire metadata precedence and zero-cooldown behavior survive projection extraction', () => {
  const context = preview({
    balanceProfiles: { [TRAIT.DHUUMFIRE]: { effects: [{ type: 'condition', name: 'Burning', duration: 7 }] } }
  }).balanceContextFor('tooltip-projection');
  const emitted = captureEffectEmissions();
  const runtime = {
    catalog: context.catalog,
    config: { selectedTraitIds: [TRAIT.DHUUMFIRE] },
    effects: emitted.effects,
    procs: {
      claimCooldown() {
        assert.fail('Zero interval must not claim a cooldown');
      }
    }
  };
  for (const [metadata, skillDuration] of [
    [{ dhuumfireDuration: 4, dhuumfireInterval: 0 }, 5],
    [undefined, 5],
    [undefined, undefined]
  ]) {
    dhuumfireOpportunity(runtime, { type: 'damage', at: 0, skillName: 'Fixture', metadata }, skillDuration, true);
  }

  assert.deepEqual(
    emitted.events.map(({ duration }) => duration),
    [4, 5, 7]
  );
});

// Pulse count belongs to volley authoring; an empty timeline must not materialize a default single application.
test('Dark Barrage projection supports authored pulse counts without manufacturing empty-volley packets', () => {
  const context = preview({}).balanceContextFor('current');
  const profile = context.catalog.balanceProfilesById.get(BARRAGE);
  const volley = darkBarrageEffects({ ...profile, pulseCount: 3 }, profile.effects);
  assert.ok(volley.every((effect) => effect.ticks.length === 3));
  assert.deepEqual(darkBarrageEffects({ ...profile, pulseCount: 0 }, profile.effects), []);
});

// A strike named for another spirit is not executable; surviving command packets keep their original role.
test('Ritualist attack projections reject cross-spirit packets and preserve selected command tuning', () => {
  const profession = preview({
    balanceProfiles: {
      [WANDERLUST]: {
        removeEffects: [{ type: 'strike', name: 'Wanderlust Initial Swing' }],
        effects: [{ type: 'strike', name: 'Summon Spirits - Wanderlust', coefficient: 6 }],
        addEffects: [{ type: 'strike', name: 'Anguish Initial Barrage', coefficient: 99 }]
      }
    }
  });
  for (const patchId of ['current', 'tooltip-projection']) {
    const context = profession.balanceContextFor(patchId);
    const patched = patchId === 'tooltip-projection';
    const summon = skillFacts(context, ID.WANDERLUST);
    assert.equal(
      summon.some(({ detail }) => detail.includes('Anguish Initial Barrage')),
      false
    );
    assert.equal(
      summon.some(({ detail }) => detail.includes('Wanderlust Initial Swing')),
      !patched
    );
    assert.equal(
      summon.some(({ detail }) => detail.includes('Summon Spirits - Wanderlust')),
      false
    );
    const command = skillFacts(context, ID.SUMMON_SPIRITS).find(({ detail }) =>
      detail.includes('Summon Spirits - Wanderlust')
    );
    assert.ok(command.detail.startsWith(`${patched ? 6 : 3.7} coefficient`));
    const definition = spiritDefinition(context, ID.WANDERLUST);
    assert.equal(definition.summonTicks.length, patched ? 0 : 1);
    assert.equal(definition.activeTicks[0].coefficient, patched ? 6 : 3.7);
    const result = simulate(profession, patchId, 'Ritualist', [
      "Ritualist's Shroud",
      'Wanderlust',
      { type: 'wait', durationMs: 2000 },
      'Summon Spirits',
      { type: 'wait', durationMs: 2000 }
    ]);
    const attacks = result.resolvedEvents.filter(
      (event) => event.type === 'damage' && event.metadata?.spiritAttackType === 'summon-spirits'
    );
    assert.ok(attacks.length > 0);
    assert.ok(attacks.every(({ coefficient }) => coefficient === (patched ? 6 : 3.7)));
  }
});

/** Projection contracts use the selected trait's registered strike listener. */
function dhuumfireOpportunity(runtime, event, dhuumfireDuration, shroudSkillOne) {
  bindTriggerPoints(runtime, necromancerProfession, runtime.config);
  runtime.fireTrigger(necromancerStrike, {
    event: { coefficient: 1, ...event },
    details: {},
    firstHit: true,
    dhuumfireDuration,
    shroudSkillOne
  });
}
