import { describe, expect, it } from 'vitest';
import { classifyItem } from '../src/categories';

describe('category classification', () => {
  it.each(['Boursin', 'Parmesan', 'BOURSIN', 'grated parmesan'])('classifies cheese keyword %s as Dairy', name => {
    expect(classifyItem(name)).toBe('Dairy');
  });

  it.each([
    ['2 Apples', 'Fruit & Veg'], ['Tomatoes', 'Fruit & Veg'], ['milk', 'Dairy'],
    ['chicken', 'Meat'], ['salmon', 'Seafood'], ['rice', 'Pantry'],
    ['bread', 'Bakery'], ['frozen peas', 'Frozen'], ['toothpaste', 'Toiletries'],
    ['washing-up liquid', 'Cleaning Products'], ['cat food', 'Pets'],
    ['baby milk', 'Baby'], ['ibuprofen', 'Medicine'], ['beer', 'Alcohol'],
    ['unknown product', 'Other'], ['ginger', 'Fruit & Veg'], ['dog treats', 'Pets'],
    ['ICE', 'Frozen'], ['Pizza', 'Ready Meals'], ['ready meal', 'Ready Meals'],
    ['cheese pizza', 'Ready Meals'], ['frozen pizza', 'Frozen'],
    ['pepperoni', 'Meat'], ['PEPPERONI', 'Meat'], ['pepperoni pizza', 'Ready Meals'],
    ['salad', 'Fruit & Veg'], ['SALAD', 'Fruit & Veg'], ['mixed salad', 'Fruit & Veg'],
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

describe('wine classification', () => {
  it.each([
    'pinot', 'Pinot Grigio', 'PINOT NOIR', 'pinot gris', 'Sauvignon',
    'Sauvignon Blanc', 'Merlot', 'Malbec', 'Bordeaux', 'Chardonnay',
    'Cabernet', 'Cabernet Sauvignon', 'Shiraz',
  ])('classifies %s as Alcohol without the word wine', name => {
    expect(classifyItem(name)).toBe('Alcohol');
    expect(classifyItem(`2 x ${name.toUpperCase().replace(/ /g, '-')}`)).toBe('Alcohol');
  });

  it.each(['red wine vinegar', 'pinot grigio vinegar', 'sauvignon blanc vinegar', 'merlot vinegar', 'Malbec vinegar', 'Bordeaux vinegar'])(
    'keeps %s under Pantry', name => {
      expect(classifyItem(name)).toBe('Pantry');
    },
  );

  it.each(['pinot', 'sauvignon', 'merlot', 'malbec', 'bordeaux'])(
    'does not match %s inside a longer word', name => {
      expect(classifyItem(`x${name}x`)).toBe('Other');
    },
  );
});
