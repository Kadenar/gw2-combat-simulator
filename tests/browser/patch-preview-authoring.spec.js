import { expect, test } from '@playwright/test';

// Replace only the browser's active-preview module so composition tests never edit repository patch data.
for (const mode of ['preview', 'absent', 'invalid']) {
  test(`profession app composition handles ${mode} active preview`, async ({ page }) => {
    const preview =
      mode === 'absent'
        ? null
        : {
            id: 'fixture-preview',
            label: 'Fixture Preview',
            ...(mode === 'invalid'
              ? { constants: { factor: 2 } }
              : { professions: { fixture: { skills: { 1: { coefficient: { multiply: 2 } } } } } })
          };
    await page.route('**/integrations/patches/active-preview.ts', (route) =>
      route.fulfill({
        contentType: 'text/javascript',
        body: `export const activePatchPreview = ${JSON.stringify(preview)};`
      })
    );
    await page.route('**/composition-test', (route) =>
      route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Composition test</title>' })
    );
    await page.goto('/composition-test');
    const result = await page.evaluate(async (mode) => {
      const { definePatchedProfessionApp } = await import('/js/games/gw2/app/create-patched-adapter.ts');
      const { defineProfessionApp } = await import('/js/games/gw2/app/create-adapter.ts');
      const { defineNativeModule, defineNativeProfession } =
        await import('/js/games/gw2/platform/profession-definition/profession.ts');
      // Reuse the isolated strike scenario from the native patch-preview contract coverage.
      const native = defineNativeProfession({
        id: 'fixture',
        name: 'Fixture',
        modules: [
          defineNativeModule({
            id: 'Core',
            data: {
              generatedSkills: [
                {
                  id: 1,
                  name: 'Previewed Skill',
                  type: 'Utility',
                  castTimeMs: 0,
                  effects: [{ type: 'strike', coefficient: 1, hits: 1 }]
                }
              ]
            },
            state: { create: () => ({}) }
          })
        ]
      });
      const options = {
        profession: native,
        applyBuildAttributeRules: () => {},
        toApplicationBuild: (build) => build,
        specializationFallback: 'Core'
      };
      const plain = defineProfessionApp(options);
      if (mode === 'invalid') {
        try {
          definePatchedProfessionApp(options);
        } catch (error) {
          return { error: error.message, plainIsNative: plain.profession === native };
        }

        return { error: null };
      }

      const adapter = definePatchedProfessionApp(options);
      const patchId = mode === 'preview' ? 'fixture-preview' : 'current';
      const config = {
        specialization: 'Core',
        stats: { power: 1000, precision: 0, ferocity: 0, conditionDamage: 0, expertise: 0, concentration: 0 },
        target: { armor: 1000 }
      };
      const current = plain.simulateBuild([1], config);
      const patched = adapter.simulateBuild([1], { ...config, patchId });
      return {
        coefficient: adapter.profession.catalogFor(patchId).skillsById.get(1).effects[0].coefficient,
        nativeCoefficient: native.catalog.skillsById.get(1).effects[0].coefficient,
        nativeHasPreview: 'preview' in native,
        currentDamage: current.totalDamage,
        patchedDamage: patched.totalDamage,
        warnings: patched.warnings,
        previewId: adapter.profession.preview?.id ?? null
      };
    }, mode);

    if (mode === 'invalid') {
      expect(result.error).toContain('unsupported field constants');
      expect(result.plainIsNative).toBe(true);
      return;
    }

    const multiplier = mode === 'preview' ? 2 : 1;
    expect(result.coefficient).toBe(multiplier);
    expect(result.nativeCoefficient).toBe(1);
    expect(result.nativeHasPreview).toBe(false);
    expect(result.currentDamage).toBeGreaterThan(0);
    expect(Math.abs(result.patchedDamage - result.currentDamage * multiplier)).toBeLessThan(multiplier);
    expect(result.warnings).toEqual([]);
    expect(result.previewId).toBe(mode === 'preview' ? 'fixture-preview' : null);
  });
}

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
