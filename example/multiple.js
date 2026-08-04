import { treePrompt } from '../index.js';

// `multiple: true` turns the prompt into a checkbox: `space` (or `right` on a
// leaf) toggles the item under the cursor, and the answer is an array.
//
// Siblings are mutually exclusive by default: selecting one clears the others.
// An item opts its own children into multiple selection with `multiple: true`.
const answer = await treePrompt({
    message: 'Order your meal:',
    multiple: true,
    tree: [
        {
            name: 'main',
            value: '',
            open: true,
            // Left out, so the two mains are mutually exclusive: picking one
            // deselects the other.
            children: [
                { name: 'PLAIN', value: 'plain burger', short: 'PLAIN BURGER' },
                { name: 'THE LOT', value: 'burger with the lot', short: 'BURGER WITH THE LOT' },
            ]
        },
        {
            name: 'snacks',
            value: '',
            open: true,
            // Any number of snacks may be selected together.
            multiple: true,
            children: [
                'chips',
                'dim sims',
                'calamari',
            ]
        },
    ],
});

// An array of values, in selection order.
console.log(answer);
