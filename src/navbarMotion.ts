import { motionEnabled, motionOptions } from './listMotion';

export type NavbarPositions = Map<string, { bounds: DOMRect; copy: HTMLElement }>;

export function captureNavbar(navbar: HTMLElement): NavbarPositions {
  return new Map(Array.from(navbar.querySelectorAll<HTMLElement>('.nav-button'), button => [
    button.getAttribute('aria-label')!, { bounds: button.getBoundingClientRect(), copy: button.cloneNode(true) as HTMLElement },
  ]));
}

export function animateNavbar(navbar: HTMLElement, previous: NavbarPositions) {
  const animations: Animation[] = [];
  const ghosts: HTMLElement[] = [];
  const current = captureNavbar(navbar);
  if (motionEnabled()) {
    navbar.querySelectorAll<HTMLElement>('.nav-button').forEach(button => {
      if (typeof button.animate !== 'function')
        return;

      const before = previous.get(button.getAttribute('aria-label')!);
      const after = button.getBoundingClientRect();
      animations.push(button.animate(before ? [
        { transform: `translateX(${before.bounds.left - after.left}px)` }, { transform: 'none' },
      ] : [
        { opacity: 0, transform: 'scale(0.8)' }, { opacity: 1, transform: 'scale(1)' },
      ], motionOptions));
    });
    previous.forEach(({ bounds, copy }, label) => {
      if (current.has(label) || typeof copy.animate !== 'function')
        return;

      const ghost = document.createElement('div');
      ghost.className = 'app-nav-bar nav-exit-preview';
      ghost.setAttribute('aria-hidden', 'true');
      ghost.inert = true;
      Object.assign(ghost.style, { left: `${bounds.left}px`, top: `${bounds.top}px`, width: `${bounds.width}px`, height: `${bounds.height}px` });
      ghost.append(copy);
      document.body.append(ghost);
      ghosts.push(ghost);
      const exit = ghost.animate([
        { opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(0.8)' },
      ], { ...motionOptions, duration: 150 });

      animations.push(exit);
      void exit.finished.then(() => ghost.remove()).catch(() => ghost.remove());
    });
  }

  return () => {
    animations.forEach(animation => animation.cancel());
    ghosts.forEach(ghost => ghost.remove());
  };
}
