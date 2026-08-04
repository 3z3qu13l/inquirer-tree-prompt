import { treePrompt } from '../index.js';

const tree = [
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
                name: 'archive',
                value: '',
                // Items with children are kept even when invalid: they may hold
                // valid descendants.
                children: ['old-logo.png', 'changelog.txt'],
            },
        ]
    },
];

const validate = (value) => /\.(png|jpe?g|gif)$/.test(value);

// `onlyShowValid` hides the items `validate` rejects, instead of displaying
// them in red: only `logo.png`, `screenshot.jpg` and the `archive` branch are
// left at the top level.
const answer = await treePrompt({
    message: 'Pick an image (invalid items are hidden):',
    tree,
    validate,
    onlyShowValid: true,
});

console.log(answer);
