import assert from 'node:assert/strict';
import test from 'node:test';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import { applySkillPatch } from '#gw2/integrations/patches/authoring/patches.js';
import { createCanonicalCatalog } from '#gw2/platform/skills/catalog.js';
import { requireEffect } from '#gw2/platform/skills/balance-profiles.js';
import { describeSimulationSkill } from '#gw2/app/shared/simulation-tooltip.js';
import { elementalistProfession, elementalistCatalog } from '#gw2/professions/elementalist/profession.js';
import { elementalistTooltips } from '#gw2/professions/elementalist/app/tooltips.js';
import {
  ELEMENTALIST_SKILL_IDS as ID,
  ELEMENTALIST_TRAIT_IDS as TRAIT
} from '#gw2/professions/elementalist/data/ids.js';
import { runElementalist } from '#tests/helpers/elementalist-simulation.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';

// Edit the same skill catalog used by runtime and tooltips; no profile aliases participate.
function preview(skills) {
  return withPatchPreview(elementalistProfession, {
    id: 'side-effect-ownership',
    label: 'Side-effect ownership',
    professions: { elementalist: { skills } }
  });
}

const cases = [
  [ID.FROSTFIRE_FLURRY, 'Fire', 'Water'],
  [ID.PURBLINDING_PLASMA, 'Fire', 'Air'],
  [ID.MOLTEN_METEOR, 'Fire', 'Earth'],
  [ID.FLOWING_FINESSE, 'Air', 'Water'],
  [ID.ENERVATING_EARTH, 'Air', 'Earth']
];

test('Overload Air action patches control both Lightning Jolts and removal suppresses the charge and announcement', () => {
  for (const glyphName of [null, 'Glyph of Elementals', 'Glyph of Elementals (Earth)']) {
    const glyph = glyphName ? elementalistCatalog.skills.find((candidate) => candidate.name === glyphName) : null;
    for (const removed of [false, true]) {
      const profession = preview({
        [ID.OVERLOAD_AIR]: {
          sideEffects: {
            'lightning-jolt': removed
              ? { removeEffects: [{ type: 'strike', name: 'Overload Air - Lightning Jolt' }] }
              : { effects: [{ type: 'strike', name: 'Overload Air - Lightning Jolt', coefficient: 2.5 }] }
          }
        }
      });
      const result = runElementalist(
        [
          ...(glyph ? [{ type: 'cast', skillId: glyph.id }] : []),
          { type: 'cast', skillId: ID.OVERLOAD_AIR },
          { type: 'wait', durationMs: 10000 }
        ],
        {
          patchId: 'side-effect-ownership',
          specialization: 'Tempest',
          startAttunement: 'Air',
          selectedSkillIds: glyph ? [glyph.id] : [],
          selectedTraitIds: [TRAIT.TRANSCENDENT_TEMPEST]
        },
        { profession }
      );
      assert.deepEqual(result.warnings, []);
      const jolts = result.resolvedEvents.filter(
        (event) => event.type === 'damage' && event.skillName === 'Lightning Jolt'
      );
      // A represented elemental consumes its own captured charge once; the player copy is independent.
      assert.equal(jolts.filter((event) => event.actorType === 'effect').length, removed ? 0 : 1);
      assert.equal(jolts.filter((event) => event.actorType === 'summon').length, !removed && glyph ? 1 : 0);
      for (const jolt of jolts) {
        assert.equal(jolt.coefficient, 2.5);
        assert.equal(jolt.criticalChance, 0);
        assert.equal(jolt.sourceId, ID.LIGHTNING_JOLT);
      }

      assert.equal(observedRuntime(result).profession.specialization.state.pendingLightningJolt, null);
      assert.equal(
        result.events.some((event) => event.type === 'proc' && event.name === 'Lightning Jolt'),
        !removed
      );
      assert.ok(result.resolvedEvents.some((event) => event.type === 'damage' && event.skillName === 'Overload Air'));
      const context = profession.resolvePatch({ id: 'side-effect-ownership' }).balanceContext;
      const model = describeSimulationSkill(
        context,
        context.catalog.skillsById.get(ID.OVERLOAD_AIR),
        elementalistTooltips
      );
      assert.equal(
        model.facts.some(
          (fact) => fact.detail.includes('2.5 coefficient') && fact.detail.includes('additional completion strike')
        ),
        !removed
      );
    }
  }
});

test('Fulgor action patches reach procedural damage and tooltips without changing ordinary attacks', () => {
  const profession = preview({
    [ID.FULGOR]: {
      sideEffects: {
        pulses: {
          effects: [
            { type: 'strike', name: 'Fulgor', tickIndex: 'all', flatStrikeBase: 321, flatStrikePowerCoeff: 0.2 }
          ]
        }
      }
    }
  });
  const result = runElementalist(
    [
      { type: 'cast', skillId: ID.FULGOR },
      { type: 'wait', durationMs: 1500 }
    ],
    {
      patchId: 'side-effect-ownership',
      specialization: 'Core',
      primaryWeapon: 'Spear',
      startAttunement: 'Air',
      selectedTraitIds: []
    },
    { profession }
  );
  assert.deepEqual(result.warnings, []);
  const action = result.events.find((event) => event.type === 'action' && event.skillId === ID.FULGOR);
  const pulses = result.resolvedEvents.filter((event) => event.type === 'damage' && event.actorType === 'effect');
  assert.ok(pulses.length > 0);
  assert.ok(
    pulses.every(
      (event) =>
        event.flatStrikeBase === 321 &&
        event.flatStrikePowerCoeff === 0.2 &&
        event.canCrit === false &&
        event.activationId === action.activationId
    )
  );
  assert.ok(
    result.events.some((event) => event.type === 'damage' && event.actorType === 'player' && event.coefficient === 0.4)
  );
  assert.ok(result.events.some((event) => event.condition === 'Vulnerability'));
  const context = profession.resolvePatch({ id: 'side-effect-ownership' }).balanceContext;
  const model = describeSimulationSkill(context, context.catalog.skillsById.get(ID.FULGOR), elementalistTooltips);
  assert.ok(
    model.facts.some((fact) => fact.detail.includes('321 base damage') && fact.detail.includes('additional pulses'))
  );
});

test('Fulgor still rejects removal of its required procedural timeline', () => {
  // Ownership changes must not turn a previously invalid declaration into a silent partial cast.
  const profession = preview({
    [ID.FULGOR]: {
      sideEffects: {
        pulses: {
          removeEffects: [{ type: 'strike', name: 'Fulgor' }]
        }
      }
    }
  });
  assert.throws(
    () =>
      runElementalist(
        [{ type: 'cast', skillId: ID.FULGOR }],
        {
          patchId: 'side-effect-ownership',
          specialization: 'Core',
          primaryWeapon: 'Spear',
          startAttunement: 'Air',
          selectedTraitIds: []
        },
        { profession }
      ),
    /Fulgor requires an explicit strike timeline/
  );
});

test('Fervent Stance owns its expiry and later dual-attack reward independently of immediate boons', () => {
  for (const removed of [false, true]) {
    const profession = preview({
      [ID.FERVENT_STANCE]: {
        fields: { duration: 1 },
        sideEffects: {
          'dual-attack-might': removed
            ? { removeEffects: [{ type: 'boon', name: 'Might' }] }
            : { effects: [{ type: 'boon', name: 'Might', stacks: 7, duration: 11 }] }
        }
      }
    });
    for (const expired of [false, true]) {
      const result = runElementalist(
        [
          { type: 'cast', skillId: ID.FERVENT_STANCE },
          ...(expired ? [{ type: 'wait', durationMs: 1100 }] : []),
          { type: 'cast', skillId: ID.FROSTFIRE_FLURRY }
        ],
        {
          patchId: 'side-effect-ownership',
          specialization: 'Weaver',
          primaryWeapon: 'Pistol',
          startAttunement: 'Fire',
          secondaryAttunement: 'Water',
          selectedTraitIds: [],
          selectedSkillIds: [ID.FERVENT_STANCE]
        },
        { profession }
      );
      assert.deepEqual(result.warnings, []);
      const reward = result.events.find((event) => event.kind === 'might' && event.source === 'Fervent Stance');
      assert.equal(Boolean(reward), !removed && !expired);

      if (reward) {
        const dual = result.events.find((event) => event.type === 'action' && event.skillId === ID.FROSTFIRE_FLURRY);
        assert.equal(reward.at, dual.endsAt);
        assert.equal(reward.activationId, dual.activationId);
        assert.equal(reward.stacks, 7);
        assert.equal(reward.duration, 11);
      }

      for (const kind of ['swiftness', 'fury', 'quickness'])
        assert.ok(result.events.some((event) => event.kind === kind && event.sourceId === ID.FERVENT_STANCE));
    }

    const context = profession.resolvePatch({ id: 'side-effect-ownership' }).balanceContext;
    const model = describeSimulationSkill(
      context,
      context.catalog.skillsById.get(ID.FERVENT_STANCE),
      elementalistTooltips
    );
    assert.equal(
      model.facts.some((fact) => fact.detail.includes('11s') && fact.detail.includes('per completed dual attack')),
      !removed
    );
  }
});

test('Elemental Explosion selects the live attunement aura and consumes all bullets even if that aura is removed', () => {
  for (const [element, aura] of [
    ['Fire', 'Fire Aura'],
    ['Water', 'Frost Aura'],
    ['Air', 'Shocking Aura'],
    ['Earth', 'Magnetic Aura']
  ]) {
    for (const removed of [false, true]) {
      const profession = preview({
        [ID.ELEMENTAL_EXPLOSION]: {
          sideEffects: {
            'attunement-aura': removed
              ? { removeEffects: [{ type: 'aura', name: element }] }
              : { effects: [{ type: 'aura', name: element, duration: 7 }] }
          }
        }
      });
      const result = runElementalist(
        [
          { type: 'cast', skillId: ID.ELEMENTAL_EXPLOSION },
          { type: 'wait', durationMs: 1000 }
        ],
        {
          patchId: 'side-effect-ownership',
          specialization: 'Core',
          primaryWeapon: 'Pistol',
          startAttunement: element === 'Fire' ? 'Water' : 'Fire',
          selectedTraitIds: [],
          pistolBullets: { Fire: true, Water: true, Air: true, Earth: true }
        },
        {
          profession,
          timeline: [
            {
              at: 0.1,
              run(runtime) {
                runtime.profession.core.primaryAttunement = element;
              }
            }
          ]
        }
      );
      assert.deepEqual(result.warnings, []);
      assert.equal(
        result.events.some((event) => event.type === 'aura' && event.aura === aura && event.duration === 7),
        !removed
      );
      assert.ok(!Object.values(observedRuntime(result).profession.core.pistolBullets).some(Boolean));
      assert.ok(result.events.some((event) => event.type === 'condition' && event.condition === 'Burning'));
      const context = profession.resolvePatch({ id: 'side-effect-ownership' }).balanceContext;
      const model = describeSimulationSkill(
        context,
        context.catalog.skillsById.get(ID.ELEMENTAL_EXPLOSION),
        elementalistTooltips
      );
      assert.equal(
        model.facts.some((fact) => fact.name === aura && fact.detail.includes('7s')),
        !removed
      );
    }
  }
});

test('all Primordial Stance variants use the canonical action patch while sampling both live hands', () => {
  for (const removedType of [null, 'strike', 'condition']) {
    const profession = preview({
      [ID.PRIMORDIAL_STANCE_FIRE]: {
        sideEffects: {
          pulses: {
            effects: [
              { type: 'strike', name: 'Primordial Stance', coefficient: 0.57 },
              { type: 'condition', name: 'Fire', stacks: 3, duration: 7 }
            ],
            ...(removedType
              ? {
                  removeEffects: [{ type: removedType, name: removedType === 'strike' ? 'Primordial Stance' : 'Fire' }]
                }
              : {})
          }
        }
      }
    });
    for (const element of ['Fire', 'Water', 'Air', 'Earth']) {
      const id = ID[`PRIMORDIAL_STANCE_${element.toUpperCase()}`];
      const result = runElementalist(
        [{ type: 'cast', skillId: id }],
        {
          patchId: 'side-effect-ownership',
          specialization: 'Weaver',
          startAttunement: element,
          secondaryAttunement: 'Water',
          selectedTraitIds: [],
          selectedSkillIds: [id]
        },
        {
          profession,
          observation: { kind: 'tail', durationMs: 1500 },
          timeline: [
            {
              at: 0.5,
              run(runtime) {
                // The accepting variant is no longer either hand when the pulse resolves.
                runtime.profession.core.primaryAttunement = 'Fire';
                runtime.profession.specialization.state.secondaryAttunement = 'Fire';
              }
            }
          ]
        }
      );
      assert.deepEqual(result.warnings, []);
      const action = result.events.find((event) => event.type === 'action');
      const strike = result.events.find((event) => event.type === 'damage' && event.skillId === id);
      assert.equal(Boolean(strike), removedType !== 'strike');

      if (strike) assert.equal(strike.coefficient, 0.57);

      const conditions = result.events.filter((event) => event.type === 'condition' && event.skillId === id);
      // Matching hands each contribute the selected condition, even for a differently named casting variant.
      assert.equal(conditions.length, removedType === 'condition' ? 0 : 2);
      for (const condition of conditions) {
        assert.equal(condition.condition, 'Burning');
        assert.equal(condition.stacks, 3);
        assert.equal(condition.duration, 7);
        assert.equal(condition.activationId, action.activationId);
      }

      const context = profession.resolvePatch({ id: 'side-effect-ownership' }).balanceContext;
      const model = describeSimulationSkill(context, context.catalog.skillsById.get(id), elementalistTooltips);
      assert.equal(
        model.facts.some((fact) => fact.name === 'Burning' && fact.detail.includes('7s')),
        removedType !== 'condition'
      );
    }
  }
});

test('dual pistol rewards read commitment-time bullets and selected skill payloads', () => {
  for (const [id, primary, secondary] of cases) {
    const actions = elementalistCatalog.skillsById
      .get(id)
      .sideEffects.map(({ do: action }) => action)
      .filter((action) => Array.isArray(action.effects));
    const payloads = actions.flatMap((action) => action.effects);
    const profession = preview({
      [id]: {
        sideEffects: Object.fromEntries(
          actions.map((action) => [
            action.id,
            { effects: action.effects.map(({ type, name }) => ({ type, name, duration: 7 })) }
          ])
        )
      }
    });
    for (const loadedAtCommit of [false, true]) {
      const result = runElementalist(
        [
          { type: 'cast', skillId: id },
          { type: 'wait', durationMs: 1000 }
        ],
        {
          patchId: 'side-effect-ownership',
          specialization: 'Weaver',
          primaryWeapon: 'Pistol',
          startAttunement: primary,
          secondaryAttunement: secondary,
          selectedTraitIds: [],
          pistolBullets: { [primary]: !loadedAtCommit, [secondary]: !loadedAtCommit }
        },
        {
          profession,
          timeline: [
            {
              at: 0.1,
              run(runtime) {
                // State changes between acceptance and commitment must determine both rewards before settlement.
                runtime.profession.core.pistolBullets[primary] = loadedAtCommit;
                runtime.profession.core.pistolBullets[secondary] = loadedAtCommit;
              }
            }
          ]
        }
      );
      assert.deepEqual(result.warnings, []);
      for (const effect of payloads) {
        const matches = result.events.filter(
          (event) =>
            event.duration === 7 &&
            (effect.type === 'aura'
              ? event.type === 'aura' && event.aura === effect.aura
              : effect.type === 'buff'
                ? event.type === 'buff' && event.kind === effect.kind
                : event.type === 'condition' && event.condition === effect.condition)
        );
        assert.equal(matches.length, loadedAtCommit ? 1 : 0, `${id}:${effect.name}`);
      }

      const bullets = observedRuntime(result).profession.core.pistolBullets;
      assert.equal(bullets[primary], !loadedAtCommit);
      assert.equal(bullets[secondary], false);
    }
  }
});

test('removing either dual reward preserves its sibling, bullet settlement, and tooltip qualification', () => {
  for (const removedName of ['Fire', 'Water']) {
    const id = ID.FROSTFIRE_FLURRY;
    const removedType = removedName === 'Fire' ? 'aura' : 'condition';
    const actionId = `frostfire-${removedName.toLowerCase()}`;
    const profession = preview({
      [id]: { sideEffects: { [actionId]: { removeEffects: [{ type: removedType, name: removedName }] } } }
    });
    const result = runElementalist(
      [{ type: 'cast', skillId: id }],
      {
        patchId: 'side-effect-ownership',
        specialization: 'Weaver',
        primaryWeapon: 'Pistol',
        startAttunement: 'Fire',
        secondaryAttunement: 'Water',
        selectedTraitIds: [],
        pistolBullets: { Fire: true, Water: true }
      },
      { profession }
    );
    assert.deepEqual(result.warnings, []);
    assert.equal(
      result.events.some((event) => event.type === 'aura' && event.aura === 'Fire Aura'),
      removedName !== 'Fire'
    );
    assert.equal(
      result.events.some((event) => event.type === 'condition' && event.condition === 'Vulnerability'),
      removedName !== 'Water'
    );
    assert.equal(observedRuntime(result).profession.core.pistolBullets.Fire, false);
    assert.equal(observedRuntime(result).profession.core.pistolBullets.Water, false);
    const context = profession.resolvePatch({ id: 'side-effect-ownership' }).balanceContext;
    const skill = context.catalog.skillsById.get(id);
    const model = describeSimulationSkill(context, skill, elementalistTooltips);
    const conditional = model.facts.filter(({ detail }) => / — (Fire|Water) bullet$/.test(detail));
    assert.equal(conditional.length, 1);
    assert.equal(
      requireEffect(
        skill,
        removedType,
        removedName,
        skill.sideEffects.find(({ do: action }) => action.id === actionId).do
      ),
      undefined
    );
    // A generic tooltip must not advertise triggered rewards as unconditional casts.
    const generic = describeSimulationSkill(context, skill, {});
    assert.ok(!generic.facts.some(({ name }) => ['Fire Aura', 'Vulnerability'].includes(name)));
  }
});

test('Plasma patches preserve conditional Air-bullet recharge independently of Fire payload removal', () => {
  const id = ID.PURBLINDING_PLASMA;
  const profession = preview({
    [id]: {
      fields: { airBulletRechargeMultiplier: 0.25 },
      sideEffects: {
        'plasma-fire': { removeEffects: [{ type: 'condition', name: 'Fire' }] }
      }
    }
  });
  for (const flowState of [false, true])
    for (const air of [false, true]) {
      const result = runElementalist(
        [{ type: 'cast', skillId: id }],
        {
          patchId: 'side-effect-ownership',
          specialization: 'Weaver',
          primaryWeapon: 'Pistol',
          startAttunement: 'Fire',
          secondaryAttunement: 'Air',
          selectedTraitIds: flowState ? [TRAIT.FLOW_STATE] : [],
          pistolBullets: { Fire: true, Air: air }
        },
        { profession }
      );
      assert.deepEqual(result.warnings, []);
      assert.equal(
        observedRuntime(result).cooldownController.rechargeFor(id).work,
        (air ? 3 : 12) * (flowState ? 0.8 : 1)
      );
      assert.ok(!result.events.some((event) => event.type === 'condition' && event.condition === 'Burning'));
    }
});

test('Unravel selected lifetime and boon removal preserve hand alignment and cooldown reset', () => {
  const id = ID.UNRAVEL;
  for (const removed of [false, true]) {
    const profession = preview({
      [id]: {
        fields: { duration: 2 },
        sideEffects: {
          unravel: {
            effects: [{ type: 'boon', name: 'Fire', stacks: 9, duration: 7 }],
            ...(removed ? { removeEffects: [{ type: 'boon', name: 'Fire' }] } : {})
          }
        }
      }
    });
    const result = runElementalist(
      [{ type: 'cast', skillId: id }],
      {
        patchId: 'side-effect-ownership',
        specialization: 'Weaver',
        startAttunement: 'Fire',
        secondaryAttunement: 'Water',
        selectedTraitIds: [TRAIT.ELEMENTS_OF_RAGE]
      },
      {
        profession,
        initialize(runtime) {
          runtime.cooldownController.startRecharge(runtime.helpers.skillsById.get(ID.AIR_ATTUNEMENT), 0, 20);
        }
      }
    );
    assert.deepEqual(result.warnings, []);
    const runtime = observedRuntime(result);
    assert.equal(runtime.profession.specialization.state.secondaryAttunement, 'Fire');
    assert.equal(runtime.profession.specialization.state.unravelUntil, 2);
    assert.ok((runtime.cooldownController.readyAt(ID.AIR_ATTUNEMENT) ?? 0) <= runtime.time);
    const boons = result.events.filter(
      (event) =>
        event.type === 'buff' &&
        event.source === 'Unravel' &&
        ['might', 'vigor', 'fury', 'protection'].includes(event.kind)
    );
    assert.equal(boons.length, removed ? 0 : 1);

    if (!removed) {
      assert.equal(boons[0].kind, 'might');
      assert.equal(boons[0].stacks, 9);
      assert.equal(boons[0].duration, 7);
    }
  }
});

test('inline action payload validation and patch removal retain canonical ownership', () => {
  const effect = { type: 'boon', boon: 'might', stacks: 1, duration: 2, name: 'Reward' };
  const make = (effects, extraActions = []) =>
    createCanonicalCatalog({
      generated: [
        {
          id: 1,
          name: 'Owner',
          effects: [],
          sideEffects: [{ on: 'castCommit', do: { type: 'fixture.reward', id: 'reward', effects } }, ...extraActions]
        }
      ]
    });
  for (const effects of [null, {}, [{ ...effect, duration: NaN }], [effect, effect]])
    assert.throws(() => make(effects));
  assert.throws(() => make([{ ...effect, reactions: [] }]), /cannot declare reactions/);
  assert.throws(
    () => make([effect], [{ on: 'castStart', do: { type: 'fixture.other', effects: [effect] } }]),
    /requires an action id/
  );
  assert.throws(
    () => make([effect], [{ on: 'castStart', do: { type: 'fixture.other', id: 'reward', effects: [effect] } }]),
    /duplicate action id/
  );
  assert.throws(
    () =>
      make(
        [effect],
        [{ on: 'castStart', do: { type: 'resourceGrant', id: 'reward', resource: 'endurance', amount: 1 } }]
      ),
    /duplicate action id/
  );
  const catalog = make([effect]);
  const action = (catalog) => catalog.skillsById.get(1).sideEffects[0].do;
  const owner = (catalog) => ({
    ...catalog.skillsById.get(1),
    balanceDataContext: { professionId: 'fixture', patchId: 'selected' }
  });
  const read = (catalog, name = 'Reward') => requireEffect(owner(catalog), 'boon', name, action(catalog));
  const patch = (catalog, changes) => applySkillPatch(catalog, { skills: { 1: { sideEffects: { reward: changes } } } });
  const patched = patch(catalog, { effects: [{ type: 'boon', name: 'Reward', stacks: 3 }] });
  assert.equal(read(patched).stacks, 3);
  assert.equal(read(catalog).stacks, 1);
  assert.ok(Object.isFrozen(action(patched).effects));
  assert.throws(
    () => read(catalog, 'Typo'),
    /profession=fixture patch=selected skill=1 action=reward effect=boon\/Typo unknown effect key/
  );
  assert.throws(
    () => requireEffect(owner(catalog), 'boon', 'Reward', { ...action(catalog), effects: [effect] }),
    /profession=fixture patch=selected skill=1 action=reward effects must be normalized/
  );
  const removed = patch(patched, { removeEffects: [{ type: 'boon', name: 'Reward' }] });
  assert.equal(read(removed), undefined);
  const overlaid = applySkillPatch(removed, { skills: { 1: { effects: [] } } });
  assert.equal(read(overlaid), undefined);
  assert.throws(() => patch(catalog, { fields: { duration: 3 } }), /supports only/);
  assert.throws(
    () => applySkillPatch(catalog, { skills: { 1: { sideEffects: { typo: { effects: [] } } } } }),
    /has no payload action/
  );
  // Two declarations can reuse a handler while edits address only the selected action id.
  const sharedHandler = make(
    [effect],
    [{ on: 'castStart', do: { type: 'fixture.reward', id: 'other', effects: [effect] } }]
  );
  const selected = patch(sharedHandler, { effects: [{ name: 'Reward', stacks: 4 }] });
  assert.equal(read(selected).stacks, 4);
  assert.equal(selected.skillsById.get(1).sideEffects[1].do.effects[0].stacks, 1);
});
