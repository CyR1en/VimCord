import { activeDialog, DIALOG_SELECTOR, isVisible, OWNED_SELECTOR } from './dom.js';

const PANE_DEFINITIONS = [
    {
        key: 'servers',
        label: 'Server List',
        list: '[data-list-id="guildsnav"]',
        container: '[class*="guilds_"]',
    },
    { key: 'channels', label: 'Channel List', list: '#channels, [data-list-id="channels"]' },
    {
        key: 'dms',
        label: 'DM List',
        list: '[data-list-id="private-channels"]',
        container: '[class*="privateChannels_"]',
    },
    {
        key: 'friends',
        label: 'Friends List',
        list: '[data-list-id="people"]',
        container: '[class*="peopleList_"]',
    },
    {
        key: 'chat',
        label: 'Channel',
        list: '[data-list-id="chat-messages"]',
        container: '[class*="messagesWrapper_"]',
    },
    {
        key: 'members',
        label: 'Member List',
        list: '[data-list-id^="members-"]',
        container: '[class*="membersWrap_"]',
    },
];
const SCROLLER_SELECTOR = '[class*="scroller" i], [data-list-id], [role="list"], [role="listbox"]';
export const PANES_SELECTOR = `${PANE_DEFINITIONS.flatMap((pane) => [pane.list, pane.container])
    .filter(Boolean)
    .join(', ')}, ${DIALOG_SELECTOR}`;

export function paneMutationRelevant(record) {
    if (record.type === 'attributes') {
        return !!record.target.matches?.(PANES_SELECTOR);
    }
    return [...record.addedNodes, ...record.removedNodes].some((node) => {
        if (node.nodeType !== 1 || node.matches(OWNED_SELECTOR)) {
            return false;
        }
        return node.matches(PANES_SELECTOR) || !!node.querySelector(PANES_SELECTOR);
    });
}

function scrollSurface(element) {
    if (!isVisible(element)) {
        return false;
    }
    const style = getComputedStyle(element);
    return /^(auto|scroll|overlay)$/.test(style.overflowY);
}

function enclosingSurface(anchor, boundary) {
    for (
        let candidate = anchor;
        candidate && candidate !== document.body;
        candidate = candidate.parentElement
    ) {
        if (candidate !== anchor && candidate.matches('#app-mount, [class*="base_"]')) {
            break;
        }
        if (scrollSurface(candidate)) {
            return candidate;
        }
        if (candidate === boundary) {
            break;
        }
    }
    return null;
}

function containedSurface(container) {
    if (scrollSurface(container)) {
        return container;
    }
    for (const candidate of container.querySelectorAll(SCROLLER_SELECTOR)) {
        if (scrollSurface(candidate)) {
            return candidate;
        }
    }
    return null;
}

function findPaneSurface(definition) {
    // Semantic lists lead to their enclosing scroller; wrapper fallbacks stay inside the pane.
    for (const anchor of document.querySelectorAll(definition.list)) {
        if (anchor.closest(OWNED_SELECTOR) || !isVisible(anchor)) {
            continue;
        }
        const boundary = definition.container ? anchor.closest(definition.container) : null;
        const surface = enclosingSurface(anchor, boundary);
        if (surface) {
            return surface;
        }
    }
    if (definition.container) {
        for (const container of document.querySelectorAll(definition.container)) {
            if (container.closest(OWNED_SELECTOR) || !isVisible(container)) {
                continue;
            }
            const surface = containedSurface(container);
            if (surface) {
                return surface;
            }
        }
    }
    return null;
}

export class PaneManager {
    constructor() {
        this.panes = [];
        this.active = null;
        this.backgroundActive = null;
        this.dialog = null;
    }

    refresh() {
        const next = [];
        const used = new Set();
        const dialog = activeDialog();
        let defaultDialogPane = null;
        if (dialog) {
            if (!this.dialog) {
                this.backgroundActive = this.active;
            }
            const surfaces = [dialog, ...dialog.querySelectorAll(SCROLLER_SELECTOR)]
                .filter((element) => !element.closest(OWNED_SELECTOR) && scrollSurface(element))
                .map((element) => ({ element, rect: element.getBoundingClientRect() }))
                .sort((a, b) => a.rect.left - b.rect.left || a.rect.top - b.rect.top);
            for (const [index, surface] of surfaces.entries()) {
                const pane = {
                    key: 'dialog',
                    label: surfaces.length > 1 ? `Dialog ${index + 1}` : 'Dialog',
                    element: surface.element,
                };
                next.push(pane);
                if (
                    !defaultDialogPane ||
                    pane.element.clientWidth * pane.element.clientHeight >
                        defaultDialogPane.element.clientWidth *
                            defaultDialogPane.element.clientHeight
                ) {
                    defaultDialogPane = pane;
                }
            }
        } else {
            for (const definition of PANE_DEFINITIONS) {
                const element = findPaneSurface(definition);
                if (!element || used.has(element)) {
                    continue;
                }
                used.add(element);
                next.push({ key: definition.key, label: definition.label, element });
            }
        }
        const previous = !dialog && this.dialog ? this.backgroundActive : this.active;
        const active =
            next.find((pane) => pane.element === previous?.element) ||
            (dialog ? defaultDialogPane : next.find((pane) => pane.key === previous?.key)) ||
            next.find((pane) => pane.key === 'chat') ||
            next.find((pane) => pane.key !== 'servers') ||
            next[0] ||
            null;
        const changed =
            active?.element !== this.active?.element ||
            next.length !== this.panes.length ||
            next.some(
                (pane, index) =>
                    pane.element !== this.panes[index]?.element ||
                    pane.label !== this.panes[index]?.label,
            );
        this.panes = next;
        this.active = active;
        this.dialog = dialog;
        if (!dialog) {
            this.backgroundActive = null;
        }
        return changed;
    }

    move(direction) {
        this.refresh();
        if (!this.panes.length) {
            return;
        }
        const index = this.panes.indexOf(this.active);
        this.active =
            this.panes[Math.max(0, Math.min(this.panes.length - 1, index + Math.sign(direction)))];
    }

    scroll(delta) {
        if (!this.active || !scrollSurface(this.active.element)) {
            this.refresh();
        }
        const element = this.active?.element;
        if (!element) {
            return;
        }
        element.scrollBy({ top: delta, behavior: 'instant' });
    }

    get label() {
        return this.active?.label || '';
    }

    get pageSize() {
        return this.active?.element.clientHeight || window.innerHeight;
    }

    stop() {
        this.panes = [];
        this.active = null;
        this.backgroundActive = null;
        this.dialog = null;
    }
}
