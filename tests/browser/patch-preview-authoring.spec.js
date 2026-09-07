import { expect, test } from '@playwright/test';

// Hold API responses in memory to exercise draft ownership without writing a preview to disk.
for (const operation of ['save', 'reset']) {
  for (const succeeds of [true, false]) {
    test(`${operation} locks authoring until ${succeeds ? 'success' : 'failure'}`, async ({ page }) => {
      const preview = { id: 'test-patch', label: 'Original' };
      const payload = { preview, professions: [], sourceFile: 'active-preview.ts' };
      const requests = [];
      let initialLoad = true;
      await page.route('**/api/patch-preview', (route) => {
        if (initialLoad) {
          initialLoad = false;
          return route.fulfill({ json: payload });
        }

        requests.push(route);
      });
      await page.goto('/patch-preview.html');
      const label = page.locator('[data-preview-field="label"]');
      const save = page.locator('[data-save-preview]');
      const reset = page.locator('[data-reset-preview]');
      await label.fill('First edit');
      await label.dispatchEvent('change');
      await (operation === 'save' ? save : reset).click();
      await expect.poll(() => requests.length).toBe(1);
      expect(requests[0].request().method()).toBe(operation === 'save' ? 'PUT' : 'GET');
      if (operation === 'save') {
        expect(requests[0].request().postDataJSON().preview.label).toBe('First edit');
      }

      await expect(label).toBeDisabled();
      await expect(save).toBeDisabled();
      await expect(reset).toBeDisabled();
      await expect(page.locator('[data-patch-authoring-app] :is(button, input, select, textarea):enabled')).toHaveCount(
        0
      );

      // Even queued or synthetic events cannot mutate the draft or launch another request while locked.
      await label.evaluate((input) => {
        input.value = 'Second edit while pending';
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });
      await save.dispatchEvent('click');
      await reset.dispatchEvent('click');
      await expect(page.locator('.patch-generated-preview')).toContainText('First edit');
      await expect(page.locator('.patch-generated-preview')).not.toContainText('Second edit while pending');

      const savedPreview = { ...preview, label: 'First edit' };
      await requests[0].fulfill({
        status: succeeds ? 200 : 500,
        json: succeeds
          ? { ...payload, preview: operation === 'save' ? savedPreview : preview }
          : { error: 'Test request failed' }
      });
      await expect(save).toBeEnabled();
      await expect(label).toBeEnabled();
      await expect(label).toHaveValue(succeeds && operation === 'reset' ? 'Original' : 'First edit');
      await expect(reset).toBeEnabled({ enabled: !succeeds });
      if (!succeeds) {
        await expect(page.getByRole('status')).toHaveText('Test request failed');
      }

      expect(requests).toHaveLength(1);
      await label.fill('Edit after completion');
      await label.dispatchEvent('change');
      await expect(reset).toBeEnabled();
      await expect(page.locator('.patch-generated-preview')).toContainText('Edit after completion');
      await save.click();
      await expect.poll(() => requests.length).toBe(2);
      await requests[1].fulfill({ json: { ...payload, preview: { ...preview, label: 'Edit after completion' } } });
      await expect(save).toBeEnabled();
      await expect(reset).toBeDisabled();
    });
  }
}
