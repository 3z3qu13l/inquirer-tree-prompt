import { treePrompt } from '../index.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// `tree` may be an array, or an (optionally asynchronous) function called once
// when the prompt starts: "Loading…" is displayed until it resolves.
const tree = async () => {
    await sleep(300);

    return [
        {
            name: 'lazy children',
            value: '',
            // A `children` function is called the first time the item is
            // expanded; a dim `…` marks the item while it resolves.
            children: async () => {
                await sleep(500);
                return ['first', 'second', 'third'];
            }
        },
        {
            name: 'replaced once resolved',
            value: '',
            // Instead of a list, the function may return a replacement item:
            // its `name`, `value` and `short` update the item itself. Handy when
            // the label is only known once the remote data is there.
            children: async () => {
                await sleep(500);
                return {
                    name: 'resolved label',
                    value: 'resolved',
                    short: 'RESOLVED',
                    children: ['child of the resolved item'],
                };
            }
        },
        {
            name: 'fails to load',
            value: '',
            // A `children` function that throws leaves the item in place, marked
            // "(failed to load)" and no longer expandable: the prompt keeps going.
            children: async () => {
                throw new Error('network is down');
            }
        },
    ];
};

const answer = await treePrompt({
    message: 'Expand each item:',
    tree,
});

console.log(answer);
