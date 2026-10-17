import { expect, it } from 'vitest';
import { page } from '@vitest/browser/context';
import '../../src/index.css';
import '../../src/App.css';

it('keeps list cards, names, and controls within mobile and desktop widths in both themes', async () => {
  const host = document.createElement('div');
  host.id = 'root';
  host.innerHTML = `<div class="app-shell gallery"><div class="list-gallery"><article class="list-card">
    <button class="list-card-open"><span class="list-thumbnail list-placeholder">Photo</span>
    <span class="list-card-copy"><strong>${'A'.repeat(256)}</strong><small>0 of 1 items checked</small></span></button>
    <button class="list-card-delete">×</button></article></div>
    <div class="list-title"><label for="name">List name</label><input id="name" class="form-control" /></div></div>
    `;
  document.body.append(host);
  try {
    for (const width of [375, 991, 992, 1280]) {
      await page.viewport(width, 900);
      for (const scheme of ['light', 'dark']) {
        host.style.colorScheme = scheme;
        const card = host.querySelector<HTMLElement>('.list-card')!;
        const control = host.querySelector<HTMLElement>('.list-card-delete')!;
        const input = host.querySelector<HTMLElement>('input')!;
        expect(card.scrollWidth).toBeLessThanOrEqual(card.clientWidth);
        expect(card.getBoundingClientRect().right).toBeLessThanOrEqual(width);
        expect(control.getBoundingClientRect().width).toBeGreaterThanOrEqual(44);
        expect(control.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
        expect(input.getBoundingClientRect().height).toBeGreaterThanOrEqual(48);
        expect(getComputedStyle(card).backgroundColor).toBe(scheme === 'light' ? 'rgb(248, 249, 251)' : 'rgb(43, 43, 43)');
        const columns = getComputedStyle(host.querySelector('.list-gallery')!).gridTemplateColumns.split(' ');
        expect(columns).toHaveLength(width < 992 ? 1 : 2);
      }
    }
  } finally {
    host.remove();
    await page.viewport(1280, 720);
  }
});
