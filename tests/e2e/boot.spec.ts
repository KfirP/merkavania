import { expect, test, type Page } from '@playwright/test';

function isSceneActive(page: Page, key: string) {
  return page.evaluate((k) => window.__merkavania?.game.scene.isActive(k) ?? false, key);
}

test('boots to the title screen and starts the world', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));

  await page.goto('/?debug=1');
  await expect.poll(() => isSceneActive(page, 'Title')).toBe(true);

  await page.locator('canvas').click();
  await expect.poll(() => isSceneActive(page, 'World')).toBe(true);

  expect(errors).toEqual([]);
});
