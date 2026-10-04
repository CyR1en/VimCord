import { EXTRA_PREFERENCES, KEYBIND_LABELS } from './settings.js';
import styles from './settings.css';

const MODIFIER_KEYS = new Set(['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'AltGraph']);
let nextPanelId = 0;

function keyLabel(key) {
    if (!key) {
        return 'Unassigned';
    }
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
    constructor(settings, onChange = () => {}, onManageMarks = () => {}) {
        this.settings = settings;
        this.onChange = onChange;
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

        const outlineRow = createElement('div', 'vimcord-settings-row');
        const outlineText = createElement('div', 'vimcord-settings-preference');
        const outlineLabel = createElement('label', '', 'Show focus outline');
        outlineLabel.htmlFor = `${panelId}-outline`;
        const outlineDescription = createElement(
            'p',
            'vimcord-settings-description',
            'Briefly highlight the active pane or text field when focus changes.',
        );
        outlineDescription.id = `${panelId}-outline-description`;
        outlineText.append(outlineLabel, outlineDescription);
        this.outlineInput = createElement('input', 'vimcord-settings-toggle');
        this.outlineInput.id = outlineLabel.htmlFor;
        this.outlineInput.type = 'checkbox';
        this.outlineInput.setAttribute('role', 'switch');
        this.outlineInput.setAttribute('aria-describedby', outlineDescription.id);
        this.listen(this.outlineInput, 'change', () => this.saveFocusOutline());
        outlineRow.append(outlineText, this.outlineInput);
        this.element.append(outlineRow);

        this.fadeDelayRow = createElement('div', 'vimcord-settings-row');
        const fadeDelayLabel = createElement('label', '', 'Fade after (seconds)');
        fadeDelayLabel.htmlFor = `${panelId}-fade-delay`;
        this.fadeDelayInput = createElement('input', 'vimcord-settings-input');
        this.fadeDelayInput.id = fadeDelayLabel.htmlFor;
        this.fadeDelayInput.type = 'number';
        this.fadeDelayInput.min = '0.5';
        this.fadeDelayInput.max = '60';
        this.fadeDelayInput.step = '0.5';
        this.listen(this.fadeDelayInput, 'change', () => this.saveFocusOutlineFadeDelay());
        this.fadeDelayRow.append(fadeDelayLabel, this.fadeDelayInput);
        this.element.append(this.fadeDelayRow);

        const hintsRow = createElement('div', 'vimcord-settings-row');
        const hintsLabel = createElement('label', '', 'Limit hints to the selected pane');
        hintsLabel.htmlFor = `${panelId}-hints-pane`;
        this.hintsInput = createElement('input', 'vimcord-settings-toggle');
        this.hintsInput.id = hintsLabel.htmlFor;
        this.hintsInput.type = 'checkbox';
        this.hintsInput.setAttribute('role', 'switch');
        this.listen(this.hintsInput, 'change', () => {
            try {
                this.settings.setHintsCurrentPane(this.hintsInput.checked);
                this.onChange();
                this.setStatus(
                    'Hint scope saved. Use the all-hints binding for the foreground view.',
                );
            } catch (error) {
                this.setStatus(error.message, true);
            }
            this.render();
        });
        hintsRow.append(hintsLabel, this.hintsInput);
        this.element.append(hintsRow);

        this.preferenceInputs = new Map();
        for (const [key, label] of Object.entries(EXTRA_PREFERENCES)) {
            const row = createElement('div', 'vimcord-settings-row');
            const text = createElement('label', '', label);
            text.htmlFor = `${panelId}-${key}`;
            const input = createElement('input', 'vimcord-settings-toggle');
            input.type = 'checkbox';
            input.id = text.htmlFor;
            input.setAttribute('role', 'switch');
            this.listen(input, 'change', () => {
                try {
                    this.settings.setPreference(key, input.checked);
                    this.onChange();
                    this.setStatus('Preference saved.');
                } catch (error) {
                    this.setStatus(error.message, true);
                }
                this.render();
            });
            this.preferenceInputs.set(key, input);
            row.append(text, input);
            this.element.append(row);
        }
        const marksButton = createElement('button', 'vimcord-settings-reset', 'Manage saved marks');
        marksButton.type = 'button';
        this.listen(marksButton, 'click', () => {
            this.cancelCapture();
            onManageMarks();
        });
        this.element.append(marksButton);

        this.element.append(createElement('h2', 'vimcord-settings-heading', 'Keybinds'));
        const instructions = createElement(
            'p',
            'vimcord-settings-description',
            'Select a key, then press its replacement. Shifted characters and Space are supported. Digits are reserved for counts. Escape cancels. The top binding is pressed twice; mark bindings are followed by a letter.',
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
        this.outlineInput.checked = this.settings.showFocusOutline;
        this.fadeDelayRow.hidden = !this.settings.showFocusOutline;
        this.fadeDelayInput.disabled = !this.settings.showFocusOutline;
        this.fadeDelayInput.value = this.settings.focusOutlineFadeDelay;
        this.hintsInput.checked = this.settings.hintsCurrentPane;
        for (const [key, input] of this.preferenceInputs) {
            input.checked = this.settings.preference(key);
        }
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

    saveFocusOutline() {
        try {
            this.settings.setShowFocusOutline(this.outlineInput.checked);
            this.onChange();
            this.setStatus(
                this.settings.showFocusOutline
                    ? 'Focus outline enabled.'
                    : 'Focus outline disabled.',
            );
        } catch (error) {
            this.setStatus(error.message, true);
        }
        this.render();
    }

    saveFocusOutlineFadeDelay() {
        try {
            this.settings.setFocusOutlineFadeDelay(this.fadeDelayInput.value);
            this.onChange();
            this.setStatus('Focus outline fade delay saved.');
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
            this.onChange();
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
                            this.onChange();
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
