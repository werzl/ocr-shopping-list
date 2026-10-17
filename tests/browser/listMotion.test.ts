import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import AnimatedDetails from '../../src/AnimatedDetails';
import { animateRows, shrinkList, revealEmptyList } from '../../src/listMotion';
import '../../src/App.css';

it('shrinks the list before revealing its placeholder and skips reduced motion', async () => {
  const list = document.createElement('div');
  list.textContent = 'Milk';
  document.body.append(list);
  try {
    const exit = shrinkList(list)!;
    expect(exit).not.toBeNull();
    await exit.finished;
    expect(getComputedStyle(list).opacity).toBe('0');
    expect(list.textContent).toBe('Milk');
    list.textContent = 'Add your first item';
    exit.cancel();
    revealEmptyList(list);
    expect(list.getAnimations()).toHaveLength(1);
    await Promise.all(list.getAnimations().map(animation => animation.finished));
    expect(getComputedStyle(list).opacity).toBe('1');
    expect(getComputedStyle(list).transform).toBe('none');
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    expect(shrinkList(list)).toBeNull();
    revealEmptyList(list);
    expect(list.getAnimations()).toHaveLength(0);
  } finally {
    vi.unstubAllGlobals();
    list.remove();
  }
});

it('animates moved rows from their previous positions and respects reduced motion', async () => {
  const list = document.createElement('div');
  list.innerHTML = '<div data-item-key="first" style="height:48px">First</div><div data-item-key="second" style="height:48px">Second</div>';
  document.body.append(list);
  try {
    const first = list.firstElementChild as HTMLElement;
    const second = list.lastElementChild as HTMLElement;
    const positions = new Map([['first', first.getBoundingClientRect()], ['second', second.getBoundingClientRect()]]);
    list.prepend(second);
    animateRows(list, positions);
    expect(first.getAnimations()).toHaveLength(1);
    expect(second.getAnimations()).toHaveLength(1);
    await Promise.all(list.getAnimations({ subtree: true }).map(animation => animation.finished));
    expect(first.getAnimations()).toHaveLength(0);
    expect(first.getBoundingClientRect().top).toBeGreaterThan(second.getBoundingClientRect().top);
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    list.prepend(first);
    animateRows(list, positions);
    expect(list.getAnimations({ subtree: true })).toHaveLength(0);
  } finally {
    vi.unstubAllGlobals();
    list.remove();
  }
});

it('smoothly expands and collapses the photo, including rapid changes and reduced motion', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  try {
    for (const width of [375, 991, 992, 1280]) {
      host.style.width = `${width}px`;
      for (const scheme of ['light', 'dark']) {
        host.style.colorScheme = scheme;
        await act(async () => root.render(createElement(AnimatedDetails, { className: 'source-photo', children: [
          createElement('summary', { key: 'summary' }, 'Uploaded photo'),
          createElement('div', { key: 'photo', style: { height: 200 } }, 'Photo'),
        ] })));
        const details = host.querySelector('details')!;
        const summary = host.querySelector('summary')!;
        const closedHeight = details.getBoundingClientRect().height;
        summary.click();
        expect(details.open).toBe(true);
        expect(details.getAnimations()).toHaveLength(1);
        await Promise.all(details.getAnimations().map(animation => animation.finished));
        expect(details.getBoundingClientRect().height).toBeGreaterThan(closedHeight);
        summary.click();
        summary.click();
        summary.click();
        await Promise.all(details.getAnimations().map(animation => animation.finished));
        expect(details.open).toBe(false);
        expect(details.getBoundingClientRect().height).toBe(closedHeight);
      }
    }
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    const details = host.querySelector('details')!;
    host.querySelector('summary')!.click();
    expect(details.open).toBe(true);
    expect(details.getAnimations()).toHaveLength(0);
    host.querySelector('summary')!.click();
    expect(details.open).toBe(false);
  } finally {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
  }
});
