import { treePrompt } from '../index.js';

// `pageSize` is a number of **rows**, not of items: an item whose name spans
// several lines takes that many rows off the page. The page is also capped to
// the height of the terminal so the highlighted item always stays visible —
// resize the window to see it shrink.
const answer = await treePrompt({
    message: 'Pick a commit (5 rows at a time):',
    pageSize: 5,
    tree: [
        {
            name: 'main',
            value: '',
            open: true,
            children: [
                // This one takes two rows on its own.
                'ee1e9f7 fix: repair lazy loading\nand validation',
                'fe839ac fix: pageSize with multiline',
                '1080f4c fix: unit tests in CI',
                '0c20e7d feat: update to nodejs 26',
                '3eeb77c chore(deps-dev): bump eslint',
                '9dd5087 chore(deps): bump yoctocolors',
                '7ad519a chore(deps): bump brace-expansion',
                '1355c33 chore(deps-dev): bump globals',
            ]
        },
    ],
});

console.log(answer);
