import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { SavedList } from './storage';
import { loadListImage } from './storage';
import { popInList } from './listMotion';
import TrashIcon from './assets/trash-solid-full.svg?react';
import PhotoIcon from './assets/photo-film-solid-full.svg?react';

interface Props {
  list: SavedList;
  disabled: boolean;
  onOpen: () => void;
  onDelete: () => void;
}

export default function ListCard({ list, disabled, onOpen, onDelete }: Props) {
  const cardRef = useRef<HTMLElement>(null);
  const [thumbnail, setThumbnail] = useState('');
  useLayoutEffect(() => {
    const animation = cardRef.current ? popInList(cardRef.current) : null;

    return () => animation?.cancel();
  }, []);

  useEffect(() => {
    setThumbnail('');
    if (!list.imageId)
      return;

    let active = true;
    let url = '';
    void loadListImage(list.imageId).then(image => {
      if (active && image) {
        url = URL.createObjectURL(image);
        setThumbnail(url);
      }
    }).catch(() => { /* The list can still open if its thumbnail fails. */ });

    return () => {
      active = false;
      if (url)
        URL.revokeObjectURL(url);
    };
  }, [list.imageId]);
  const checked = list.shoppingList.filter(item => item.checked).length;

  return <article ref={cardRef} className="list-card" data-list-id={list.id}>
    <button className="list-card-open" onClick={onOpen} disabled={disabled} aria-label={`Open ${list.name}`}>
      {thumbnail ? <img className="list-thumbnail" src={thumbnail} alt="" />
        : <span className="list-thumbnail list-placeholder" aria-label="No photo"><PhotoIcon aria-hidden="true" /></span>}
      <span className="list-card-copy"><strong>{list.name}</strong><small>{checked} of {list.shoppingList.length} items checked</small></span>
    </button>
    <button className="list-card-delete" onClick={onDelete} disabled={disabled} aria-label={`Delete ${list.name}`}>
      <TrashIcon aria-hidden="true" />
    </button>
  </article>;
}
