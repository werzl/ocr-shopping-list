import { describe, expect, it } from 'vitest';
import { categoryOrder, classifyItem } from '../src/categories';
import { itemCategory } from '../src/reorderItems';
import { categoryItems } from './fixtures/categoryItems';

describe('combined fruit and vegetable category', () => {
  it('groups all fruit and vegetable fixtures under Fruit & Veg', () => {
    for (const name of categoryItems['Fruit & Veg']) {
      expect(classifyItem(name), name).toBe('Fruit & Veg');
      expect(classifyItem(`2 x ${name.toUpperCase()}`), name).toBe('Fruit & Veg');
    }
    expect(categoryOrder).not.toContain('Veg');
  });

  it('uses Fruit & Veg for saved Veg assignments without changing the item', () => {
    const item = { name: 'carrots', checked: true, category: 'Veg' as const };
    expect(itemCategory(item)).toBe('Fruit & Veg');
    expect(item).toEqual({ name: 'carrots', checked: true, category: 'Veg' });
    expect(itemCategory({ name: 'carrots', checked: false, category: 'Pantry' })).toBe('Pantry');
  });

  it.each([
    ['frozen peas', 'Frozen'], ['vegetable pizza', 'Ready Meals'],
    ['vegetable stock', 'Pantry'], ['salad dressing', 'Pantry'],
    ['ginger beer', 'Soft drinks'], ['strawberry yogurt', 'Dairy'],
  ])('preserves the product category for %s', (name, expected) => {
    expect(classifyItem(name)).toBe(expected);
  });
});
