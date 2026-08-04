import { treePrompt } from '../index.js';

// `hideChildrenOfValid` makes valid items leaves: their children are dropped,
// so once an item may be selected there is nothing to drill into. Useful when a
// branch is a valid answer on its own — here picking a directory answers with
// the directory, and only invalid ones can be opened further.
const answer = await treePrompt({
    message: 'Pick a package directory:',
    tree: [
        {
            name: 'src',
            value: 'src',
            open: true,
            children: [
                {
                    // Valid (holds a package.json): shown as a leaf, its
                    // children are never displayed.
                    name: 'core',
                    value: 'src/core',
                    children: ['src/core/index.js', 'src/core/tree.js'],
                },
                {
                    // Invalid: still expandable, so its children can be reached.
                    name: 'utils',
                    value: 'src/utils',
                    children: [
                        {
                            name: 'strings',
                            value: 'src/utils/strings',
                            children: ['src/utils/strings/case.js'],
                        },
                    ],
                },
            ]
        },
    ],
    validate: (value) => ['src/core', 'src/utils/strings'].includes(value),
    hideChildrenOfValid: true,
});

console.log(answer);
