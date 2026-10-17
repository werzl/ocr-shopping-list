import { page } from '@vitest/browser/context';
import { expect, it, vi } from 'vitest';
import { keepItemVisible } from '../../src/itemVisibility';
import '../../src/App.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import '../../src/bootstrap-overrides.css';
import '../../src/index.css';

function nextFrame() {
  return new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

function setup() {
  const host = document.createElement('div');
  host.id = 'root';
  host.innerHTML = `<main class="app-shell container"><div class="workspace"><div class="shopping-list shopping-list-editing">
    ${Array.from({ length: 40 }, (_, index) => `<div class="item-editor" style="min-height:48px">Item ${index + 1}</div>`).join('')}
    <div class="item-editor"><input aria-label="New item name" class="form-control"><button>Remove</button></div>
    <div class="list-actions"><button class="add-item-button">Add item</button></div>
    </div></div><div class="navbar-dock"><nav class="app-nav-bar"><button class="nav-button">Back</button><button class="nav-button">Save</button></nav></div></main>`;
  document.body.append(host);

  return { host, input: host.querySelector('input')!, shell: host.querySelector<HTMLElement>('.app-shell')!, list: host.querySelector<HTMLElement>('.shopping-list')! };
}

it('keeps the whole next item above the toolbar at mobile and desktop widths in both themes', async () => {
  const { host, input, list } = setup();
  const scheme = document.documentElement.style.colorScheme;
  let stop = () => {};
  try {
    for (const width of [375, 991, 992, 1280]) {
      await page.viewport(width, 700);
      for (const theme of ['light', 'dark']) {
        document.documentElement.style.colorScheme = theme;
        window.scrollTo(0, 0);
        list.scrollTop = 0;
        input.focus({ preventScroll: true });
        for (let index = 0; index < 3; index++) {
          const completed = document.createElement('div');
          completed.className = 'item-editor';
          completed.style.minHeight = '48px';
          completed.textContent = 'Completed item';
          list.insertBefore(completed, input.parentElement);
          stop();
          stop = keepItemVisible(input);
          await nextFrame();
          const row = input.parentElement!.getBoundingClientRect();
          const dock = host.querySelector<HTMLElement>('.navbar-dock')!;
          const bottom = getComputedStyle(dock).position === 'fixed' ? dock.getBoundingClientRect().top : innerHeight;
          expect(row.bottom).toBeLessThanOrEqual(bottom - 15);
          expect(row.top).toBeGreaterThanOrEqual(15);
          expect(document.activeElement).toBe(input);
          expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(width);
          if (width >= 992) {
            expect(list.scrollTop).toBeGreaterThan(0);
            expect(row.bottom).toBeLessThanOrEqual(list.getBoundingClientRect().bottom);
          }
        }
      }
    }
  } finally {
    stop();
    host.remove();
    document.documentElement.style.colorScheme = scheme;
    window.scrollTo(0, 0);
    await page.viewport(1280, 720);
  }
});

it('allows enough page scroll when the keyboard reduces the visible viewport and changes size', async () => {
  await page.viewport(375, 700);
  const viewport = Object.assign(new EventTarget(), { height: 400, offsetTop: 0 });
  vi.stubGlobal('visualViewport', viewport);
  const { host, input, shell } = setup();
  input.focus({ preventScroll: true });
  const stop = keepItemVisible(input);
  try {
    await nextFrame();
    expect(input.parentElement!.getBoundingClientRect().bottom).toBeLessThanOrEqual(385);
    expect(shell.style.getPropertyValue('--keyboard-inset')).toBe('300px');
    viewport.height = 300;
    viewport.dispatchEvent(new Event('resize'));
    await nextFrame();
    expect(input.parentElement!.getBoundingClientRect().bottom).toBeLessThanOrEqual(285);
    expect(shell.style.getPropertyValue('--keyboard-inset')).toBe('400px');
    input.blur();
    expect(shell.style.getPropertyValue('--keyboard-inset')).toBe('');
    const position = window.scrollY;
    viewport.dispatchEvent(new Event('resize'));
    await nextFrame();
    expect(window.scrollY).toBe(position);
  } finally {
    stop();
    host.remove();
    vi.unstubAllGlobals();
    window.scrollTo(0, 0);
    await page.viewport(1280, 720);
  }
});

it('cancels a scheduled reveal when the item closes', async () => {
  const { host, input } = setup();
  input.focus({ preventScroll: true });
  const scroll = vi.spyOn(window, 'scrollBy');
  const stop = keepItemVisible(input);
  try {
    stop();
    await nextFrame();
    expect(scroll).not.toHaveBeenCalled();
  } finally {
    stop();
    scroll.mockRestore();
    host.remove();
    window.scrollTo(0, 0);
  }
});

it('detects keyboard dismissal when the input remains focused and stops watching after dismissal', async () => {
  await page.viewport(375, 700);
  const viewport = Object.assign(new EventTarget(), { height: 400, offsetTop: 0, scale: 1 });
  vi.stubGlobal('visualViewport', viewport);
  const { host, input, shell } = setup();
  input.focus({ preventScroll: true });
  const dismiss = vi.fn(() => input.blur());
  const stop = keepItemVisible(input, dismiss);
  try {
    await nextFrame();
    expect(document.activeElement).toBe(input);
    viewport.height = 700;
    viewport.dispatchEvent(new Event('resize'));
    await nextFrame();
    expect(dismiss).toHaveBeenCalledOnce();
    expect(document.activeElement).not.toBe(input);
    expect(shell.style.getPropertyValue('--keyboard-inset')).toBe('');
    viewport.dispatchEvent(new Event('resize'));
    await nextFrame();
    expect(dismiss).toHaveBeenCalledOnce();
  } finally {
    stop();
    host.remove();
    vi.unstubAllGlobals();
    window.scrollTo(0, 0);
    await page.viewport(1280, 720);
  }
});

it('ignores small viewport changes and orientation changes during keyboard dismissal detection', async () => {
  await page.viewport(375, 700);
  const viewport = Object.assign(new EventTarget(), { height: 650, offsetTop: 0, scale: 1 });
  vi.stubGlobal('visualViewport', viewport);
  const { host, input } = setup();
  input.focus({ preventScroll: true });
  const dismiss = vi.fn();
  const stop = keepItemVisible(input, dismiss);
  try {
    await nextFrame();
    viewport.height = 700;
    viewport.dispatchEvent(new Event('resize'));
    await nextFrame();
    expect(dismiss).not.toHaveBeenCalled();
    viewport.height = 400;
    viewport.dispatchEvent(new Event('resize'));
    await nextFrame();
    vi.stubGlobal('innerWidth', 700);
    viewport.height = 700;
    viewport.dispatchEvent(new Event('resize'));
    await nextFrame();
    expect(dismiss).not.toHaveBeenCalled();
  } finally {
    stop();
    host.remove();
    vi.unstubAllGlobals();
    window.scrollTo(0, 0);
    await page.viewport(1280, 720);
  }
});

it.each([0, 140])('reserves the full toolbar height before it follows the keyboard with viewport offset %s', async offsetTop => {
  await page.viewport(375, 700);
  const viewport = Object.assign(new EventTarget(), { height: 400, offsetTop, scale: 1 });
  vi.stubGlobal('visualViewport', viewport);
  const { host, input } = setup();
  input.focus({ preventScroll: true });
  const stop = keepItemVisible(input);
  try {
    await nextFrame();
    const dock = host.querySelector<HTMLElement>('.navbar-dock')!;
    const bounds = dock.getBoundingClientRect();
    expect(bounds.top).toBeGreaterThan(viewport.offsetTop + viewport.height - bounds.height);
    expect(input.parentElement!.getBoundingClientRect().bottom).toBeLessThanOrEqual(
      viewport.offsetTop + viewport.height - bounds.height - 15,
    );
  } finally {
    stop();
    host.remove();
    vi.unstubAllGlobals();
    window.scrollTo(0, 0);
    await page.viewport(1280, 720);
  }
});

it('corrects the next row after a late viewport pan moves it behind the toolbar', async () => {
  await page.viewport(375, 700);
  const viewport = Object.assign(new EventTarget(), { height: 400, offsetTop: 100, scale: 1 });
  vi.stubGlobal('visualViewport', viewport);
  const { host, input } = setup();
  const dock = host.querySelector<HTMLElement>('.navbar-dock')!;
  dock.style.bottom = '200px';
  input.focus({ preventScroll: true });
  const stop = keepItemVisible(input);
  try {
    await nextFrame();
    const bottom = dock.getBoundingClientRect().top - 16;
    expect(input.parentElement!.getBoundingClientRect().bottom).toBeLessThanOrEqual(bottom + 1);
    window.scrollBy({ top: -80, behavior: 'instant' });
    expect(input.parentElement!.getBoundingClientRect().bottom).toBeGreaterThan(bottom);
    viewport.dispatchEvent(new Event('scroll'));
    await nextFrame();
    expect(input.parentElement!.getBoundingClientRect().bottom).toBeLessThanOrEqual(bottom + 1);
    expect(document.activeElement).toBe(input);
  } finally {
    stop();
    host.remove();
    vi.unstubAllGlobals();
    window.scrollTo(0, 0);
    await page.viewport(1280, 720);
  }
});

it('allows manual scrolling while a new item remains focused', async () => {
  await page.viewport(375, 700);
  const viewport = Object.assign(new EventTarget(), { height: 400, offsetTop: 0, scale: 1 });
  vi.stubGlobal('visualViewport', viewport);
  const { host, input } = setup();
  input.focus({ preventScroll: true });
  const stop = keepItemVisible(input);
  try {
    await nextFrame();
    window.dispatchEvent(new WheelEvent('wheel', { deltaY: -120 }));
    window.scrollBy({ top: -120, behavior: 'instant' });
    const position = window.scrollY;
    viewport.dispatchEvent(new Event('scroll'));
    await nextFrame();
    expect(window.scrollY).toBe(position);
    viewport.height = 350;
    viewport.dispatchEvent(new Event('resize'));
    await nextFrame();
    expect(window.scrollY).toBe(position);
  } finally {
    stop();
    host.remove();
    vi.unstubAllGlobals();
    window.scrollTo(0, 0);
    await page.viewport(1280, 720);
  }
});

it('reveals the next row inside the desktop list without moving the page', async () => {
  await page.viewport(1280, 700);
  const { host, input, list } = setup();
  input.focus({ preventScroll: true });
  const stop = keepItemVisible(input);
  try {
    await nextFrame();
    expect(list.scrollTop).toBeGreaterThan(0);
    expect(input.parentElement!.getBoundingClientRect().bottom).toBeLessThanOrEqual(list.getBoundingClientRect().bottom - 15);
    expect(window.scrollY).toBe(0);
    expect(document.activeElement).toBe(input);
  } finally {
    stop();
    host.remove();
    window.scrollTo(0, 0);
    await page.viewport(1280, 720);
  }
});
