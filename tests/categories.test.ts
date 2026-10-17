import { describe, expect, it } from 'vitest';
import { classifyItem } from '../src/categories';

describe('category classification', () => {
  it.each(['Boursin', 'Parmesan', 'BOURSIN', 'grated parmesan'])('classifies cheese keyword %s as Dairy', name => {
    expect(classifyItem(name)).toBe('Dairy');
  });

  it.each([
    ['2 Apples', 'Fruit & Veg'], ['Tomatoes', 'Veg'], ['milk', 'Dairy'],
    ['chicken', 'Meat'], ['salmon', 'Seafood'], ['rice', 'Pantry'],
    ['bread', 'Bakery'], ['frozen peas', 'Frozen'], ['toothpaste', 'Toiletries'],
    ['washing-up liquid', 'Cleaning Products'], ['cat food', 'Pets'],
    ['baby milk', 'Baby'], ['ibuprofen', 'Medicine'], ['beer', 'Alcohol'],
    ['unknown product', 'Other'], ['ginger', 'Veg'], ['dog treats', 'Pets'],
    ['ICE', 'Frozen'], ['Pizza', 'Ready Meals'], ['ready meal', 'Ready Meals'],
    ['cheese pizza', 'Ready Meals'], ['frozen pizza', 'Frozen'],
    ['pepperoni', 'Meat'], ['PEPPERONI', 'Meat'], ['pepperoni pizza', 'Ready Meals'],
    ['salad', 'Veg'], ['SALAD', 'Veg'], ['mixed salad', 'Veg'],
    ['salad dressing', 'Pantry'], ['fruit salad', 'Fruit & Veg'],
    ['dry food', 'Pets'], ['DRY FOOD', 'Pets'], ['dogfood', 'Pets'],
    ['DOGFOOD', 'Pets'], ['chicken dry food', 'Pets'], ['beef dogfood', 'Pets'],
    ['dogfoodie', 'Other'], ['dry foodie', 'Other'],
    ['pretzel', 'Pantry'], ['pretzels', 'Pantry'], ['PRETZELS', 'Pantry'],
    ['cheese pretzels', 'Pantry'],
  ])('classifies %s as %s', (name, category) => {
    expect(classifyItem(name)).toBe(category);
  });
});
