import { treePrompt } from '../index.js';

// Item properties: `name`, `value`, `short`, `open` and multiline names.
// Only items without children can be selected, so items holding children are
// really just labels for the branch they open.
const answer = await treePrompt({
    message: 'Pick a font:',
    tree: [
        // A bare string is the shortest form: it is both displayed and answered
        // with.
        'system default',
        {
            name: 'Serif',
            value: '',
            // `open: true` shows the children right away.
            open: true,
            children: [
                {
                    // `name` is displayed in the list, `value` is what the prompt
                    // answers with, and `short` is displayed once confirmed.
                    name: 'Times New Roman',
                    value: 'times-new-roman',
                    short: 'Times',
                },
                {
                    // A name may span several lines: the extra ones are indented
                    // under the first, and count towards `pageSize`.
                    name: 'Garamond\nold style, low contrast',
                    value: 'garamond',
                    short: 'Garamond',
                },
            ]
        },
        {
            name: 'Sans serif',
            value: '',
            children: [
                // With no `name`, the value is displayed as is.
                'helvetica',
                'inter',
            ]
        },
    ]
});

console.log(answer);
