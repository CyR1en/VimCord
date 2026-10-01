import { KEYBIND_LABELS } from './settings.js';
import styles from './settings.css';

const MODIFIER_KEYS = new Set(['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'AltGraph']);
let nextPanelId = 0;

function keyLabel(key) {
    return key === ' ' ? 'Space' : key;
}

function createElement(tag, className, text) {
    const element = document.createElement(tag);
    element.className = className;
    if (text !== undefined) {
        element.textContent = text;
    }
    return element;
}

export class SettingsPanel {
    constructor(settings) {
        this.settings = settings;
        this.listeners = new AbortController();
        this.buttons = new Map();
        this.captureAction = null;

        const panelId = `vimcord-settings-${++nextPanelId}`;
        this.element = createElement('div', 'vimcord-settings');
        this.element.dataset.vimcordSettings = '';
        const style = document.createElement('style');
        style.textContent = styles;
        this.element.append(style);

        this.element.append(createElement('h2', 'vimcord-settings-heading', 'Preferences'));
        const scrollRow = createElement('div', 'vimcord-settings-row');
        const scrollLabel = createElement('label', '', 'Scroll amount (pixels)');
        scrollLabel.htmlFor = `${panelId}-scroll`;
        this.scrollInput = createElement('input', 'vimcord-settings-input');
        this.scrollInput.id = scrollLabel.htmlFor;
        this.scrollInput.type = 'number';
        this.scrollInput.min = '10';
        this.scrollInput.max = '1000';
        this.scrollInput.step = '1';
        this.listen(this.scrollInput, 'change', () => this.saveScrollAmount());
        scrollRow.append(scrollLabel, this.scrollInput);
        this.element.append(scrollRow);

        this.element.append(createElement('h2', 'vimcord-settings-heading', 'Keybinds'));
        const instructions = createElement(
            'p',
            'vimcord-settings-description',
            'Select a key, then press its replacement. Shifted characters and Space are supported. Escape cancels.',
        );
        instructions.id = `${panelId}-instructions`;
        this.element.append(instructions);

        for (const [action, label] of Object.entries(KEYBIND_LABELS)) {
            const row = createElement('div', 'vimcord-settings-row');
            const button = createElement('button', 'vimcord-settings-key');
            button.type = 'button';
            button.dataset.action = action;
            button.setAttribute('aria-describedby', instructions.id);
            this.listen(button, 'click', () => this.beginCapture(action));
            this.listen(button, 'keydown', (event) => this.captureKey(event, action));
            this.listen(button, 'blur', () => {
                if (this.captureAction === action) {
                    this.cancelCapture();
                }
            });
            this.buttons.set(action, button);
            row.append(createElement('span', '', label), button);
            this.element.append(row);
        }

        this.status = createElement('p', 'vimcord-settings-status');
        this.status.setAttribute('role', 'status');
        this.status.setAttribute('aria-live', 'polite');
        this.status.setAttribute('aria-atomic', 'true');
        this.element.append(this.status);

        const resetButton = createElement('button', 'vimcord-settings-reset', 'Reset to defaults');
        resetButton.type = 'button';
        this.listen(resetButton, 'click', () => this.confirmReset());
        this.element.append(resetButton);
        this.render();
    }

    listen(element, eventName, handler) {
        element.addEventListener(eventName, handler, { signal: this.listeners.signal });
    }

    render() {
        this.scrollInput.value = this.settings.scrollAmount;
        for (const [action, button] of this.buttons) {
            const capturing = this.captureAction === action;
            const binding = keyLabel(this.settings.keybinds[action]);
            button.textContent = capturing ? 'Press a key…' : binding;
            button.classList.toggle('is-capturing', capturing);
            button.setAttribute(
                'aria-label',
                `${KEYBIND_LABELS[action]}: ${capturing ? 'press a new key' : binding}`,
            );
        }
    }

    setStatus(message, isError = false) {
        this.status.textContent = message;
        this.status.classList.toggle('is-error', isError);
    }

    saveScrollAmount() {
        try {
            this.settings.setScrollAmount(this.scrollInput.value);
            this.setStatus('Scroll amount saved.');
        } catch (error) {
            this.setStatus(error.message, true);
        }
        this.render();
    }

    beginCapture(action) {
        this.captureAction = action;
        this.buttons.get(action).focus();
        this.render();
        this.setStatus(`Press a new key for ${KEYBIND_LABELS[action]}. Escape cancels.`);
    }

    cancelCapture() {
        if (this.captureAction === null) {
            return;
        }
        this.captureAction = null;
        this.render();
        this.setStatus('Key change canceled.');
    }

    captureKey(event, action) {
        if (this.captureAction !== action) {
            return;
        }
        const button = this.buttons.get(action);
        if (!this.element.isConnected || document.activeElement !== button) {
            this.cancelCapture();
            return;
        }
        if (event.key === 'Tab') {
            this.cancelCapture();
            return;
        }
        if (
            event.repeat ||
            event.isComposing ||
            event.key === 'Dead' ||
            MODIFIER_KEYS.has(event.key)
        ) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        this.cancelCapture();
        if (event.key === 'Escape') {
            return;
        }
        if (event.ctrlKey || event.altKey || event.metaKey) {
            this.setStatus('Control, Alt, and Meta key combinations are not supported.', true);
            return;
        }

        try {
            this.settings.setKeybind(action, event.key);
            this.render();
            this.setStatus(`${KEYBIND_LABELS[action]} changed to ${keyLabel(event.key)}.`);
        } catch (error) {
            this.setStatus(error.message, true);
        }
    }

    confirmReset() {
        this.cancelCapture();
        try {
            BdApi.UI.showConfirmationModal(
                'Reset to defaults?',
                'This will restore all keybinds and preferences to their default values.',
                {
                    confirmText: 'Reset',
                    cancelText: 'Cancel',
                    danger: true,
                    onConfirm: () => {
                        if (this.listeners.signal.aborted) {
                            return;
                        }
                        try {
                            this.settings.reset();
                            this.render();
                            this.setStatus('Keybinds and preferences reset to defaults.');
                        } catch (error) {
                            this.setStatus(error.message, true);
                        }
                    },
                },
            );
        } catch (error) {
            this.setStatus(error.message, true);
        }
    }

    dispose() {
        this.cancelCapture();
        this.listeners.abort();
    }
}
