interface Point {
  x: number;
  y: number;
}

export function startDragAutoScroll(list: HTMLElement, getPoint: () => Point | undefined, onScroll: (point: Point) => void) {
  let frame: number;
  let previous = performance.now();
  let remainder = 0;
  let lastDirection = 0;

  function scroll(now: number) {
    const elapsed = Math.max(0, Math.min(now - previous, 32)) / 1000;
    previous = now;
    const point = getPoint();
    if (!point)
      return;

    const bounds = list.getBoundingClientRect();
    const viewport = window.visualViewport;
    const top = Math.max(bounds.top, viewport?.offsetTop ?? 0);
    let bottom = Math.min(bounds.bottom, (viewport?.offsetTop ?? 0) + (viewport?.height ?? window.innerHeight));
    const dock = document.querySelector<HTMLElement>('.navbar-dock');
    if (dock && getComputedStyle(dock).position === 'fixed')
      bottom = Math.min(bottom, dock.getBoundingClientRect().top);

    const edge = Math.min(96, (bottom - top) / 3);
    if (edge > 0 && point.x >= bounds.left && point.x <= bounds.right) {
      const distance = Math.min(point.y - top, bottom - point.y);
      const strength = Math.max(0, Math.min(1, 1 - distance / edge));
      const direction = point.y < (top + bottom) / 2 ? -1 : 1;
      const delta = direction * 1400 * strength ** 2 * elapsed;
      if (delta) {
        if (direction !== lastDirection)
          remainder = 0;

        lastDirection = direction;
        const step = Math.trunc(delta + remainder);
        remainder += delta - step;
        const scrolls = /auto|scroll/.test(getComputedStyle(list).overflowY) && list.scrollHeight > list.clientHeight;
        const scroller = scrolls ? list : document.scrollingElement;
        const before = scroller?.scrollTop;
        if (scrolls)
          list.scrollBy({ top: step, behavior: 'instant' });
        else
          window.scrollBy({ top: step, behavior: 'instant' });

        if (scroller?.scrollTop !== before)
          onScroll(point);
      }
    }

    frame = requestAnimationFrame(scroll);
  }

  frame = requestAnimationFrame(scroll);

  return () => cancelAnimationFrame(frame);
}
