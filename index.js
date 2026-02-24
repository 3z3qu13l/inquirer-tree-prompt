import { createPrompt, useState, useKeypress, usePagination, usePrefix, useRef, isEnterKey, isUpKey, isDownKey, isSpaceKey } from '@inquirer/core';
import figures from 'figures';
import colors from 'yoctocolors';

function valueFor(node) {
    return node.value !== undefined ? node.value : node.name;
}

function shortFor(node) {
    if (node.short !== undefined) return node.short;
    if (node.name !== undefined) return node.name;
    return node.value;
}

function nameFor(node, config) {
    if (node.name !== undefined) return node.name;
    if (config?.transformer) return config.transformer(node.value, {}, { isFinal: false });
    return node.value;
}

// Synchronous tree preparation (handles static trees)
function prepareNode(node, config) {
    if (node.prepared) return;
    node.prepared = true;

    if (typeof node.children === 'function') return;
    if (!node.children) return;

    node.children = node.children.map((item) => (typeof item !== 'object' ? { value: item } : item));

    for (let i = node.children.length - 1; i >= 0; i--) {
        const child = node.children[i];
        child.parent = node;

        if (child.isValid === undefined) {
            child.isValid = config?.validate ? undefined : true;
        }

        if (config?.hideChildrenOfValid && child.isValid === true) {
            child.children = null;
        }
        if (config?.onlyShowValid && child.isValid !== true && !child.children) {
            node.children.splice(i, 1);
            continue;
        }

        if (child.open) {
            prepareNode(child, config);
        }
    }
}

// Async tree preparation (for function children and async validate)
async function prepareNodeAsync(node, config) {
    if (node.prepared) return;
    node.prepared = true;

    if (typeof node.children === 'function') {
        try {
            const result = await node.children();
            if (!result) return;
            if (Array.isArray(result)) {
                node.children = structuredClone(result);
            } else {
                node.children = structuredClone(result.children);
                for (const prop of ['name', 'value', 'short']) {
                    if (result[prop] !== undefined) node[prop] = result[prop];
                }
                node.isValid = undefined;
            }
        } catch {
            node.children = null;
            return;
        }
    }

    if (!node.children) return;

    node.children = node.children.map((item) => (typeof item !== 'object' ? { value: item } : item));

    for (let i = node.children.length - 1; i >= 0; i--) {
        const child = node.children[i];
        child.parent = node;

        if (child.isValid === undefined) {
            if (config?.validate) {
                child.isValid = await config.validate(valueFor(child));
            } else {
                child.isValid = true;
            }
        }

        if (config?.hideChildrenOfValid && child.isValid === true) {
            child.children = null;
        }
        if (config?.onlyShowValid && child.isValid !== true && !child.children) {
            node.children.splice(i, 1);
            continue;
        }

        if (child.open) {
            await prepareNodeAsync(child, config);
        }
    }
}

function flattenTree(node, depth = 0) {
    const result = [];
    for (const child of node.children || []) {
        child._depth = depth;
        result.push(child);
        if (child.open && child.children) {
            result.push(...flattenTree(child, depth + 1));
        }
    }
    return result;
}

function toggleSelection(node, selectedList) {
    if (node.isValid !== true) return;
    if (node.children?.length) return;

    const idx = selectedList.current.indexOf(node);
    if (idx === -1) {
        if (!node.parent?.multiple && node.parent?.children) {
            selectedList.current = selectedList.current.filter((elm) => elm.parent?.name !== node.parent?.name);
        }
        selectedList.current.push(node);
    } else {
        selectedList.current.splice(idx, 1);
    }
}

export const treePrompt = createPrompt((config, done) => {
    const { message, tree: treeInput, multiple = false, pageSize = 10, loop = true } = config;

    const treeRoot = useRef(null);
    const selectedList = useRef([]);
    const showHint = useRef(true);
    const activeRef = useRef(null);
    const [status, setStatus] = useState('pending');
    const [, setRenderKey] = useState(0);
    const prefix = usePrefix({ status: status === 'answered' ? 'done' : 'idle' });

    const rerender = () => setRenderKey(Date.now());

    // Initialize tree on first render
    if (treeRoot.current === null) {
        const data = typeof treeInput === 'function' ? treeInput : structuredClone(treeInput);
        treeRoot.current = { children: data };
        prepareNode(treeRoot.current, config);
    }

    const items = flattenTree(treeRoot.current);

    if (activeRef.current === null && items.length > 0) {
        activeRef.current = items[0];
    }

    let activeIndex = items.indexOf(activeRef.current);
    if (activeIndex < 0 && items.length > 0) {
        activeRef.current = items[0];
        activeIndex = 0;
    }

    useKeypress(async (key) => {
        if (status === 'answered' || items.length === 0) return;

        const active = activeRef.current;

        if (isEnterKey(key)) {
            setStatus('answered');
            if (multiple) {
                done(selectedList.current.map(valueFor));
            } else {
                done(valueFor(active));
            }
            return;
        }

        if (isUpKey(key)) {
            let idx = activeIndex - 1;
            if (idx < 0) {
                if (loop === false) return;
                idx = items.length - 1;
            }
            activeRef.current = items[idx];
            rerender();
            return;
        }

        if (isDownKey(key)) {
            let idx = activeIndex + 1;
            if (idx >= items.length) {
                if (loop === false) return;
                idx = 0;
            }
            activeRef.current = items[idx];
            rerender();
            return;
        }

        if (key.name === 'left') {
            if (active.children && active.open) {
                active.open = false;
            } else if (active.parent && active.parent !== treeRoot.current) {
                activeRef.current = active.parent;
            }
            rerender();
            return;
        }

        if (key.name === 'right') {
            if (!active.children) {
                if (multiple) {
                    toggleSelection(active, selectedList);
                    rerender();
                }
                return;
            }
            if (!active.open) {
                active.open = true;
                await prepareNodeAsync(active, config);
                rerender();
            } else if (active.children.length) {
                activeRef.current = items[activeIndex + 1];
                rerender();
            }
            return;
        }

        if (isSpaceKey(key)) {
            if (multiple) {
                toggleSelection(active, selectedList);
            } else if (active.children) {
                active.open = !active.open;
                if (active.open) await prepareNodeAsync(active, config);
            }
            rerender();
            return;
        }

        if (key.name === 'tab') {
            if (active.children) {
                active.open = !active.open;
                if (active.open) await prepareNodeAsync(active, config);
                rerender();
            }
        }
    });

    // Always call usePagination (hooks must be called unconditionally)
    const page = usePagination({
        items: items.length > 0 ? items : [{ _depth: 0, name: 'No items', isValid: true }],
        active: activeIndex >= 0 ? activeIndex : 0,
        renderItem({ item, isActive }) {
            const indent = ' '.repeat((item._depth + 1) * 2);

            let pfx = item.children
                ? item.open
                    ? `${figures.arrowDown} `
                    : `${figures.arrowRight} `
                : isActive
                    ? `${figures.pointer} `
                    : '  ';

            if (multiple) {
                pfx += `${selectedList.current.includes(item) ? figures.radioOn : figures.radioOff} `;
            }

            const name = nameFor(item, config);
            const line = `${indent}${pfx}${name}`;

            if (isActive) {
                return item.isValid === true ? colors.cyan(line) : colors.red(line);
            }
            return line;
        },
        pageSize,
        loop: loop !== false,
    });

    if (status === 'answered') {
        let answer;
        if (multiple) {
            answer = selectedList.current.map((n) => shortFor(n)).join(', ');
        } else {
            answer = activeRef.current ? shortFor(activeRef.current) : '';
        }
        return `${prefix} ${message} ${colors.cyan(answer)}`;
    }

    let header = `${prefix} ${message}`;
    if (showHint.current) {
        showHint.current = false;
        const hint = `Use arrow keys,${multiple ? ' space to select,' : ''} enter to confirm.`;
        header += ` ${colors.dim(`(${hint})`)}`;
    }

    const separator = loop !== false ? '\n----------------' : '';
    return `${header}\n${page}${separator}`;
});

export default treePrompt;
