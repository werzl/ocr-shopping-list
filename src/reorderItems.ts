import { classifyItem, type Category } from './categories';
import type { ShoppingListItem } from './storage';

export function reorderItems(items: ShoppingListItem[], source: number, target: number, after: boolean, category?: Category): ShoppingListItem[] {
  if (!items[source] || !items[target])
    return items;

  const moved = category ? { ...items[source], category } : items[source];
  if (source === target) {
    return items.map((item, index) => index === source ? moved : item);
  }

  const result = items.filter((_, index) => index !== source);
  const insertion = target - (source < target ? 1 : 0) + Number(after);
  result.splice(insertion, 0, moved);

  return result;
}

export function itemCategory(item: ShoppingListItem): Category {
  return item.category ?? classifyItem(item.name);
}
