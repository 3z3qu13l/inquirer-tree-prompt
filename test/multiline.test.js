import test from 'node:test';
import assert from 'node:assert/strict';
import { render, keys } from './helpers/prompt.js';

const CYAN = '[36m';

const twoLines = (label) => `${label}\n${label} details`;

const tree = [
    { name: twoLines('alpha'), children: [twoLines('alpha child')] },
    { name: twoLines('beta') },
    { name: twoLines('gamma') },
    { name: twoLines('delta') },
];

test('extra lines of a name are aligned under the first one', async () => {
    const ui = await render({ message: 'Pick one', tree, pageSize: 4 });

    assert.equal(ui.screen(), [
        '? Pick one (Use arrow keys, enter to confirm.)',
        '  → alpha',
        '    alpha details',
        '    beta',
        '    beta details',
        '----------------',
    ].join('\n'));

    await ui.close();
});

test('extra lines follow the depth of their item', async () => {
    const ui = await render({ message: 'Pick one', tree, pageSize: 4 });

    await ui.press(keys.right, keys.down);
    const lines = ui.screen().split('\n');
    const index = lines.findIndex((line) => line.endsWith('alpha child'));

    // The pointer sits in the gutter, so the extra line starts where the name does.
    assert.equal(lines[index], '    ❯ alpha child');
    assert.equal(lines[index + 1], '      alpha child details');

    await ui.close();
});

test('extra lines of the active item are highlighted too', async () => {
    const ui = await render({ message: 'Pick one', tree: [twoLines('alpha')], pageSize: 4 });

    const highlighted = ui.rawScreen()
        .split('\n')
        .filter((line) => line.includes(CYAN));

    assert.equal(highlighted.length, 2);
    assert.match(highlighted[1], /alpha details/);

    await ui.close();
});

test('the page budget is spent in lines, not in items', async () => {
    const ui = await render({ message: 'Pick one', tree, pageSize: 4 });

    const rows = ui.screen().split('\n').slice(1, -1);
    assert.equal(rows.length, 4);
    assert.equal(rows.filter((row) => row.includes('details')).length, 2);

    await ui.close();
});

test('the page never grows past the terminal height', async () => {
    const ui = await render({ message: 'Pick one', tree, pageSize: 20 }, { rows: 6 });

    assert.ok(ui.screen().split('\n').length <= 6, ui.screen());

    await ui.close();
});

test('the active item stays visible in a short terminal', async () => {
    const ui = await render({ message: 'Pick one', tree, pageSize: 20 }, { rows: 6 });

    await ui.press(keys.down, keys.down, keys.down);
    const screen = ui.screen();

    assert.match(screen, /❯ delta/);
    assert.ok(screen.split('\n').length <= 6, screen);

    await ui.close();
});

test('a multi line item is confirmed like any other', async () => {
    const ui = await render({ message: 'Pick one', tree: [{ name: twoLines('alpha'), value: 'a', short: 'A' }] });

    await ui.press(keys.enter);

    assert.equal(await ui.answer, 'a');
    assert.match(ui.screen(), /Pick one A$/);
});

test('the loading marker stays on the first line', async () => {
    const ui = await render({
        message: 'Pick one',
        tree: [{ name: twoLines('slow'), children: () => new Promise((resolve) => setTimeout(() => resolve(['x']), 80)) }],
    });

    await ui.press(keys.right);
    const [, first, second] = ui.screen().split('\n');

    assert.equal(first, '  ↓ slow …');
    assert.equal(second, '    slow details');

    await ui.close();
});
