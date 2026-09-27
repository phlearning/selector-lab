import { expect, test } from '@playwright/test';

interface ExempleVerifie {
  cle: string;
  page: string;
  langage: 'css' | 'xpath' | 'dom';
  selecteur: string;
  attendu: unknown;
}

// Chaque Exemple de la Référence et chaque ligne de "CSS vs XPath" est réévalué par le vrai moteur
// de chaque navigateur, et doit renvoyer exactement le Résultat typé affiché sur le site.
test('chaque Exemple renvoie le Résultat typé attendu', async ({ page, request }) => {
  const exemples: ExempleVerifie[] = await (await request.get('exemples.json')).json();
  expect(exemples.length).toBeGreaterThan(0);

  await page.goto('verification/');
  await expect(page.locator('body[data-pret="oui"]')).toBeAttached();

  const obtenus = await page.evaluate(
    (liste) =>
      liste.map((e) =>
        (window as unknown as { selectorLab: { verifier: (...a: string[]) => unknown } }).selectorLab.verifier(
          e.page,
          e.langage,
          e.selecteur,
        ),
      ),
    exemples,
  );

  exemples.forEach((exemple, i) => {
    expect.soft(exemple.attendu, `${exemple.cle} : résultat attendu manquant`).not.toBeNull();
    expect.soft(obtenus[i], `${exemple.cle} : ${exemple.selecteur}`).toEqual(exemple.attendu);
  });
});
