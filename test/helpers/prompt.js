import { PassThrough } from 'node:stream';
import { stripVTControlCharacters } from 'node:util';
import { treePrompt } from '../../index.js';

/** ScreenManager reads `columns` off the output stream to wrap lines. */
class Output extends PassThrough {
    columns = 80;
    rows = 30;
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
export async function render(config) {
    const input = new PassThrough();
    const output = new Output();
    const frames = [];
    output.on('data', (chunk) => frames.push(chunk.toString()));

    const answer = treePrompt(config, { input, output });
    // Tests that never confirm would otherwise trigger an unhandled rejection.
    answer.catch(() => {});

    await tick();

    return {
        answer,
        frames,
        screen() {
            for (let i = frames.length - 1; i >= 0; i--) {
                const frame = clean(frames[i]);
                if (frame !== '') return frame;
            }
            return '';
        },
        async press(...sequence) {
            for (const key of sequence) {
                input.write(key);
                await tick();
            }
        },
        close() {
            answer.cancel();
            return answer.catch(() => {});
        },
    };
}
