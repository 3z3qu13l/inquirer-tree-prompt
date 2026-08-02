/**
 * Internal tree model.
 *
 * The prompt never mutates the tree it is given: every item provided by the
 * caller is wrapped in an internal node holding the display/selection state,
 * and the original item is kept untouched in `raw`. This also means trees
 * containing functions (lazy `children`) are supported, which a structured
 * clone of the input could never be.
 *
 * Internal node shape:
 *   raw        the caller's item ({ value } when a bare string was given)
 *   parent     parent node, or null for the root
 *   depth      0 for top level items
 *   open       whether children are shown
 *   expandable whether the node has (or may lazily produce) children
 *   children   array of nodes once prepared, otherwise null
 *   prepared   whether children have been resolved
 *   loading    whether children are currently being resolved
 *   error      error thrown by a `children` function, if any
 *   isValid    result of `validate`, true when no validation is configured
 *   multiple   whether this node's children may be selected together
 */

export function buildNode(raw, parent = null, depth = 0) {
    const data = raw !== null && typeof raw === 'object' ? raw : { value: raw };

    return {
        raw: data,
        parent,
        depth,
        open: Boolean(data.open),
        expandable: data.children !== undefined && data.children !== null,
        children: null,
        prepared: false,
        loading: false,
        error: null,
        isValid: data.isValid,
        multiple: data.multiple,
    };
}

export function createRoot(config = {}) {
    const root = buildNode({ children: config.tree }, null, -1);
    root.multiple = config.multiple === true;
    root.isValid = true;
    return root;
}

export function valueFor(node) {
    const { value, name } = node.raw;
    return value !== undefined ? value : name;
}

export function shortFor(node) {
    const { short, name, value } = node.raw;
    if (short !== undefined) return short;
    if (name !== undefined) return name;
    return value;
}

export function nameFor(node, config) {
    const { name, value } = node.raw;
    if (name !== undefined) return name;
    if (config?.transformer) return config.transformer(value, {}, { isFinal: false });
    return value;
}

/** A node can only be selected once it is known to have no children of its own. */
export function isLeaf(node) {
    if (!node.expandable) return true;
    return node.prepared && (node.children === null || node.children.length === 0);
}

/**
 * Resolve a node's children, validating and filtering them according to the
 * config. This is the single preparation path: it handles static arrays,
 * `children` functions returning an array, and `children` functions returning
 * a replacement item.
 */
export async function prepareNode(node, config = {}) {
    if (node.prepared) return node;
    node.prepared = true;

    let source = node.raw.children;

    if (typeof source === 'function') {
        try {
            const result = await source();

            if (Array.isArray(result)) {
                source = result;
            } else if (result !== null && typeof result === 'object') {
                // The function may return a replacement item rather than just a
                // list of children, in which case its own properties change too.
                const replacement = {};
                for (const prop of ['name', 'value', 'short']) {
                    if (result[prop] !== undefined) replacement[prop] = result[prop];
                }
                node.raw = { ...node.raw, ...replacement };
                source = result.children;

                // The node's value may have changed, so its validity has to be
                // established again.
                if (config.validate && replacement.value !== undefined) {
                    node.isValid = await config.validate(valueFor(node));
                }
            } else {
                source = null;
            }
        } catch (error) {
            node.error = error;
            node.children = null;
            node.expandable = false;
            return node;
        }
    }

    if (!source) {
        node.children = null;
        node.expandable = false;
        return node;
    }

    const children = source.map((item) => buildNode(item, node, node.depth + 1));

    await Promise.all(children.map(async (child) => {
        if (child.isValid !== undefined) return;
        child.isValid = config.validate ? await config.validate(valueFor(child)) : true;
    }));

    for (const child of children) {
        if (config.hideChildrenOfValid && child.isValid === true) {
            child.expandable = false;
            child.children = null;
            child.prepared = true;
        }
    }

    node.children = config.onlyShowValid
        ? children.filter((child) => child.isValid === true || child.expandable)
        : children;

    await Promise.all(node.children
        .filter((child) => child.open && child.expandable)
        .map((child) => prepareNode(child, config)));

    return node;
}

/** Depth first list of every currently visible node. */
export function flattenTree(node, result = []) {
    for (const child of node.children || []) {
        result.push(child);
        if (child.open && child.children) flattenTree(child, result);
    }
    return result;
}

/**
 * Add or remove a node from the selection. Siblings are mutually exclusive
 * unless their parent opted in with `multiple: true` (the root node inherits
 * the prompt level `multiple` option).
 *
 * Returns whether the selection changed.
 */
export function toggleSelection(node, selection) {
    if (node.isValid !== true) return false;
    if (!isLeaf(node)) return false;

    if (selection.has(node)) {
        selection.delete(node);
        return true;
    }

    if (node.parent?.multiple !== true) {
        for (const selected of selection) {
            if (selected.parent === node.parent) selection.delete(selected);
        }
    }

    selection.add(node);
    return true;
}
