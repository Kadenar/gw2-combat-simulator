import assert from 'node:assert/strict';
import test from 'node:test';
import { revenantAppAdapter } from '#gw2/professions/revenant/app/app-definition.js';
import { revenantProfession } from '#gw2/professions/revenant/profession.js';
import { VINDICATOR_JUMP_SKILL } from '#gw2/professions/revenant/data/vindicator-jump.js';
import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import { describeSimulationTrait } from '#gw2/app/shared/simulation-tooltip.js';
import { revenantTooltips } from '#gw2/professions/revenant/app/tooltips.js';
import { REVENANT_SKILL_IDS as ID, REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';

// Reuse and mutate one build to catch stale cached landings after a trait selection changes.
test('Vindicator dodge tooltips show only the selected landing and trait descriptions', () => {
  const build = { specializations: [{ name: 'Vindicator', traits: '1-1-1' }] };
  for (const skillId of [VINDICATOR_JUMP_SKILL.id, SHARED_SKILL_IDS.DODGE]) {
    const skill = revenantProfession.catalog.skillsById.get(skillId);
    for (const [choice, landing, names] of [
      [1, 'Death Drop', ['Strike damage', 'Vulnerability']],
      [2, 'Imperial Impact', ['Strike damage', 'Chilled', 'Might', 'Protection']],
      [3, "Saint's Shield", ['Alacrity']],
      [1, 'Death Drop', ['Strike damage', 'Vulnerability']]
    ]) {
      build.specializations[0].traits = `1-1-${choice}`;
      const model = revenantAppAdapter.skillTooltip(skill, 'current', build);
      assert.ok(!model.incomplete);
      assert.deepEqual(
        model.facts.map(({ name }) => name),
        [...names, 'Endurance spent']
      );
      assert.match(model.description, new RegExp(landing));
      assert.match(model.description, /Reaver's Curse/);
      assert.equal(model.description.includes('Forerunner of Death'), choice === 1);
      assert.equal(revenantAppAdapter.skillTooltip(skill, 'current', build), model);
    }

    build.specializations[0].traits = '1-2-3';
    assert.doesNotMatch(revenantAppAdapter.skillTooltip(skill, 'current', build).description, /Reaver's Curse/);
  }
});

// Trait cards expose their own landing payload without requiring that trait to be equipped.
test('Vindicator trait tooltips expose dodge effects, ally recipients, and named buff icons', () => {
  const facts = (id) =>
    revenantAppAdapter.traitTooltip(
      revenantProfession.catalog.traits.find((trait) => trait.id === id),
      'current',
      'Vindicator'
    ).facts;
  const forerunner = facts(TRAIT.FORERUNNER_OF_DEATH);
  assert.equal(
    forerunner.find(({ name }) => name === 'Forerunner of Death').icon,
    revenantProfession.catalog.skillsById.get(ID.DEATH_DROP).icon
  );
  assert.match(
    facts(TRAIT.REAVERS_CURSE).find(({ name }) => name === "Reaver's Curse").icon,
    /^https:\/\/render.guildwars2.com\/file\/00B56F050D44B6690427AFF77901E3074FF221AD\/2491534.png$/
  );
  const imperial = facts(TRAIT.VASSALS_OF_THE_EMPIRE);
  assert.match(imperial.find(({ name }) => name === 'Strike damage').detail, /^2 coefficient/);
  assert.match(imperial.find(({ name }) => name === 'Chilled').detail, /^2s/);
  const might = imperial.find(({ name }) => name === 'Might');
  assert.equal(might.stacks, 5);
  assert.match(might.detail, /^10s.*up to 5 party members/);
  assert.match(imperial.find(({ name }) => name === 'Protection').detail, /^5s.*up to 5 party members/);
  assert.match(
    facts(TRAIT.SAINT_OF_ZU_HELTZER).find(({ name }) => name === 'Alacrity').detail,
    /^4s.*up to 5 party members/
  );
});

// Editing the canonical landing data must update the trait facts as well as the dodge facts.
test('Vindicator trait facts follow the selected patch landing payload', () => {
  const profession = withPatchPreview(revenantProfession, {
    id: 'landing-tooltip',
    label: 'Landing tooltip',
    professions: {
      revenant: {
        skills: {
          [ID.IMPERIAL_IMPACT]: { removeEffects: [{ type: 'condition', condition: 'Chilled' }] },
          [ID.SAINTS_SHIELD]: {
            effects: [
              {
                type: 'boon',
                boon: 'alacrity',
                duration: 7,
                stacks: 1,
                audience: { recipients: 'party', maximumRecipients: 5 }
              }
            ]
          }
        }
      }
    }
  });
  const context = profession.balanceContextFor('landing-tooltip');
  const facts = (id) =>
    describeSimulationTrait(
      context,
      context.catalog.traits.find((trait) => trait.id === id),
      revenantTooltips,
      'Vindicator'
    ).facts;
  assert.ok(!facts(TRAIT.VASSALS_OF_THE_EMPIRE).some(({ name }) => name === 'Chilled'));
  assert.match(facts(TRAIT.SAINT_OF_ZU_HELTZER).find(({ name }) => name === 'Alacrity').detail, /^7s/);
});
