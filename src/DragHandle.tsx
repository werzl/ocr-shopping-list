import { useEffect, useRef, useState } from 'react';
import { startDragAutoScroll } from './dragAutoScroll';

interface DropTarget {
  index: number;
  after: boolean;
  landing?: DOMRect;
}

interface Props {
  name: string;
  disabled: boolean;
  onDrop: (target: DropTarget) => void;
  onStep: (direction: number) => void;
}

export default function DragHandle({ name, disabled, onDrop, onStep }: Props) {
  const gesture = useRef<{ x: number; y: number; point?: { x: number; y: number }; started?: boolean; target?: DropTarget } | null>(null);
  const [dragging, setDragging] = useState(false);
  const visual = useRef<{ source: HTMLElement; preview: HTMLElement; offsetX: number; offsetY: number } | null>(null);
  const stopScroll = useRef<(() => void) | null>(null);

  function removeVisual() {
    visual.current?.source.classList.remove('drag-source');
    visual.current?.preview.remove();
    visual.current = null;
  }

  useEffect(() => () => {
    stopScroll.current?.();
    removeVisual();
    document.querySelectorAll('.drop-before, .drop-after').forEach(row => row.classList.remove('drop-before', 'drop-after'));
  }, []);

  function clear() {
    stopScroll.current?.();
    stopScroll.current = null;
    removeVisual();
    gesture.current = null;
    setDragging(false);
    document.querySelectorAll('.drop-before, .drop-after').forEach(row => row.classList.remove('drop-before', 'drop-after'));
  }

  function updateTarget(list: HTMLElement, point: { x: number; y: number }) {
    const current = gesture.current;
    if (!current)
      return;

    document.querySelectorAll('.drop-before, .drop-after').forEach(row => row.classList.remove('drop-before', 'drop-after'));
    let row = document.elementFromPoint(point.x, point.y)?.closest<HTMLElement>('[data-item-index]');
    if (!row || !list.contains(row)) {
      const bounds = list.getBoundingClientRect();
      const rows = list.querySelectorAll<HTMLElement>('[data-item-index]');
      const first = rows[0];
      const last = rows[rows.length - 1];
      row = undefined;
      if (point.x >= bounds.left && point.x <= bounds.right) {
        if (first && point.y <= first.getBoundingClientRect().top)
          row = first;
        else if (last && point.y >= last.getBoundingClientRect().bottom)
          row = last;
      }
    }

    current.target = undefined;
    if (row && list.contains(row)) {
      const bounds = row.getBoundingClientRect();
      const after = point.y > bounds.top + bounds.height / 2;
      current.target = { index: Number(row.dataset.itemIndex), after };
      row.classList.add(after ? 'drop-after' : 'drop-before');
    }
  }

  return <button type="button" className={`drag-handle${dragging ? ' dragging' : ''}`}
    aria-label={`Move ${name}`} title="Drag to move. Use the arrow keys to move one row."
    disabled={disabled}
    onContextMenu={event => event.preventDefault()}
    onDragStart={event => event.preventDefault()}
    onKeyDown={event => {
      if (event.key === 'Escape') {
        clear();
      }

      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        event.preventDefault();
        onStep(event.key === 'ArrowUp' ? -1 : 1);
      }
    }}
    onPointerDown={event => {
      if (event.button !== 0 || !event.isPrimary)
        return;

      event.preventDefault();
      event.currentTarget.focus({ preventScroll: true });
      gesture.current = { x: event.clientX, y: event.clientY };
      event.currentTarget.setPointerCapture(event.pointerId);
    }}
    onPointerMove={event => {
      const current = gesture.current;
      if (!current || (!current.started && Math.hypot(event.clientX - current.x, event.clientY - current.y) < 5))
        return;

      current.started = true;
      current.point = { x: event.clientX, y: event.clientY };
      setDragging(true);
      if (!visual.current) {
        const source = event.currentTarget.closest<HTMLElement>('[data-item-index]');
        if (source) {
          const bounds = source.getBoundingClientRect();
          const preview = document.createElement('div');
          preview.className = 'workspace drag-preview';
          preview.setAttribute('aria-hidden', 'true');
          preview.inert = true;
          preview.style.width = `${bounds.width}px`;
          preview.style.transformOrigin = `${current.x - bounds.left}px ${current.y - bounds.top}px`;
          const styles = getComputedStyle(source);
          for (const property of ['--list-control-color', '--list-control-surface', '--list-control-border', '--panel-surface', '--primary-button-main-color']) {
            preview.style.setProperty(property, styles.getPropertyValue(property));
          }
          preview.style.colorScheme = styles.colorScheme;
          const copy = source.cloneNode(true) as HTMLElement;
          copy.removeAttribute('data-item-index');
          copy.querySelectorAll('[id]').forEach(element => element.removeAttribute('id'));
          preview.append(copy);
          document.body.append(preview);
          visual.current = { source, preview, offsetX: current.x - bounds.left, offsetY: current.y - bounds.top };
          source.classList.add('drag-source');
        }
      }

      const floating = visual.current;
      if (floating) {
        floating.preview.style.left = `${event.clientX - floating.offsetX}px`;
        floating.preview.style.top = `${event.clientY - floating.offsetY}px`;
      }

      const list = event.currentTarget.closest<HTMLElement>('.shopping-list');
      if (list) {
        updateTarget(list, current.point);
        stopScroll.current ??= startDragAutoScroll(list, () => gesture.current?.point, point => updateTarget(list, point));
      }
    }}
    onPointerUp={event => {
      const target = gesture.current?.target;
      const landing = visual.current?.preview.getBoundingClientRect();
      clear();
      event.currentTarget.releasePointerCapture(event.pointerId);
      if (target)
        onDrop({ ...target, landing });
    }}
    onPointerCancel={clear}
    onLostPointerCapture={clear}>
    <svg width="16" height="24" viewBox="0 0 16 24" fill="currentColor" aria-hidden="true">
      {[5, 12, 19].flatMap(y => [5, 11].map(x => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.6" />))}
    </svg>
  </button>;
}
