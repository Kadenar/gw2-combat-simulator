import assert from 'node:assert/strict';
import test from 'node:test';
import { availableSlotSkills, swapSelectedSkillsForPatch } from '#gw2/app/build/state/skill-selection.js';
import { resolveEntrySkill } from '#gw2/app/rotation/editing/actions.js';
import { ProfessionApp } from '#gw2/app/profession-app.js';

const utility = { type: 'Utility', slot: 'Utility', weapon: '' };
const focus = { type: 'Weapon', slot: 'Weapon_5', weapon: 'Focus' };
const catalog = (skills) => ({ skills, skillsById: new Map(skills.map((skill) => [skill.id, skill])) });
const live = catalog([
  { id: 1, ...utility },
  { id: 2, ...focus },
  { id: 3, ...utility }
]);
const preview = catalog([
  { id: 1, ...focus },
  { id: 2, ...utility },
  { id: 3, ...utility }
]);

// Reciprocal role changes retain the same utility position and leave other selections and empty slots intact.
test('patch role swaps preserve the selected utility slot in both directions', () => {
  for (const slot of ['Utility1', 'Utility2', 'Utility3']) {
    const selected = { Heal: null, Utility1: null, Utility2: null, Utility3: null, Elite: null, [slot]: 1 };
    const other = slot === 'Utility1' ? 'Utility2' : 'Utility1';
    selected[other] = 3;
    const app = { activeCatalog: live, build: { selectedSkillIds: { ...selected } } };
    swapSelectedSkillsForPatch(app, preview);
    assert.deepEqual(app.build.selectedSkillIds, { ...selected, [slot]: 2 });
    app.activeCatalog = preview;
    swapSelectedSkillsForPatch(app, live);
    assert.deepEqual(app.build.selectedSkillIds, selected);
  }
});

// Missing, unrelated, or ambiguous placement edits do not establish a replacement relationship.
test('patch switching only remaps a unique reciprocal placement swap', () => {
  for (const [previous, next] of [
    [live, live],
    [
      live,
      catalog([
        { id: 1, ...focus },
        { id: 3, ...utility }
      ])
    ],
    [
      live,
      catalog([
        { id: 2, ...utility },
        { id: 3, ...utility }
      ])
    ],
    [catalog([...live.skills, { id: 4, ...focus }]), catalog([...preview.skills, { id: 4, ...utility }])]
  ]) {
    const app = { activeCatalog: previous, build: { selectedSkillIds: { Utility2: 1 } } };
    swapSelectedSkillsForPatch(app, next);
    assert.equal(app.build.selectedSkillIds.Utility2, 1);
  }
});

// Remap selections against the outgoing catalog before refresh consumers read the incoming patch.
test('patch selection refreshes skill lists and both lookups from the new catalog', () => {
  const catalogs = Object.fromEntries(
    [
      ['current', live],
      ['preview', preview]
    ].map(([id, source]) => {
      const skills = source.skills.map((skill) => ({ ...skill, name: `Skill ${skill.id}` }));
      return [
        id,
        {
          skills,
          skillsById: new Map(skills.map((skill) => [skill.id, skill])),
          skillsByName: new Map(skills.map((skill) => [skill.name, skill]))
        }
      ];
    })
  );
  const refreshed = [];
  const app = Object.assign(Object.create(ProfessionApp.prototype), {
    patchId: 'current',
    activeCatalog: catalogs.current,
    profession: { catalog: catalogs.current, catalogFor: (id) => catalogs[id], ui: {} },
    adapter: { eliteSpecialization: () => 'Core', isSkillAvailable: () => true },
    build: { selectedSkillIds: { Utility1: 1 } },
    changed() {
      const selected = this.activeCatalog.skillsById.get(this.build.selectedSkillIds.Utility1);
      assert.equal(resolveEntrySkill(this, { type: 'cast', skillId: selected.id }), selected);
      assert.equal(resolveEntrySkill(this, { name: selected.name }), selected);
      assert.deepEqual(
        availableSlotSkills(this, 'Utility'),
        this.activeCatalog.skills.filter((skill) => skill.type === 'Utility')
      );
      refreshed.push([this.patchId, selected.id]);
    }
  });
  app.selectPatch('preview');
  app.selectPatch('current');
  assert.deepEqual(refreshed, [
    ['preview', 2],
    ['current', 1]
  ]);
});
