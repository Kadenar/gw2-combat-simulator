import assert from 'node:assert/strict';
import test from 'node:test';

import { groupedOptionsHtml, optionHtml } from '#ui/shared/select-options.js';

test('select options escape labels and preserve selection state', () => {
  assert.equal(
    optionHtml('a&b', 'a&b', '<label>', true),
    '<option value="a&amp;b" selected disabled>&lt;label&gt;</option>'
  );
  assert.equal(
    groupedOptionsHtml([{ label: 'Damage & support', items: ['Power'] }], 'Power', (value) => `${value} <stat>`),
    '<optgroup label="Damage &amp; support"><option value="Power" selected>Power &lt;stat&gt;</option></optgroup>'
  );
});

test('grouped options can disable items without losing the selection', () => {
  assert.equal(
    groupedOptionsHtml(
      [{ label: 'Power', items: ['Force', 'Impact'] }],
      'Force',
      (value) => value,
      (value) => value === 'Impact'
    ),
    '<optgroup label="Power"><option value="Force" selected>Force</option><option value="Impact" disabled>Impact</option></optgroup>'
  );
});
