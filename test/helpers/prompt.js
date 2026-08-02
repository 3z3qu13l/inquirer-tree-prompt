import { PassThrough } from 'node:stream';
import { stripVTControlCharacters } from 'node:util';
import { treePrompt } from '../../index.js';

class Output extends PassThrough {
    constructor({ columns = 80, rows = 30 } = {}) {
        super();
        this.columns = columns;
        this.rows = rows;
    }
}

export const keys = {
    up: '[A',
    down: '[B',
    right: '[C',
    left: '[D',
    enter: '\r',
    space: ' ',
    tab: '\t',
};

/** Let pending timers, effects and promises settle before looking at the screen. */
export function tick(ms = 10) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

const QUIET = 15;
const TIMEOUT = 5000;

/** Waits until a predicate holds, rather than for an arbitrary delay. */
async function until(predicate, timeout = TIMEOUT) {
    const deadline = Date.now() + timeout;
    while (!predicate() && Date.now() < deadline) await tick(5);
}

function clean(frame) {
    return stripVTControlCharacters(frame)
        .split('\n')
        .map((line) => line.trimEnd())
        .join('\n')
        .replace(/^\n+|\n+$/g, '');
}

/**
 * Run the prompt against in memory streams.
 *
 * Returns the answer promise, a `screen()` accessor returning the last rendered
 * frame without ANSI codes, and helpers to send keys.
 */
export async function render(config, terminal) {
    const input = new PassThrough();
    const output = new Output(terminal);
    const frames = [];
    output.on('data', (chunk) => frames.push(chunk.toString()));

    const answer = treePrompt(config, { input, output });
    // Tests that never confirm would otherwise trigger an unhandled rejection.
    answer.catch(() => {});

    const screen = () => {
        for (let i = frames.length - 1; i >= 0; i--) {
            const frame = clean(frames[i]);
            if (frame !== '') return frame;
        }
        return '';
    };

    // Waits for the rendering to stop changing: a single keypress may paint
    // several frames, and a cold start may take a while on a slow machine.
    const settle = async () => {
        const deadline = Date.now() + TIMEOUT;
        let previous = -1;
        while (Date.now() < deadline) {
            if (frames.length > 0 && frames.length === previous) return;
            previous = frames.length;
            await tick(QUIET);
        }
    };

    await settle();
    await until(() => !screen().includes('Loading…'));

    return {
        answer,
        frames,
        screen,
        rawScreen() {
            for (let i = frames.length - 1; i >= 0; i--) {
                if (clean(frames[i]) !== '') return frames[i];
            }
            return '';
        },
        async press(...sequence) {
            for (const key of sequence) {
                input.write(key);
                await settle();
            }
        },
        close() {
            answer.cancel();
            return answer.catch(() => {});
        },
    };
}
