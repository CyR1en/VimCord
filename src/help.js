import { actionsForMode, KEYBIND_LABELS } from './settings.js';

const MODE_NAMES = {
    normal: 'Normal',
    visual: 'Message selection',
    range: 'Message range',
    hint: 'Hint',
    insert: 'Insert',
};

function element(tag, text, className = '') {
    const node = document.createElement(tag);
    node.className = className;
    node.textContent = text;
    return node;
}

export class ContextHelp {
    constructor() {
        this.root = null;
    }

    show(mode, settings) {
        this.close();
        this.previousFocus = document.activeElement;
        const root = element('div', '', 'vimcord-help-backdrop');
        root.dataset.vimcord = 'help';
        const dialog = element('section', '', 'vimcord-help');
        dialog.setAttribute('role', 'dialog');
        dialog.setAttribute('aria-modal', 'true');
        dialog.setAttribute('aria-labelledby', 'vimcord-help-title');
        const title = element('h2', `VimCord · ${MODE_NAMES[mode]}`);
        title.id = 'vimcord-help-title';
        const close = element('button', 'Close', 'vimcord-help-close');
        close.type = 'button';
        close.addEventListener('click', () => this.close());
        const header = element('header', '');
        header.append(title, close);
        dialog.append(header);
        const list = element('dl', '', 'vimcord-help-keys');
        const messageMode = mode === 'visual' || mode === 'range';
        const add = (key, description) => {
            if (!key) {
                return;
            }
            const term = element('dt', '');
            term.append(element('kbd', key));
            list.append(term, element('dd', description));
        };
        for (const action of actionsForMode(mode)) {
            let key = action === 'help' ? settings.helpKeyForMode(mode) : settings.keybinds[action];
            if (!key) {
                continue;
            }
            key = key === ' ' ? 'Space' : key;
            let label = KEYBIND_LABELS[action];
            if (action === 'jumpTop') {
                key = `${key} ${key}`;
                label = messageMode ? 'First loaded message' : 'Top of selected pane';
            } else if (messageMode && action === 'jumpBottom') {
                label = 'Latest messages (returns to Normal)';
            } else if (action === 'setMark' || action === 'jumpMark') {
                key += ' a–z';
            } else if (messageMode && ['scrollDown', 'scrollUp'].includes(action)) {
                label = action === 'scrollDown' ? 'Next message' : 'Previous message';
                if (mode === 'range') {
                    label += ' (extend or shrink range)';
                }
            } else if (mode === 'range' && action === 'copyMessage') {
                label = 'Copy selected messages in chronological order';
            } else if (mode === 'range' && action === 'range') {
                label = 'Return to single-message selection';
            } else if (messageMode && action === 'visual') {
                label = 'Leave message selection';
            } else if (action === 'hint') {
                label = settings.hintsCurrentPane
                    ? 'Hints in selected pane'
                    : 'Hints in foreground view';
            }
            add(key, label);
        }
        if (mode === 'hint') {
            add('A–Z', 'Narrow hints and activate a complete label');
            add('Backspace', 'Undo a hint letter');
            add('Enter', 'Activate the only matching hint');
        } else if (mode !== 'insert') {
            add('1–999', 'Repeat the next movement (for example, 5 + your down key)');
        }
        add('Escape', mode === 'normal' ? 'Cancel an unfinished command' : 'Return to Normal mode');
        dialog.append(list);
        dialog.append(
            element(
                'p',
                'Escape closes this help. Typing is available in Insert mode.',
                'vimcord-help-note',
            ),
        );
        root.append(dialog);
        root.addEventListener('pointerdown', (event) => {
            if (event.target === root) {
                event.preventDefault();
                this.close();
            }
        });
        this.root = root;
        document.body.append(root);
        close.focus({ preventScroll: true });
    }

    handleKey(event, helpKey) {
        if (event.key === 'Escape' || event.key === helpKey) {
            this.close();
        } else if (event.key === 'Tab') {
            this.root.querySelector('button').focus();
        } else if (
            ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'].includes(event.key)
        ) {
            const dialog = this.root.querySelector('section');
            if (event.key === 'Home' || event.key === 'End') {
                dialog.scrollTop = event.key === 'Home' ? 0 : dialog.scrollHeight;
            } else {
                const sign = ['ArrowUp', 'PageUp'].includes(event.key) ? -1 : 1;
                const distance = event.key.startsWith('Page') ? dialog.clientHeight : 60;
                dialog.scrollBy({ top: sign * distance, behavior: 'instant' });
            }
        } else if (event.key === 'Enter' || event.key === ' ') {
            this.close();
        }
    }

    close(restoreFocus = true) {
        if (!this.root) {
            return;
        }
        this.root.remove();
        this.root = null;
        if (restoreFocus && this.previousFocus?.isConnected) {
            this.previousFocus.focus({ preventScroll: true });
        }
        this.previousFocus = null;
    }
}
