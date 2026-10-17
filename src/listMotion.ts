export const motionOptions = { duration: 220, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' };

export function motionEnabled() {
  return typeof matchMedia === 'function' && !matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function popInList(list: HTMLElement): Animation | null {
  if (!motionEnabled() || typeof list.animate !== 'function')
    return null;

  return list.animate([
    { transform: 'scale(0.88)', opacity: 0 },
    { transform: 'scale(1.025)', opacity: 1, offset: 0.7 },
    { transform: 'scale(1)', opacity: 1 },
  ], { duration: 260, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' });
}

export function popOutList(list: HTMLElement): Animation | null {
  if (!motionEnabled() || typeof list.animate !== 'function')
    return null;

  return list.animate([
    { transform: 'scale(1)', opacity: 1 },
    { transform: 'scale(1.025)', opacity: 1, offset: 0.2 },
    { transform: 'scale(0.8)', opacity: 0 },
  ], { duration: 180, easing: 'cubic-bezier(0.4, 0, 1, 1)', fill: 'forwards' });
}

export function popOutRow(row: HTMLElement): Animation | null {
  if (!motionEnabled() || typeof row.animate !== 'function')
    return null;

  return row.animate([
    { transform: 'scale(1)', opacity: 1 },
    { transform: 'scale(0.8)', opacity: 0 },
  ], { duration: 150, easing: 'cubic-bezier(0.4, 0, 1, 1)', fill: 'forwards' });
}

export function animateEditMode(list: HTMLElement, editing: boolean, entering: boolean): Animation | null {
  if (!motionEnabled() || typeof list.animate !== 'function')
    return null;

  const small = { transform: 'scale(0.96)', opacity: 0 };
  const large = { transform: 'scale(1.04)', opacity: 0 };
  const visible = { transform: 'scale(1)', opacity: 1 };

  return list.animate(entering
    ? [editing ? large : small, visible]
    : [visible, editing ? small : large],
  { ...motionOptions, duration: entering ? 180 : 110, fill: entering ? 'none' : 'forwards' });
}

export function shrinkList(list: HTMLElement): Animation | null {
  if (!motionEnabled() || typeof list.animate !== 'function')
    return null;

  return list.animate([
    { transform: 'scale(1)', opacity: 1 },
    { transform: 'scale(0.65)', opacity: 0 },
  ], { duration: 160, easing: 'cubic-bezier(0.4, 0, 1, 1)', fill: 'forwards' });
}

export function revealEmptyList(list: HTMLElement) {
  if (!motionEnabled() || typeof list.animate !== 'function')
    return;

  list.animate([
    { transform: 'scale(0.94)', opacity: 0 },
    { transform: 'scale(1)', opacity: 1 },
  ], { ...motionOptions, duration: 340 });
}

export function animateRows(list: HTMLElement, previous: Map<string, DOMRect>) {
  if (!motionEnabled())
    return;

  list.querySelectorAll<HTMLElement>('[data-item-key]').forEach(row => {
    const before = previous.get(row.dataset.itemKey!);
    const after = row.getBoundingClientRect();
    if (!before || !after.width || !after.height || typeof row.animate !== 'function')
      return;

    if (before.top === after.top && before.left === after.left && before.width === after.width && before.height === after.height)
      return;

    row.animate([
      { transform: `translate(${before.left - after.left}px, ${before.top - after.top}px) scale(${before.width / after.width}, ${before.height / after.height})`, transformOrigin: 'top left' },
      { transform: 'none', transformOrigin: 'top left' },
    ], motionOptions);
  });
}
