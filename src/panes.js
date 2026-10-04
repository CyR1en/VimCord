import { activeDialog, DIALOG_SELECTOR, elementLabel, isVisible, OWNED_SELECTOR } from './dom.js';
import { isScrollSurface, ScrollPanels } from './scroll-panels.js';

const PANE_DEFINITIONS = [
    {
        key: 'servers',
        label: 'Servers',
        list: '[data-list-id="guildsnav"]',
        container: '[class*="guilds_"]',
    },
    { key: 'channels', label: 'Channels', list: '#channels, [data-list-id="channels"]' },
    {
        key: 'dms',
        label: 'Direct messages',
        list: '[data-list-id="private-channels"]',
        container: '[class*="privateChannels_"]',
    },
    {
        key: 'friends',
        label: 'Friends',
        list: '[data-list-id="people"]',
        container: '[class*="peopleList_"]',
    },
    {
        key: 'chat',
        label: 'Messages',
        list: '[data-list-id="chat-messages"]',
        container: '[class*="messagesWrapper_"]',
    },
    {
        key: 'members',
        label: 'Members',
        list: '[data-list-id^="members-"]',
        container: '[class*="membersWrap_"]',
    },
    {
        key: 'activeNow',
        label: 'Active Now',
        list: '[class*="nowPlayingColumn_"] aside',
        container: '[class*="nowPlayingColumn_"]',
    },
];
const SCROLLER_SELECTOR = '[class*="scroller" i], [data-list-id], [role="list"], [role="listbox"]';
const HEADING_SELECTOR = 'h1, h2, h3, [role="heading"]';
const SETTINGS_SELECTOR = '[class*="standardSidebarView_"]';
const SETTINGS_SIDEBAR_SELECTOR = '[class*="sidebarRegion_"], [class*="sidebarRegionScroller_"]';
export const PANES_SELECTOR = `${PANE_DEFINITIONS.flatMap((pane) => [pane.list, pane.container])
    .filter(Boolean)
    .join(', ')}, ${DIALOG_SELECTOR}`;

function paneMutationRelevant(record) {
    if (record.type === 'attributes') {
        return !!record.target.matches?.(PANES_SELECTOR);
    }
    const inDialog = record.target.closest?.(DIALOG_SELECTOR);
    if (inDialog && record.target.closest(HEADING_SELECTOR)) {
        return true;
    }
    return [...record.addedNodes, ...record.removedNodes].some((node) => {
        if (node.nodeType !== 1 || node.matches(OWNED_SELECTOR)) {
            return false;
        }
        const selector = inDialog
            ? `${PANES_SELECTOR}, ${SCROLLER_SELECTOR}, ${HEADING_SELECTOR}`
            : PANES_SELECTOR;
        return node.matches(selector) || !!node.querySelector(selector);
    });
}

function headingLabel(scope) {
    const heading = scope?.querySelector(HEADING_SELECTOR);
    return heading?.textContent.replace(/\s+/g, ' ').trim() || '';
}

function dialogPaneLabel(element, dialog) {
    const sidebar = element.closest('aside, [role="complementary"]');
    const sidebarLabel =
        sidebar && dialog.contains(sidebar) ? elementLabel(sidebar) || headingLabel(sidebar) : '';
    if (dialog.matches(SETTINGS_SELECTOR)) {
        if (
            element.closest(SETTINGS_SIDEBAR_SELECTOR) ||
            element.querySelector('[role="tablist"]')
        ) {
            return 'Settings sidebar';
        }
        const selected = dialog.querySelector('[role="tab"][aria-selected="true"]');
        const selectedLabel = selected?.textContent.replace(/\s+/g, ' ').trim();
        const content = element.closest('[class*="contentRegion_"]');
        return (
            selectedLabel ||
            headingLabel(content) ||
            headingLabel(element) ||
            headingLabel(dialog) ||
            'Settings'
        );
    }
    return (
        elementLabel(element) ||
        sidebarLabel ||
        headingLabel(element) ||
        elementLabel(dialog) ||
        headingLabel(dialog) ||
        'Dialog content'
    );
}

function scrollSurface(element) {
    return isVisible(element) && isScrollSurface(element);
}

function discoveredLabel(element, scope, surfaces) {
    for (let region = element; region && scope.contains(region); region = region.parentElement) {
        if (
            region !== element &&
            surfaces.some((other) => other !== element && region.contains(other))
        ) {
            break;
        }
        const heading = [...region.querySelectorAll(HEADING_SELECTOR)].find(
            (node) => !node.closest(`${OWNED_SELECTOR}, [role="article"], [contenteditable]`),
        );
        const label = elementLabel(region) || heading?.textContent.replace(/\s+/g, ' ').trim();
        if (label) {
            return label.slice(0, 80);
        }
        if (region === scope || region === document.body) {
            break;
        }
    }
    return 'Scrollable panel';
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
        this.scrollPanels = new ScrollPanels();
        this.panelKeys = new WeakMap();
        this.nextPanelKey = 0;
    }

    invalidate() {
        this.scrollPanels.invalidate();
    }

    onMutation(record) {
        const discoveredChanged = this.scrollPanels.onMutation(record);
        return discoveredChanged || paneMutationRelevant(record);
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
            for (const surface of surfaces) {
                const pane = {
                    key: 'dialog',
                    label: dialogPaneLabel(surface.element, dialog),
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
        const scope = dialog || document.body;
        const knownElements = next.map((pane) => pane.element);
        const discovered = this.scrollPanels.discover(scope, knownElements);
        const surfaces = [...knownElements, ...discovered];
        for (const element of discovered) {
            if (!this.panelKeys.has(element)) {
                this.panelKeys.set(element, `scrollable-${++this.nextPanelKey}`);
            }
            const pane = {
                key: this.panelKeys.get(element),
                label: discoveredLabel(element, scope, surfaces),
                element,
            };
            next.push(pane);
            if (
                dialog &&
                (!defaultDialogPane ||
                    element.clientWidth * element.clientHeight >
                        defaultDialogPane.element.clientWidth *
                            defaultDialogPane.element.clientHeight)
            ) {
                defaultDialogPane = pane;
            }
        }
        const bounds = new Map(next.map((pane) => [pane, pane.element.getBoundingClientRect()]));
        next.sort(
            (first, second) =>
                bounds.get(first).left - bounds.get(second).left ||
                bounds.get(first).top - bounds.get(second).top,
        );
        const previous = !dialog && this.dialog ? this.backgroundActive : this.active;
        const replacements =
            previous?.key.startsWith('scrollable-') && previous.label !== 'Scrollable panel'
                ? next.filter(
                      (pane) => pane.key.startsWith('scrollable-') && pane.label === previous.label,
                  )
                : [];
        const active =
            next.find((pane) => pane.element === previous?.element) ||
            (replacements.length === 1 ? replacements[0] : null) ||
            (dialog ? defaultDialogPane : next.find((pane) => pane.key === previous?.key)) ||
            (previous?.key === 'activeNow' ? next.find((pane) => pane.key === 'friends') : null) ||
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
        this.active = this.panes[Math.max(0, Math.min(this.panes.length - 1, index + direction))];
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

    jump(edge) {
        this.refresh();
        const element = this.active?.element;
        if (!element) {
            return;
        }
        element.scrollTo({ top: edge === 'top' ? 0 : element.scrollHeight, behavior: 'instant' });
    }

    get pageSize() {
        return this.active?.element.clientHeight || window.innerHeight;
    }

    stop() {
        this.scrollPanels.stop();
        this.panes = [];
        this.active = null;
        this.backgroundActive = null;
        this.dialog = null;
    }
}
