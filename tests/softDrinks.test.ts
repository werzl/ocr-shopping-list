import { describe, expect, it } from 'vitest';
import { categoryOrder, classifyItem } from '../src/categories';
import { categoryItems } from './fixtures/categoryItems';

describe('soft drink classification', () => {
  it.each(categoryItems['Soft drinks'])('classifies %s and its shopping-list variants as Soft drinks', name => {
    for (const separator of [' ', '-', '_', '‑']) {
      for (const value of [name, name.toUpperCase()]) {
        const item = value.replace(/ /g, separator);
        expect(classifyItem(item)).toBe('Soft drinks');
        expect(classifyItem(`2 x ${item} (large)`)).toBe('Soft drinks');
      }
    }
  });

  it.each(['CocaColaZeroSugar', 'DietCoke', 'PepsiMax', 'FantaOrange', 'AppleJuice', 'OrangeJuice', 'MountainDew'])(
    'recognises %s when words join together', name => {
      expect(classifyItem(name)).toBe('Soft drinks');
    },
  );

  it('uses the juice category for any fruit name', () => {
    for (const fruit of ['apple', 'orange', 'mango', 'strawberry', 'raspberry', 'lychee', 'guava', 'passion fruit', 'dragon fruit', 'pomegranate']) {
      expect(classifyItem(`${fruit} juice`)).toBe('Soft drinks');
      expect(classifyItem(`freshly squeezed ${fruit.toUpperCase()} JUICE`)).toBe('Soft drinks');
    }
    expect(categoryOrder).toContain('Soft drinks');
  });

  it.each([
    ['rum and Coke', 'Alcohol'], ['whisky and Pepsi', 'Alcohol'],
    ['gin and tonic water', 'Alcohol'], ['vodka orange juice', 'Alcohol'],
    ["Jack Daniel's Coca-Cola", 'Alcohol'], ['Topo Chico Hard Seltzer', 'Alcohol'],
    ['Simply Spiked lemonade', 'Alcohol'], ['Fresca Mixed', 'Alcohol'],
    ["Crabbie's ginger beer", 'Alcohol'], ['alcoholic ginger beer', 'Alcohol'],
    ['non-alcoholic ginger beer', 'Soft drinks'], ['hard root beer', 'Alcohol'],
    ['baking soda', 'Pantry'], ['bicarbonate of soda', 'Pantry'],
    ['washing soda', 'Cleaning Products'], ['soda crystals', 'Cleaning Products'],
    ['soda bread', 'Bakery'], ['Coke biscuits', 'Pantry'],
    ['slice of bread', 'Bakery'], ['mug cake', 'Bakery'],
    ['apple juice jam', 'Pantry'], ['apple jam', 'Pantry'],
    ['coconut milk', 'Pantry'], ['water chestnuts', 'Pantry'],
    ['rose water', 'Pantry'], ['orange blossom water', 'Pantry'],
    ['milk', 'Dairy'], ['strawberry yogurt', 'Dairy'], ['cat food', 'Pets'],
    ['frozen fruit juice', 'Frozen'], ['water-based shampoo', 'Toiletries'],
    ['beer', 'Alcohol'], ['Merlot', 'Alcohol'], ['cider', 'Alcohol'],
    ['fantastic', 'Other'], ['colander', 'Other'], ['spriteware', 'Other'],
  ])('keeps %s under %s', (name, category) => {
    expect(classifyItem(name)).toBe(category);
  });
});
