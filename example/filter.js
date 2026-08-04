import { treePrompt } from '../index.js';

const PRICES = {
    'plain burger': 8,
    'burger with the lot': 12,
    'whiting': 10,
    'flathead': 11,
    'chips': 4,
    'dim sims': 3,
    'calamari': 6,
};

const menu = [
    {
        name: 'burgers',
        value: '',
        open: true,
        children: [
            'plain burger',
            'burger with the lot',
        ]
    },
    {
        name: 'fish',
        value: '',
        children: [
            'whiting',
            'flathead',
        ]
    },
    {
        name: 'snacks',
        value: '',
        multiple: true,
        children: [
            'chips',
            'dim sims',
            'calamari',
        ]
    }
];

// In single selection mode, `filter` receives the selected value and returns
// (or resolves to) whatever the prompt should answer with: here the raw value
// is turned into an object.
const dish = await treePrompt({
    message: 'Pick a dish:',
    tree: menu,
    filter: (value) => ({ name: value, price: PRICES[value] }),
});

console.dir(dish);

// In `multiple` mode, `filter` receives the array of selected values. It may
// also be asynchronous: the prompt waits for the returned promise before
// resolving.
const order = await treePrompt({
    message: 'Order your meal:',
    tree: menu,
    multiple: true,
    filter: async (values) => {
        const items = values.map((value) => ({ name: value, price: PRICES[value] }));
        return {
            items,
            total: items.reduce((sum, item) => sum + item.price, 0),
        };
    },
});

console.dir(order, { depth: 5 });
