import { expect, test } from '@playwright/test';

test("la page d'accueil mène aux trois parties du site", async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { level: 1, name: 'Selector Lab' })).toBeVisible();

  const nav = page.getByRole('navigation', { name: 'Navigation principale' });
  for (const name of ['Référence', 'Testeur', 'Jeu']) {
    await nav.getByRole('link', { name }).click();
    await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
    await expect(nav.getByRole('link', { name })).toHaveAttribute('aria-current', 'page');
  }
});
