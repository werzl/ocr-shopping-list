import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { page } from '@vitest/browser/context';
import { expect, it, vi } from 'vitest';
import DragHandle from '../../src/DragHandle';
import { startDragAutoScroll } from '../../src/dragAutoScroll';
import '../../src/App.css';

function frames(duration: number) {
  return new Promise<void>(resolve => {
    const start = performance.now();
    const next = () => performance.now() - start >= duration ? resolve() : requestAnimationFrame(next);
    requestAnimationFrame(next);
  });
}

async function setup(nested: boolean) {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  await page.viewport(nested ? 1280 : 375, 700);
  const host = document.createElement('div');
  host.style.width = '100%';
  if (nested)
    host.style.padding = '100px 0 1200px';
  else
    host.style.paddingTop = '180px';

  document.body.append(host);
  const root = createRoot(host);
  const onDrop = vi.fn();
  await act(async () => root.render(createElement('div', {
    className: 'shopping-list',
    style: { height: nested ? 360 : 'auto', maxHeight: 'none', overflowY: nested ? 'auto' : 'visible', padding: 0, border: 0, gap: 0 },
  }, Array.from({ length: 60 }, (_, index) => createElement('div', {
    key: index, 'data-item-index': index, style: { height: 60, flex: '0 0 60px' },
  }, index === 59 ? createElement(DragHandle, { name: 'last item', disabled: false, onDrop, onStep: vi.fn() }) : `Item ${index + 1}`)))));
  const list = host.querySelector<HTMLElement>('.shopping-list')!;
  const handle = host.querySelector('button')!;
  vi.spyOn(handle, 'setPointerCapture').mockImplementation(() => {});
  vi.spyOn(handle, 'releasePointerCapture').mockImplementation(() => {});
  const send = (type: string, x: number, y: number) => handle.dispatchEvent(new PointerEvent(type, {
    bubbles: true, cancelable: true, pointerId: 1, pointerType: 'touch', isPrimary: true, button: 0, clientX: x, clientY: y,
  }));

  return { host, list, handle, onDrop, send, async cleanup() {
    await act(async () => root.unmount());
    host.remove();
    window.scrollTo(0, 0);
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    await page.viewport(1280, 720);
  }, unmount: () => act(async () => root.unmount()) };
}

it('scrolls the page continuously under a stationary touch and updates the drop target', async () => {
  const fixture = await setup(false);
  const { list, handle, onDrop, send } = fixture;
  try {
    window.scrollTo(0, document.documentElement.scrollHeight);
    const start = handle.getBoundingClientRect();
    const x = start.left + 10;
    await act(async () => {
      send('pointerdown', x, start.top + 10);
      send('pointermove', x, 8);
    });
    const before = window.scrollY;
    const initialTarget = Number(list.querySelector<HTMLElement>('.drop-before, .drop-after')!.dataset.itemIndex);
    await frames(400);
    expect(window.scrollY).toBeLessThan(before - 250);
    const target = list.querySelector<HTMLElement>('.drop-before, .drop-after')!;
    const targetIndex = Number(target.dataset.itemIndex);
    expect(targetIndex).toBeLessThan(initialTarget);
    await act(async () => { send('pointerup', x, 8); });
    expect(onDrop).toHaveBeenCalledWith(expect.objectContaining({ index: targetIndex }));
    const stopped = window.scrollY;
    await frames(100);
    expect(window.scrollY).toBe(stopped);
    expect(document.querySelector('.drag-preview')).toBeNull();
  } finally {
    await fixture.cleanup();
  }
});

it('scrolls only the nested list, stops in its centre, reverses, and stops on cancel or unmount', async () => {
  const fixture = await setup(true);
  const { list, handle, send, onDrop } = fixture;
  try {
    list.scrollTop = list.scrollHeight;
    const start = handle.getBoundingClientRect();
    const bounds = list.getBoundingClientRect();
    const x = start.left + 10;
    await act(async () => {
      send('pointerdown', x, start.top + 10);
      send('pointermove', x, bounds.top + 8);
    });
    const before = list.scrollTop;
    await frames(400);
    expect(list.scrollTop).toBeLessThan(before - 250);
    expect(window.scrollY).toBe(0);
    await act(async () => { send('pointermove', x, bounds.top + bounds.height / 2); });
    const centre = list.scrollTop;
    await frames(100);
    expect(list.scrollTop).toBe(centre);
    await act(async () => { send('pointermove', x, bounds.bottom - 8); });
    await frames(200);
    expect(list.scrollTop).toBeGreaterThan(centre + 100);
    await act(async () => { send('pointercancel', x, bounds.bottom - 8); });
    const cancelled = list.scrollTop;
    await frames(100);
    expect(list.scrollTop).toBe(cancelled);
    expect(onDrop).not.toHaveBeenCalled();
    const fresh = handle.getBoundingClientRect();
    await act(async () => {
      send('pointerdown', x, fresh.top + 10);
      send('pointermove', x, bounds.top + 8);
    });
    await fixture.unmount();
    const unmounted = list.scrollTop;
    await frames(100);
    expect(list.scrollTop).toBe(unmounted);
    expect(document.querySelector('.drag-preview')).toBeNull();
  } finally {
    await fixture.cleanup();
  }
});

it('scrolls faster near the edge and covers the same distance at 60 Hz and 120 Hz', async () => {
  const fixture = await setup(true);
  const { list } = fixture;
  try {
    let frame: FrameRequestCallback;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
      frame = callback;

      return 1;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
    vi.spyOn(performance, 'now').mockReturnValue(0);
    const bounds = list.getBoundingClientRect();
    const distance = (hz: number, inset: number) => {
      list.scrollTop = 2000;
      const stop = startDragAutoScroll(list, () => ({ x: bounds.left + 10, y: bounds.top + inset }), vi.fn());
      for (let index = 1; index <= hz; index++)
        frame(index * 1000 / hz);

      stop();

      return 2000 - list.scrollTop;
    };

    const fast = distance(60, 4);
    const highRefresh = distance(120, 4);
    const slow = distance(60, 64);
    expect(fast).toBeGreaterThan(1000);
    expect(Math.abs(fast - highRefresh)).toBeLessThan(60);
    expect(fast).toBeGreaterThan(slow * 4);
  } finally {
    await fixture.cleanup();
  }
});

it('drops before the first item after scrolling from the bottom while the touch stays above the list heading', async () => {
  const fixture = await setup(false);
  const { handle, send, onDrop } = fixture;
  try {
    let frame: FrameRequestCallback;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
      frame = callback;

      return 1;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
    vi.spyOn(performance, 'now').mockReturnValue(0);
    window.scrollTo(0, document.documentElement.scrollHeight);
    const start = handle.getBoundingClientRect();
    const x = start.left + 10;
    await act(async () => {
      send('pointerdown', x, start.top + 10);
      send('pointermove', x, 8);
    });
    for (let index = 1; index <= 240; index++)
      frame!(index * 1000 / 60);

    expect(window.scrollY).toBe(0);
    await act(async () => { send('pointerup', x, 8); });
    expect(onDrop).toHaveBeenCalledWith(expect.objectContaining({ index: 0, after: false }));
  } finally {
    await fixture.cleanup();
  }
});
