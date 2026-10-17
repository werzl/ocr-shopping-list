import { expect, it } from 'vitest';
import { page } from '@vitest/browser/context';
import '../../src/App.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import '../../src/bootstrap-overrides.css';
import '../../src/index.css';

it('clear action fits beside Delete and the editing controls on mobile and desktop', async () => {
  const host = document.createElement('div');
  const previousScheme = document.documentElement.style.colorScheme;
  host.className = 'navbar-dock';
  host.innerHTML = '<nav class="app-nav-bar">' + ['Back', 'Cancel', 'Save', 'Clear', 'Delete'].map(label =>
    `<button class="nav-button" aria-label="${label}"><svg viewBox="0 0 24 24" aria-hidden="true"></svg><span>${label}</span></button>`,
  ).join('') + '</nav>';
  document.body.append(host);
  try {
    for (const width of [320, 375, 991, 992, 1280]) {
      await page.viewport(width, 900);
      for (const scheme of ['light', 'dark']) {
        document.documentElement.style.colorScheme = scheme;
        for (const button of host.querySelectorAll('button')) {
          const bounds = button.getBoundingClientRect();
          expect(bounds.width).toBeGreaterThanOrEqual(44);
          expect(bounds.height).toBeGreaterThanOrEqual(44);
          expect(bounds.left).toBeGreaterThanOrEqual(0);
          expect(bounds.right).toBeLessThanOrEqual(width);
        }
      }
    }
  } finally {
    host.remove();
    document.documentElement.style.colorScheme = previousScheme;
    await page.viewport(1280, 720);
  }
});
