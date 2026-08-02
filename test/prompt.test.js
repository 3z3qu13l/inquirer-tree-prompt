import test from 'node:test';
import assert from 'node:assert/strict';
import { render, keys, tick } from './helpers/prompt.js';

const PENDING = Symbol('pending');
const settled = (promise) => Promise.race([promise, tick(30).then(() => PENDING)]);

const MEAL = [
    { name: 'burgers', value: '', children: [{ name: 'PLAIN', value: 'plain burger', short: 'PLAIN BURGER' }, 'deluxe'] },
    { name: 'snacks', value: '', multiple: true, children: ['chips', 'calamari'] },
];

test('renders the tree, the hint and the separator', async () => {
    const ui = await render({ message: 'Pick one', tree: ['a', 'b'] });

    assert.equal(ui.screen(), [
        '? Pick one (Use arrow keys, enter to confirm.)',
        '  ❯ a',
        '    b',
        '----------------',
    ].join('\n'));

    await ui.close();
});

test('the hint is only shown once', async () => {
    const ui = await render({ message: 'Pick one', tree: ['a', 'b'] });
    await ui.press(keys.down);

    assert.ok(!ui.screen().includes('arrow keys'));

    await ui.close();
});

test('arrow keys move the pointer and wrap around', async () => {
    const ui = await render({ message: 'Pick one', tree: ['a', 'b', 'c'] });

    await ui.press(keys.down);
    assert.match(ui.screen(), /❯ b/);

    await ui.press(keys.up, keys.up);
    assert.match(ui.screen(), /❯ c/);

    await ui.press(keys.enter);
    assert.equal(await ui.answer, 'c');
});

test('loop:false stops at both ends and hides the separator', async () => {
    const ui = await render({ message: 'Pick one', tree: ['a', 'b'], loop: false });

    assert.ok(!ui.screen().includes('----------------'));

    await ui.press(keys.up);
    assert.match(ui.screen(), /❯ a/);

    await ui.press(keys.down, keys.down);
    assert.match(ui.screen(), /❯ b/);

    await ui.close();
});

test('right expands, left collapses, left again moves to the parent', async () => {
    const ui = await render({ message: 'Pick one', tree: [{ name: 'a', children: ['a1'] }, 'b'] });

    await ui.press(keys.right);
    assert.equal(ui.screen().includes('a1'), true);

    await ui.press(keys.right);
    assert.match(ui.screen(), /❯ a1/);

    await ui.press(keys.left);
    assert.match(ui.screen(), /↓ a/);

    await ui.press(keys.left);
    assert.equal(ui.screen().includes('a1'), false);

    await ui.close();
});

test('space and tab toggle a branch open and closed', async () => {
    const ui = await render({ message: 'Pick one', tree: [{ name: 'a', children: ['a1'] }] });

    await ui.press(keys.space);
    assert.equal(ui.screen().includes('a1'), true);

    await ui.press(keys.space);
    assert.equal(ui.screen().includes('a1'), false);

    await ui.press(keys.tab);
    assert.equal(ui.screen().includes('a1'), true);

    await ui.press(keys.tab);
    assert.equal(ui.screen().includes('a1'), false);

    await ui.close();
});

test('the answer uses value, the answer line uses short', async () => {
    const ui = await render({ message: 'Order', tree: MEAL });

    await ui.press(keys.right, keys.down, keys.enter);

    assert.equal(await ui.answer, 'plain burger');
    assert.match(ui.screen(), /Order PLAIN BURGER$/);
});

test('a transformer is used to display items without a name', async () => {
    const ui = await render({ message: 'Pick one', tree: ['a'], transformer: (value) => value.toUpperCase() });

    assert.match(ui.screen(), /❯ A/);

    await ui.press(keys.enter);
    assert.equal(await ui.answer, 'a');
});

test('pageSize limits the number of visible rows', async () => {
    const ui = await render({ message: 'Pick one', tree: ['a', 'b', 'c', 'd', 'e'], pageSize: 3 });

    const rows = ui.screen().split('\n').filter((line) => /^\s{2}[❯ ]/.test(line));
    assert.equal(rows.length, 3);

    await ui.close();
});

test('the caller tree is not mutated by the prompt', async () => {
    const tree = [{ name: 'a', children: ['a1'] }];
    const ui = await render({ message: 'Pick one', tree });

    await ui.press(keys.right, keys.down, keys.enter);
    await ui.answer;

    assert.deepEqual(tree, [{ name: 'a', children: ['a1'] }]);
});

test('multiple selections accumulate on a flat list', async () => {
    const ui = await render({ message: 'Pick some', tree: ['a', 'b', 'c'], multiple: true });

    await ui.press(keys.space, keys.down, keys.space, keys.enter);

    assert.deepEqual(await ui.answer, ['a', 'b']);
});

test('selected items are marked in the list', async () => {
    const ui = await render({ message: 'Pick some', tree: ['a', 'b'], multiple: true });

    await ui.press(keys.space);
    const [first, second] = ui.screen().split('\n').slice(1);

    assert.match(first, /◉ a/);
    assert.match(second, /◯ b/);

    await ui.close();
});

test('right toggles a leaf when selecting multiple', async () => {
    const ui = await render({ message: 'Pick some', tree: ['a', 'b'], multiple: true });

    await ui.press(keys.right, keys.enter);

    assert.deepEqual(await ui.answer, ['a']);
});

test('siblings of a group without multiple replace each other', async () => {
    const ui = await render({ message: 'Order', tree: MEAL, multiple: true });

    // burgers is a single choice group, snacks allows several.
    await ui.press(keys.right, keys.down, keys.space, keys.down, keys.space);
    await ui.press(keys.down, keys.right, keys.down, keys.space, keys.down, keys.space, keys.enter);

    assert.deepEqual(await ui.answer, ['deluxe', 'chips', 'calamari']);
});

test('a tree given as an async function is loaded', async () => {
    const ui = await render({ message: 'Pick one', tree: async () => ['a', 'b'] });

    assert.match(ui.screen(), /❯ a/);

    await ui.press(keys.down, keys.enter);
    assert.equal(await ui.answer, 'b');
});

test('children given as a function are loaded on expand', async () => {
    const ui = await render({
        message: 'Pick one',
        tree: [{ name: 'lazy', children: async () => ['x', 'y'] }],
    });

    assert.equal(ui.screen().includes('x'), false);

    await ui.press(keys.right);
    assert.equal(ui.screen().includes('x'), true);

    await ui.press(keys.down, keys.enter);
    assert.equal(await ui.answer, 'x');
});

test('a children function returning a replacement item updates the node', async () => {
    const ui = await render({
        message: 'Pick one',
        tree: [{ name: 'a', children: () => ({ name: 'renamed', value: 'A', children: [] }) }],
    });

    await ui.press(keys.right);
    assert.match(ui.screen(), /renamed/);

    await ui.press(keys.enter);
    assert.equal(await ui.answer, 'A');
});

test('a failing children function does not break the prompt', async () => {
    const ui = await render({
        message: 'Pick one',
        tree: [{ name: 'broken', children: () => { throw new Error('boom'); } }, 'b'],
    });

    await ui.press(keys.right);
    assert.match(ui.screen(), /broken \(failed to load\)/);

    await ui.press(keys.down, keys.enter);
    assert.equal(await ui.answer, 'b');
});

test('a slow children function shows a loading marker', async () => {
    const ui = await render({
        message: 'Pick one',
        tree: [{ name: 'slow', children: () => new Promise((resolve) => setTimeout(() => resolve(['x']), 80)) }],
    });

    await ui.press(keys.right);
    assert.match(ui.screen(), /slow …/);

    await tick(100);
    assert.match(ui.screen(), /x/);

    await ui.close();
});

test('an error thrown by validate rejects the prompt', async () => {
    const ui = await render({ message: 'Pick one', tree: ['a'], validate: () => { throw new Error('validate exploded'); } });

    await assert.rejects(ui.answer, /validate exploded/);
});

test('an error thrown by filter rejects the prompt', async () => {
    const ui = await render({ message: 'Pick one', tree: ['a'], filter: () => { throw new Error('filter exploded'); } });

    await ui.press(keys.enter);
    await assert.rejects(ui.answer, /filter exploded/);
});

test('enter is ignored on an invalid item', async () => {
    const ui = await render({ message: 'Pick one', tree: ['x', 'y'], validate: (value) => value === 'y' });

    await ui.press(keys.enter);
    assert.equal(await settled(ui.answer), PENDING);

    await ui.press(keys.down, keys.enter);
    assert.equal(await ui.answer, 'y');
});

test('validate is applied to top level items', async () => {
    const ui = await render({ message: 'Pick some', tree: ['x', 'y'], multiple: true, validate: (value) => value === 'x' });

    await ui.press(keys.space, keys.down, keys.space, keys.enter);

    assert.deepEqual(await ui.answer, ['x']);
});

test('onlyShowValid hides invalid items instead of trapping the prompt', async () => {
    const ui = await render({ message: 'Pick one', tree: ['x', 'y'], validate: () => false, onlyShowValid: true });

    assert.match(ui.screen(), /No items/);

    await ui.press(keys.enter);
    assert.equal(await ui.answer, undefined);
});

test('hideChildrenOfValid makes valid branches selectable', async () => {
    const ui = await render({
        message: 'Pick one',
        tree: [{ name: 'a', children: ['a1'] }],
        validate: (value) => value === 'a',
        hideChildrenOfValid: true,
    });

    await ui.press(keys.right);
    assert.equal(ui.screen().includes('a1'), false);

    await ui.press(keys.enter);
    assert.equal(await ui.answer, 'a');
});

test('filter transforms the answer', async () => {
    const ui = await render({ message: 'Pick one', tree: ['a'], filter: (value) => `${value}!` });

    await ui.press(keys.enter);
    assert.equal(await ui.answer, 'a!');
});

test('filter also receives the list of selected values', async () => {
    const ui = await render({ message: 'Pick some', tree: ['a', 'b'], multiple: true, filter: (values) => values.join('+') });

    await ui.press(keys.space, keys.down, keys.space, keys.enter);
    assert.equal(await ui.answer, 'a+b');
});
