const PLUGIN_NAME = 'VimCord';

export const DEFAULT_SCROLL_AMOUNT = 80;
export const DEFAULT_FOCUS_OUTLINE_FADE_DELAY = 3;
export const DEFAULT_KEYBINDS = Object.freeze({
    hint: 'f',
    paneLeft: 'h',
    paneRight: 'l',
    scrollDown: 'j',
    scrollUp: 'k',
    halfPageDown: 'd',
    halfPageUp: 'u',
    insert: 'i',
    hintAll: 'F',
    visual: 'v',
    copyMessage: 'y',
    replyMessage: 'r',
    jumpTop: 'g',
    jumpBottom: 'G',
    setMark: 'm',
    jumpMark: "'",
    help: '?',
    range: 'V',
    historyBack: 'H',
    historyForward: 'L',
    manageMarks: 'M',
    editMessage: 'e',
    reactMessage: '+',
    copyMessageLink: 'Y',
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
    hintAll: 'Hints across the foreground view',
    visual: 'Message selection mode',
    copyMessage: 'Copy selected message',
    replyMessage: 'Reply to selected message',
    jumpTop: 'Go to top (press twice)',
    jumpBottom: 'Go to bottom / latest messages',
    setMark: 'Set channel mark (then a–z)',
    jumpMark: 'Jump to channel mark (then a–z)',
    help: 'Show contextual help',
    range: 'Select a message range',
    historyBack: 'Previous reading position',
    historyForward: 'Next reading position',
    manageMarks: 'Manage saved marks',
    editMessage: 'Edit selected message',
    reactMessage: 'Add a reaction to selected message',
    copyMessageLink: 'Copy selected message link',
});

export const EXTRA_PREFERENCES = Object.freeze({
    showSequenceHints: 'Show key-sequence hints',
    rangeCopyAuthors: 'Include author names when copying a range',
    rangeCopyTimestamps: 'Include timestamps when copying a range',
});
const EXTRA_DEFAULTS = {
    showSequenceHints: true,
    rangeCopyAuthors: true,
    rangeCopyTimestamps: false,
};

const ACTIONS = Object.keys(DEFAULT_KEYBINDS);
const HALF_PAGE_ACTIONS = new Set(['halfPageDown', 'halfPageUp']);
const NEW_ACTIONS = new Set([
    'hintAll',
    'visual',
    'copyMessage',
    'replyMessage',
    'jumpTop',
    'jumpBottom',
    'setMark',
    'jumpMark',
    'help',
    'range',
    'historyBack',
    'historyForward',
    'manageMarks',
    'editMessage',
    'reactMessage',
    'copyMessageLink',
]);

function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isBindableKey(key) {
    return (
        typeof key === 'string' && /^[\p{L}\p{N}\p{P}\p{S} ]$/u.test(key) && !/^[0-9]$/.test(key)
    );
}

function effectiveKeys(action, key) {
    if (!key) {
        return [];
    }
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

function normalizeFocusOutlineFadeDelay(raw) {
    if (
        (typeof raw !== 'number' && typeof raw !== 'string') ||
        (typeof raw === 'string' && !raw.trim()) ||
        !Number.isFinite(Number(raw))
    ) {
        throw new Error('Enter a number of seconds between 0.5 and 60.');
    }
    return Math.min(60, Math.max(0.5, Math.round(Number(raw) * 2) / 2));
}

function normalizeKeybinds(saved) {
    const keybinds = { ...DEFAULT_KEYBINDS };
    if (isRecord(saved)) {
        for (const action of ACTIONS) {
            if (
                Object.hasOwn(saved, action) &&
                ((saved[action] === null && NEW_ACTIONS.has(action)) ||
                    isBindableKey(saved[action]))
            ) {
                keybinds[action] = saved[action];
            }
        }
    }
    let conflict = findConflict(keybinds);
    while (conflict) {
        const firstSaved = isRecord(saved) && isBindableKey(saved[conflict.first]);
        const secondSaved = isRecord(saved) && isBindableKey(saved[conflict.second]);
        if (firstSaved === secondSaved) {
            return DEFAULT_KEYBINDS;
        }
        const unassigned = firstSaved ? conflict.second : conflict.first;
        if (!NEW_ACTIONS.has(unassigned)) {
            return DEFAULT_KEYBINDS;
        }
        // Adding a default must not silently take over an existing custom binding.
        keybinds[unassigned] = null;
        conflict = findConflict(keybinds);
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
        const showFocusOutline =
            isRecord(saved) && typeof saved.showFocusOutline === 'boolean'
                ? saved.showFocusOutline
                : true;
        let focusOutlineFadeDelay = DEFAULT_FOCUS_OUTLINE_FADE_DELAY;
        if (isRecord(saved) && Object.hasOwn(saved, 'focusOutlineFadeDelay')) {
            try {
                focusOutlineFadeDelay = normalizeFocusOutlineFadeDelay(saved.focusOutlineFadeDelay);
            } catch {
                focusOutlineFadeDelay = DEFAULT_FOCUS_OUTLINE_FADE_DELAY;
            }
        }
        this.current = {
            scrollAmount,
            keybinds: normalizeKeybinds(savedKeybinds),
            showFocusOutline,
            focusOutlineFadeDelay,
            hintsCurrentPane:
                isRecord(saved) && typeof saved.hintsCurrentPane === 'boolean'
                    ? saved.hintsCurrentPane
                    : true,
            ...Object.fromEntries(
                Object.entries(EXTRA_DEFAULTS).map(([key, value]) => [
                    key,
                    isRecord(saved) && typeof saved[key] === 'boolean' ? saved[key] : value,
                ]),
            ),
        };
    }

    get scrollAmount() {
        return this.current.scrollAmount;
    }

    get keybinds() {
        return this.current.keybinds;
    }

    get showFocusOutline() {
        return this.current.showFocusOutline;
    }

    get focusOutlineFadeDelay() {
        return this.current.focusOutlineFadeDelay;
    }

    get hintsCurrentPane() {
        return this.current.hintsCurrentPane;
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
                showFocusOutline: next.showFocusOutline,
                focusOutlineFadeDelay: next.focusOutlineFadeDelay,
                hintsCurrentPane: next.hintsCurrentPane,
                ...Object.fromEntries(Object.keys(EXTRA_DEFAULTS).map((key) => [key, next[key]])),
            });
        } catch (error) {
            const reason = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to save VimCord settings: ${reason}`, { cause: error });
        }
        this.current = next;
    }

    actionForKey(key, mode = 'normal') {
        return ACTIONS.find(
            (action) =>
                actionsForMode(mode).includes(action) &&
                effectiveKeys(action, this.keybinds[action]).includes(key),
        );
    }

    helpKeyForMode(mode) {
        const key = this.keybinds.help;
        // Hint letters must remain selectable even when Help is mapped to a letter.
        return mode === 'hint' && (!key || /^[a-z]$/i.test(key)) ? '?' : key;
    }

    setScrollAmount(raw) {
        const scrollAmount = normalizeScrollAmount(raw);
        this.save({ ...this.current, scrollAmount });
        return scrollAmount;
    }

    setKeybind(action, key) {
        if (!Object.hasOwn(DEFAULT_KEYBINDS, action)) {
            throw new Error('Unknown VimCord action.');
        }
        if (!isBindableKey(key)) {
            throw new Error('Use one visible character or Space. Digits are reserved for counts.');
        }
        const keybinds = { ...this.keybinds, [action]: key };
        const conflict = findConflict(keybinds);
        if (conflict) {
            const otherAction = conflict.first === action ? conflict.second : conflict.first;
            const displayKey = conflict.key === ' ' ? 'Space' : conflict.key;
            throw new Error(`"${displayKey}" is already used for: ${KEYBIND_LABELS[otherAction]}.`);
        }
        this.save({ ...this.current, keybinds: Object.freeze(keybinds) });
    }

    setShowFocusOutline(showFocusOutline) {
        if (typeof showFocusOutline !== 'boolean') {
            throw new Error('Choose whether to show the focus outline.');
        }
        this.save({ ...this.current, showFocusOutline });
    }

    setFocusOutlineFadeDelay(raw) {
        const focusOutlineFadeDelay = normalizeFocusOutlineFadeDelay(raw);
        this.save({ ...this.current, focusOutlineFadeDelay });
    }

    setHintsCurrentPane(value) {
        if (typeof value !== 'boolean') {
            throw new Error('Choose whether to limit hints to the selected pane.');
        }
        this.save({ ...this.current, hintsCurrentPane: value });
    }

    preference(key) {
        return this.current[key];
    }

    setPreference(key, value) {
        if (!Object.hasOwn(EXTRA_DEFAULTS, key) || typeof value !== 'boolean') {
            throw new Error('Choose a valid preference.');
        }
        this.save({ ...this.current, [key]: value });
    }

    reset() {
        this.save({
            scrollAmount: DEFAULT_SCROLL_AMOUNT,
            keybinds: DEFAULT_KEYBINDS,
            showFocusOutline: true,
            focusOutlineFadeDelay: DEFAULT_FOCUS_OUTLINE_FADE_DELAY,
            hintsCurrentPane: true,
            ...EXTRA_DEFAULTS,
        });
    }
}

export function actionsForMode(mode) {
    const messageActions = [
        'copyMessage',
        'replyMessage',
        'editMessage',
        'reactMessage',
        'copyMessageLink',
    ];
    if (mode === 'hint') {
        return ['help'];
    }
    if (mode === 'insert') {
        return [];
    }
    if (mode === 'visual') {
        return ACTIONS.filter((action) => !HALF_PAGE_ACTIONS.has(action));
    }
    if (mode === 'range') {
        return ACTIONS.filter(
            (action) =>
                !HALF_PAGE_ACTIONS.has(action) &&
                (!messageActions.includes(action) || action === 'copyMessage'),
        );
    }
    return ACTIONS.filter((action) => !messageActions.includes(action));
}
