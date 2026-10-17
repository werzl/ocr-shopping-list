import { describe, expect, it } from 'vitest';
import { categoryOrder, classifyItem } from '../src/categories';
import { categoryItems } from './fixtures/categoryItems';

const separators = [' ', '  ', '\t', '\n', '-', '_', '‑', '–'];
const quantities = ['', '2 x ', '500g ', '1/2 kg '];
const suffixes = ['', ' (large)', ' x2'];
const letterCases = [
  (text: string) => text,
  (text: string) => text.toUpperCase(),
  (text: string) => text.replace(/\b\w/g, letter => letter.toUpperCase()),
];

function* itemVariants(name: string) {
  for (const separator of separators) {
    for (const changeCase of letterCases) {
      for (const quantity of quantities) {
        for (const suffix of suffixes) {
          yield `${quantity}${changeCase(name).replace(/ /g, separator)}${suffix}`;
        }
      }
    }
  }
}

describe('category properties', () => {
  for (const [category, names] of Object.entries(categoryItems)) {
    it.each(names)(`preserves ${category} for generated variants of %s`, name => {
      for (const variant of itemVariants(name)) {
        // The generator starts with the simplest case to keep failures readable.
        expect(classifyItem(variant), JSON.stringify({ name, variant })).toBe(category);
      }
    });
  }

  const productFamilies = [
    { category: 'Pantry', flavours: ['apple', 'orange', 'mango', 'strawberry', 'raspberry'], products: ['juice', 'jam'] },
    { category: 'Pantry', flavours: ['chicken', 'beef', 'vegetable', 'tomato'], products: ['stock', 'soup'] },
    { category: 'Pantry', flavours: ['ginger', 'butter', 'chocolate'], products: ['biscuits', 'cookies'] },
    { category: 'Dairy', flavours: ['strawberry', 'raspberry', 'mango'], products: ['yogurt', 'yoghurt'] },
    { category: 'Frozen', flavours: ['chocolate', 'strawberry', 'vanilla'], products: ['ice cream'] },
    { category: 'Toiletries', flavours: ['coconut', 'lemon', 'almond'], products: ['shampoo', 'shower gel'] },
    { category: 'Ready Meals', flavours: ['cheese', 'chicken', 'ham', 'seafood', 'vegetable', 'pepperoni'], products: ['pizza', 'ready meal'] },
  ];

  for (const { category, flavours, products } of productFamilies) {
    for (const product of products) {
      it(`uses the product category for flavoured ${product}`, () => {
        for (const flavour of flavours) {
          for (const variant of itemVariants(`${flavour} ${product}`)) {
            expect(classifyItem(variant), variant).toBe(category);
          }
        }
      });
    }
  }

  it('does not match a keyword inside a longer word', () => {
    for (const keyword of ['ham', 'gin', 'rum', 'cod', 'tea', 'egg', 'milk', 'rice', 'soap', 'beer', 'ice', 'pizza']) {
      for (const prefix of ['x', 'pre', 'super']) {
        for (const suffix of ['', 'x', 'like']) {
          expect(classifyItem(`${prefix}${keyword}${suffix}`)).toBe('Other');
          expect(classifyItem(`${keyword}${prefix}${suffix}`)).toBe('Other');
        }
      }
    }
  });

  it('returns a valid category consistently for seeded arbitrary text', () => {
    let seed = 0x3ca7e;
    const alphabet = ['a', 'b', 'c', 'g', 'i', 'n', ' ', '\t', '\n', '-', '_', 'é', '中', '🥕', '2', '\0', '‑'];
    const next = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;

      return seed;
    };

    for (let run = 0; run < 2000; run++) {
      const name = Array.from({ length: next() % 100 }, () => alphabet[next() % alphabet.length]).join('');
      const category = classifyItem(name);

      expect(categoryOrder).toContain(category);
      expect(classifyItem(name)).toBe(category);
    }
  });
});
