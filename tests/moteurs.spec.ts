import { expect, test } from '@playwright/test';

// Vérifie que chaque moteur de navigateur évalue les Langages de sélection natifs.
// Ce fichier sert de base aux vérifications des Exemples et Solutions de référence (jalons 2 à 4).

const html = `
  <ul id="etagere">
    <li class="livre" data-genre="sf">Dune</li>
    <li class="livre" data-genre="sf">Hyperion</li>
    <li class="livre" data-genre="polar">Le Chien des Baskerville</li>
  </ul>`;

test.beforeEach(async ({ page }) => {
  await page.setContent(html);
});

test('CSS : querySelectorAll et :has()', async ({ page }) => {
  const result = await page.evaluate(() => ({
    sf: document.querySelectorAll('li[data-genre="sf"]').length,
    has: document.querySelectorAll('ul:has(> li[data-genre="polar"])').length,
  }));
  expect(result).toEqual({ sf: 2, has: 1 });
});

test('XPath 1.0 : résultats typés nombre, chaîne et booléen', async ({ page }) => {
  const result = await page.evaluate(() => {
    const ev = (expr: string, type: number) => document.evaluate(expr, document, null, type, null);
    return {
      count: ev("count(//li[@data-genre='sf'])", XPathResult.NUMBER_TYPE).numberValue,
      string: ev('string(//li[last()])', XPathResult.STRING_TYPE).stringValue,
      boolean: ev("boolean(//li[contains(., 'Dune')])", XPathResult.BOOLEAN_TYPE).booleanValue,
    };
  });
  expect(result).toEqual({ count: 2, string: 'Le Chien des Baskerville', boolean: true });
});

test("XPath 2.0 : les fonctions comme lower-case() n'existent pas dans le navigateur", async ({ page }) => {
  const threw = await page.evaluate(() => {
    try {
      document.evaluate("//li[lower-case(.)='dune']", document, null, XPathResult.ANY_TYPE, null);
      return false;
    } catch {
      return true;
    }
  });
  expect(threw).toBe(true);
});
