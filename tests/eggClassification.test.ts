import { describe, expect, it } from 'vitest';
import { categoryOrder, classifyItem } from '../src/categories';
import { itemCategory } from '../src/reorderItems';

describe('egg pantry classification', () => {
  it.each(['egg', 'eggs', 'EGGS', '6 eggs', 'large eggs', 'free-range eggs', 'chicken eggs', 'duck eggs', 'eggs x12'])(
    'classifies %s under Pantry', name => {
      expect(classifyItem(name)).toBe('Pantry');
    },
  );

  it.each(['egg noodles', 'egg pasta', 'egg fried rice', 'egg mayonnaise', 'chocolate eggs', 'Easter egg'])(
    'keeps %s under Pantry', name => {
      expect(classifyItem(name)).toBe('Pantry');
    },
  );

  it.each([
    ['milk', 'Dairy'], ['butter', 'Dairy'], ['cream', 'Dairy'],
    ['chicken', 'Meat'], ['frozen eggs', 'Frozen'], ['egg shampoo', 'Toiletries'],
    ['eggplantation', 'Other'], ['eggshells', 'Other'],
  ])('preserves the product category for %s', (name, category) => {
    expect(classifyItem(name)).toBe(category);
  });

  it('omits the retired Eggs category from the display order', () => {
    expect(categoryOrder).not.toContain('Eggs');
  });

  it('preserves a category that the user assigned manually', () => {
    expect(itemCategory({ name: 'eggs', checked: true, category: 'Dairy' })).toBe('Dairy');
    expect(itemCategory({ name: 'eggs', checked: true })).toBe('Pantry');
  });
  it('uses Pantry for saved Eggs assignments from earlier test builds', () => {
    expect(itemCategory({ name: 'eggs', checked: true, category: 'Eggs' })).toBe('Pantry');
    expect(itemCategory({ name: 'large eggs', checked: false, category: 'Eggs' })).toBe('Pantry');
  });

});
