export function keepItemVisible(input: HTMLInputElement, onKeyboardDismiss?: () => void) {
  const viewport = window.visualViewport;
  const shell = input.closest<HTMLElement>('.app-shell');
  const previousInset = shell?.style.getPropertyValue('--keyboard-inset') ?? '';
  let frame: number | null = null;
  let stopped = false;
  let width = window.innerWidth;
  let keyboardHeight = 0;
  let settleUntil = performance.now() + 700;
  let allowScroll = true;

  function reveal() {
    frame = null;
    if (document.activeElement !== input || !input.isConnected)
      return;

    const inset = viewport ? Math.max(0, Math.max(window.innerHeight, document.documentElement.clientHeight) - viewport.height) : 0;
    if (Math.abs(window.innerWidth - width) > 80 || (viewport?.scale ?? 1) !== 1) {
      keyboardHeight = 0;
      width = window.innerWidth;
    }

    if (onKeyboardDismiss && keyboardHeight > 100 && inset < 80) {
      stop();
      onKeyboardDismiss();

      return;
    }

    keyboardHeight = Math.max(keyboardHeight, inset);
    if (shell?.style.getPropertyValue('--keyboard-inset') !== `${inset}px`)
      shell?.style.setProperty('--keyboard-inset', `${inset}px`);

    const row = input.closest<HTMLElement>('.item-editor');
    if (!row || !allowScroll)
      return;

    const list = row.closest<HTMLElement>('.shopping-list');
    if (list && /auto|scroll/.test(getComputedStyle(list).overflowY) && list.scrollHeight > list.clientHeight) {
      const listTop = list.getBoundingClientRect().top + list.clientTop;
      const bounds = row.getBoundingClientRect();
      const delta = bounds.bottom > listTop + list.clientHeight - 16
        ? bounds.bottom - (listTop + list.clientHeight - 16)
        : Math.min(0, bounds.top - (listTop + 16));

      if (Math.abs(delta) > 1)
        list.scrollBy({ top: delta, behavior: 'instant' });
    }

    const top = (viewport?.offsetTop ?? 0) + 16;
    let bottom = (viewport?.offsetTop ?? 0) + (viewport?.height ?? window.innerHeight);
    const dock = shell?.querySelector<HTMLElement>('.navbar-dock');
    if (dock && getComputedStyle(dock).position === 'fixed')
      bottom = Math.min(bottom - dock.getBoundingClientRect().height, dock.getBoundingClientRect().top);

    bottom -= 16;
    const bounds = row.getBoundingClientRect();
    if (bounds.bottom > bottom + 1)
      window.scrollBy({ top: bounds.bottom - bottom, behavior: 'instant' });
    else if (bounds.top < top - 1 && bounds.height <= bottom - top)
      window.scrollBy({ top: bounds.top - top, behavior: 'instant' });

    if (performance.now() < settleUntil)
      schedule();
  }

  function schedule() {
    if (!stopped && frame === null)
      frame = requestAnimationFrame(reveal);
  }

  function resized() {
    settleUntil = performance.now() + 700;
    schedule();
  }

  function panned() {
    if (performance.now() < settleUntil)
      schedule();
  }

  function manualScroll() {
    allowScroll = false;
    settleUntil = 0;
    if (frame !== null) {
      cancelAnimationFrame(frame);
      frame = null;
    }
  }

  function stop() {
    if (stopped)
      return;

    stopped = true;
    if (frame !== null)
      cancelAnimationFrame(frame);

    viewport?.removeEventListener('resize', resized);
    viewport?.removeEventListener('scroll', panned);
    window.removeEventListener('resize', resized);
    window.removeEventListener('touchstart', manualScroll);
    window.removeEventListener('wheel', manualScroll);
    input.removeEventListener('blur', stop);
    if (previousInset)
      shell?.style.setProperty('--keyboard-inset', previousInset);
    else
      shell?.style.removeProperty('--keyboard-inset');
  }

  viewport?.addEventListener('resize', resized);
  viewport?.addEventListener('scroll', panned);
  window.addEventListener('resize', resized);
  window.addEventListener('touchstart', manualScroll, { passive: true });
  window.addEventListener('wheel', manualScroll, { passive: true });
  input.addEventListener('blur', stop);
  schedule();

  return stop;
}
