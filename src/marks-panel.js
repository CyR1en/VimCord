import styles from './marks-panel.css';

function element(tag, text = '', className = '') {
    const node = document.createElement(tag);
    node.textContent = text;
    node.className = className;
    return node;
}

export class MarksPanel {
    constructor(marks, onJump = (key) => marks.jump(key)) {
        this.marks = marks;
        this.onJump = onJump;
        this.root = null;
    }

    show(keybinds) {
        this.close();
        this.previousFocus = document.activeElement;
        this.keybinds = keybinds;
        this.editing = null;
        this.removed = null;
        this.events = new AbortController();
        this.root = element('div', '', 'vimcord-marks-backdrop');
        this.root.dataset.vimcord = 'marks';
        const style = element('style', styles);
        this.dialog = element('section', '', 'vimcord-marks');
        this.dialog.setAttribute('role', 'dialog');
        this.dialog.setAttribute('aria-modal', 'true');
        this.dialog.setAttribute('aria-labelledby', 'vimcord-marks-title');
        const title = element('h2', 'Saved marks');
        title.id = 'vimcord-marks-title';
        const header = element('header');
        this.closeButton = this.button('Close', () => this.close());
        header.append(title, this.closeButton);
        this.list = element('div', '', 'vimcord-marks-list');
        this.status = element('p', '', 'vimcord-marks-status');
        this.status.setAttribute('role', 'status');
        this.status.setAttribute('aria-live', 'polite');
        this.undo = this.button('Undo removal', () => this.undoRemove());
        this.undo.hidden = true;
        this.dialog.append(
            header,
            this.list,
            this.status,
            this.undo,
            element(
                'p',
                'Tab moves between controls · Enter activates · Escape closes',
                'vimcord-marks-note',
            ),
        );
        this.root.append(style, this.dialog);
        this.root.addEventListener('pointerdown', (event) => {
            if (event.target === this.root) {
                event.preventDefault();
                this.close();
            }
        });
        document.addEventListener('keydown', (event) => this.handleKey(event), {
            capture: true,
            signal: this.events.signal,
        });
        for (const type of ['beforeinput', 'paste', 'cut']) {
            document.addEventListener(
                type,
                (event) => {
                    if (!this.root.contains(event.target)) {
                        event.preventDefault();
                    }
                    event.stopImmediatePropagation();
                },
                { capture: true, signal: this.events.signal },
            );
        }
        document.body.append(this.root);
        this.render();
        this.closeButton.focus();
    }

    button(label, action) {
        const button = element('button', label);
        button.type = 'button';
        button.addEventListener('click', action);
        return button;
    }

    render(focusKey, control = 'change') {
        this.list.replaceChildren();
        const entries = this.marks.entries();
        if (!entries.length) {
            const key = this.keybinds.setMark || 'the set-mark key';
            this.list.append(
                element(
                    'p',
                    `No saved marks yet. Open a channel or DM, then press ${key} and a letter.`,
                    'vimcord-marks-empty',
                ),
            );
        }
        for (const entry of entries) {
            const row = element('div', '', 'vimcord-mark-row');
            row.dataset.mark = entry.key;
            const description = element('div', '', 'vimcord-mark-description');
            description.append(element('strong', entry.name), element('span', entry.detail));
            const actions = element('div', '', 'vimcord-mark-actions');
            if (this.editing === entry.key) {
                const input = element('input');
                input.type = 'text';
                input.maxLength = 1;
                input.value = entry.key;
                input.setAttribute('aria-label', `New letter for mark ${entry.key}`);
                input.autocomplete = 'off';
                input.spellcheck = false;
                this.renameInput = input;
                row.append(input, description);
                actions.append(
                    this.button('Save', () => this.saveRename()),
                    this.button('Cancel', () => this.cancelRename()),
                );
            } else {
                row.append(element('kbd', entry.key), description);
                for (const [name, label, callback] of [
                    ['open', 'Open', () => this.open(entry.key)],
                    [
                        'change',
                        'Change letter',
                        () => {
                            this.editing = entry.key;
                            this.render();
                            this.renameInput.focus();
                            this.renameInput.select();
                        },
                    ],
                    ['remove', 'Remove', () => this.remove(entry.key)],
                ]) {
                    const button = this.button(label, callback);
                    button.dataset.control = name;
                    button.setAttribute('aria-label', `${label} mark ${entry.key}: ${entry.name}`);
                    actions.append(button);
                }
            }
            row.append(actions);
            this.list.append(row);
        }
        this.undo.hidden = !this.removed;
        if (focusKey) {
            const target = this.list.querySelector(
                `[data-mark="${focusKey}"] [data-control="${control}"]`,
            );
            (target || this.closeButton).focus();
        }
    }

    report(message, error = false) {
        this.status.textContent = message;
        this.status.classList.toggle('is-error', error);
    }

    saveRename() {
        try {
            const old = this.editing;
            const key = this.marks.rename(old, this.renameInput.value);
            this.editing = null;
            this.render(key);
            this.report(`Mark ${old} changed to ${key}.`);
        } catch (error) {
            this.report(error.message, true);
            this.renameInput.focus();
        }
    }

    cancelRename() {
        const key = this.editing;
        this.editing = null;
        this.render(key);
    }

    remove(key) {
        try {
            const keys = this.marks.entries().map((entry) => entry.key);
            const index = keys.indexOf(key);
            this.removed = this.marks.remove(key);
            this.editing = null;
            this.render(keys[index + 1] || keys[index - 1]);
            this.report(`Removed mark ${key}.`);
            if (!Object.keys(this.marks.marks).length) {
                this.undo.focus();
            }
        } catch (error) {
            this.report(error.message, true);
        }
    }

    undoRemove() {
        try {
            const { key } = this.removed;
            this.marks.restore(this.removed);
            this.removed = null;
            this.render(key);
            this.report(`Restored mark ${key}.`);
        } catch (error) {
            this.report(error.message, true);
        }
    }

    open(key) {
        try {
            this.onJump(key);
            this.close(false);
        } catch (error) {
            this.report(error.message, true);
        }
    }

    handleKey(event) {
        event.stopImmediatePropagation();
        if (event.key === 'Escape') {
            event.preventDefault();
            if (this.editing) {
                this.cancelRename();
            } else {
                this.close();
            }
        } else if (event.key === 'Tab') {
            event.preventDefault();
            const controls = [...this.dialog.querySelectorAll('button:not([hidden]), input')];
            const index = controls.indexOf(document.activeElement);
            const next = (index + (event.shiftKey ? -1 : 1) + controls.length) % controls.length;
            controls[next].focus();
        } else if (this.editing && event.target === this.renameInput && event.key === 'Enter') {
            event.preventDefault();
            this.saveRename();
        } else if (!this.editing && event.key === this.keybinds.manageMarks) {
            event.preventDefault();
            if (!event.repeat) {
                this.close();
            }
        } else if (!this.editing && event.key.length === 1 && event.key !== ' ') {
            event.preventDefault();
        }
    }

    close(restoreFocus = true) {
        if (!this.root) {
            return;
        }
        this.events.abort();
        this.root.remove();
        this.root = null;
        if (restoreFocus && this.previousFocus?.isConnected) {
            this.previousFocus.focus({ preventScroll: true });
        }
        this.previousFocus = null;
    }
}
