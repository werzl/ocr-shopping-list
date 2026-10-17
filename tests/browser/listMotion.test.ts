import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import AnimatedDetails from '../../src/components/AnimatedDetails';
import { animateRows, shrinkList, revealEmptyList, animateEditMode, popOutRow } from '../../src/listMotion';
import '../../src/App.css';
import { animateNavbar, captureNavbar } from '../../src/navbarMotion';

it('pops a row out without collapsing its space before removal', async () => {
  const row = document.createElement('div');
  row.style.height = '44px';
  document.body.append(row);
  try {
    const animation = popOutRow(row)!;
    expect(row.offsetHeight).toBe(44);
    await animation.finished;
    expect(getComputedStyle(row).opacity).toBe('0');
    expect(row.offsetHeight).toBe(44);
    animation.cancel();
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    expect(popOutRow(row)).toBeNull();
    expect(getComputedStyle(row).opacity).toBe('1');
  } finally {
    row.remove();
    vi.unstubAllGlobals();
  }
});

it('moves navbar controls and removes exiting Save and Cancel previews', async () => {
  const nav = document.createElement('div');
  nav.className = 'app-nav-bar';
  document.body.append(nav);
  const buttons = (labels: string[]) => labels.map(label => `<button class="nav-button" aria-label="${label}">${label}</button>`).join('');
  try {
    nav.innerHTML = buttons(['Back', 'Clear']);
    const closed = captureNavbar(nav);
    nav.innerHTML = buttons(['Back', 'Cancel', 'Save', 'Clear']);
    const entering = animateNavbar(nav, closed);
    expect(nav.querySelector('[aria-label="Save"]')!.getAnimations()).toHaveLength(1);
    await Promise.all(nav.getAnimations({ subtree: true }).map(animation => animation.finished));
    entering();
    const open = captureNavbar(nav);
    nav.innerHTML = buttons(['Back', 'Clear']);
    const exiting = animateNavbar(nav, open);
    expect(document.querySelectorAll('.nav-exit-preview')).toHaveLength(2);
    expect(document.querySelector<HTMLElement>('.nav-exit-preview')!.inert).toBe(true);
    await Promise.all(document.getAnimations().map(animation => animation.finished));
    expect(document.querySelectorAll('.nav-exit-preview')).toHaveLength(0);
    exiting();
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    animateNavbar(nav, open)();
    expect(document.querySelectorAll('.nav-exit-preview')).toHaveLength(0);
  } finally {
    nav.remove();
    vi.unstubAllGlobals();
  }
});

it('animates Edit and Cancel in opposite directions and skips reduced motion', async () => {
  const list = document.createElement('div');
  document.body.append(list);
  try {
    for (const editing of [true, false]) {
      const exit = animateEditMode(list, editing, false)!;
      await exit.finished;
      expect(getComputedStyle(list).opacity).toBe('0');
      exit.cancel();
      const entrance = animateEditMode(list, editing, true)!;
      const frames = (entrance.effect as KeyframeEffect).getKeyframes();
      expect(frames[0].transform).toBe(editing ? 'scale(1.04)' : 'scale(0.96)');
      await entrance.finished;
      expect(getComputedStyle(list).opacity).toBe('1');
      expect(getComputedStyle(list).transform).toBe('none');
    }
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    expect(animateEditMode(list, true, false)).toBeNull();
    expect(animateEditMode(list, false, true)).toBeNull();
  } finally {
    vi.unstubAllGlobals();
    list.remove();
  }
});

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
