import type { Category } from '../../src/categories';

// Expected categories describe shopping items independently of the regex rules.
export const categoryItems = {
  'Fruit & Veg': [
    'fruit salad', 'fruit salads',
    'apple', 'apples', 'banana', 'oranges', 'pear', 'grapes', 'lemon', 'lime',
    'strawberry', 'strawberries', 'blueberries', 'raspberries', 'avocado',
    'melon', 'pineapple', 'mango', 'mangoes', 'peach', 'peaches', 'plum',
    'plums', 'cherries', 'kiwi', 'satsumas', 'tangerines', 'nectarines',
  ],
  Veg: [
    'salad', 'salads', 'mixed salad', 'salad leaves', 'bag of salad',
    'lettuce', 'tomato', 'tomatoes', 'cucumber', 'carrots', 'potato', 'potatoes',
    'onions', 'broccoli', 'spinach', 'cabbage', 'peas', 'red peppers',
    'courgette', 'aubergine', 'mushrooms', 'garlic', 'ginger', 'celery',
    'cauliflower', 'leeks', 'sweetcorn', 'beetroot', 'asparagus', 'kale',
    'baby spinach', 'baby potatoes', 'baby carrots', 'green beans',
  ],
  Dairy: [
    'milk', 'cheese', 'butter', 'yogurt', 'yoghurt', 'yogurts', 'yoghurts',
    'cream', 'egg', 'eggs', 'cheddar', 'mozzarella', 'feta', 'halloumi',
    'cream cheese', 'double cream', 'salted butter',
  ],
  Meat: [
    'pepperoni', 'pepperoni slices', 'sliced pepperoni',
    'chicken', 'beef', 'pork', 'lamb', 'turkey', 'bacon', 'ham', 'sausage',
    'sausages', 'mince', 'steak', 'steaks', 'pork chops', 'meatballs',
  ],
  Seafood: [
    'fish', 'salmon', 'tuna', 'cod', 'haddock', 'prawn', 'prawns', 'shrimp',
    'crab', 'mussels', 'sardines', 'mackerel', 'trout', 'squid', 'scallops',
  ],
  Pantry: [
    'pretzel', 'pretzels', 'salted pretzels', 'cheese pretzels', 'chocolate pretzels',
    'salad dressing',
    'rice', 'pasta', 'flour', 'sugar', 'salt', 'black pepper', 'white pepper',
    'olive oil', 'vinegar', 'baked beans', 'kidney beans', 'lentils', 'cereal',
    'oats', 'coffee', 'tea', 'sauce', 'ketchup', 'biscuits', 'chocolate',
    'crisps', 'nuts', 'honey', 'jam', 'juice', 'water', 'peanut butter',
    'milk chocolate', 'cream crackers', 'butter beans', 'coconut milk',
    'red wine vinegar', 'white wine vinegar', 'cider vinegar', 'fish sauce',
    'chicken stock', 'beef stock', 'stock cubes', 'mustard', 'mayonnaise',
  ],
  Bakery: [
    'bread', 'bread rolls', 'bagels', 'croissants', 'buns', 'baguette',
    'cakes', 'muffins', 'wraps', 'crumpets', 'pitta', 'sourdough', 'scones',
  ],
  Frozen: [
    'ice', 'ICE', 'Ice', 'bag of ice', 'frozen pizza', 'frozen ready meal',
    'frozen peas', 'frozen chicken', 'frozen fish', 'frozen berries',
    'ice cream', 'ice creams', 'ice lolly', 'ice lollies', 'ice cubes',
  ],
  'Ready Meals': [
    'pizza', 'pizzas', 'cheese pizza', 'ham pizza', 'chicken pizza',
    'seafood pizza', 'vegetable pizza', 'pepperoni pizza', 'margherita pizza',
    'ready meal', 'ready meals', 'chilled ready meal', 'microwave meal',
    'microwave meals', 'prepared meal', 'lasagne', 'lasagna', 'cottage pie',
    "shepherd's pie", 'shepherd’s pie',
  ],
  Toiletries: [
    'toothpaste', 'toothbrush', 'toothbrushes', 'shampoo', 'conditioner',
    'soap', 'deodorant', 'toilet paper', 'toilet rolls', 'shower gel',
    'tissues', 'tampons', 'hand cream', 'sun cream', 'sunscreen',
    'mouthwash', 'razors', 'cotton wool', 'lip balm', 'sanitary towels',
  ],
  'Cleaning Products': [
    'bleach', 'detergent', 'disinfectant', 'cleaner', 'washing up liquid',
    'dishwasher tablets', 'bin bags', 'laundry powder', 'sponges',
    'kitchen roll', 'kitchen towels', 'washing powder', 'fabric softener',
    'cream cleaner', 'dish soap',
  ],
  Pets: [
    'dry food', 'dogfood', 'chicken dry food', 'beef dogfood',
    'cat food', 'dog food', 'kitten food', 'puppy food', 'bird food',
    'dog treats', 'cat litter', 'cat milk', 'dog shampoo', 'fish food',
    'bird seed', 'hamster food', 'rabbit food', 'frozen dog food',
  ],
  Baby: [
    'baby milk', 'baby formula', 'baby food', 'baby wipes', 'baby shampoo',
    'baby oil', 'baby lotion', 'nappy', 'nappies', 'diaper', 'diapers',
    'infant formula', 'frozen baby food',
  ],
  Medicine: [
    'paracetamol', 'ibuprofen', 'aspirin', 'medicine', 'vitamins', 'plasters',
    'antihistamines', 'cough syrup', 'antiseptic cream', 'throat lozenges',
    'eye drops', 'antacid',
  ],
  Alcohol: [
    'beer', 'wine', 'lager', 'cider', 'vodka', 'gin', 'rum', 'whisky',
    'whiskey', 'prosecco', 'champagne', 'ginger beer', 'brandy', 'tequila',
  ],
  Other: [
    'dogfoodie', 'dry foodie',
    'saladware',
    'mystery item', 'batteries', 'notebook', 'light bulbs', 'newspaper',
    'gingham', 'hamper', 'rumble', 'codex', 'teapot', 'eggplantation',
  ],
} as const satisfies Record<Category, readonly string[]>;
