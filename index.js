import { createPrompt, useState, useEffect, useKeypress, usePagination, usePrefix, useRef, isEnterKey, isUpKey, isDownKey, isSpaceKey, isTabKey } from '@inquirer/core';
import figures from 'figures';
import colors from 'yoctocolors';
import { createRoot, prepareNode, flattenTree, toggleSelection, isLeaf, valueFor, shortFor, nameFor } from './lib/tree.js';

const SEPARATOR = '----------------';
const PLACEHOLDER = { raw: { name: 'No items' }, depth: 0, isValid: true, expandable: false };

export const treePrompt = createPrompt((config, done) => {
    const { message, multiple = false, pageSize = 10, loop = true } = config;

    const rootRef = useRef(null);
    const selection = useRef(new Set());
    const activeRef = useRef(null);
    const showHint = useRef(true);
    const renderCount = useRef(0);
    const errorRef = useRef(null);
    const rlRef = useRef(null);
    const [status, setStatus] = useState('pending');
    const [loading, setLoading] = useState(true);
    const [, setRenderKey] = useState(0);
    const prefix = usePrefix({ status: status === 'answered' ? 'done' : 'idle' });

    if (rootRef.current === null) rootRef.current = createRoot(config);

    const rerender = () => setRenderKey(++renderCount.current);

    // Keypress handlers and effects run outside the render, where a rejection
    // would go unhandled: errors are rethrown on the next render instead, which
    // rejects the prompt.
    const fail = (error) => {
        errorRef.current = error;
        rerender();
    };

    // The root may be a function, and initially open nodes may have to be
    // resolved, so the tree is always loaded asynchronously.
    useEffect((rl) => {
        // Kept to read the terminal height, which the page is capped to.
        rlRef.current = rl;
        prepareNode(rootRef.current, config).then(() => setLoading(false), fail);
    }, []);

    const items = flattenTree(rootRef.current);

    if (!items.includes(activeRef.current)) activeRef.current = items[0] ?? null;
    const activeIndex = Math.max(items.indexOf(activeRef.current), 0);

    const finish = async (answer) => {
        setStatus('answered');
        done(config.filter ? await config.filter(answer) : answer);
    };

    const expand = async (node) => {
        node.open = true;
        if (node.prepared || node.loading) {
            rerender();
            return;
        }
        node.loading = true;
        rerender();
        try {
            await prepareNode(node, config);
        } finally {
            node.loading = false;
            rerender();
        }
    };

    const handleKey = async (key) => {
        if (status === 'answered' || loading) return;

        // The list is rebuilt on every keypress: an expansion awaited in a
        // previous keypress may have changed it since this render.
        const list = flattenTree(rootRef.current);
        const active = activeRef.current;

        if (isEnterKey(key)) {
            if (multiple) {
                await finish([...selection.current].map(valueFor));
            } else if (active === null) {
                // Nothing selectable (everything filtered out by onlyShowValid);
                // resolve rather than trapping the user in the prompt.
                await finish(undefined);
            } else if (active.isValid === true) {
                await finish(valueFor(active));
            }
            return;
        }

        if (active === null) return;

        if (isUpKey(key)) {
            let index = list.indexOf(active) - 1;
            if (index < 0) {
                if (loop === false) return;
                index = list.length - 1;
            }
            activeRef.current = list[index];
            rerender();
            return;
        }

        if (isDownKey(key)) {
            let index = list.indexOf(active) + 1;
            if (index >= list.length) {
                if (loop === false) return;
                index = 0;
            }
            activeRef.current = list[index];
            rerender();
            return;
        }

        if (key.name === 'left') {
            if (active.expandable && active.open) {
                active.open = false;
            } else if (active.parent && active.parent !== rootRef.current) {
                activeRef.current = active.parent;
            }
            rerender();
            return;
        }

        if (key.name === 'right') {
            if (!active.expandable) {
                if (multiple && toggleSelection(active, selection.current)) rerender();
                return;
            }
            if (!active.open) {
                await expand(active);
                return;
            }
            const next = list[list.indexOf(active) + 1];
            if (next?.parent === active) {
                activeRef.current = next;
                rerender();
            }
            return;
        }

        if (isSpaceKey(key) && multiple && isLeaf(active)) {
            toggleSelection(active, selection.current);
            rerender();
            return;
        }

        if (isSpaceKey(key) || isTabKey(key)) {
            if (!active.expandable) return;
            if (active.open) {
                active.open = false;
                rerender();
            } else {
                await expand(active);
            }
        }
    };

    useKeypress(async (key) => {
        try {
            await handleKey(key);
        } catch (error) {
            fail(error);
        }
    });

    let header = `${prefix} ${message}`;
    if (showHint.current && !loading) {
        showHint.current = false;
        const hint = `Use arrow keys,${multiple ? ' space to select,' : ''} enter to confirm.`;
        header += ` ${colors.dim(`(${hint})`)}`;
    }
    const separator = loop !== false ? `\n${SEPARATOR}` : '';

    // usePagination counts lines, not items, so a multi line item takes several
    // rows off the page. Cap the page to what the terminal can display, keeping
    // room for the header, the separator and the line the cursor rests on:
    // otherwise the terminal scrolls and the active item ends up out of sight.
    const rows = rlRef.current?.output?.rows;
    const reserved = header.split('\n').length + (separator === '' ? 0 : 1) + 1;
    const pageHeight = typeof rows === 'number' && rows > 0
        ? Math.max(1, Math.min(pageSize, rows - reserved))
        : pageSize;

    // Hooks must be called unconditionally, hence the placeholder.
    const page = usePagination({
        items: items.length > 0 ? items : [PLACEHOLDER],
        active: activeIndex,
        renderItem({ item, isActive }) {
            const indent = ' '.repeat((item.depth + 1) * 2);

            let pfx = item.expandable
                ? item.open
                    ? `${figures.arrowDown} `
                    : `${figures.arrowRight} `
                : isActive
                    ? `${figures.pointer} `
                    : '  ';

            if (multiple) {
                pfx += `${selection.current.has(item) ? figures.radioOn : figures.radioOff} `;
            }

            // A name may span several lines; the extra ones are aligned under
            // the first so they read as part of the same item.
            const [head, ...rest] = String(nameFor(item, config)).split('\n');
            let first = `${indent}${pfx}${head}`;
            if (item.loading) first += ` ${colors.dim('…')}`;
            if (item.error) first += ` ${colors.dim('(failed to load)')}`;

            const continuation = ' '.repeat(indent.length + pfx.length);
            const lines = [first, ...rest.map((line) => `${continuation}${line}`)];

            if (isActive) {
                const paint = item.isValid === true ? colors.cyan : colors.red;
                return lines.map((line) => paint(line)).join('\n');
            }
            return lines.join('\n');
        },
        pageSize: pageHeight,
        loop: loop !== false,
    });

    // Rejects the prompt with errors raised by validate, filter or a children
    // function outside of the render.
    if (errorRef.current) throw errorRef.current;

    if (status === 'answered') {
        const answer = multiple
            ? [...selection.current].map(shortFor).join(', ')
            : activeRef.current ? shortFor(activeRef.current) : '';
        return `${prefix} ${message} ${colors.cyan(answer)}`;
    }

    if (loading) return `${header}\n  ${colors.dim('Loading…')}`;

    return `${header}\n${page}${separator}`;
});

export default treePrompt;
