import { treePrompt } from '../index.js';

// `transformer` changes how a value is displayed, and only applies to items
// without a `name`. The answer is left untouched — use `filter` for that.
const answer = await treePrompt({
    message: 'Pick a tip:',
    tree: [
        {
            // This item has a `name`, so the transformer is not called for it.
            name: 'Suggested',
            value: '',
            open: true,
            // Bare values: each one goes through the transformer.
            children: [1.5, 2, 5, 10],
        },
    ],
    // The second and third arguments exist for inquirer compatibility; the
    // prompt always calls the transformer with `{}` and `{ isFinal: false }`.
    transformer: (value) => `${value.toFixed(2)} €`,
});

// The raw value, not the transformed display.
console.log(answer);
