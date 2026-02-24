import { treePrompt } from '../index.js';

const answer = await treePrompt({
    loop: false,
    message: 'Order your meal:',
    tree: [
        {
            name: 'burgers',
            value: '',
            multiple: false,
            children: [
                {
                    name: 'PLAIN',
                    value: 'plain burger',
                    short: 'PLAIN BURGER',
                },
                {
                    name: 'THE LOT',
                    value: 'burger with the lot',
                    short: 'BURGER WITH THE LOT',
                },
            ]
        },
        {
            name: 'fish',
            value: '',
            multiple: false,
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
                'pickled onions',
                'jam donuts',
                {
                    name: 'fritters',
                    value: '',
                    children: [
                        {
                            name: 'BANANA',
                            value: 'banana fritter',
                            short: 'BANANA FRITTER',
                        },
                        {
                            name: 'PINEAPPLE',
                            value: 'pineapple fritter',
                            short: 'PINEAPPLE FRITTER',
                        }
                    ]
                }
            ]
        }
    ],
    multiple: true,
});

console.dir(answer, { depth: 5 });
