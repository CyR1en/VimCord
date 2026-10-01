import { isVisible } from './dom.js';

export const USER_PANEL_SELECTOR = 'section[class*="panels_"]';

export class ModeIndicator {
    constructor() {
        this.element = document.createElement('div');
        this.element.dataset.vimcord = 'indicator';
        this.element.className = 'vim-indicator-container vimcord-indicator-container';
        this.label = document.createElement('span');
        this.label.className = 'vim-indicator vimcord-indicator';
        this.element.append(this.label);
    }

    update(mode, paneLabel, dialog = null) {
        const candidate = dialog ? null : document.querySelector(USER_PANEL_SELECTOR);
        const panel = candidate && isVisible(candidate) ? candidate : null;
        const parent = dialog ?? panel ?? document.body;
        if (this.element.parentElement !== parent) {
            parent.append(this.element);
        }
        this.element.classList.toggle('is-floating', !!dialog || !panel);

        const modeLabel = { normal: 'Normal', insert: 'Insert', hint: 'Hint' }[mode];
        const text = `${modeLabel}${paneLabel ? ` | Focus: ${paneLabel}` : ''}`;
        if (this.label.textContent !== text) {
            this.label.textContent = text;
        }
    }

    stop() {
        this.element.remove();
    }
}
