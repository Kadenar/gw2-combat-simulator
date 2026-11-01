// Pet helpers keep actor execution and summon boon ownership consistent across families.
import assert from 'node:assert/strict';
import test from 'node:test';

import { RECIPIENT } from '#gw2/platform/constants.js';
import { RANGER_CORE_PET_SKILL_MECHANICS } from '#gw2/professions/ranger/core/skills/pets/index.js';
import { definePetSkill } from '#gw2/professions/ranger/core/skills/pets/pet-skill.js';

test('pet declarations share independent actor recharge rules without changing authored payloads', () => {
  const authored = Object.freeze({
    name: 'Pet action',
    description: 'Fixture.',
    icon: 'pet.png',
    cooldown: 12,
    effects: []
  });
  const defined = definePetSkill(authored);
  assert.equal(defined.cooldown, authored.cooldown);
  assert.equal(defined.effects, authored.effects);
  assert.equal(Object.hasOwn(authored, 'rechargeOwner'), false);
  for (const skill of [defined, ...Object.values(RANGER_CORE_PET_SKILL_MECHANICS)]) {
    assert.equal(skill.petSkill, true);
    assert.equal(skill.independentCast, true);
    assert.equal(skill.independentCastCanOverlap, true);
    assert.equal(skill.usableWhileRecharging, true);
    assert.equal(skill.rechargeOwner, 'actor');
    assert.equal(skill.rechargeAnchor, 'castStart');
    assert.equal(skill.rechargeBuffAudience, RECIPIENT.SUMMONS);
  }
});
