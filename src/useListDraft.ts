import { useMemo, useReducer, type SetStateAction } from 'react';
import type { LoadedList, ShoppingListItem } from './storage';

interface ListDraft {
  name: string;
  shoppingList: ShoppingListItem[];
  image: Blob | null;
  imageFileName: string;
  categories: boolean;
}

type Action = { type: 'restore'; draft: ListDraft } | {
  [K in keyof ListDraft]: { type: K; value: SetStateAction<ListDraft[K]> }
}[keyof ListDraft];

function reducer(draft: ListDraft, action: Action): ListDraft {
  if (action.type === 'restore')
    return action.draft;

  const value = typeof action.value === 'function'
    ? (action.value as (previous: unknown) => unknown)(draft[action.type])
    : action.value;

  return { ...draft, [action.type]: value };
}

export function useListDraft(initial: LoadedList) {
  const [draft, dispatch] = useReducer(reducer, {
    name: initial.name, shoppingList: initial.shoppingList, image: initial.image,
    imageFileName: initial.fileName, categories: initial.categories ?? false,
  });

  const actions = useMemo(() => ({
    setName: (value: SetStateAction<string>) => dispatch({ type: 'name', value }),
    setShoppinglist: (value: SetStateAction<ShoppingListItem[]>) => dispatch({ type: 'shoppingList', value }),
    setImage: (value: SetStateAction<Blob | null>) => dispatch({ type: 'image', value }),
    setImageFileName: (value: SetStateAction<string>) => dispatch({ type: 'imageFileName', value }),
    setCategories: (value: SetStateAction<boolean>) => dispatch({ type: 'categories', value }),
    restore: (draft: ListDraft) => dispatch({ type: 'restore', draft }),
  }), []);

  return { draft, ...actions };
}
