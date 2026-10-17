import { expect, it } from 'vitest';
import { itemCategory, reorderItems } from '../src/reorderItems';

it('moves exactly one item before or after its target without changing the input', () => {
  const items = ['apple', 'milk', 'bread'].map(name => ({ name, checked: name === 'apple' }));
  expect(reorderItems(items, 0, 2, true).map(item => item.name)).toEqual(['milk', 'bread', 'apple']);
  expect(reorderItems(items, 2, 0, false).map(item => item.name)).toEqual(['bread', 'apple', 'milk']);
  expect(reorderItems(items, 0, 1, false).map(item => item.name)).toEqual(['apple', 'milk', 'bread']);
  expect(items.map(item => item.name)).toEqual(['apple', 'milk', 'bread']);
  const moved = reorderItems(items, 0, 1, true, 'Dairy');
  expect(moved[1]).toEqual({ name: 'apple', checked: true, category: 'Dairy' });
  expect(itemCategory(moved[1])).toBe('Dairy');
  expect(itemCategory(items[0])).toBe('Fruit & Veg');
});
