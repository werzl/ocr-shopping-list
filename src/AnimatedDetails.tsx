import { useEffect, useRef, type ReactNode } from 'react';
import { motionEnabled, motionOptions } from './listMotion';

export default function AnimatedDetails({ children, className }: { children: ReactNode; className: string }) {
  const animation = useRef<Animation | null>(null);
  const expanded = useRef(false);

  useEffect(() => () => animation.current?.cancel(), []);

  return <details className={className} onClick={event => {
    const details = event.currentTarget;
    const summary = details.querySelector('summary');
    if (!(event.target instanceof Element) || event.target.closest('summary') !== summary)
      return;

    event.preventDefault();
    const startHeight = details.getBoundingClientRect().height;
    animation.current?.cancel();
    expanded.current = !expanded.current;
    details.dataset.expanded = String(expanded.current);
    if (!motionEnabled() || typeof details.animate !== 'function') {
      details.open = expanded.current;

      return;
    }

    details.open = true;
    const endHeight = expanded.current ? details.getBoundingClientRect().height : summary!.getBoundingClientRect().height + 2;
    const next = details.animate([
      { height: `${startHeight}px` }, { height: `${endHeight}px` },
    ], motionOptions);

    animation.current = next;
    void next.finished.then(() => {
      if (animation.current === next) {
        details.open = expanded.current;
        animation.current = null;
      }
    }).catch(() => {});
  }}>{children}</details>;
}
