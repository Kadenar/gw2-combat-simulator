import assert from 'node:assert/strict';
import test from 'node:test';
import { runElementalist } from '#tests/helpers/elementalist-simulation.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';
import { withSkill, withProfile } from '#tests/helpers/catalog-overrides.js';
import { ELEMENTALIST_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/core/profile-ids.js';
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
      const result = runElementalist(
        [
          {
            type: 'cast',
            skillId: id,
            ...(['committed', 'cancelled'].includes(mode) ? { interruptAfterMs: mode === 'committed' ? 400 : 100 } : {})
          }
        ],
        {
          specialization: 'Core',
          primaryWeapon: skill.weapon === 'Focus' ? 'Scepter' : skill.weapon || 'Dagger',
          secondaryWeapon: skill.weapon === 'Focus' ? 'Focus' : 'Dagger',
          startAttunement: skill.attunement || 'Fire',
          selectedSkillIds: [skill.id],
          selectedTraitIds: []
        },
        {
          profession: patchedProfession([
            [id, { castTimeMs: 1000, interruptCommitMs: 200, ...(mode === 'removed' ? { sideEffects: [] } : {}) }]
          ]),
          initialize(runtime) {
            // Both skill- and trait-origin auras must be consumed; unrelated auras survive.
            if (aura)
              runtime.profession.core.activeAuras = [
                { type: aura, expiresAt: 10, sourceId: 'skill' },
                { type: aura, expiresAt: 12, sourceId: 'trait' },
                { type: 'unrelated', expiresAt: 15 }
              ];
          }
        }
      );
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
    const result = runElementalist(
      [
        {
          type: 'cast',
          skillId: skill.id,
          ...(['interrupted', 'cancelled'].includes(mode) ? { interruptAfterMs: mode === 'interrupted' ? 500 : 0 } : {})
        }
      ],
      { specialization: 'Core', primaryWeapon: 'Pistol', startAttunement: 'Water', selectedTraitIds: [] },
      {
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
        ])
      }
    );
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

test('ordinary spear snapshots retire at completion while prepared delayed strikes keep their bonuses', () => {
  // Damaging, non-damaging, and cancelled activations must not leave historical snapshots behind.
  for (const skillId of [ID.BLAZING_BARRAGE, ID.SEETHE]) {
    for (const cancelled of [false, true]) {
      const result = runElementalist(
        [
          { type: 'cast', skillId, impactDelayMs: 2000, ...(cancelled ? { interruptAfterMs: 0 } : {}) },
          { type: 'wait', durationMs: 3000 }
        ],
        { specialization: 'Core', primaryWeapon: 'Spear', startAttunement: 'Fire', selectedTraitIds: [] },
        {
          initialize(runtime) {
            Object.assign(runtime.profession.core, {
              spearNextDamageBonus: true,
              spearNextGuaranteedCritical: true,
              spearNextControlHit: true
            });
          },
          timeline: [{ at: 1, run: (runtime) => assert.deepEqual(runtime.profession.core.spearFollowups, {}) }]
        }
      );
      assert.deepEqual(result.warnings, []);
      const strikes = result.events.filter((event) => event.type === 'damage' && event.skillId === skillId);
      if (!cancelled && skillId === ID.BLAZING_BARRAGE) {
        assert.ok(strikes.length > 0);
        assert.ok(strikes.every((event) => event.at > 1 && event.coefficient === 2.6 * 1.2 && event.forceCrit));
        assert.equal(result.events.filter((event) => event.type === 'control' && event.skillId === skillId).length, 1);
      } else assert.deepEqual(strikes, []);
      assert.deepEqual(observedRuntime(result).profession.core.spearFollowups, {});
    }
  }
});

test('Fulgor keeps spear bonuses through the final procedural packet and consumes control only once', () => {
  // Remove ordinary strikes so a delayed packet must consume control; equal-time tail packets share one snapshot.
  const base = patchedProfession([[ID.FULGOR, { effects: [], cooldown: 0 }]]);
  const profession = {
    ...base,
    runtimeFor(config) {
      const native = base.runtimeFor(config);
      return {
        ...native,
        catalog: withProfile(native.catalog, PROFILE.fulgor, {
          effects: [
            {
              type: 'strike',
              name: 'Fulgor',
              ticks: [1000, 2000, 2000].map((atMs) => ({
                atMs,
                coefficient: 2,
                flatStrikeBase: 0,
                flatStrikePowerCoeff: 0
              }))
            }
          ]
        })
      };
    }
  };
  const result = runElementalist(
    [
      { type: 'cast', skillId: ID.FULGOR },
      { type: 'wait', durationMs: 1000 },
      { type: 'cast', skillId: ID.FULGOR, interruptAfterMs: 0 },
      { type: 'wait', durationMs: 3000 }
    ],
    { specialization: 'Core', primaryWeapon: 'Spear', startAttunement: 'Air', selectedTraitIds: [] },
    {
      profession,
      initialize(runtime) {
        Object.assign(runtime.profession.core, {
          spearNextDamageBonus: true,
          spearNextGuaranteedCritical: true,
          spearNextControlHit: true
        });
      },
      timeline: [
        {
          at: 1.5,
          run(runtime) {
            // Delayed work retains its own snapshot after the cast's entry has been retired.
            assert.deepEqual(runtime.profession.core.spearFollowups, {});
          }
        },
        { at: 2.1, run: (runtime) => assert.deepEqual(runtime.profession.core.spearFollowups, {}) }
      ]
    }
  );
  assert.deepEqual(result.warnings, []);
  const strikes = result.events.filter((event) => event.type === 'damage' && event.skillId === ID.FULGOR);
  assert.deepEqual(
    strikes.map((event) => event.at),
    [1, 2, 2]
  );
  assert.ok(strikes.every((event) => event.coefficient === 2 * 1.2 && event.forceCrit));
  assert.ok(strikes.some((event) => event.at === 2));
  assert.equal(result.events.filter((event) => event.type === 'control' && event.skillId === ID.FULGOR).length, 1);
});

test('Fulgor replaces only its extra stream on commitment and retains targeting and attribution', () => {
  for (const mode of ['full', 'cancelled', 'removed']) {
    const result = runElementalist(
      [
        { type: 'cast', skillId: ID.FULGOR },
        { type: 'wait', durationMs: 1000 },
        { type: 'cast', skillId: ID.FULGOR, offTarget: true, ...(mode === 'cancelled' ? { interruptAfterMs: 0 } : {}) },
        { type: 'wait', durationMs: 5500 }
      ],
      { specialization: 'Core', primaryWeapon: 'Spear', startAttunement: 'Air', selectedTraitIds: [] },
      {
        profession: patchedProfession([
          [ID.FULGOR, { cooldown: 0, ...(mode === 'removed' ? { sideEffects: [] } : {}) }]
        ]),
        initialize(runtime) {
          runtime.profession.core.spearNextDamageBonus = true;
        },
        timeline: [
          {
            at: 3,
            run(runtime) {
              // Neither surviving nor replaced pulse sequences retain entries in cast state.
              assert.deepEqual(runtime.profession.core.spearFollowups, {});
            }
          }
        ]
      }
    );
    assert.deepEqual(result.warnings, []);
    assert.deepEqual(observedRuntime(result).profession.core.spearFollowups, {});
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
      const summon = runElementalist(
        [{ type: 'cast', skillId: glyphId }],
        { specialization: 'Core', selectedSkillIds: [glyph.id], selectedTraitIds: [] },
        { profession: patchedProfession([[glyphId, removed ? { sideEffects: [] } : {}]]) }
      );
      assert.deepEqual(summon.warnings, []);
      const elemental = observedRuntime(summon).profession.core.summonedElemental;
      assert.equal(elemental.element, removed ? null : element);
      assert.equal(elemental.summonGeneration, removed ? 0 : 1);

      const command = runElementalist(
        [
          { type: 'cast', skillId: glyphId },
          { type: 'cast', skillId: commandId },
          { type: 'wait', durationMs: 4000 }
        ],
        { specialization: 'Core', selectedSkillIds: [glyph.id], selectedTraitIds: [] },
        { profession: patchedProfession([[commandId, removed ? { sideEffects: [] } : {}]]) }
      );
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
      const result = runElementalist(
        [{ type: 'cast', skillId: skill.id }],
        {
          specialization: 'Weaver',
          primaryWeapon: 'Spear',
          startAttunement: primary,
          secondaryAttunement: secondary,
          selectedTraitIds: []
        },
        {
          profession: patchedProfession([
            [skill.id, { castTimeMs: 1000, ...(mode === 'removed' ? { sideEffects: [] } : {}) }]
          ]),
          timeline: [
            {
              at: 0.1,
              run(runtime) {
                // Change hands after acceptance so a snapshot-based implementation cannot pass.
                runtime.profession.core.primaryAttunement = secondary;
                runtime.profession.specialization.state.secondaryAttunement = mode === 'same' ? secondary : primary;
                for (const id of Object.values(ELEMENTALIST_ATTUNEMENT_SKILL_IDS))
                  runtime.cooldownController.setReadyAt(id, 20);
              }
            }
          ]
        }
      );
      assert.deepEqual(result.warnings, []);
      const runtime = observedRuntime(result);
      for (const [element, id] of Object.entries(ELEMENTALIST_ATTUNEMENT_SKILL_IDS))
        assert.equal(runtime.cooldownController.hasCooldown(id), !(mode === 'different' && element === secondary));
    }

    for (const specialization of ['Core', 'Tempest', 'Catalyst', 'Evoker'])
      assert.equal(elementalistProfession.runtimeFor({ specialization }).catalog.skillsById.has(skill.id), false);
  }
});

test('Weave Self activation is skill-owned, cancellable, and reads the element live at activation', () => {
  for (const mode of ['full', 'cancelled', 'removed']) {
    const result = runElementalist(
      [
        { type: 'cast', skillId: ID.WEAVE_SELF, ...(mode === 'cancelled' ? { interruptAfterMs: 0 } : {}) },
        { type: 'wait', durationMs: 1000 }
      ],
      {
        specialization: 'Weaver',
        selectedSkillIds: [43638],
        startAttunement: 'Fire',
        selectedTraitIds: []
      },
      {
        profession: patchedProfession([
          [ID.WEAVE_SELF, { castTimeMs: 1000, ...(mode === 'removed' ? { sideEffects: [] } : {}) }]
        ]),
        timeline: [
          {
            at: 0.1,
            run(runtime) {
              runtime.profession.core.primaryAttunement = 'Air';
            }
          }
        ]
      }
    );
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
      const result = runElementalist(
        [
          { type: 'cast', skillId: id, offTarget: true },
          { type: 'wait', durationMs: 3500 }
        ],
        {
          specialization: 'Weaver',
          selectedSkillIds: [skill.id],
          startAttunement: skill.attunement,
          secondaryAttunement: skill.attunement,
          selectedTraitIds: []
        },
        {
          profession: patchedProfession([[id, removed ? { sideEffects: [] } : {}]]),
          timeline: [
            {
              at: 1.5,
              run(runtime) {
                runtime.profession.core.primaryAttunement = 'Fire';
                runtime.profession.specialization.state.secondaryAttunement = 'Fire';
              }
            }
          ]
        }
      );
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
    const result = runElementalist(
      [
        { type: 'cast', skillId: ID.ELEMENTAL_PROCESSION, ...(mode === 'cancelled' ? { interruptAfterMs: 0 } : {}) },
        { type: 'wait', durationMs: 4000 }
      ],
      {
        specialization: 'Evoker',
        selectedSkillIds: [76841],
        initialEvokerCharges: 4,
        initialEvokerEmpowered: 2,
        selectedTraitIds: [TRAIT.FAMILIARS_PROWESS, TRAIT.FAMILIARS_BLESSING, TRAIT.GALVANIC_ENCHANTMENT]
      },
      {
        profession: patchedProfession([
          [ID.ELEMENTAL_PROCESSION, mode === 'removed' ? { sideEffects: [] } : {}],
          [ID.CONFLAGRATION, mode === 'source-removed' ? { effects: [] } : {}]
        ])
      }
    );
    assert.deepEqual(result.warnings, []);
    const state = observedRuntime(result).profession.specialization.state;
    assert.equal(state.familiarCharges.value, 4);
    assert.equal(state.empoweredCharges.value, 2);
    assert.deepEqual(state.electricEnchantmentGrants, []);
    assert.equal(
      result.resolvedEvents.some(
        (event) => event.type === 'buff' && ["Familiar's Prowess", "Familiar's Blessing"].includes(event.source)
      ),
      false
    );
    const replay = result.events.filter(
      (event) => ['damage', 'condition', 'control'].includes(event.type) && event.triggeredBy === 'Elemental Procession'
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
        const result = runElementalist(
          [
            { type: 'cast', skillId: id, ...(mode === 'cancelled' ? { interruptAfterMs: 0 } : {}) },
            { type: 'wait', durationMs: 2000 }
          ],
          {
            specialization: 'Core',
            primaryWeapon: 'Pistol',
            startAttunement: skill.attunement,
            selectedTraitIds: [],
            pistolBullets: { [skill.attunement]: !loaded }
          },
          {
            profession: patchedProfession([
              [id, { castTimeMs: 1000, ...(mode === 'removed' ? { sideEffects: [] } : {}) }]
            ]),
            timeline: [
              {
                at: 0.1,
                run(runtime) {
                  runtime.profession.core.pistolBullets[skill.attunement] = loaded;
                }
              }
            ]
          }
        );
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
        const result = runElementalist(
          [{ type: 'cast', skillId: skill.id }],
          {
            specialization: 'Weaver',
            primaryWeapon: 'Pistol',
            startAttunement: first,
            secondaryAttunement: second,
            selectedTraitIds: [],
            pistolBullets: Object.fromEntries(loaded.map((element) => [element, true]))
          },
          {
            profession: patchedProfession([[skill.id, { castTimeMs: 1000, ...(removed ? { sideEffects: [] } : {}) }]]),
            timeline: [
              {
                at: 0.1,
                run(runtime) {
                  runtime.profession.core.primaryAttunement = second;
                  runtime.profession.specialization.state.secondaryAttunement = first;
                }
              }
            ]
          }
        );
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
      const result = runElementalist(
        [{ type: 'cast', skillId: skill.id }],
        {
          specialization: second ? 'Weaver' : 'Core',
          primaryWeapon: 'Hammer',
          startAttunement: first,
          secondaryAttunement: second,
          selectedTraitIds: []
        },
        { profession: patchedProfession([[skill.id, removed ? { sideEffects: [] } : {}]]) }
      );
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
      const result = runElementalist(
        [
          { type: 'cast', skillId: skill.id },
          ...Array.from({ length: 3 }, () => ({ type: 'cast', skillId: ID.ARCANE_ECHO })),
          ...(mode === 'released' ? [{ type: 'cast', skillId: chain.fullId }] : [])
        ],
        {
          specialization: 'Core',
          primaryWeapon: 'Spear',
          startAttunement: skill.attunement,
          selectedSkillIds: [5635],
          selectedTraitIds: []
        },
        {
          profession: patchedProfession([
            [skill.id, mode === 'removed' ? { sideEffects: [] } : {}],
            [ID.ARCANE_ECHO, { cooldown: 0 }]
          ])
        }
      );
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
      const result = runElementalist(
        [
          { type: 'cast', skillId: id },
          ...(mode.startsWith('drop') ? [{ type: 'cast', skillId: ID.DROP_BUNDLE }] : [])
        ],
        { specialization: 'Core', selectedSkillIds: [skill.id], selectedTraitIds: [TRAIT.CONJURER] },
        {
          profession: patchedProfession([
            [id, mode === 'removed' ? { sideEffects: [] } : {}],
            [ID.DROP_BUNDLE, mode === 'drop-removed' ? { sideEffects: [] } : {}]
          ])
        }
      );
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
        const result = runElementalist(
          [{ type: 'cast', skillId: id, ...(mode === 'cancelled' ? { interruptAfterMs: 0 } : {}) }],
          {
            specialization: 'Tempest',
            primaryWeapon: 'Spear',
            startAttunement: skill.attunement,
            selectedTraitIds: []
          },
          {
            profession: patchedProfession([
              [id, { castTimeMs: 1000, ...(mode === 'removed' ? { sideEffects: [] } : {}) }]
            ]),
            initialize(runtime) {
              runtime.profession.core.etchings[ETCHING_CHAINS[0].etching] = {
                stage: 'lesser',
                otherCasts: initial,
                expiresAt: 30
              };
              runtime.cooldownController.setReadyAt(ELEMENTALIST_ATTUNEMENT_SKILL_IDS[skill.attunement], 60);
            }
          }
        );
        assert.deepEqual(result.warnings, []);
        const runtime = observedRuntime(result);
        const ordinary = mode === 'cancelled' ? initial : initial + 1;
        const expected = mode === 'full' && id !== ID.OVERLOAD_WATER && ordinary < 3 ? ordinary + 2 : ordinary;
        assert.equal(runtime.profession.core.etchings[ETCHING_CHAINS[0].etching].otherCasts, expected);
        assert.equal(runtime.cooldownController.readyAt(ELEMENTALIST_ATTUNEMENT_SKILL_IDS[skill.attunement]), 60);
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
      const result = runElementalist(
        [{ type: 'cast', skillId: ID.UNRAVEL }],
        {
          specialization: 'Weaver',
          startAttunement: 'Fire',
          secondaryAttunement: secondary,
          selectedTraitIds: [TRAIT.ELEMENTS_OF_RAGE, TRAIT.BOLSTERED_ELEMENTS]
        },
        {
          profession: patchedProfession([[ID.UNRAVEL, removed ? { sideEffects: [] } : {}]], (runtime, cast) => {
            if (cast.skill.id === ID.UNRAVEL) runtime.schedule('test.timeline', runtime.time, 0, undefined, -100);
          }),
          initialize(runtime) {
            for (const id of Object.values(ELEMENTALIST_ATTUNEMENT_SKILL_IDS))
              runtime.cooldownController.setReadyAt(id, 20);
          },
          timeline: [
            {
              at: 100,
              run(runtime) {
                observed = true;
                assert.equal(runtime.profession.specialization.state.secondaryAttunement, removed ? secondary : 'Fire');
                for (const id of Object.values(ELEMENTALIST_ATTUNEMENT_SKILL_IDS))
                  assert.equal(runtime.cooldownController.hasCooldown(id), removed);
              }
            }
          ]
        }
      );
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
      const result = runElementalist(
        [{ type: 'cast', skillId: id }],
        {
          specialization: 'Catalyst',
          startAttunement: skill.attunement,
          initialCatalystEnergy: 30,
          selectedTraitIds: [TRAIT.SPECTACULAR_SPHERE, TRAIT.SPHERE_SPECIALIST]
        },
        {
          profession: patchedProfession([
            [id, mode === 'removed' ? { sideEffects: [] } : mode === 'field-removed' ? { comboFields: [] } : {}]
          ])
        }
      );
      assert.deepEqual(result.warnings, []);
      const state = observedRuntime(result).profession.specialization.state;
      const spent = result.events.filter(
        (event) => event.type === 'resource' && event.kind === 'catalyst-energy' && event.change < 0
      );
      assert.equal(spent.length, mode === 'removed' ? 0 : 1);
      assert.equal(state.sphereActiveUntil > 0, mode === 'full');
      if (mode !== 'removed') assert.equal(spent[0].value, 30 + spent[0].change);
      assert.equal(
        state.catalystEnergy.value,
        30 +
          result.events
            .filter((event) => event.type === 'resource' && event.kind === 'catalyst-energy')
            .reduce((total, event) => total + event.change, 0)
      );
      // Without a field, accepted strikes can immediately earn energy again.
      if (mode === 'field-removed') assert.ok(state.catalystEnergy.value > spent[0].value);
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
      const result = runElementalist(
        [{ type: 'cast', skillId: id }],
        {
          specialization: 'Evoker',
          evokerElement: skill.attunement,
          initialEvokerCharges: 6,
          initialEvokerEmpowered: basic ? 1 : 3,
          selectedTraitIds: []
        },
        {
          profession: patchedProfession([[id, removed ? { sideEffects: [] } : {}]], (runtime) =>
            runtime.schedule('test.timeline', runtime.time, 0, undefined, -100)
          ),
          initialize(runtime) {
            runtime.profession.specialization.state.pendingWeaponChargeGains = [
              { activationId: 'weapon', source: 'Weapon', sourceId: 42, gain: 2 }
            ];
          },
          timeline: [
            {
              at: 100,
              run(runtime) {
                observed = true;
                const state = runtime.profession.specialization.state;
                assert.equal(state.familiarCharges.value, !removed && basic ? 2 : 6);
                assert.equal(state.empoweredCharges.value, removed ? (basic ? 1 : 3) : basic ? 2 : 0);
                assert.equal(state.activeFamiliarCast, null);
                assert.equal(state.pendingWeaponChargeGains.length, removed ? 1 : 0);
              }
            }
          ]
        }
      );
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
        const result = runElementalist(
          [{ type: 'cast', skillId: id }],
          {
            specialization: 'Evoker',
            evokerElement: element === 'Fire' ? 'Earth' : 'Fire',
            initialEvokerCharges: 2,
            selectedSkillIds: [skill.id],
            selectedTraitIds: [TRAIT.ALTRUISTIC_ASPECT]
          },
          {
            profession: patchedProfession([[id, { castTimeMs: 1000, ...(removed ? { sideEffects: [] } : {}) }]]),
            timeline: [
              {
                at: 0.1,
                run(runtime) {
                  runtime.profession.specialization.state.element = element;
                }
              }
            ]
          }
        );
        assert.deepEqual(result.warnings, []);
        const state = observedRuntime(result).profession.specialization.state;
        const buffs = result.resolvedEvents.filter((event) => event.type === 'buff');
        if (id === ID.REJUVENATE)
          assert.equal(state.familiarCharges.value, removed ? 2 : state.familiarCharges.maximum);
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
