export const categoryOrder = [
  'Fruit & Veg', 'Dairy', 'Meat', 'Seafood', 'Pantry', 'Bakery',
  'Frozen', 'Ready Meals', 'Toiletries', 'Cleaning Products', 'Pets', 'Baby', 'Medicine',
  'Soft drinks', 'Alcohol', 'Other',
] as const;

export type Category = typeof categoryOrder[number];

// Specific phrases take priority over general food names.
const rules: [Category, RegExp][] = [
  ['Pets', /\b((cat|dog|pet|kitten|puppy|bird|fish|hamster|rabbit) (food|treats?|litter|milk|shampoo|seed)|dogfood|dry food)\b/],
  ['Baby', /\b(baby (milk|formula|food|wipes|shampoo|oil|lotion)|infant formula|napp(?:y|ies)|diapers?|formula)\b/],
  ['Frozen', /\b(frozen|ice)\b/],
  ['Cleaning Products', /\b(bleach|detergent|disinfectant|cleaner|washing up liquid|dishwasher|bin bags?|laundry|sponges?|kitchen (rolls?|towels?)|washing powder|fabric softener|dish soap|washing soda|soda crystals)\b/],
  ['Toiletries', /\b(toothpaste|toothbrush(?:es)?|shampoo|conditioner|soap|deodorant|toilet (paper|rolls?)|shower gel|tissues?|sanitary|tampons?|hand cream|sun cream|sunscreen|mouthwash|razors?|cotton wool|lip balm)\b/],
  ['Medicine', /\b(paracetamol|ibuprofen|aspirin|medicine|vitamins?|plasters?|antihistamines?|cough syrup|antiseptic cream|throat lozenges?|eye drops|antacids?)\b/],
  ['Ready Meals', /\b(pizzas?|(ready|microwave|prepared) meals?|lasagn[ae]|cottage pies?|shepherd['’]s pies?)\b/],
  // These pantry phrases contain words from other categories.
  ['Pantry', /\b((peanut|almond|cashew) butter|milk chocolate|cream crackers?|butter beans|coconut milk|vinegar|fish sauce|salad dressing|black pepper|white pepper|baking soda|bicarbonate of soda|rose water|orange blossom water|water chestnuts?|egg (noodles?|pasta|fried rice|mayonnaise)|(?:chocolate|easter) eggs?)\b/],
  // A packaged product takes priority over its flavour or ingredient.
  ['Pantry', /\b(jams?|stocks?|soups?|biscuits?|cookies?|pretzels?)\b/],
  ['Alcohol', /\b(wine|lager|cider|vodka|gin|rum|whisk(?:y|ey)|prosecco|champagne|brandy|tequila|pinot|sauvignon|merlot|malbec|bordeaux|chardonnay|cabernet|shiraz|jack daniel['’]?s|crabbie['’]?s|hard (seltzer|soda|ginger beer|root beer)|(?<!non )alcoholic (ginger|root) beer|topo chico hard|simply spiked|fresca mixed)\b/],
  // Soda brands match their flavour, diet, and zero-sugar variants.
  ['Soft drinks', /\b(coca ?cola|coke|fanta|sprite|fresca|schweppes|barq['’]?s|mello ?yello|pibb|thums ?up|limca|inca ?kola|kuat|quatro|mezzo ?mix|frescolita|sparletta|stoney|royal tru|lilt|pepsi|(?:mountain|mtn) ?dew|7 ?up|seven ?up|mirinda|starry|sierra ?mist|manzanita ?sol|kas|evervess|shani|teem|stubborn soda|poppi|dr[.]? ?pepper|tango|irn ?bru|sunkist|crush|canada dry|root beer|ginger beer|cream soda|ginger ale)\b/],
  ['Alcohol', /\bbeers?\b/],
  ['Seafood', /\b(fish|salmon|tuna|cod|haddock|prawns?|shrimps?|crabs?|mussels?|sardines?|mackerel|trout|squid|scallops?)\b/],
  ['Pantry', /\beggs?\b/],
  ['Meat', /\b(chicken|beef|pork|lamb|turkey|bacon|ham|pepperoni|sausages?|mince|steaks?|chops?|meatballs?)\b/],
  ['Dairy', /\b(milk|cheese|butter|yogh?urts?|cream|cheddar|mozzarella|feta|halloumi|boursin|parmesan)\b/],
  ['Bakery', /\b(bread|rolls?|bagels?|croissants?|buns?|baguettes?|cakes?|muffins?|wraps?|crumpets?|pittas?|sourdough|scones?)\b/],
  ['Soft drinks', /\b(mug|slice)\b/],
  ['Soft drinks', /\b(juices?|waters?|soft drinks?|fizzy drinks?|sodas?|seltzer|cola|lemonade|cordials?|(?:orange|blackcurrant|lemon(?: and lime)?|lime|fruit|apple(?: and blackcurrant)?) squash|tonic|dasani|aquafina|smartwater|vitaminwater|bubly|topo chico|kinley|evian|volvic|buxton|highland spring|harrogate|perrier|pellegrino|sanpellegrino|fiji|tropicana|innocent|minute maid|ocean spray|rubicon|ribena|robinsons|vimto|capri ?sun|oasis|j2o|appletiser|maaza|del valle|cappy|hi ?c|5 alive|five alive|sunny ?d|simply (orange|apple|lemonade|juice))\b/],
  ['Fruit & Veg', /\b(salads?|lettuce|tomato(?:es)?|cucumbers?|carrots?|potato(?:es)?|onions?|broccoli|spinach|cabbage|peas|peppers?|courgettes?|aubergines?|mushrooms?|garlic|ginger|vegetables?|veg|celery|cauliflower|leeks?|sweetcorn|beetroots?|asparagus|kale|green beans)\b/],
  ['Fruit & Veg', /\b(apples?|bananas?|oranges?|pears?|grapes?|lemons?|limes?|strawberr(?:y|ies)|blueberr(?:y|ies)|raspberr(?:y|ies)|avocados?|fruit|melons?|pineapples?|mango(?:es)?|peach(?:es)?|plums?|cherr(?:y|ies)|kiwis?|satsumas?|tangerines?|nectarines?)\b/],
  ['Pantry', /\b(rice|pasta|flour|sugar|salt|pepper|oil|vinegar|beans|lentils?|cereal|oats|coffee|tea|sauce|ketchup|chocolate|crisps|nuts|honey|mustard|mayonnaise)\b/],
];

export function classifyItem(name: string): Category {
  const normalised = name.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().replace(/[\p{Dash_Punctuation}_]/gu, ' ').replace(/\s+/g, ' ').trim();

  return rules.find(([, pattern]) => pattern.test(normalised))?.[0] ?? 'Other';
}
