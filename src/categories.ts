export const categoryOrder = [
  'Fruit & Veg', 'Veg', 'Dairy', 'Meat', 'Seafood', 'Pantry', 'Bakery',
  'Frozen', 'Ready Meals', 'Toiletries', 'Cleaning Products', 'Pets', 'Baby', 'Medicine',
  'Alcohol', 'Other',
] as const;

export type Category = typeof categoryOrder[number];

// Specific phrases take priority over general food names.
const rules: [Category, RegExp][] = [
  ['Pets', /\b((cat|dog|pet|kitten|puppy|bird|fish|hamster|rabbit) (food|treats?|litter|milk|shampoo|seed)|dogfood|dry food)\b/],
  ['Baby', /\b(baby (milk|formula|food|wipes|shampoo|oil|lotion)|infant formula|napp(?:y|ies)|diapers?|formula)\b/],
  ['Frozen', /\b(frozen|ice)\b/],
  ['Cleaning Products', /\b(bleach|detergent|disinfectant|cleaner|washing up liquid|dishwasher|bin bags?|laundry|sponges?|kitchen (rolls?|towels?)|washing powder|fabric softener|dish soap)\b/],
  ['Toiletries', /\b(toothpaste|toothbrush(?:es)?|shampoo|conditioner|soap|deodorant|toilet (paper|rolls?)|shower gel|tissues?|sanitary|tampons?|hand cream|sun cream|sunscreen|mouthwash|razors?|cotton wool|lip balm)\b/],
  ['Medicine', /\b(paracetamol|ibuprofen|aspirin|medicine|vitamins?|plasters?|antihistamines?|cough syrup|antiseptic cream|throat lozenges?|eye drops|antacids?)\b/],
  ['Ready Meals', /\b(pizzas?|(ready|microwave|prepared) meals?|lasagn[ae]|cottage pies?|shepherd['’]s pies?)\b/],
  // These pantry phrases contain words from other categories.
  ['Pantry', /\b((peanut|almond|cashew) butter|milk chocolate|cream crackers?|butter beans|coconut milk|(wine|cider) vinegar|fish sauce|salad dressing|black pepper|white pepper)\b/],
  // A packaged product takes priority over its flavour or ingredient.
  ['Pantry', /\b(juices?|jams?|stocks?|soups?|biscuits?|cookies?|pretzels?)\b/],
  ['Alcohol', /\b(beer|wine|lager|cider|vodka|gin|rum|whisk(?:y|ey)|prosecco|champagne|brandy|tequila)\b/],
  ['Seafood', /\b(fish|salmon|tuna|cod|haddock|prawns?|shrimps?|crabs?|mussels?|sardines?|mackerel|trout|squid|scallops?)\b/],
  ['Meat', /\b(chicken|beef|pork|lamb|turkey|bacon|ham|pepperoni|sausages?|mince|steaks?|chops?|meatballs?)\b/],
  ['Dairy', /\b(milk|cheese|butter|yogh?urts?|cream|eggs?|cheddar|mozzarella|feta|halloumi)\b/],
  ['Bakery', /\b(bread|rolls?|bagels?|croissants?|buns?|baguettes?|cakes?|muffins?|wraps?|crumpets?|pittas?|sourdough|scones?)\b/],
  ['Fruit & Veg', /\bfruit salads?\b/],
  ['Veg', /\b(salads?|lettuce|tomato(?:es)?|cucumbers?|carrots?|potato(?:es)?|onions?|broccoli|spinach|cabbage|peas|peppers?|courgettes?|aubergines?|mushrooms?|garlic|ginger|vegetables?|veg|celery|cauliflower|leeks?|sweetcorn|beetroots?|asparagus|kale|green beans)\b/],
  ['Fruit & Veg', /\b(apples?|bananas?|oranges?|pears?|grapes?|lemons?|limes?|strawberr(?:y|ies)|blueberr(?:y|ies)|raspberr(?:y|ies)|avocados?|fruit|melons?|pineapples?|mango(?:es)?|peach(?:es)?|plums?|cherr(?:y|ies)|kiwis?|satsumas?|tangerines?|nectarines?)\b/],
  ['Pantry', /\b(rice|pasta|flour|sugar|salt|pepper|oil|vinegar|beans|lentils?|cereal|oats|coffee|tea|sauce|ketchup|chocolate|crisps|nuts|honey|water|mustard|mayonnaise)\b/],
];

export function classifyItem(name: string): Category {
  const normalised = name.toLowerCase().replace(/[\p{Dash_Punctuation}_]/gu, ' ').replace(/\s+/g, ' ').trim();

  return rules.find(([, pattern]) => pattern.test(normalised))?.[0] ?? 'Other';
}
