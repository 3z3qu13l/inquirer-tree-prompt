import cloneDeep from 'lodash/cloneDeep.js';
import chalk from 'chalk';
import figures from 'figures';
import cliCursor from 'cli-cursor';
import { fromEvent } from 'rxjs';
import { filter, share, map, takeUntil } from 'rxjs/operators';
import BasePrompt from 'inquirer/lib/prompts/base.js';
import observe from 'inquirer/lib/utils/events.js';
import Paginator from 'inquirer/lib/utils/paginator.js';

const _ = { cloneDeep };

export class TreePrompt extends BasePrompt {
    constructor(questions, rl, answers) {
        super(questions, rl, answers);

        this.done = () => {};
        this.firstRender = true;

        const tree = typeof this.opt.tree === 'function' ? this.opt.tree : _.cloneDeep(this.opt.tree);
        this.tree = { children: tree };

        this.shownList = [];
        this.opt = {
            pageSize: 10,
            multiple: false,
            ...this.opt
        };

        this.opt.default = null;
        this.paginator = new Paginator(this.screen, { isInfinite: this.opt.loop !== false });
        this.selectedList = [];
    }

    async _run(done) {
        this.done = done;
        this._installKeyHandlers();
        cliCursor.hide();
        await this.prepareChildrenAndRender(this.tree);

        // TODO: exit early somehow if no items
        // TODO: what about if there are no valid items?
        return this;
    }

    _installKeyHandlers() {
        const events = observe(this.rl);

        const getvalue = () => {
            const value = this.opt.multiple ? this.selectedList[0] : this.active;
            if (value) this.valueFor(value);
            return value;
        };

        const validation = this.handleSubmitEvents(
            events.line.pipe(map(getvalue))
        );
        validation.success.forEach(this.onSubmit.bind(this));
        validation.error.forEach(this.onError.bind(this));

        events.normalizedUpKey
            .pipe(takeUntil(validation.success))
            .forEach(this.onUpKey.bind(this));

        events.normalizedDownKey
            .pipe(takeUntil(validation.success))
            .forEach(this.onDownKey.bind(this));

        events.keypress
            .pipe(
                filter(({ key }) => key.name === 'right'),
                share()
            )
            .pipe(takeUntil(validation.success))
            .forEach(this.onRightKey.bind(this));

        events.keypress
            .pipe(
                filter(({ key }) => key.name === 'left'),
                share()
            )
            .pipe(takeUntil(validation.success))
            .forEach(this.onLeftKey.bind(this));

        events.spaceKey
            .pipe(takeUntil(validation.success))
            .forEach(this.onSpaceKey.bind(this));

        function normalizeKeypressEvents(value, key) {
            return { value, key: key || {} };
        }

        fromEvent(this.rl.input, 'keypress', normalizeKeypressEvents)
            .pipe(filter(({ key }) => key && key.name === 'tab'), share())
            .pipe(takeUntil(validation.success))
            .forEach(this.onTabKey.bind(this));
    }

    async prepareChildrenAndRender(node) {
        await this.prepareChildren(node);
        this.render();
    }

    async prepareChildren(node) {
        if (node.prepared) return;

        node.prepared = true;
        await this.runChildrenFunctionIfRequired(node);
        if (!node.children) return;

        this.cloneAndNormaliseChildren(node);
        await this.validateAndFilterDescendants(node);
    }

    async runChildrenFunctionIfRequired(node) {
        if (typeof node.children !== 'function') return;

        try {
            const nodeOrChildren = await node.children();
            if (!nodeOrChildren) return;

            let children;
            if (Array.isArray(nodeOrChildren)) {
                children = nodeOrChildren;
            } else {
                children = nodeOrChildren.children;
                ['name', 'value', 'short'].forEach((property) => {
                    node[property] = nodeOrChildren[property];
                });
                node.isValid = undefined;

                await this.addValidity(node);

                // Don't filter based on validity; children can be handled by the
                // callback itself if desired, and filtering out the node itself
                // would be a poor experience in this scenario.
            }

            node.children = _.cloneDeep(children);
        } catch (e) {
            node.children = null;
        }
    }

    cloneAndNormaliseChildren(node) {
        node.children = node.children.map((item) => ((typeof item !== 'object') ? { value: item } : item));
    }

    async validateAndFilterDescendants(node) {
        for (let index = node.children.length - 1; index >= 0; index -= 1) {
            const child = node.children[index];
            child.parent = node;
            await this.addValidity(child);

            if (this.opt.hideChildrenOfValid && child.isValid === true) {
                child.children = null;
            }

            if (this.opt.onlyShowValid && child.isValid !== true && !child.children) {
                node.children.splice(index, 1);
            }

            if (child.open) {
                await this.prepareChildren(child);
            }
        }
    }

    async addValidity(node) {
        if (typeof node.isValid !== 'undefined') return;
        if (this.opt.validate) {
            node.isValid = await this.opt.validate(this.valueFor(node), this.answers);
        } else {
            node.isValid = true;
        }
    }

    render(error) {
        let message = this.getQuestion();

        if (this.firstRender) {
            const hint = `Use arrow keys,${this.opt.multiple ? ' space to select,' : ''} enter to confirm.`;
            message += chalk.dim(`(${hint})`);
        }

        if (this.status === 'answered') {
            let answer;
            if (this.opt.multiple) {
                answer = this.selectedList.map((item) => this.shortFor(item, true)).join(', ');
            } else {
                answer = this.shortFor(this.active, true);
            }

            message += chalk.cyan(answer);
        } else {
            this.shownList = [];
            const treeContent = `${this.createTreeContent()}${this.opt.loop !== false ? '----------------' : ''}`;
            message += `\n${this.paginator.paginate(treeContent, this.shownList.indexOf(this.active), this.opt.pageSize)}`;
        }

        this.firstRender = false;

        const bottomContent = error ? `\n${chalk.red('>> ')}${error}` : undefined;
        this.screen.render(message, bottomContent);
    }

    createTreeContent(node = this.tree, indent = 2) {
        const children = node.children || [];
        let output = '';
        const isFinal = this.status === 'answered';

        children.forEach((child) => {
            this.shownList.push(child);
            if (!this.active) this.active = child;

            // eslint-disable-next-line no-nested-ternary
            let prefix = child.children
                ? child.open
                    ? `${figures.arrowDown} `
                    : `${figures.arrowRight} `
                : child === this.active
                    ? `${figures.pointer} `
                    : '  ';

            if (this.opt.multiple) {
                prefix += `${this.selectedList.includes(child) ? figures.radioOn : figures.radioOff} `;
            }

            const showValue = `${' '.repeat(indent)}${prefix}${this.nameFor(child, isFinal)}\n`;
            if (child === this.active) {
                output += (child.isValid === true) ? chalk.cyan(showValue) : chalk.red(showValue);
            } else {
                output += showValue;
            }

            if (child.open) {
                output += this.createTreeContent(child, indent + 2);
            }
        });

        return output;
    }

    shortFor(node, isFinal = false) {
        return typeof node.short !== 'undefined' ? node.short : this.nameFor(node, isFinal);
    }

    nameFor(node, isFinal = false) {
        if (typeof node.name !== 'undefined') return node.name;
        if (this.opt.transformer) return this.opt.transformer(node.value, this.answers, { isFinal });
        return node.value;
    }

    valueFor(node) {
        return typeof node.value !== 'undefined' ? node.value : node.name;
    }

    onError(state) {
        this.render(state.isValid);
    }

    onSubmit(state) {
        this.status = 'answered';
        this.render();
        this.screen.done();
        cliCursor.show();
        this.done(this.opt.multiple ? this.selectedList.map((item) => this.valueFor(item)) : state.value);
    }

    onUpKey() {
        this.moveActive(-1);
    }

    onDownKey() {
        this.moveActive(1);
    }

    onLeftKey() {
        if (this.active.children && this.active.open) {
            this.active.open = false;
        } else if (this.active.parent !== this.tree) {
            this.active = this.active.parent;
        }

        this.render();
    }

    onRightKey() {
        if (!this.active.children) return;

        if (!this.active.open) {
            this.active.open = true;
            this.prepareChildrenAndRender(this.active);
        } else if (this.active.children.length) {
            this.moveActive(1);
        }
    }

    moveActive(distance = 0) {
        const currentIndex = this.shownList.indexOf(this.active);
        let index = currentIndex + distance;

        if (index >= this.shownList.length) {
            if (this.opt.loop === false) return;
            index = 0;
        } else if (index < 0) {
            if (this.opt.loop === false) return;
            index = this.shownList.length - 1;
        }

        this.active = this.shownList[index];
        this.render();
    }

    onTabKey() {
        this.toggleOpen();
    }

    onSpaceKey() {
        if (this.opt.multiple) {
            this.toggleSelection();
        } else {
            this.toggleOpen();
        }
    }

    toggleSelection() {
        if (this.active.isValid !== true) return;
        if (this.active.children?.length) return;

        const selectedIndex = this.selectedList.indexOf(this.active);
        if (selectedIndex === -1) {
            // if !parent.multiple, remove all selected brothers before adding the active
            if (!this.active.parent?.multiple && this.active.parent?.children) {
                this.selectedList = this.selectedList.filter((elm) => elm.parent.name !== this.active.parent.name);
            }

            this.selectedList.push(this.active);
        } else {
            this.selectedList.splice(selectedIndex, 1);
        }

        this.render();
    }

    toggleOpen() {
        if (!this.active.children) return;

        this.active.open = !this.active.open;
        this.render();
    }
}

export default TreePrompt;
