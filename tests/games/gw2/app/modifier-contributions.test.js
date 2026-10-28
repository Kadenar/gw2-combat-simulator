import assert from 'node:assert/strict';
import test from 'node:test';

import { modifierContributionsHtml, mountModifierContributions } from '#gw2/app/results/modifier-contributions-view.js';
import { inertContainer } from '#tests/helpers/dom.js';

// Pending comparisons occupy only their own section and never present old values as current.
test('modifier section shows pending, completed, empty, and failed states', () => {
  const contributions = [{ name: 'Old modifier', dpsIncrease: 12, pctIncrease: 1 }];
  const pending = modifierContributionsHtml({ contributions, contributionsStale: true });
  assert.match(pending, /role="status"/);
  assert.match(pending, /Calculating modifier contributions/);
  assert.doesNotMatch(pending, /Old modifier|contrib-table/);
  assert.match(modifierContributionsHtml({ contributions }), /Old modifier/);
  assert.equal(modifierContributionsHtml({ contributions: [] }), '');
  assert.match(modifierContributionsHtml({ contributionsError: 'Failed <request>' }), /Failed &lt;request&gt;/);
});

test('modifier contribution errors are visible and escaped', () => {
  const container = inertContainer();

  mountModifierContributions(container, { contributionsError: 'Comparison <failed>' });

  assert.match(container.innerHTML, /Modifier Contributions/);
  assert.match(container.innerHTML, /class="contrib-pending contrib-error"/);
  assert.match(container.innerHTML, /Comparison &lt;failed&gt;/);
  assert.doesNotMatch(container.innerHTML, /Comparison <failed>/);
});
