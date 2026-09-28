import assert from 'node:assert/strict';
import test from 'node:test';
import { runElementalist } from '#tests/helpers/elementalist-simulation.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';
import { withSkill } from '#tests/helpers/catalog-overrides.js';
import { elementalistCatalog, elementalistProfession } from '#gw2/professions/elementalist/profession.js';
import {
  ELEMENTALIST_SKILL_IDS as ID,
  ELEMENTALIST_TRAIT_IDS as TRAIT,
  ELEMENTALIST_ATTUNEMENT_SKILL_IDS
} from '#gw2/professions/elementalist/data/ids.js';
import { AURA_TRANSMUTE_SKILLS, ETCHING_CHAINS } from '#gw2/professions/elementalist/core/constants.js';

// Patch declarations through every catalog lookup while retaining the real lifecycle and state owners.
function patchedProfession(changes, afterCommit) {
  return {
    ...elementalistProfession,
    runtimeFor(config) {
      const native = elementalistProfession.runtimeFor(config);
      return {
        ...native,
        catalog: changes.reduce((catalog, [id, patch]) => withSkill(catalog, id, patch), native.catalog),
        onCastCommit(runtime, cast) {
          native.onCastCommit?.(runtime, cast);
          afterCommit?.(runtime, cast);
        }
      };
    }
  };
}

test('aura consumption and Arcane Echo arming belong to successful skill commitments', () => {
  for (const id of [ID.ARCANE_ECHO, ...Object.keys(AURA_TRANSMUTE_SKILLS).map(Number)]) {
    const skill = elementalistCatalog.skillsById.get(id);
    const aura = AURA_TRANSMUTE_SKILLS[id];
    for (const mode of ['full', 'committed', 'cancelled', 'removed']) {
      const result = runElementalist({
        profession: patchedProfession([
          [id, { castTimeMs: 1000, interruptCommitMs: 200, ...(mode === 'removed' ? { sideEffects: [] } : {}) }]
        ]),
        config: {
          specialization: 'Core',
          primaryWeapon: skill.weapon === 'Focus' ? 'Scepter' : skill.weapon || 'Dagger',
          secondaryWeapon: skill.weapon === 'Focus' ? 'Focus' : 'Dagger',
          startAttunement: skill.attunement || 'Fire',
          selectedSkills: [skill.name],
          selectedTraitIds: []
        },
        rotation: [
          {
            type: 'cast',
            skillId: id,
            ...(['committed', 'cancelled'].includes(mode) ? { interruptAfterMs: mode === 'committed' ? 400 : 100 } : {})
          }
        ],
        initialize(runtime) {
          // Both skill- and trait-origin auras must be consumed; unrelated auras survive.
          if (aura)
            runtime.profession.core.activeAuras = [
              { type: aura, expiresAt: 10, sourceId: 'skill' },
              { type: aura, expiresAt: 12, sourceId: 'trait' },
              { type: 'unrelated', expiresAt: 15 }
            ];
        }
      });
      assert.deepEqual(result.warnings, [], `${skill.name}: ${mode}`);
      const core = observedRuntime(result).profession.core;
      const committed = mode === 'full' || mode === 'committed';
      if (aura)
        assert.deepEqual(
          core.activeAuras.map((entry) => entry.type),
          committed ? ['unrelated'] : [aura, aura, 'unrelated']
        );
      else assert.equal(core.arcaneEchoUntil > 0, committed);
    }
  }
});

test('Frigid Flurry declares independent projectile attempts only on surviving packets', () => {
  const skill = elementalistCatalog.skillsById.get(ID.FRIGID_FLURRY);
  for (const mode of ['full', 'interrupted', 'cancelled', 'removed']) {
    const result = runElementalist({
      profession: patchedProfession([
        [
          skill.id,
          {
            effects: skill.effects.map((effect) =>
              effect.type !== 'strike' || mode !== 'removed'
                ? effect
                : {
                    ...effect,
                    ticks: effect.ticks.map((tick) => ({ ...tick, comboFinishers: [] }))
                  }
            )
          }
        ]
      ]),
      config: { specialization: 'Core', primaryWeapon: 'Pistol', startAttunement: 'Water', selectedTraitIds: [] },
      rotation: [
        {
          type: 'cast',
          skillId: skill.id,
          ...(['interrupted', 'cancelled'].includes(mode) ? { interruptAfterMs: mode === 'interrupted' ? 500 : 0 } : {})
        }
      ]
    });
    assert.deepEqual(result.warnings, []);
    const strikes = result.resolvedEvents.filter((event) => event.type === 'damage' && event.skillId === skill.id);
    const attempts = result.events.filter((event) => event.type === 'combo_finisher' && event.skillId === skill.id);
    if (mode === 'removed' || mode === 'cancelled') assert.equal(attempts.length, 0);
    else {
      assert.equal(attempts.length, strikes.length);
      assert.ok(attempts.length >= 2);
      assert.equal(new Set(attempts.map((event) => event.attemptId)).size, attempts.length);
      assert.ok(strikes.every((event) => event.comboFinishers[0].attemptGroup === `frigid-flurry:${event.hitIndex}`));
    }
  }
});

test('Fulgor replaces only its extra stream on commitment and retains targeting and attribution', () => {
  for (const mode of ['full', 'cancelled', 'removed']) {
    const result = runElementalist({
      profession: patchedProfession([[ID.FULGOR, { cooldown: 0, ...(mode === 'removed' ? { sideEffects: [] } : {}) }]]),
      config: { specialization: 'Core', primaryWeapon: 'Spear', startAttunement: 'Air', selectedTraitIds: [] },
      rotation: [
        { type: 'cast', skillId: ID.FULGOR },
        { type: 'wait', durationMs: 1000 },
        { type: 'cast', skillId: ID.FULGOR, offTarget: true, ...(mode === 'cancelled' ? { interruptAfterMs: 0 } : {}) },
        { type: 'wait', durationMs: 5500 }
      ]
    });
    assert.deepEqual(result.warnings, []);
    const [first, second] = result.events.filter((event) => event.type === 'action' && event.skillId === ID.FULGOR);
    const extra = result.events.filter(
      (event) => event.type === 'damage' && event.skillId === ID.FULGOR && event.actorType === 'effect'
    );
    const priorTail = extra.filter((event) => event.activationId === first.activationId && event.at > second.endsAt);
    if (mode === 'removed') assert.deepEqual(extra, []);
    else {
      assert.ok(extra.length > 0);
      assert.equal(priorTail.length > 0, mode === 'cancelled');
      assert.ok(extra.every((event) => event.canCrit === false && event.ownerActorType === 'player'));
      if (mode === 'full') {
        const replaced = extra.filter((event) => event.activationId === second.activationId);
        assert.ok(replaced.length > 0);
        assert.ok(replaced.every((event) => event.offTarget === true && !(event.damage > 0)));
      }
    }

    // Replacing the extra stream never cancels the first activation's ordinary weapon packets.
    assert.ok(
      result.resolvedEvents.some(
        (event) =>
          event.type === 'damage' &&
          event.actorType === 'player' &&
          event.activationId === first.activationId &&
          event.at > second.endsAt
      )
    );
  }
});

test('glyph and elemental command declarations invoke their lifetime owners exactly once', () => {
  for (const [glyphId, commandId, element] of [
    [ID.GLYPH_OF_ELEMENTALS, ID.FLAME_BARRAGE_ELEMENTAL_COMMAND, 'Fire'],
    [ID.GLYPH_OF_ELEMENTALS_EARTH, ID.STOMP_ELEMENTAL_COMMAND, 'Earth']
  ]) {
    const glyph = elementalistCatalog.skillsById.get(glyphId);
    for (const removed of [false, true]) {
      const summon = runElementalist({
        profession: patchedProfession([[glyphId, removed ? { sideEffects: [] } : {}]]),
        config: { specialization: 'Core', selectedSkills: [glyph.name], selectedTraitIds: [] },
        rotation: [{ type: 'cast', skillId: glyphId }]
      });
      assert.deepEqual(summon.warnings, []);
      const elemental = observedRuntime(summon).profession.core.summonedElemental;
      assert.equal(elemental.element, removed ? null : element);
      assert.equal(elemental.summonGeneration, removed ? 0 : 1);

      const command = runElementalist({
        profession: patchedProfession([[commandId, removed ? { sideEffects: [] } : {}]]),
        config: { specialization: 'Core', selectedSkills: [glyph.name], selectedTraitIds: [] },
        rotation: [
          { type: 'cast', skillId: glyphId },
          { type: 'cast', skillId: commandId },
          { type: 'wait', durationMs: 4000 }
        ]
      });
      assert.deepEqual(command.warnings, []);
      const actions = command.events.filter(
        (event) =>
          event.type === 'action' &&
          event.actorType === 'summon' &&
          event.skillName === elementalistCatalog.skillsById.get(commandId).name
      );
      assert.equal(actions.length, removed ? 0 : 1);
    }
  }
});

test('all six Weaver spear dual declarations refresh the live primary only when the hands differ', () => {
  const duals = elementalistCatalog.skills.filter(
    (skill) => skill.weapon === 'Spear' && skill.attunement?.includes('+')
  );
  assert.equal(duals.length, 6);
  for (const skill of duals) {
    for (const mode of ['different', 'same', 'removed']) {
      const [primary, secondary] = skill.attunement.split('+');
      const result = runElementalist({
        profession: patchedProfession([
          [skill.id, { castTimeMs: 1000, ...(mode === 'removed' ? { sideEffects: [] } : {}) }]
        ]),
        config: {
          specialization: 'Weaver',
          primaryWeapon: 'Spear',
          startAttunement: primary,
          secondaryAttunement: secondary,
          selectedTraitIds: []
        },
        rotation: [{ type: 'cast', skillId: skill.id }],
        timeline: [
          {
            at: 0.1,
            run(runtime) {
              // Change hands after acceptance so a snapshot-based implementation cannot pass.
              runtime.profession.core.primaryAttunement = secondary;
              runtime.profession.specialization.state.secondaryAttunement = mode === 'same' ? secondary : primary;
              for (const id of Object.values(ELEMENTALIST_ATTUNEMENT_SKILL_IDS)) runtime.cooldowns.set(id, 20);
            }
          }
        ]
      });
      assert.deepEqual(result.warnings, []);
      const runtime = observedRuntime(result);
      for (const [element, id] of Object.entries(ELEMENTALIST_ATTUNEMENT_SKILL_IDS))
        assert.equal(runtime.cooldowns.has(id), !(mode === 'different' && element === secondary));
    }

    for (const specialization of ['Core', 'Tempest', 'Catalyst', 'Evoker'])
      assert.equal(elementalistProfession.runtimeFor({ specialization }).catalog.skillsById.has(skill.id), false);
  }
});

test('Weave Self activation is skill-owned, cancellable, and reads the element live at activation', () => {
  for (const mode of ['full', 'cancelled', 'removed']) {
    const result = runElementalist({
      profession: patchedProfession([
        [ID.WEAVE_SELF, { castTimeMs: 1000, ...(mode === 'removed' ? { sideEffects: [] } : {}) }]
      ]),
      config: {
        specialization: 'Weaver',
        selectedSkills: ['Weave Self'],
        startAttunement: 'Fire',
        selectedTraitIds: []
      },
      rotation: [
        { type: 'cast', skillId: ID.WEAVE_SELF, ...(mode === 'cancelled' ? { interruptAfterMs: 0 } : {}) },
        { type: 'wait', durationMs: 1000 }
      ],
      timeline: [
        {
          at: 0.1,
          run(runtime) {
            runtime.profession.core.primaryAttunement = 'Air';
          }
        }
      ]
    });
    assert.deepEqual(result.warnings, []);
    const state = observedRuntime(result).profession.specialization.state;
    assert.deepEqual(state.weaveSelfVisited, mode === 'full' ? ['Air'] : []);
    assert.equal(state.weaveSelfUntil > 0, mode === 'full');
  }
});

test('all Primordial Stance declarations own their dynamic pulse stream without duplicate template packets', () => {
  for (const id of [
    ID.PRIMORDIAL_STANCE_FIRE,
    ID.PRIMORDIAL_STANCE_WATER,
    ID.PRIMORDIAL_STANCE_AIR,
    ID.PRIMORDIAL_STANCE_EARTH
  ]) {
    const skill = elementalistCatalog.skillsById.get(id);
    for (const removed of [false, true]) {
      const result = runElementalist({
        profession: patchedProfession([[id, removed ? { sideEffects: [] } : {}]]),
        config: {
          specialization: 'Weaver',
          selectedSkills: [skill.name],
          startAttunement: skill.attunement,
          secondaryAttunement: skill.attunement,
          selectedTraitIds: []
        },
        rotation: [
          { type: 'cast', skillId: id, offTarget: true },
          { type: 'wait', durationMs: 3500 }
        ],
        timeline: [
          {
            at: 1.5,
            run(runtime) {
              runtime.profession.core.primaryAttunement = 'Fire';
              runtime.profession.specialization.state.secondaryAttunement = 'Fire';
            }
          }
        ]
      });
      assert.deepEqual(result.warnings, []);
      const packets = result.events.filter(
        (event) => event.skillId === id && ['damage', 'condition'].includes(event.type)
      );
      if (removed) assert.deepEqual(packets, []);
      else {
        const hits = packets.filter((event) => event.type === 'damage');
        assert.deepEqual(
          hits.map((event) => event.at),
          [1, 2, 3]
        );
        assert.ok(packets.every((event) => event.offTarget === true));
        assert.deepEqual(
          packets.filter((event) => event.type === 'condition' && event.at === 2).map((event) => event.condition),
          ['Burning', 'Burning']
        );
      }
    }
  }
});

test('Elemental Procession replays only surviving familiar payloads without familiar cast settlement', () => {
  for (const mode of ['full', 'removed', 'source-removed', 'cancelled']) {
    const result = runElementalist({
      profession: patchedProfession([
        [ID.ELEMENTAL_PROCESSION, mode === 'removed' ? { sideEffects: [] } : {}],
        [ID.CONFLAGRATION, mode === 'source-removed' ? { effects: [] } : {}]
      ]),
      config: {
        specialization: 'Evoker',
        selectedSkills: ['Elemental Procession'],
        initialEvokerCharges: 4,
        initialEvokerEmpowered: 2,
        selectedTraitIds: [TRAIT.FAMILIARS_PROWESS, TRAIT.FAMILIARS_BLESSING, TRAIT.GALVANIC_ENCHANTMENT]
      },
      rotation: [
        { type: 'cast', skillId: ID.ELEMENTAL_PROCESSION, ...(mode === 'cancelled' ? { interruptAfterMs: 0 } : {}) },
        { type: 'wait', durationMs: 4000 }
      ]
    });
    assert.deepEqual(result.warnings, []);
    const state = observedRuntime(result).profession.specialization.state;
    assert.equal(state.charges, 4);
    assert.equal(state.empowered, 2);
    assert.deepEqual(state.electricEnchantmentGrants, []);
    assert.equal(
      result.resolvedEvents.some(
        (event) => event.type === 'buff' && ["Familiar's Prowess", "Familiar's Blessing"].includes(event.source)
      ),
      false
    );
    const replay = result.events.filter(
      (event) =>
        ['damage', 'condition', 'control', 'blind'].includes(event.type) && event.triggeredBy === 'Elemental Procession'
    );
    if (mode === 'removed' || mode === 'cancelled') assert.deepEqual(replay, []);
    else {
      assert.equal(
        replay.some((event) => event.skillId === ID.CONFLAGRATION),
        mode !== 'source-removed'
      );
      for (const id of [ID.BUOYANT_DELUGE, ID.LIGHTNING_BLITZ, ID.SEISMIC_IMPACT])
        assert.ok(replay.some((event) => event.skillId === id));
      assert.ok(
        result.resolvedEvents
          .filter((event) => event.type === 'damage' && event.triggeredBy === 'Elemental Procession')
          .every((event) => event.weaponStrengthProfileId === 'nonweapon.profession-mechanic')
      );
    }
  }
});

test('Core pistol declarations use completion-time bullets and preserve the load-only chain exception', () => {
  for (const id of [
    ID.RAGING_RICOCHET,
    ID.SEARING_SALVO,
    ID.FRIGID_FLURRY,
    ID.FROZEN_FUSILLADE,
    ID.DAZING_DISCHARGE,
    ID.SHATTERING_STONE,
    ID.BOULDER_BLAST,
    ID.AERIAL_AGILITY
  ]) {
    const skill = elementalistCatalog.skillsById.get(id);
    for (const loaded of [false, true])
      for (const mode of ['full', 'removed', 'cancelled']) {
        const result = runElementalist({
          profession: patchedProfession([
            [id, { castTimeMs: 1000, ...(mode === 'removed' ? { sideEffects: [] } : {}) }]
          ]),
          config: {
            specialization: 'Core',
            primaryWeapon: 'Pistol',
            startAttunement: skill.attunement,
            selectedTraitIds: [],
            pistolBullets: { [skill.attunement]: !loaded }
          },
          rotation: [
            { type: 'cast', skillId: id, ...(mode === 'cancelled' ? { interruptAfterMs: 0 } : {}) },
            { type: 'wait', durationMs: 2000 }
          ],
          timeline: [
            {
              at: 0.1,
              run(runtime) {
                runtime.profession.core.pistolBullets[skill.attunement] = loaded;
              }
            }
          ]
        });
        assert.deepEqual(result.warnings, [], `${skill.name}:${mode}`);
        const core = observedRuntime(result).profession.core;
        assert.equal(
          core.pistolBullets[skill.attunement],
          mode === 'full' ? id === ID.AERIAL_AGILITY || !loaded : loaded
        );
        if (id === ID.DAZING_DISCHARGE) assert.equal(core.dazingDischargeUntil > 0, loaded && mode === 'full');
      }
  }
});

test('every Weaver pistol declaration consumes matching bullets or loads the live primary', () => {
  const duals = elementalistCatalog.skills.filter(
    (skill) => skill.weapon === 'Pistol' && skill.attunement?.includes('+')
  );
  for (const skill of duals) {
    const [first, second] = skill.attunement.split('+');
    for (const loaded of [[], [first], [second], [first, second]])
      for (const removed of [false, true]) {
        const result = runElementalist({
          profession: patchedProfession([[skill.id, { castTimeMs: 1000, ...(removed ? { sideEffects: [] } : {}) }]]),
          config: {
            specialization: 'Weaver',
            primaryWeapon: 'Pistol',
            startAttunement: first,
            secondaryAttunement: second,
            selectedTraitIds: [],
            pistolBullets: Object.fromEntries(loaded.map((element) => [element, true]))
          },
          rotation: [{ type: 'cast', skillId: skill.id }],
          timeline: [
            {
              at: 0.1,
              run(runtime) {
                runtime.profession.core.primaryAttunement = second;
                runtime.profession.specialization.state.secondaryAttunement = first;
              }
            }
          ]
        });
        assert.deepEqual(result.warnings, [], skill.name);
        const bullets = observedRuntime(result).profession.core.pistolBullets;
        assert.equal(bullets[first], removed && loaded.includes(first));
        assert.equal(bullets[second], removed ? loaded.includes(second) : loaded.length === 0);
        if (skill.id === ID.FLOWING_FINESSE)
          assert.equal(
            result.resolvedEvents.some((event) => event.type === 'buff' && event.kind === 'superspeed'),
            !removed && loaded.includes('Air')
          );
      }
  }
});

test('hammer definitions own single and dual orb grants', () => {
  const creators = elementalistCatalog.skills.filter((skill) =>
    skill.sideEffects?.some((effect) => effect.do.type === 'elementalist.create-hammer-orbs')
  );
  assert.equal(creators.length, 10);
  for (const skill of creators)
    for (const removed of [false, true]) {
      const [first, second] = skill.attunement.split('+');
      const result = runElementalist({
        profession: patchedProfession([[skill.id, removed ? { sideEffects: [] } : {}]]),
        config: {
          specialization: second ? 'Weaver' : 'Core',
          primaryWeapon: 'Hammer',
          startAttunement: first,
          secondaryAttunement: second,
          selectedTraitIds: []
        },
        rotation: [{ type: 'cast', skillId: skill.id }]
      });
      assert.deepEqual(result.warnings, []);
      const core = observedRuntime(result).profession.core;
      assert.deepEqual(
        Object.keys(core.hammerOrbs)
          .filter((element) => core.hammerOrbs[element] != null)
          .sort(),
        removed ? [] : [first, ...(second ? [second] : [])].sort()
      );
    }
});

test('etching declarations open their window and release only their own state after three other commits', () => {
  for (const chain of ETCHING_CHAINS)
    for (const mode of ['full', 'removed', 'released']) {
      const skill = elementalistCatalog.skillsById.get(chain.etchingId);
      const result = runElementalist({
        profession: patchedProfession([
          [skill.id, mode === 'removed' ? { sideEffects: [] } : {}],
          [ID.ARCANE_ECHO, { cooldown: 0 }]
        ]),
        config: {
          specialization: 'Core',
          primaryWeapon: 'Spear',
          startAttunement: skill.attunement,
          selectedSkills: ['Arcane Echo'],
          selectedTraitIds: []
        },
        rotation: [
          { type: 'cast', skillId: skill.id },
          ...Array.from({ length: 3 }, () => ({ type: 'cast', skillId: ID.ARCANE_ECHO })),
          ...(mode === 'released' ? [{ type: 'cast', skillId: chain.fullId }] : [])
        ]
      });
      assert.deepEqual(result.warnings, []);
      const progress = observedRuntime(result).profession.core.etchings[chain.etching];
      if (mode === 'full') {
        assert.equal(progress.stage, 'full');
        assert.equal(progress.otherCasts, 3);
      } else assert.equal(progress, mode === 'removed' ? undefined : null);
    }
});

test('conjure declarations own equip and drop without duplicating swap events', () => {
  for (const id of [ID.CONJURE_FROST_BOW, ID.CONJURE_LIGHTNING_HAMMER, ID.CONJURE_FIERY_GREATSWORD]) {
    const skill = elementalistCatalog.skillsById.get(id);
    for (const mode of ['full', 'removed', 'drop', 'drop-removed']) {
      const result = runElementalist({
        profession: patchedProfession([
          [id, mode === 'removed' ? { sideEffects: [] } : {}],
          [ID.DROP_BUNDLE, mode === 'drop-removed' ? { sideEffects: [] } : {}]
        ]),
        config: { specialization: 'Core', selectedSkills: [skill.name], selectedTraitIds: [TRAIT.CONJURER] },
        rotation: [
          { type: 'cast', skillId: id },
          ...(mode.startsWith('drop') ? [{ type: 'cast', skillId: ID.DROP_BUNDLE }] : [])
        ]
      });
      assert.deepEqual(result.warnings, []);
      assert.equal(
        observedRuntime(result).profession.core.conjureEquipped != null,
        mode === 'full' || mode === 'drop-removed'
      );
      assert.equal(
        result.events.filter((event) => event.type === 'sigil_swap').length,
        mode === 'removed' ? 0 : mode === 'drop' ? 2 : 1
      );
    }
  }
});

test('overload declarations preserve full-channel eligibility and ordinary-before-extra etching credit', () => {
  for (const id of [ID.OVERLOAD_FIRE, ID.OVERLOAD_WATER, ID.OVERLOAD_AIR, ID.OVERLOAD_EARTH]) {
    const skill = elementalistCatalog.skillsById.get(id);
    for (const initial of [0, 1, 2])
      for (const mode of ['full', 'removed', 'cancelled']) {
        const result = runElementalist({
          profession: patchedProfession([
            [id, { castTimeMs: 1000, ...(mode === 'removed' ? { sideEffects: [] } : {}) }]
          ]),
          config: {
            specialization: 'Tempest',
            primaryWeapon: 'Spear',
            startAttunement: skill.attunement,
            selectedTraitIds: []
          },
          rotation: [{ type: 'cast', skillId: id, ...(mode === 'cancelled' ? { interruptAfterMs: 0 } : {}) }],
          initialize(runtime) {
            runtime.profession.core.etchings[ETCHING_CHAINS[0].etching] = {
              stage: 'lesser',
              otherCasts: initial,
              expiresAt: 30
            };
            runtime.cooldowns.set(ELEMENTALIST_ATTUNEMENT_SKILL_IDS[skill.attunement], 60);
          }
        });
        assert.deepEqual(result.warnings, []);
        const runtime = observedRuntime(result);
        const ordinary = mode === 'cancelled' ? initial : initial + 1;
        const expected = mode === 'full' && id !== ID.OVERLOAD_WATER && ordinary < 3 ? ordinary + 2 : ordinary;
        assert.equal(runtime.profession.core.etchings[ETCHING_CHAINS[0].etching].otherCasts, expected);
        assert.equal(runtime.cooldowns.get(ELEMENTALIST_ATTUNEMENT_SKILL_IDS[skill.attunement]), 60);
        assert.equal(
          result.events.some((event) => event.type === 'damage' && event.skillId === ID.LIGHTNING_JOLT),
          id === ID.OVERLOAD_AIR && mode === 'full'
        );
      }
  }
});

test('Unravel settles after its traits and before another same-time completion observes the hands', () => {
  for (const removed of [false, true])
    for (const secondary of ['Fire', 'Air']) {
      let observed = false;
      const result = runElementalist({
        profession: patchedProfession([[ID.UNRAVEL, removed ? { sideEffects: [] } : {}]], (runtime, cast) => {
          if (cast.skill.id === ID.UNRAVEL)
            runtime.schedule('test.elementalist-check', runtime.time, 0, undefined, -100);
        }),
        config: {
          specialization: 'Weaver',
          startAttunement: 'Fire',
          secondaryAttunement: secondary,
          selectedTraitIds: [TRAIT.ELEMENTS_OF_RAGE, TRAIT.BOLSTERED_ELEMENTS]
        },
        rotation: [{ type: 'cast', skillId: ID.UNRAVEL }],
        initialize(runtime) {
          for (const id of Object.values(ELEMENTALIST_ATTUNEMENT_SKILL_IDS)) runtime.cooldowns.set(id, 20);
        },
        timeline: [
          {
            at: 100,
            run(runtime) {
              observed = true;
              assert.equal(runtime.profession.specialization.state.secondaryAttunement, removed ? secondary : 'Fire');
              for (const id of Object.values(ELEMENTALIST_ATTUNEMENT_SKILL_IDS))
                assert.equal(runtime.cooldowns.has(id), removed);
            }
          }
        ]
      });
      assert.deepEqual(result.warnings, []);
      assert.equal(observed, true);
      assert.equal(
        result.events.filter((event) => event.type === 'elementalist.attunement' && event.skillId === ID.UNRAVEL)
          .length,
        removed ? 0 : 1
      );
      assert.ok(result.resolvedEvents.some((event) => event.type === 'buff' && event.kind === 'protection'));
    }
});

test('sphere declarations spend once and derive live windows from their fields before trait payouts', () => {
  for (const id of [
    ID.DEPLOY_JADE_SPHERE_FIRE,
    ID.DEPLOY_JADE_SPHERE_WATER,
    ID.DEPLOY_JADE_SPHERE_AIR,
    ID.DEPLOY_JADE_SPHERE_EARTH
  ]) {
    const skill = elementalistCatalog.skillsById.get(id);
    for (const mode of ['full', 'removed', 'field-removed']) {
      const result = runElementalist({
        profession: patchedProfession([
          [id, mode === 'removed' ? { sideEffects: [] } : mode === 'field-removed' ? { comboFields: [] } : {}]
        ]),
        config: {
          specialization: 'Catalyst',
          startAttunement: skill.attunement,
          initialCatalystEnergy: 30,
          selectedTraitIds: [TRAIT.SPECTACULAR_SPHERE, TRAIT.SPHERE_SPECIALIST]
        },
        rotation: [{ type: 'cast', skillId: id }]
      });
      assert.deepEqual(result.warnings, []);
      const state = observedRuntime(result).profession.specialization.state;
      const spent = result.events.filter(
        (event) => event.type === 'resource' && event.kind === 'catalyst-energy' && event.change < 0
      );
      assert.equal(spent.length, mode === 'removed' ? 0 : 1);
      assert.equal(state.sphereActiveUntil > 0, mode === 'full');
      if (mode !== 'removed') assert.equal(spent[0].value, 30 + spent[0].change);
      assert.equal(
        state.energy,
        30 +
          result.events
            .filter((event) => event.type === 'resource' && event.kind === 'catalyst-energy')
            .reduce((total, event) => total + event.change, 0)
      );
      // Without a field, accepted strikes can immediately earn energy again.
      if (mode === 'field-removed') assert.ok(state.energy > spent[0].value);
      assert.ok(
        result.resolvedEvents.some(
          (event) => event.type === 'buff' && event.kind === 'quickness' && event.audience?.recipients === 'party'
        )
      );
    }
  }
});

test('familiar declarations reset their pools before deferred grants and the next same-time completion', () => {
  for (const id of [
    ID.IGNITE,
    ID.SPLASH,
    ID.ZAP,
    ID.CALCIFY,
    ID.CONFLAGRATION,
    ID.BUOYANT_DELUGE,
    ID.LIGHTNING_BLITZ,
    ID.SEISMIC_IMPACT
  ]) {
    const skill = elementalistCatalog.skillsById.get(id);
    const basic = [ID.IGNITE, ID.SPLASH, ID.ZAP, ID.CALCIFY].includes(id);
    for (const removed of [false, true]) {
      let observed = false;
      const result = runElementalist({
        profession: patchedProfession([[id, removed ? { sideEffects: [] } : {}]], (runtime) =>
          runtime.schedule('test.elementalist-check', runtime.time, 0, undefined, -100)
        ),
        config: {
          specialization: 'Evoker',
          evokerElement: skill.attunement,
          initialEvokerCharges: 6,
          initialEvokerEmpowered: basic ? 1 : 3,
          selectedTraitIds: []
        },
        rotation: [{ type: 'cast', skillId: id }],
        initialize(runtime) {
          runtime.profession.specialization.state.pendingWeaponChargeGains = [
            { activationId: 'weapon', at: 0, source: 'Weapon', sourceId: 42, gain: 2 }
          ];
        },
        timeline: [
          {
            at: 100,
            run(runtime) {
              observed = true;
              const state = runtime.profession.specialization.state;
              assert.equal(state.charges, !removed && basic ? 2 : 6);
              assert.equal(state.empowered, removed ? (basic ? 1 : 3) : basic ? 2 : 0);
              assert.equal(state.activeFamiliarCast, null);
              assert.equal(state.pendingWeaponChargeGains.length, removed ? 1 : 0);
            }
          }
        ]
      });
      assert.deepEqual(result.warnings, [], skill.name);
      assert.equal(observed, true);
    }
  }
});

test('meditation declarations own their live-element bonuses and refill before Altruistic Aspect', () => {
  for (const id of [ID.FOXS_FURY, ID.HARES_AGILITY, ID.TOADS_FORTITUDE, ID.REJUVENATE]) {
    const skill = elementalistCatalog.skillsById.get(id);
    for (const element of ['Fire', 'Earth'])
      for (const removed of [false, true]) {
        const result = runElementalist({
          profession: patchedProfession([[id, { castTimeMs: 1000, ...(removed ? { sideEffects: [] } : {}) }]]),
          config: {
            specialization: 'Evoker',
            evokerElement: element === 'Fire' ? 'Earth' : 'Fire',
            initialEvokerCharges: 2,
            selectedSkills: [skill.name],
            selectedTraitIds: [TRAIT.ALTRUISTIC_ASPECT]
          },
          rotation: [{ type: 'cast', skillId: id }],
          timeline: [
            {
              at: 0.1,
              run(runtime) {
                runtime.profession.specialization.state.element = element;
              }
            }
          ]
        });
        assert.deepEqual(result.warnings, []);
        const state = observedRuntime(result).profession.specialization.state;
        const buffs = result.resolvedEvents.filter((event) => event.type === 'buff');
        if (id === ID.REJUVENATE) assert.equal(state.charges, removed ? 2 : state.maximumCharges);
        if (id === ID.HARES_AGILITY) assert.equal(state.electricEnchantmentGrants.length > 0, !removed);
        if (id === ID.TOADS_FORTITUDE)
          assert.equal(
            buffs.some((event) => event.kind === 'resistance'),
            !removed && element === 'Earth'
          );
        if (id === ID.FOXS_FURY) {
          const partyMight = buffs.filter((event) => event.kind === 'might' && event.audience?.recipients === 'party');
          assert.equal(partyMight.length, removed ? 0 : 1);
          if (!removed) assert.ok(partyMight[0].audience.maximumRecipients === 5);
        }

        // The meditation trait remains active even when its intrinsic reward is removed.
        const traitBoon = { [ID.FOXS_FURY]: 'might', [ID.HARES_AGILITY]: 'fury', [ID.TOADS_FORTITUDE]: 'stability' }[
          id
        ];
        if (traitBoon)
          assert.ok(
            buffs.some(
              (event) => event.sourceId === id && event.kind === traitBoon && event.audience?.recipients !== 'party'
            )
          );
      }
  }
});
