import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { Button, Modal } from 'react-bootstrap';
import { expect, it, vi } from 'vitest';
import { page } from '@vitest/browser/context';
import '../../src/App.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import '../../src/bootstrap-overrides.css';
import '../../src/index.css';

it('uses the app colours for the real delete modal outside the app root after Bootstrap loads', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const host = document.createElement('div');
  host.id = 'root';
  document.body.append(host);
  const root = createRoot(host);
  const previousScheme = document.documentElement.style.colorScheme;
  try {
    await act(async () => root.render(createElement(Modal, { show: true, centered: true, animation: false, onHide: () => {} },
      createElement(Modal.Header, { closeButton: true }, createElement(Modal.Title, null, 'Delete list?')),
      createElement(Modal.Body, null, 'Delete this list and its photo?'),
      createElement(Modal.Footer, null,
        createElement(Button, { variant: 'secondary' }, 'Cancel'),
        createElement(Button, { variant: 'danger' }, 'Delete list')))));
    const content = document.querySelector<HTMLElement>('.modal-content')!;
    const header = content.querySelector<HTMLElement>('.modal-header')!;
    const footer = content.querySelector<HTMLElement>('.modal-footer')!;
    expect(content.closest('#root')).toBeNull();
    for (const width of [375, 991, 992, 1280]) {
      await page.viewport(width, 900);
      for (const scheme of ['dark', 'light']) {
        document.documentElement.style.colorScheme = scheme;
        const colours = getComputedStyle(content);
        const border = scheme === 'light' ? 'rgb(205, 210, 217)' : 'rgb(72, 72, 72)';
        expect(colours.backgroundColor).toBe(scheme === 'light' ? 'rgb(255, 255, 255)' : 'rgb(36, 36, 36)');
        expect(colours.color).toBe(scheme === 'light' ? 'rgb(0, 0, 0)' : 'rgb(255, 255, 255)');
        expect(colours.borderTopColor).toBe(border);
        expect(getComputedStyle(header).borderBottomColor).toBe(border);
        expect(getComputedStyle(footer).borderTopColor).toBe(border);
        expect(content.getBoundingClientRect().left).toBeGreaterThanOrEqual(0);
        expect(content.getBoundingClientRect().right).toBeLessThanOrEqual(width);
        expect([...content.querySelectorAll('button')].every(button => !button.disabled)).toBe(true);
      }
    }
  } finally {
    await act(async () => root.unmount());
    host.remove();
    document.documentElement.style.colorScheme = previousScheme;
    await page.viewport(1280, 720);
    vi.unstubAllGlobals();
  }
});
