import assert from 'node:assert/strict';
import test from 'node:test';
import { guardianCatalog, guardianProfession } from '#gw2/professions/guardian/profession.js';
import { GUARDIAN_SKILL_IDS as ID, GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';
import { swiftScholar } from '#gw2/professions/guardian/specializations/firebrand/traits/index.js';
import { compileProfessionRules } from '#gw2/platform/profession-definition/trigger-rules.js';
import { skillEffectKey } from '#gw2/platform/effects/validation.js';
import { AURA_GRANT } from '#gw2/professions/guardian/specializations/luminary/mechanics/effects.js';
import { LUMINARY_INITIAL_LIGHT_AURA_SKILL_ID } from '#gw2/professions/guardian/specializations/luminary/skills/radiant-forge-skills.js';
import { runGuardian } from '#tests/helpers/guardian-simulation.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';
import { withProfile } from '#tests/helpers/catalog-overrides.js';

const wait = (durationMs) => ({ type: 'wait', durationMs });
const cast = (name) => guardianCatalog.skillsByName.get(name).id;
const state = (runtime) => runtime.profession.specialization.state;
const buffs = (result, name) => result.resolvedEvents.filter((event) => event.type === 'buff' && event.name === name);
const cause = (at, extra = {}) => ({
  at,
  actorType: 'player',
  source: 'Fixture',
  sourceId: 'fixture',
  skillName: 'Fixture',
  ...extra
});

/** Native casts and explicit admitted work exercise isolation without replacing the profession's lifetime handlers. */
function run(specialization, rotation, { traitTriggers = true, ...config } = {}, options = {}) {
  const result = runGuardian(
    rotation,
    { specialization, ...config },
    {
      ...options,
      profession: { runtimeFor: (config) => guardianProfession.runtimeFor(config, { traitTriggers }) }
    }
  );
  assert.deepEqual(result.warnings, []);
  return { result, runtime: observedRuntime(result) };
}

test('Swift Scholar isolates implicit minor rewards while pages, dormancy, and selected page capacity remain intrinsic', () => {
  for (const traitTriggers of [false, true]) {
    const { result, runtime } = run(
      'Firebrand',
      [
        ID.TOME_OF_JUSTICE,
        cast('Chapter 1: Searing Spell'),
        cast('Chapter 2: Igniting Burst'),
        cast('Chapter 3: Heated Rebuke'),
        ID.STOW_TOME
      ],
      { traitTriggers, selectedTraitIds: [TRAIT.ARCHIVIST_OF_WHISPERS] }
    );
    const current = state(runtime);
    assert.equal(current.tomePages.maximum, 8);
    assert.equal(current.tomePages.value, 8 - 3 + Number(traitTriggers));
    assert.equal(current.activeTome, '');
    assert.ok(current.tomeDormantReadyAt.justice > 0);
    assert.ok(current.tomePages.nextAt > 0);
    assert.equal(
      result.procSteps.some((step) => step.skill === 'Swift Scholar'),
      traitTriggers
    );
  }
});

test('an explicitly admitted Swift Scholar refund completes in isolation after the tome is stowed', () => {
  // Feed an earned entitlement to the real isolated completion hook, independently of disabled admission.
  const admit = compileProfessionRules({
    traitTriggers: swiftScholar.triggers.map((rule) => ({ ...rule, trait: swiftScholar.id }))
  }).onCastStart;
  const { result, runtime } = run(
    'Firebrand',
    [ID.TOME_OF_JUSTICE, cast('Chapter 1: Searing Spell')],
    {
      traitTriggers: false
    },
    {
      extend: (native) => ({
        onCastStart(runtime, cast) {
          native.onCastStart?.(runtime, cast);
          if (!cast.skill.tome) return;
          const current = state(runtime);
          current.swiftScholarTome = cast.skill.tome;
          current.swiftScholarCount = 2;
          admit(runtime, cast);
          current.activeTome = '';
          current.swiftScholarTome = '';
          current.swiftScholarCount = 0;
        }
      })
    }
  );
  assert.equal(state(runtime).tomePages.value, 5);
  assert.equal(result.procSteps.filter((step) => step.skill === 'Swift Scholar').length, 1);
});

test('Legendary Lore selects only its tome boon, respects isolation and removal, and delivers to self', () => {
  for (const [tome, page, kind] of [
    [ID.TOME_OF_JUSTICE, 'Chapter 1: Searing Spell', 'might'],
    [ID.TOME_OF_RESOLVE, 'Chapter 1: Desert Bloom', 'regeneration'],
    [ID.TOME_OF_COURAGE, 'Chapter 1: Unflinching Charge', 'protection']
  ])
    for (const selected of [false, true])
      for (const traitTriggers of [false, true])
        for (const removed of [false, true]) {
          const { result } = run(
            'Firebrand',
            [tome, cast(page)],
            {
              traitTriggers,
              selectedTraitIds: selected ? [TRAIT.LEGENDARY_LORE] : [],
              allies: { count: 2 }
            },
            {
              catalog: (catalog) =>
                removed
                  ? withProfile(catalog, TRAIT.LEGENDARY_LORE, {
                      effects: catalog.balanceProfilesById
                        .get(TRAIT.LEGENDARY_LORE)
                        .effects.filter((effect) => effect.name !== kind),
                      removedEffectKeys: [skillEffectKey('boon', kind)]
                    })
                  : catalog
            }
          );
          const granted = buffs(result, 'Legendary Lore');
          assert.equal(granted.length, Number(selected && traitTriggers && !removed));
          for (const event of granted) {
            assert.equal(event.kind, kind);
            assert.equal(event.resolvedAudience.includesSelf, true);
            assert.equal(event.resolvedAudience.alliedPlayerCount, 0);
          }
        }
});

test("Liberator's Vow isolates heal rewards and claims only surviving party Quickness", () => {
  for (const selected of [false, true])
    for (const traitTriggers of [false, true])
      for (const removed of [false, true]) {
        const { result, runtime } = run(
          'Firebrand',
          [cast('Shelter')],
          {
            traitTriggers,
            selectedTraitIds: selected ? [TRAIT.LIBERATORS_VOW] : [],
            allies: { count: 2 }
          },
          {
            catalog: (catalog) =>
              removed
                ? withProfile(catalog, TRAIT.LIBERATORS_VOW, {
                    effects: [],
                    removedEffectKeys: [skillEffectKey('boon', 'quickness')]
                  })
                : catalog
          }
        );
        const active = selected && traitTriggers && !removed;
        const granted = result.resolvedEvents.filter((event) => event.type === 'buff' && event.kind === 'quickness');
        assert.equal(granted.length, Number(active));
        assert.equal(runtime.procs.deadline('guardian.firebrand.liberatorsVow') > 0, active);
        for (const event of granted) {
          assert.equal(event.resolvedAudience.includesSelf, true);
          assert.equal(event.resolvedAudience.alliedPlayerCount, 2);
        }
      }
});

test('Weighty Terms isolates final-charge refunds and reports without preventing mantra retirement', () => {
  for (const selected of [false, true])
    for (const traitTriggers of [false, true])
      for (const removed of [false, true]) {
        const { result, runtime } = run(
          'Firebrand',
          [ID.FLAME_RUSH, ID.FLAME_RUSH, ID.FLAME_SURGE],
          {
            traitTriggers,
            initialTomePages: 0,
            selectedSkillIds: [ID.MANTRA_OF_FLAME],
            selectedTraitIds: selected ? [TRAIT.WEIGHTY_TERMS] : []
          },
          {
            catalog: (catalog) =>
              removed
                ? withProfile(catalog, TRAIT.WEIGHTY_TERMS, {
                    effects: [],
                    removedEffectKeys: [skillEffectKey('condition', 'Slow')]
                  })
                : catalog
          }
        );
        const active = selected && traitTriggers;
        // The page refund is independent of the removable Slow component.
        assert.equal(state(runtime).tomePages.value, active ? 2 : 0);
        assert.equal(result.procSteps.filter((step) => step.skill === 'Weighty Terms').length, Number(active));
        assert.equal(
          result.resolvedEvents.some((event) => event.condition === 'Slow'),
          active && !removed
        );
        assert.ok(runtime.cooldownController.readyAt(ID.MANTRA_OF_FLAME) > runtime.time);
      }
});

test('every Guardian virtue owner grants shared rewards once, and dormant tome reopening grants none', () => {
  for (const [specialization, id] of [
    ['Core', ID.JUSTICE],
    ['Dragonhunter', ID.SPEAR_OF_JUSTICE],
    ['Firebrand', ID.TOME_OF_JUSTICE],
    ['Willbender', ID.RUSHING_JUSTICE],
    ['Luminary', ID.RADIANT_JUSTICE]
  ])
    for (const selected of [false, true])
      for (const traitTriggers of [false, true]) {
        const { result } = run(
          specialization,
          [id, ...(specialization === 'Firebrand' ? [ID.STOW_TOME, id] : []), wait(1000)],
          {
            traitTriggers,
            selectedTraitIds: selected ? [TRAIT.INSPIRED_VIRTUE] : [],
            allies: { count: 2 }
          }
        );
        const granted = buffs(result, 'Inspired Virtue');
        assert.equal(granted.length, Number(selected && traitTriggers), specialization);
        for (const event of granted) {
          assert.equal(event.kind, 'might');
          assert.equal(event.resolvedAudience.includesSelf, true);
          assert.equal(event.resolvedAudience.alliedPlayerCount, 2);
        }
      }
});

test('Lethal Tempo imports supplied stacks in isolation while new virtue rewards remain disabled', () => {
  for (const traitTriggers of [false, true]) {
    const { result, runtime } = run('Willbender', [ID.FLOWING_RESOLVE], {
      traitTriggers,
      initialBuffs: [{ kind: 'lethal-tempo', stacks: 2, duration: 20 }],
      selectedTraitIds: [TRAIT.RESTORATIVE_VIRTUES]
    });
    assert.equal(state(runtime).lethalTempo.stacks, traitTriggers ? 3 : 2);
    assert.ok(state(runtime).resolveUntil > runtime.time);
    assert.equal(
      result.resolvedEvents.some((event) => event.type === 'buff' && event.kind === 'vigor'),
      traitTriggers
    );
  }
});

test('Restorative Virtues isolates new reductions and always completes admitted weapon reservations', () => {
  const work = [];
  for (const admitted of [false, true]) {
    const { runtime } = run(
      'Willbender',
      [ID.CHAINS_OF_LIGHT],
      { traitTriggers: false },
      {
        extend: (native) => ({
          onCastStart(runtime, cast) {
            native.onCastStart?.(runtime, cast);
            assert.equal(state(runtime).weaponCastRecharge[cast.id].skillId, ID.CHAINS_OF_LIGHT);
            if (admitted) state(runtime).pendingWeaponCooldownReduction[cast.id] = 0.28;
          }
        })
      }
    );
    work.push(runtime.cooldownController.rechargeFor(ID.CHAINS_OF_LIGHT).work);
    assert.deepEqual(state(runtime).weaponCastRecharge, {});
    assert.deepEqual(state(runtime).pendingWeaponCooldownReduction, {});
  }

  assert.ok(Math.abs(work[0] - work[1] - 0.28) < 1e-9);

  for (const traitTriggers of [false, true]) {
    const { result } = run(
      'Willbender',
      [ID.CHAINS_OF_LIGHT],
      {
        traitTriggers,
        selectedTraitIds: [TRAIT.RESTORATIVE_VIRTUES]
      },
      {
        initialize(runtime) {
          state(runtime).justiceUntil = 10;
          state(runtime).virtueHitCounts.justice = 4;
          runtime.effects.emit({
            kind: 'packet',
            event: cause(0.1, {
              type: 'damage',
              coefficient: 1,
              skillId: ID.ORB_OF_WRATH,
              weaponStrengthProfileId: 'weapon.scepter'
            })
          });
        }
      }
    );
    assert.equal(
      result.procSteps.some((step) => step.skill === 'Restorative Virtues'),
      traitTriggers
    );
  }
});

test('Luminary trait aura admission obeys selection and isolation, independently of removable offensive components', () => {
  for (const [trait, id, key] of [
    [TRAIT.JUSTICE_IS_BLIND, ID.RADIANT_JUSTICE, skillEffectKey('condition', 'Blind')],
    [TRAIT.SOVEREIGN_OF_LIGHT, ID.ENTER_RADIANT_FORGE, skillEffectKey('strike', 'Strike')]
  ])
    for (const selected of [false, true])
      for (const traitTriggers of [false, true])
        for (const removed of [false, true]) {
          const { runtime } = run(
            'Luminary',
            [id],
            { traitTriggers, selectedTraitIds: selected ? [trait] : [] },
            {
              catalog: (catalog) =>
                removed ? withProfile(catalog, trait, { effects: [], removedEffectKeys: [key] }) : catalog
            }
          );
          assert.equal(state(runtime).lightAuraUntil > runtime.time, selected && traitTriggers);
        }
});

test('Luminary retains imported and admitted aura delivery and consumes an old aura before its replacement', () => {
  for (const traitTriggers of [false, true]) {
    const { result, runtime } = run('Luminary', [LUMINARY_INITIAL_LIGHT_AURA_SKILL_ID, ID.RADIANT_JUSTICE], {
      traitTriggers,
      selectedTraitIds: [TRAIT.JUSTICE_IS_BLIND, TRAIT.SOVEREIGN_OF_LIGHT]
    });
    assert.equal(
      result.resolvedEvents.filter((event) => event.type === 'damage' && event.name === 'Sovereign of Light').length,
      Number(traitTriggers)
    );
    assert.ok(state(runtime).lightAuraUntil > runtime.time);
  }

  const { runtime } = run(
    'Luminary',
    [wait(1000)],
    { traitTriggers: false },
    {
      initialize(runtime) {
        runtime.schedule(AURA_GRANT, 0.5, cause(0.5, { duration: 3 }));
      }
    }
  );
  assert.ok(state(runtime).lightAuraUntil > runtime.time);
  const admitted = run(
    'Luminary',
    [wait(1000)],
    { traitTriggers: false },
    {
      initialize(runtime) {
        state(runtime).lightAuraUntil = 10;
        runtime.schedule('guardian.luminary.aura-detonate', 0.5, cause(0.5));
      }
    }
  );
  assert.equal(state(admitted.runtime).lightAuraUntil, 0);
  assert.equal(
    admitted.result.resolvedEvents.filter((event) => event.type === 'damage' && event.name === 'Sovereign of Light')
      .length,
    1
  );
});

test('Core Resolution cadence starts only through enabled triggers and admitted cadence work survives isolation', () => {
  for (const traitTriggers of [false, true])
    for (const admitted of [false, true]) {
      const { result } = run(
        'Core',
        [wait(3000)],
        {
          traitTriggers,
          selectedTraitIds: [TRAIT.RIGHTEOUS_INSTINCTS]
        },
        {
          initialize(runtime) {
            const event = cause(0, { type: 'buff', kind: 'resolution', duration: 2, stacks: 1 });
            runtime.effects.emit({ kind: 'packet', event });
            if (admitted) runtime.schedule('guardian.righteous-might', 1, { generation: 0, event });
          }
        }
      );
      assert.equal(
        result.resolvedEvents.some((event) => event.sourceId === TRAIT.RIGHTEOUS_INSTINCTS),
        traitTriggers || admitted
      );
      assert.ok(
        result.resolvedEvents
          .filter((event) => event.sourceId === TRAIT.RIGHTEOUS_INSTINCTS)
          .every((event) => event.at < 2)
      );
    }
});

test('Core ammo and Dragonhunter skill transformations retain their selected policies during isolation', () => {
  for (const selected of [false, true])
    for (const traitTriggers of [false, true]) {
      const core = run('Core', [ID.ZEALOTS_FLAME], {
        traitTriggers,
        primaryWeapon: 'Sword',
        secondaryWeapon: 'Torch',
        selectedTraitIds: selected ? [TRAIT.RADIANT_FIRE] : []
      });
      assert.equal(core.result.planningState.ammoBySkillId[ID.ZEALOTS_FLAME]?.maximum ?? 1, selected ? 2 : 1);
      // Soaring Devastation changes Wings' own authored payload, rather than admitting a separate proc.
      const dragonhunter = run('Dragonhunter', [ID.WINGS_OF_RESOLVE], {
        traitTriggers,
        selectedTraitIds: selected ? [TRAIT.SOARING_DEVASTATION] : []
      });
      assert.equal(
        dragonhunter.result.resolvedEvents.some(
          (event) => event.type === 'damage' && event.name.includes('Soaring Devastation')
        ),
        selected
      );
    }
});
