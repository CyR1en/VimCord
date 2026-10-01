const PLUGIN_NAME = 'VimCord';

export const DEFAULT_SCROLL_AMOUNT = 80;
export const DEFAULT_KEYBINDS = Object.freeze({
    hint: 'f',
    paneLeft: 'h',
    paneRight: 'l',
    scrollDown: 'j',
    scrollUp: 'k',
    halfPageDown: 'd',
    halfPageUp: 'u',
    insert: 'i',
});

export const KEYBIND_LABELS = Object.freeze({
    hint: 'Hint mode (click elements)',
    paneLeft: 'Focus pane to the left',
    paneRight: 'Focus pane to the right',
    scrollDown: 'Scroll down',
    scrollUp: 'Scroll up',
    halfPageDown: 'Half page down',
    halfPageUp: 'Half page up',
    insert: 'Insert mode (focus input)',
});

const ACTIONS = Object.keys(DEFAULT_KEYBINDS);
const HALF_PAGE_ACTIONS = new Set(['halfPageDown', 'halfPageUp']);

function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isBindableKey(key) {
    return typeof key === 'string' && /^[\p{L}\p{N}\p{P}\p{S} ]$/u.test(key);
}

function effectiveKeys(action, key) {
    const keys = [key];
    const uppercase = key.toUpperCase();
    if (HALF_PAGE_ACTIONS.has(action) && uppercase !== key && isBindableKey(uppercase)) {
        keys.push(uppercase);
    }
    return keys;
}

function findConflict(keybinds) {
    const assigned = new Map();
    for (const action of ACTIONS) {
        for (const key of effectiveKeys(action, keybinds[action])) {
            if (assigned.has(key)) {
                return { key, first: assigned.get(key), second: action };
            }
            assigned.set(key, action);
        }
    }
    return null;
}

function normalizeScrollAmount(raw) {
    if (
        (typeof raw !== 'number' && typeof raw !== 'string') ||
        (typeof raw === 'string' && !raw.trim())
    ) {
        throw new Error('Enter a number of pixels between 10 and 1000.');
    }
    const amount = Number(raw);
    if (!Number.isFinite(amount)) {
        throw new Error('Enter a number of pixels between 10 and 1000.');
    }
    return Math.min(1000, Math.max(10, Math.round(amount)));
}

function normalizeKeybinds(saved) {
    const keybinds = { ...DEFAULT_KEYBINDS };
    if (isRecord(saved)) {
        for (const action of ACTIONS) {
            if (Object.hasOwn(saved, action) && isBindableKey(saved[action])) {
                keybinds[action] = saved[action];
            }
        }
    }
    if (findConflict(keybinds)) {
        return DEFAULT_KEYBINDS;
    }
    return Object.freeze(keybinds);
}

export class PluginSettings {
    constructor(storage = BdApi.Data) {
        this.storage = storage;
        const saved = this.load('settings');
        const savedKeybinds =
            isRecord(saved) && Object.hasOwn(saved, 'keybinds')
                ? saved.keybinds
                : this.load('keybinds');
        let scrollAmount = DEFAULT_SCROLL_AMOUNT;
        if (isRecord(saved) && Object.hasOwn(saved, 'scrollAmount')) {
            try {
                scrollAmount = normalizeScrollAmount(saved.scrollAmount);
            } catch {
                scrollAmount = DEFAULT_SCROLL_AMOUNT;
            }
        }
        this.current = { scrollAmount, keybinds: normalizeKeybinds(savedKeybinds) };
    }

    get scrollAmount() {
        return this.current.scrollAmount;
    }

    get keybinds() {
        return this.current.keybinds;
    }

    load(key) {
        try {
            return this.storage.load(PLUGIN_NAME, key);
        } catch (error) {
            console.error(`[VimCord] Failed to load ${key}`, error);
            return undefined;
        }
    }

    save(next) {
        try {
            this.storage.save(PLUGIN_NAME, 'settings', {
                scrollAmount: next.scrollAmount,
                keybinds: { ...next.keybinds },
            });
        } catch (error) {
            const reason = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to save VimCord settings: ${reason}`, { cause: error });
        }
        this.current = next;
    }

    actionForKey(key) {
        return ACTIONS.find((action) => effectiveKeys(action, this.keybinds[action]).includes(key));
    }

    setScrollAmount(raw) {
        const scrollAmount = normalizeScrollAmount(raw);
        this.save({ scrollAmount, keybinds: this.keybinds });
        return scrollAmount;
    }

    setKeybind(action, key) {
        if (!Object.hasOwn(DEFAULT_KEYBINDS, action)) {
            throw new Error('Unknown VimCord action.');
        }
        if (!isBindableKey(key)) {
            throw new Error('Use one visible character or Space for a keybind.');
        }
        const keybinds = { ...this.keybinds, [action]: key };
        const conflict = findConflict(keybinds);
        if (conflict) {
            const otherAction = conflict.first === action ? conflict.second : conflict.first;
            const displayKey = conflict.key === ' ' ? 'Space' : conflict.key;
            throw new Error(`"${displayKey}" is already used for: ${KEYBIND_LABELS[otherAction]}.`);
        }
        this.save({ scrollAmount: this.scrollAmount, keybinds: Object.freeze(keybinds) });
    }

    reset() {
        this.save({ scrollAmount: DEFAULT_SCROLL_AMOUNT, keybinds: DEFAULT_KEYBINDS });
    }
}
