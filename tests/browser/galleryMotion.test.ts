import { page } from '@vitest/browser/context';
import { expect, it, vi } from 'vitest';
import { popInList, popOutList } from '../../src/listMotion';
import '../../src/index.css';
import '../../src/App.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import '../../src/bootstrap-overrides.css';

it('pops lists in and out without changing their layout space in either theme', async () => {
  const host = document.createElement('div');
  host.className = 'app-shell container';
  host.innerHTML = '<div class="list-gallery"><article class="list-card"><button class="list-card-open"><span class="list-thumbnail">Photo</span><span class="list-card-copy"><strong>Weekly shop</strong><small>0 of 1 items checked</small></span></button></article></div>';
  document.body.append(host);
  const card = host.querySelector<HTMLElement>('.list-card')!;
  try {
    for (const width of [375, 991, 992, 1280]) {
      await page.viewport(width, 900);
      for (const theme of ['light', 'dark']) {
        host.style.colorScheme = theme;
        const height = card.offsetHeight;
        const entrance = popInList(card)!;
        entrance.pause();
        entrance.currentTime = 0;
        expect(getComputedStyle(card).opacity).toBe('0');
        expect(card.offsetHeight).toBe(height);
        entrance.currentTime = 182;
        expect(card.getBoundingClientRect().width).toBeGreaterThan(card.offsetWidth);
        expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(width);
        entrance.finish();
        await entrance.finished;
        expect(getComputedStyle(card).transform).toBe('none');
        expect(getComputedStyle(card).opacity).toBe('1');

        const exit = popOutList(card)!;
        exit.finish();
        await exit.finished;
        expect(getComputedStyle(card).opacity).toBe('0');
        expect(card.offsetHeight).toBe(height);
        exit.cancel();
        expect(getComputedStyle(card).opacity).toBe('1');
      }
    }
  } finally {
    host.remove();
    await page.viewport(1280, 720);
  }
});

it('skips list pop animations when reduced motion is active', () => {
  const list = document.createElement('div');
  document.body.append(list);
  try {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    expect(popInList(list)).toBeNull();
    expect(popOutList(list)).toBeNull();
    expect(list.getAnimations()).toHaveLength(0);
    expect(getComputedStyle(list).opacity).toBe('1');
  } finally {
    vi.unstubAllGlobals();
    list.remove();
  }
});
