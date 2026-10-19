import assert from 'node:assert/strict';
import test from 'node:test';
import { strikeEffectTicks } from '#gw2/platform/effects/authoring.js';
import { extendPeriodicEffects } from '#gw2/platform/effects/periodic.js';
import { normalizeEffect } from '#gw2/platform/effects/validation.js';

const strike = {
  type: 'strike',
  coefficient: 0.4,
  atMs: 280,
  applications: 2,
  intervalMs: 680,
  timingAnchor: 'castStart',
  timingScale: 'fixed'
};
const bleeding = {
  type: 'condition',
  condition: 'Bleeding',
  stacks: 1,
  duration: 3,
  atMs: 680,
  applications: 5,
  intervalMs: 1000,
  timingAnchor: 'castStart'
};
const timeline = { type: 'strike', ticks: [{ atMs: 240, coefficient: 0.2 }], timingAnchor: 'castStart' };
const oneShot = { type: 'boon', boon: 'fury', duration: 1.5 };

// Each repeated strike application is one full-coefficient hit, spaced like repeated condition applications.
test('repeated strike applications expand to one full-coefficient hit per interval', () => {
  assert.deepEqual(strikeEffectTicks(strike), [
    { atMs: 280, coefficient: 0.4 },
    { atMs: 960, coefficient: 0.4 }
  ]);
});

// An added lifetime holds only whole pulses of each effect's own interval; calibrated timelines are never extended.
test('repeated effects gain the whole applications that fit in an added lifetime', () => {
  const effects = [strike, bleeding, timeline, oneShot];
  const [extendedStrike, extendedBleeding, unchangedTimeline, unchangedOneShot] = extendPeriodicEffects(effects, 2000);

  assert.equal(extendedStrike.applications, 4);
  assert.equal(extendedBleeding.applications, 7);
  assert.equal(unchangedTimeline, timeline);
  assert.equal(unchangedOneShot, oneShot);
  assert.equal(strike.applications, 2);
  assert.deepEqual(extendPeriodicEffects([strike], 679), [strike]);
});

// One schedule has one representation, and repeated pulses stay on the 40 ms server tick.
test('effect schedules reject mixed forms and off-grid intervals', () => {
  assert.equal(normalizeEffect(strike).applications, 2);
  assert.throws(
    () => normalizeEffect({ ...timeline, intervalMs: 1000 }),
    /Strike tick timelines cannot use aggregate coefficient or timing fields/
  );
  assert.throws(
    () =>
      normalizeEffect({
        type: 'condition',
        ticks: [{ atMs: 0, condition: 'Bleeding', stacks: 1, duration: 3 }],
        intervalMs: 1000,
        timingAnchor: 'castEnd'
      }),
    /Condition tick timelines cannot use aggregate application or timing fields/
  );
  assert.throws(() => normalizeEffect({ ...strike, intervalMs: 500 }), /multiple of the 40 ms server tick/);
  assert.throws(
    () => normalizeEffect({ type: 'strike', coefficient: 1, atMs: 0, intervalMs: 1000 }),
    /Strike intervals require an applications count or an explicit tick timeline/
  );
  assert.throws(() => normalizeEffect({ ...strike, hits: 2 }), /Repeated strike applications land one hit each/);
});
