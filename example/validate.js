import { treePrompt } from '../index.js';

// `validate` receives an item's value and returns (or resolves to) whether it
// may be selected. Invalid items are displayed in red and `enter` does nothing
// on them. Here only image files are selectable.
const answer = await treePrompt({
    message: 'Pick an image:',
    tree: [
        {
            name: 'assets',
            value: '',
            open: true,
            children: [
                'logo.png',
                'notes.txt',
                'screenshot.jpg',
                'README.md',
                {
                    name: 'trusted.bin',
                    value: 'trusted.bin',
                    // `isValid` skips `validate` for this item, whatever the
                    // rule would say.
                    isValid: true,
                },
            ]
        },
    ],
    validate: async (value) => /\.(png|jpe?g|gif)$/.test(value),
});

console.log(answer);
