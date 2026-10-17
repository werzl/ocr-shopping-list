import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import DragHandle from '../../src/DragHandle';
import '../../src/App.css';

it('floats the dragged row, hides its source, and cleans up mouse and touch moves', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const onDrop = vi.fn();
  try {
    for (const width of [375, 991, 992, 1280]) {
      host.style.width = `${width}px`;
      for (const scheme of ['light', 'dark']) {
        host.style.colorScheme = scheme;
        await act(async () => root.render(createElement('div', { className: 'shopping-list' },
          createElement('div', { 'data-item-index': 0 }, createElement(DragHandle, { name: 'apple', disabled: false, onDrop, onStep: vi.fn() })),
          createElement('div', { 'data-item-index': 1, style: { height: 80 } }, 'Milk'))));
        const handle = host.querySelector('button')!;
        const target = host.querySelector<HTMLElement>('[data-item-index="1"]')!;
        const start = handle.getBoundingClientRect();
        const end = target.getBoundingClientRect();
        // Synthetic pointers use real hit testing without browser pointer capture.
        const capture = vi.spyOn(handle, 'setPointerCapture').mockImplementation(() => {});
        const release = vi.spyOn(handle, 'releasePointerCapture').mockImplementation(() => {});
        for (const pointerType of ['mouse', 'touch']) {
          const send = (type: string, x: number, y: number) => handle.dispatchEvent(new PointerEvent(type, {
            bubbles: true, cancelable: true, pointerId: 1, pointerType, isPrimary: true, button: 0, clientX: x, clientY: y,
          }));

          await act(async () => {
            send('pointerdown', start.left + 10, start.top + 10);
            send('pointermove', end.left + 10, end.bottom - 10);
          });
          expect(target.classList.contains('drop-after')).toBe(true);
          const source = host.querySelector<HTMLElement>('[data-item-index="0"]')!;
          const preview = document.querySelector<HTMLElement>('.drag-preview')!;
          expect(source.classList.contains('drag-source')).toBe(true);
          expect(getComputedStyle(handle).opacity).toBe('0');
          expect(source.getBoundingClientRect().height).toBe(start.height);
          expect(preview).not.toBeNull();
          expect(preview.inert).toBe(true);
          expect(preview.getAttribute('aria-hidden')).toBe('true');
          expect(getComputedStyle(preview).position).toBe('fixed');
          expect(getComputedStyle(preview).pointerEvents).toBe('none');
          expect(preview.style.top).toBe(`${end.bottom - 10 - (start.top + 10 - source.getBoundingClientRect().top)}px`);
          expect(getComputedStyle(handle).userSelect).toBe('none');
          const contextMenu = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
          handle.dispatchEvent(contextMenu);
          expect(contextMenu.defaultPrevented).toBe(true);
          await act(async () => { send('pointerup', end.left + 10, end.bottom - 10); });
          expect(onDrop).toHaveBeenLastCalledWith(expect.objectContaining({ index: 1, after: true, landing: expect.any(DOMRect) }));
          expect(target.classList.contains('drop-after')).toBe(false);
          expect(source.classList.contains('drag-source')).toBe(false);
          expect(document.querySelector('.drag-preview')).toBeNull();
          onDrop.mockClear();
          await act(async () => {
            send('pointerdown', start.left + 10, start.top + 10);
            send('pointermove', end.left + 10, end.top + 10);
            send('pointercancel', end.left + 10, end.top + 10);
          });
          expect(onDrop).not.toHaveBeenCalled();
          expect(host.querySelector('.drop-before')).toBeNull();
          expect(document.querySelector('.drag-preview')).toBeNull();
          expect(source.classList.contains('drag-source')).toBe(false);
        }
        capture.mockRestore();
        release.mockRestore();
      }
    }
  } finally {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
  }
});
