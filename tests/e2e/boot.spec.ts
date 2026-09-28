import { expect, test, type Page } from '@playwright/test';

function isSceneActive(page: Page, key: string) {
  return page.evaluate((k) => window.__merkavania?.game.scene.isActive(k) ?? false, key);
}

function getPawn(page: Page) {
  return page.evaluate(() => window.__merkavania?.getPawn() ?? null);
}

function getShots(page: Page) {
  return page.evaluate(() => window.__merkavania?.getShots() ?? {});
}

test('boots to the title, starts the world, drives and fires the tank', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));

  await page.goto('/?debug=1');
  await expect.poll(() => isSceneActive(page, 'Title')).toBe(true);

  await page.locator('canvas').click();
  await expect.poll(() => isSceneActive(page, 'World')).toBe(true);
  await expect.poll(() => getPawn(page)).not.toBeNull();
  const start = (await getPawn(page))!;

  // The tank spawns facing north; holding W drives it up the screen.
  await page.keyboard.down('w');
  await page.waitForTimeout(800);
  const moving = (await getPawn(page))!;
  await page.keyboard.up('w');
  expect(moving.y).toBeLessThan(start.y - 10);
  expect(moving.speed).toBeGreaterThan(0);

  // Right click fires the main gun, left click the coax MG.
  await page.mouse.down({ button: 'right' });
  await page.waitForTimeout(100);
  await page.mouse.up({ button: 'right' });
  await page.mouse.down();
  await page.waitForTimeout(300);
  await page.mouse.up();
  await expect.poll(() => getShots(page)).toMatchObject({ gun_105: 1 });
  expect((await getShots(page)).coax_mg).toBeGreaterThan(1);

  await page.screenshot({ path: 'test-results/world.png' });
  expect(errors).toEqual([]);
});
