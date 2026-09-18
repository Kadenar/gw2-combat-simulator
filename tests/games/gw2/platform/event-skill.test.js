import assert from 'node:assert/strict';
import test from 'node:test';
import { skillForEvent } from '#gw2/platform/combat/query/event-skill.js';

// Shared lookup preserves stable skill/source identities and the legacy name fallback without resolver state.
test('event skill lookup prefers ids and tolerates partial catalogs', () => {
  const skill = { id: 1, name: 'Current' };
  const fallback = { id: 2, name: 'Legacy' };
  const catalog = { skillsById: new Map([[1, skill]]), skillsByName: new Map([['Legacy', fallback]]) };
  assert.equal(skillForEvent(catalog, { skillId: 1, sourceId: 2, skillName: 'Legacy' }), skill);
  assert.equal(skillForEvent(catalog, { sourceId: 1 }), skill);
  assert.equal(skillForEvent(catalog, { skillId: 99, skillName: 'Legacy' }), fallback);
  assert.equal(skillForEvent({ skillsByName: catalog.skillsByName }, { skillName: 'Legacy' }), fallback);
  assert.equal(skillForEvent({}, {}), undefined);
});
