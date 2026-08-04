import { treePrompt } from '../index.js';

const tree = [
    {
        name: 'letters',
        value: '',
        open: true,
        children: ['a', 'b', 'c', 'd'],
    },
];

// `loop: false` stops the cursor at both ends of the list instead of wrapping
// around, and drops the separator line displayed at the bottom of the page.
// Press `up` on the first item: nothing moves.
const bounded = await treePrompt({
    message: 'Bounded list (loop: false):',
    tree,
    loop: false,
});

console.log(bounded);

// The default: `up` on the first item jumps to the last one.
const looping = await treePrompt({
    message: 'Looping list (default):',
    tree,
});

console.log(looping);
