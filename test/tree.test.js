import test from 'node:test';
import assert from 'node:assert/strict';
import { buildNode, createRoot, prepareNode, flattenTree, toggleSelection, isLeaf, valueFor, shortFor, nameFor } from '../lib/tree.js';

async function prepared(config) {
    const root = createRoot(config);
    await prepareNode(root, config);
    return root;
}

const names = (nodes) => nodes.map((node) => nameFor(node));

test('valueFor prefers value over name', () => {
    assert.equal(valueFor(buildNode({ name: 'a', value: 'A' })), 'A');
    assert.equal(valueFor(buildNode({ name: 'a' })), 'a');
    assert.equal(valueFor(buildNode({ name: 'a', value: '' })), '');
});

test('shortFor prefers short, then name, then value', () => {
    assert.equal(shortFor(buildNode({ short: 'S', name: 'a', value: 'A' })), 'S');
    assert.equal(shortFor(buildNode({ name: 'a', value: 'A' })), 'a');
    assert.equal(shortFor(buildNode({ value: 'A' })), 'A');
});

test('nameFor falls back to the transformer, then the value', () => {
    const config = { transformer: (value) => `<${value}>` };
    assert.equal(nameFor(buildNode({ name: 'a', value: 'A' }), config), 'a');
    assert.equal(nameFor(buildNode({ value: 'A' }), config), '<A>');
    assert.equal(nameFor(buildNode({ value: 'A' })), 'A');
});

test('bare strings become value nodes', () => {
    const node = buildNode('hello');
    assert.equal(valueFor(node), 'hello');
    assert.equal(node.expandable, false);
});

test('the caller tree is never mutated', async () => {
    const tree = [{ name: 'a', children: ['a1'] }];
    const root = await prepared({ tree });
    await prepareNode(root.children[0], {});

    assert.deepEqual(tree, [{ name: 'a', children: ['a1'] }]);
    assert.deepEqual(Object.keys(tree[0]), ['name', 'children']);
});

test('children get a parent link and an increasing depth', async () => {
    const root = await prepared({ tree: [{ name: 'a', open: true, children: [{ name: 'a1', open: true, children: ['a1x'] }] }] });

    const [a] = root.children;
    const [a1] = a.children;
    const [a1x] = a1.children;

    assert.equal(a.depth, 0);
    assert.equal(a1.depth, 1);
    assert.equal(a1x.depth, 2);
    assert.equal(a1.parent, a);
    assert.equal(a1x.parent, a1);
    assert.equal(a.parent, root);
});

test('flattenTree only walks into open nodes', async () => {
    const root = await prepared({ tree: [{ name: 'a', children: ['a1', 'a2'] }, 'b'] });

    assert.deepEqual(names(flattenTree(root)), ['a', 'b']);

    const [a] = root.children;
    a.open = true;
    await prepareNode(a, {});
    assert.deepEqual(names(flattenTree(root)), ['a', 'a1', 'a2', 'b']);
});

test('initially open nodes are resolved recursively', async () => {
    const root = await prepared({ tree: [{ name: 'a', open: true, children: [{ name: 'a1', open: true, children: ['a1x'] }] }] });

    assert.deepEqual(names(flattenTree(root)), ['a', 'a1', 'a1x']);
});

test('the tree itself may be an async function', async () => {
    const root = await prepared({ tree: async () => ['a', 'b'] });

    assert.deepEqual(names(root.children), ['a', 'b']);
});

test('children may be a function returning a list', async () => {
    const root = await prepared({ tree: [{ name: 'a', children: async () => ['a1', 'a2'] }] });
    const [a] = root.children;

    assert.equal(a.expandable, true);
    assert.equal(a.children, null);

    await prepareNode(a, {});
    assert.deepEqual(names(a.children), ['a1', 'a2']);
});

test('children may be a function returning a replacement item', async () => {
    const root = await prepared({ tree: [{ name: 'a', children: () => ({ name: 'renamed', value: 'A', short: 'SA', children: ['a1'] }) }] });
    const [a] = root.children;
    await prepareNode(a, {});

    assert.equal(nameFor(a), 'renamed');
    assert.equal(valueFor(a), 'A');
    assert.equal(shortFor(a), 'SA');
    assert.deepEqual(names(a.children), ['a1']);
});

test('a replacement item is validated again', async () => {
    const config = { validate: (value) => value === 'valid', tree: [{ name: 'a', value: 'invalid', children: () => ({ value: 'valid', children: [] }) }] };
    const root = await prepared(config);
    const [a] = root.children;

    assert.equal(a.isValid, false);
    await prepareNode(a, config);
    assert.equal(a.isValid, true);
});

test('children are only resolved once', async () => {
    let calls = 0;
    const root = await prepared({ tree: [{ name: 'a', children: () => { calls += 1; return ['a1']; } }] });
    const [a] = root.children;

    await prepareNode(a, {});
    await prepareNode(a, {});

    assert.equal(calls, 1);
    assert.deepEqual(names(a.children), ['a1']);
});

test('a failing children function is reported instead of swallowed', async () => {
    const boom = new Error('boom');
    const root = await prepared({ tree: [{ name: 'a', children: () => Promise.reject(boom) }] });
    const [a] = root.children;
    await prepareNode(a, {});

    assert.equal(a.error, boom);
    assert.equal(a.expandable, false);
    assert.equal(isLeaf(a), true);
});

test('validate runs on top level items', async () => {
    const config = { tree: ['x', 'y'], validate: (value) => value === 'x' };
    const root = await prepared(config);

    assert.deepEqual(root.children.map((node) => node.isValid), [true, false]);
});

test('validate runs at every depth', async () => {
    const config = { tree: [{ name: 'a', open: true, children: ['x', 'y'] }], validate: (value) => value !== 'y' };
    const root = await prepared(config);

    assert.deepEqual(root.children[0].children.map((node) => node.isValid), [true, false]);
});

test('nodes may declare their own validity', async () => {
    let calls = 0;
    const config = { tree: [{ name: 'a', isValid: true }], validate: () => { calls += 1; return false; } };
    const root = await prepared(config);

    assert.equal(root.children[0].isValid, true);
    assert.equal(calls, 0);
});

test('validity defaults to true when no validate is given', async () => {
    const root = await prepared({ tree: ['x'] });

    assert.equal(root.children[0].isValid, true);
});

test('onlyShowValid keeps invalid nodes that may hold valid children', async () => {
    const config = {
        tree: ['x', 'y', { name: 'branch', children: ['z'] }],
        validate: (value) => value === 'x',
        onlyShowValid: true,
    };
    const root = await prepared(config);

    assert.deepEqual(names(root.children), ['x', 'branch']);
});

test('hideChildrenOfValid turns valid nodes into leaves', async () => {
    const config = {
        tree: [{ name: 'a', children: ['a1'] }, { name: 'b', children: ['b1'] }],
        validate: (value) => value === 'a',
        hideChildrenOfValid: true,
    };
    const root = await prepared(config);
    const [a, b] = root.children;

    assert.equal(a.expandable, false);
    assert.equal(isLeaf(a), true);
    assert.equal(b.expandable, true);
});

test('isLeaf is false while children are still unresolved', async () => {
    const root = await prepared({ tree: [{ name: 'a', children: () => ['a1'] }] });
    const [a] = root.children;

    assert.equal(isLeaf(a), false);
    await prepareNode(a, {});
    assert.equal(isLeaf(a), false);
});

test('toggleSelection adds and removes a node', async () => {
    const root = await prepared({ tree: ['x'], multiple: true });
    const selection = new Set();
    const [x] = root.children;

    assert.equal(toggleSelection(x, selection), true);
    assert.deepEqual([...selection], [x]);
    assert.equal(toggleSelection(x, selection), true);
    assert.deepEqual([...selection], []);
});

test('toggleSelection refuses invalid nodes and branches', async () => {
    const config = { tree: ['x', { name: 'branch', open: true, children: ['z'] }], validate: (value) => value !== 'x' };
    const root = await prepared(config);
    const selection = new Set();
    const [x, branch] = root.children;

    assert.equal(toggleSelection(x, selection), false);
    assert.equal(toggleSelection(branch, selection), false);
    assert.equal(selection.size, 0);
});

test('the root follows the prompt level multiple option', async () => {
    const config = { tree: ['a', 'b'], multiple: true };
    const root = await prepared(config);
    const selection = new Set();

    toggleSelection(root.children[0], selection);
    toggleSelection(root.children[1], selection);

    assert.deepEqual(names([...selection]), ['a', 'b']);
});

test('siblings are exclusive unless their parent allows multiple', async () => {
    const config = { tree: [{ name: 'group', open: true, children: ['a', 'b'] }], multiple: true };
    const root = await prepared(config);
    const selection = new Set();
    const [a, b] = root.children[0].children;

    toggleSelection(a, selection);
    toggleSelection(b, selection);

    assert.deepEqual([...selection], [b]);
});

test('groups sharing a name stay independent', async () => {
    const config = {
        tree: [
            { name: 'group', open: true, children: ['a1', 'a2'] },
            { name: 'group', open: true, children: ['b1', 'b2'] },
        ],
        multiple: true,
    };
    const root = await prepared(config);
    const selection = new Set();

    toggleSelection(root.children[0].children[0], selection);
    toggleSelection(root.children[1].children[0], selection);

    assert.deepEqual(names([...selection]), ['a1', 'b1']);
});

test('a group may opt into multiple selections', async () => {
    const config = { tree: [{ name: 'group', multiple: true, open: true, children: ['a', 'b'] }] };
    const root = await prepared(config);
    const selection = new Set();

    toggleSelection(root.children[0].children[0], selection);
    toggleSelection(root.children[0].children[1], selection);

    assert.deepEqual(names([...selection]), ['a', 'b']);
});
