/**
 * @name VimCord
 * @description Vim-style keyboard navigation and hints for BetterDiscord.
 * @author CyR1en
 * @authorLink https://github.com/CyR1en
 * @version 0.2.0
 * @source https://github.com/CyR1en/VimCord
 */
// Generated from src/ by npm run build. Edit the source files, not this bundle.
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.js
var index_exports = {};
__export(index_exports, {
  default: () => VimCord
});
module.exports = __toCommonJS(index_exports);

// src/dom.js
var OWNED_SELECTOR = "[data-vimcord]";
var DIALOG_SELECTOR = '[role="dialog"], [aria-modal="true"], dialog[open], [class*="standardSidebarView_"]';
var EDITABLE_SELECTOR = 'input, textarea, [contenteditable], [role="textbox"]';
var NON_TEXT_INPUTS = /* @__PURE__ */ new Set([
  "button",
  "checkbox",
  "color",
  "file",
  "hidden",
  "image",
  "radio",
  "range",
  "reset",
  "submit"
]);
function editableTarget(element) {
  const target = element?.nodeType === 1 ? element : element?.parentElement;
  const editor = target?.closest?.(EDITABLE_SELECTOR);
  if (!editor || editor.closest(`${OWNED_SELECTOR}, [inert], [aria-disabled="true"], [aria-readonly="true"]`)) {
    return null;
  }
  if (editor.matches(":disabled") || editor.readOnly) {
    return null;
  }
  if (editor.tagName === "INPUT" && NON_TEXT_INPUTS.has(editor.type)) {
    return null;
  }
  if (editor.tagName !== "INPUT" && editor.tagName !== "TEXTAREA" && !editor.isContentEditable) {
    return null;
  }
  return editor;
}
function isVisible(element) {
  if (!element?.isConnected || element.closest('[hidden], [inert], [aria-hidden="true"]')) {
    return false;
  }
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0 || rect.bottom <= 0 || rect.right <= 0 || rect.top >= window.innerHeight || rect.left >= window.innerWidth) {
    return false;
  }
  const style = getComputedStyle(element);
  return style.display !== "none" && style.visibility !== "hidden" && style.visibility !== "collapse" && style.opacity !== "0";
}
function activeDialog(root = document) {
  const dialogs = [...root.querySelectorAll(DIALOG_SELECTOR)];
  if (root.matches?.(DIALOG_SELECTOR)) {
    dialogs.unshift(root);
  }
  let active = null;
  let highestZ = -Infinity;
  for (const dialog of dialogs) {
    if (dialog.closest(OWNED_SELECTOR) || !isVisible(dialog)) {
      continue;
    }
    const zIndex = Number.parseInt(getComputedStyle(dialog).zIndex, 10) || 0;
    if (zIndex >= highestZ || active?.contains(dialog)) {
      active = dialog;
      highestZ = zIndex;
    }
  }
  return active;
}
function isComposer(element) {
  const editor = editableTarget(element);
  if (!editor || editor.closest(DIALOG_SELECTOR)) {
    return false;
  }
  if (editor.matches('input[type="search"]') || editor.closest('[role="search"], [class*="searchBar_"], [class*="search_"]')) {
    return false;
  }
  if (editor.matches('[data-slate-editor="true"]')) {
    return true;
  }
  return !!editor.closest(
    '[class*="channelTextArea_"], [class*="chatContent_"] form, [class*="chat_"] form'
  );
}
function findPreferredInput(root = document) {
  const scope = activeDialog(root) || root;
  const candidates = [...scope.querySelectorAll(EDITABLE_SELECTOR)];
  if (scope.matches?.(EDITABLE_SELECTOR)) {
    candidates.unshift(scope);
  }
  let preferred = null;
  let bestScore = -1;
  const visited = /* @__PURE__ */ new Set();
  for (const candidate of candidates) {
    const editor = editableTarget(candidate);
    if (!editor || visited.has(editor)) {
      continue;
    }
    visited.add(editor);
    if (!isVisible(editor)) {
      continue;
    }
    const composerBonus = isComposer(editor) ? 100 : 0;
    const autofocusBonus = editor.hasAttribute("autofocus") ? 40 : 0;
    let editorTypeScore = 0;
    if (editor.isContentEditable) {
      editorTypeScore = 30;
    } else if (editor.tagName === "TEXTAREA") {
      editorTypeScore = 20;
    } else if (editor.tagName === "INPUT") {
      editorTypeScore = 10;
    }
    const score = composerBonus + autofocusBonus + editorTypeScore;
    if (score > bestScore) {
      preferred = editor;
      bestScore = score;
    }
  }
  return preferred;
}

// src/hint-layout.js
var GAP = 3;
var VIEWPORT_PADDING = 4;
var CELL_SIZE = 64;
var SEARCH_RADIUS = 4;
var NEARBY_OFFSETS = [];
for (let y = -SEARCH_RADIUS; y <= SEARCH_RADIUS; y++) {
  for (let x = -SEARCH_RADIUS; x <= SEARCH_RADIUS; x++) {
    NEARBY_OFFSETS.push({ x, y });
  }
}
NEARBY_OFFSETS.sort(
  (a, b) => a.x * a.x + a.y * a.y - b.x * b.x - b.y * b.y || Math.abs(a.x) - Math.abs(b.x)
);
var OccupiedSpace = class {
  constructor() {
    this.cells = /* @__PURE__ */ new Map();
  }
  overlaps(box) {
    const firstColumn = Math.floor((box.left - GAP) / CELL_SIZE);
    const lastColumn = Math.floor((box.left + box.width + GAP) / CELL_SIZE);
    const firstRow = Math.floor((box.top - GAP) / CELL_SIZE);
    const lastRow = Math.floor((box.top + box.height + GAP) / CELL_SIZE);
    for (let row = firstRow; row <= lastRow; row++) {
      for (let column = firstColumn; column <= lastColumn; column++) {
        const neighbors = this.cells.get(`${column},${row}`);
        if (!neighbors) {
          continue;
        }
        for (const other of neighbors) {
          if (box.left < other.left + other.width + GAP && box.left + box.width + GAP > other.left && box.top < other.top + other.height + GAP && box.top + box.height + GAP > other.top) {
            return true;
          }
        }
      }
    }
    return false;
  }
  add(box) {
    for (let row = Math.floor(box.top / CELL_SIZE); row <= Math.floor((box.top + box.height) / CELL_SIZE); row++) {
      for (let column = Math.floor(box.left / CELL_SIZE); column <= Math.floor((box.left + box.width) / CELL_SIZE); column++) {
        const key = `${column},${row}`;
        const cell = this.cells.get(key);
        if (cell) {
          cell.push(box);
        } else {
          this.cells.set(key, [box]);
        }
      }
    }
  }
};
function layoutHints(boxes, viewport) {
  const availableWidth = viewport.width - VIEWPORT_PADDING * 2;
  const availableHeight = viewport.height - VIEWPORT_PADDING * 2;
  const fits = (box) => box.width > 0 && box.height > 0 && box.width <= availableWidth && box.height <= availableHeight;
  let maxWidth = 0;
  let maxHeight = 0;
  for (const box of boxes) {
    if (!fits(box)) {
      continue;
    }
    maxWidth = Math.max(maxWidth, box.width);
    maxHeight = Math.max(maxHeight, box.height);
  }
  const columns = Math.floor((availableWidth + GAP) / (maxWidth + GAP));
  const rows = Math.floor((availableHeight + GAP) / (maxHeight + GAP));
  const occupied = new OccupiedSpace();
  let fallbackSlot = 0;
  return boxes.map((box) => {
    if (!fits(box)) {
      return null;
    }
    const left = Math.max(
      VIEWPORT_PADDING,
      Math.min(box.left, viewport.width - VIEWPORT_PADDING - box.width)
    );
    const top = Math.max(
      VIEWPORT_PADDING,
      Math.min(box.top, viewport.height - VIEWPORT_PADDING - box.height)
    );
    let placement = null;
    for (const offset of NEARBY_OFFSETS) {
      const candidate = {
        left: left + offset.x * (box.width + GAP),
        top: top + offset.y * (box.height + GAP),
        width: box.width,
        height: box.height
      };
      if (candidate.left < VIEWPORT_PADDING || candidate.top < VIEWPORT_PADDING || candidate.left + box.width > viewport.width - VIEWPORT_PADDING || candidate.top + box.height > viewport.height - VIEWPORT_PADDING) {
        continue;
      }
      if (!occupied.overlaps(candidate)) {
        placement = candidate;
        break;
      }
    }
    while (!placement && fallbackSlot < columns * rows) {
      const slot = fallbackSlot++;
      const candidate = {
        left: VIEWPORT_PADDING + slot % columns * (maxWidth + GAP),
        top: VIEWPORT_PADDING + Math.floor(slot / columns) * (maxHeight + GAP),
        width: box.width,
        height: box.height
      };
      if (!occupied.overlaps(candidate)) {
        placement = candidate;
      }
    }
    if (placement) {
      occupied.add(placement);
    }
    return placement;
  });
}

// src/hints.js
var HINT_ALPHABET = "ASDFGHJKLQWERTYUIOPZXCVBNM";
var CLICKABLE_SELECTOR = [
  "button",
  "a[href]",
  'input:not([type="hidden"])',
  "textarea",
  "select",
  '[role="button"]',
  '[role="link"]',
  '[role="checkbox"]',
  '[role="radio"]',
  '[role="switch"]',
  '[role="tab"]',
  '[role="treeitem"]',
  '[role="menuitem"]',
  '[role="menuitemcheckbox"]',
  '[role="menuitemradio"]',
  '[role="option"]',
  '[role="combobox"]',
  '[role="textbox"]',
  '[contenteditable="true"]',
  '[contenteditable=""]',
  '[contenteditable="plaintext-only"]',
  '[tabindex]:not([tabindex="-1"])',
  '[class*="clickable_"]',
  '[class*="clickTrapContainer_"]',
  '[class*="folderButtonInner_"]',
  '[class*="backdrop_"]'
].join(",");
var EXCLUDED_SELECTOR = [
  OWNED_SELECTOR,
  "[hidden]",
  '[aria-hidden="true"]',
  "[inert]",
  '[aria-disabled="true"]',
  '[role="separator"]',
  '[class*="sidebarResizeHandle_"]',
  "button:disabled"
].join(",");
var POINT_FRACTIONS = [
  [0.5, 0.5],
  [0.2, 0.2],
  [0.8, 0.2],
  [0.2, 0.8],
  [0.8, 0.8],
  [0.5, 0.2],
  [0.5, 0.8],
  [0.2, 0.5],
  [0.8, 0.5]
];
var generateHintLabels = (count) => {
  if (count <= 0) {
    return [];
  }
  const alphabet = [...HINT_ALPHABET];
  const labels = [];
  let level = alphabet;
  let remaining = count;
  while (remaining > level.length) {
    const expansions = Math.min(
      level.length,
      Math.ceil((remaining - level.length) / (alphabet.length - 1))
    );
    const keep = level.length - expansions;
    labels.push(...level.slice(0, keep));
    remaining -= keep;
    level = level.slice(keep).flatMap((prefix) => alphabet.map((char) => prefix + char));
  }
  labels.push(...level.slice(0, remaining));
  return labels;
};
var measureTarget = (element, viewport) => {
  if (!element.isConnected || element.closest(EXCLUDED_SELECTOR) || element.matches(":disabled")) {
    return null;
  }
  const style = window.getComputedStyle(element);
  if (style.visibility !== "visible" || style.display === "none" || style.opacity === "0" || style.pointerEvents === "none") {
    return null;
  }
  const rect = element.getBoundingClientRect();
  const left = Math.max(0, rect.left);
  const top = Math.max(0, rect.top);
  const right = Math.min(viewport.width, rect.right);
  const bottom = Math.min(viewport.height, rect.bottom);
  if (right <= left || bottom <= top) {
    return null;
  }
  let anchor = null;
  for (const [fx, fy] of POINT_FRACTIONS) {
    const x = left + (right - left) * fx;
    const y = top + (bottom - top) * fy;
    const hit = document.elementFromPoint(x, y);
    if (hit && element.contains(hit)) {
      anchor = { x, y };
      break;
    }
  }
  if (!anchor) {
    return null;
  }
  const parsedZ = Number.parseInt(style.zIndex, 10);
  const z = Number.isFinite(parsedZ) ? parsedZ : 0;
  const area = (right - left) * (bottom - top);
  const distance = Math.hypot(
    (left + right - viewport.width) / 2,
    (top + bottom - viewport.height) / 2
  );
  return { element, anchor, score: z * 1e9 + area * 1e3 - distance };
};
var viewportSize = () => ({ width: window.innerWidth, height: window.innerHeight });
var SVG_NAMESPACE = "http://www.w3.org/2000/svg";
var createConnector = (anchor, box) => {
  const endX = Math.max(box.left, Math.min(anchor.x, box.left + box.width));
  const endY = Math.max(box.top, Math.min(anchor.y, box.top + box.height));
  if (Math.hypot(endX - anchor.x, endY - anchor.y) < 3) {
    return null;
  }
  const group = document.createElementNS(SVG_NAMESPACE, "g");
  group.classList.add("vimcord-hint-connector");
  const line = document.createElementNS(SVG_NAMESPACE, "line");
  line.setAttribute("x1", anchor.x);
  line.setAttribute("y1", anchor.y);
  line.setAttribute("x2", endX);
  line.setAttribute("y2", endY);
  const dot = document.createElementNS(SVG_NAMESPACE, "circle");
  dot.setAttribute("cx", anchor.x);
  dot.setAttribute("cy", anchor.y);
  dot.setAttribute("r", "1.5");
  group.append(line, dot);
  return group;
};
var HintSession = class {
  constructor({ onSelect, onCancel }) {
    this.onSelect = onSelect;
    this.onCancel = onCancel;
    this.root = null;
    this.entries = [];
    this.matches = [];
    this.labels = /* @__PURE__ */ new Map();
    this.prefix = "";
    this.cancelForViewport = () => this.cancel();
    this.cancelForPointer = (event) => {
      if (event.isTrusted) {
        this.cancel();
      }
    };
  }
  get active() {
    return this.root !== null;
  }
  start() {
    this.stop();
    const viewport = viewportSize();
    const targets = [];
    for (const element of document.querySelectorAll(CLICKABLE_SELECTOR)) {
      const target = measureTarget(element, viewport);
      if (target) {
        targets.push(target);
      }
    }
    targets.sort((a, b) => b.score - a.score);
    if (targets.length === 0) {
      return false;
    }
    const labels = generateHintLabels(targets.length);
    const root = document.createElement("div");
    root.dataset.vimcord = "hints";
    root.className = "vimcord-hints";
    root.setAttribute("aria-hidden", "true");
    Object.assign(root.style, {
      position: "fixed",
      inset: "0",
      pointerEvents: "none",
      zIndex: "2147483647",
      visibility: "hidden"
    });
    const fragment = document.createDocumentFragment();
    this.entries = targets.map((target, index) => {
      const label = labels[index];
      const overlay = document.createElement("div");
      overlay.className = "vimcord-hint is-match";
      overlay.textContent = label;
      Object.assign(overlay.style, {
        position: "absolute",
        left: `${target.anchor.x}px`,
        top: `${target.anchor.y}px`,
        pointerEvents: "none"
      });
      fragment.appendChild(overlay);
      const entry = {
        element: target.element,
        label,
        overlay,
        connector: null,
        visible: true
      };
      this.labels.set(label, entry);
      return entry;
    });
    root.appendChild(fragment);
    this.root = root;
    document.body.appendChild(root);
    const boxes = this.entries.map((entry) => entry.overlay.getBoundingClientRect());
    const placements = layoutHints(boxes, viewport);
    const connectors = document.createElementNS(SVG_NAMESPACE, "svg");
    connectors.classList.add("vimcord-hint-connectors");
    connectors.setAttribute("width", viewport.width);
    connectors.setAttribute("height", viewport.height);
    this.entries = this.entries.filter((entry, index) => {
      const placement = placements[index];
      if (!placement) {
        entry.overlay.remove();
        this.labels.delete(entry.label);
        return false;
      }
      const anchor = targets[index].anchor;
      entry.overlay.style.left = `${anchor.x + placement.left - boxes[index].left}px`;
      entry.overlay.style.top = `${anchor.y + placement.top - boxes[index].top}px`;
      entry.connector = createConnector(anchor, placement);
      if (entry.connector) {
        connectors.appendChild(entry.connector);
      }
      return true;
    });
    if (this.entries.length === 0) {
      this.stop();
      return false;
    }
    if (connectors.childElementCount) {
      root.prepend(connectors);
    }
    this.matches = this.entries;
    root.style.visibility = "";
    window.addEventListener("scroll", this.cancelForViewport, { capture: true, passive: true });
    window.addEventListener("resize", this.cancelForViewport, { passive: true });
    window.addEventListener("pointerdown", this.cancelForPointer, {
      capture: true,
      passive: true
    });
    window.addEventListener("wheel", this.cancelForPointer, { capture: true, passive: true });
    return true;
  }
  handleKey(event) {
    if (!this.active) {
      return false;
    }
    if (event.key === "Escape") {
      this.cancel();
      return true;
    }
    if (event.key === "Backspace") {
      this.updatePrefix(this.prefix.slice(0, -1));
      return true;
    }
    if (event.key === "Enter") {
      const exact = this.labels.get(this.prefix);
      if (exact || this.matches.length === 1) {
        this.select(exact || this.matches[0]);
      }
      return true;
    }
    if (!/^[a-z]$/i.test(event.key)) {
      return false;
    }
    const prefix = this.prefix + event.key.toUpperCase();
    if (this.updatePrefix(prefix)) {
      const exact = this.labels.get(prefix);
      if (exact) {
        this.select(exact);
      }
    }
    return true;
  }
  updatePrefix(prefix) {
    const candidates = prefix.length > this.prefix.length ? this.matches : this.entries;
    const matches = candidates.filter((entry) => entry.label.startsWith(prefix));
    if (matches.length === 0) {
      return false;
    }
    for (const entry of this.matches) {
      if (!entry.label.startsWith(prefix)) {
        entry.visible = false;
        entry.overlay.hidden = true;
        entry.overlay.classList.add("is-hidden");
        entry.overlay.classList.remove("is-match", "is-exact");
        entry.connector?.classList.add("is-hidden");
      }
    }
    for (const entry of matches) {
      if (!entry.visible) {
        entry.visible = true;
        entry.overlay.hidden = false;
        entry.overlay.classList.remove("is-hidden");
        entry.overlay.classList.add("is-match");
        entry.connector?.classList.remove("is-hidden");
      }
      entry.overlay.classList.toggle("is-exact", entry.label === prefix);
    }
    this.prefix = prefix;
    this.matches = matches;
    return true;
  }
  select(entry) {
    const target = measureTarget(entry.element, viewportSize());
    if (!target) {
      this.cancel();
      return;
    }
    const element = entry.element;
    this.stop();
    this.onSelect(element);
  }
  cancel() {
    if (!this.active) {
      return;
    }
    this.stop();
    this.onCancel();
  }
  stop() {
    window.removeEventListener("scroll", this.cancelForViewport, true);
    window.removeEventListener("resize", this.cancelForViewport);
    window.removeEventListener("pointerdown", this.cancelForPointer, true);
    window.removeEventListener("wheel", this.cancelForPointer, true);
    this.root?.remove();
    this.root = null;
    this.entries = [];
    this.matches = [];
    this.labels.clear();
    this.prefix = "";
  }
};

// src/indicator.js
var USER_PANEL_SELECTOR = 'section[class*="panels_"]';
var ModeIndicator = class {
  constructor() {
    this.element = document.createElement("div");
    this.element.dataset.vimcord = "indicator";
    this.element.className = "vim-indicator-container vimcord-indicator-container";
    this.label = document.createElement("span");
    this.label.className = "vim-indicator vimcord-indicator";
    this.element.append(this.label);
  }
  update(mode, paneLabel, dialog = null) {
    const candidate = dialog ? null : document.querySelector(USER_PANEL_SELECTOR);
    const panel = candidate && isVisible(candidate) ? candidate : null;
    const parent = dialog ?? panel ?? document.body;
    if (this.element.parentElement !== parent) {
      parent.append(this.element);
    }
    this.element.classList.toggle("is-floating", !!dialog || !panel);
    const modeLabel = { normal: "Normal", insert: "Insert", hint: "Hint" }[mode];
    const text = `${modeLabel}${paneLabel ? ` | Focus: ${paneLabel}` : ""}`;
    if (this.label.textContent !== text) {
      this.label.textContent = text;
    }
  }
  stop() {
    this.element.remove();
  }
};

// src/panes.js
var PANE_DEFINITIONS = [
  {
    key: "servers",
    label: "Server List",
    list: '[data-list-id="guildsnav"]',
    container: '[class*="guilds_"]'
  },
  { key: "channels", label: "Channel List", list: '#channels, [data-list-id="channels"]' },
  {
    key: "dms",
    label: "DM List",
    list: '[data-list-id="private-channels"]',
    container: '[class*="privateChannels_"]'
  },
  {
    key: "friends",
    label: "Friends List",
    list: '[data-list-id="people"]',
    container: '[class*="peopleList_"]'
  },
  {
    key: "chat",
    label: "Channel",
    list: '[data-list-id="chat-messages"]',
    container: '[class*="messagesWrapper_"]'
  },
  {
    key: "members",
    label: "Member List",
    list: '[data-list-id^="members-"]',
    container: '[class*="membersWrap_"]'
  }
];
var SCROLLER_SELECTOR = '[class*="scroller" i], [data-list-id], [role="list"], [role="listbox"]';
var PANES_SELECTOR = `${PANE_DEFINITIONS.flatMap((pane) => [pane.list, pane.container]).filter(Boolean).join(", ")}, ${DIALOG_SELECTOR}`;
function paneMutationRelevant(record) {
  if (record.type === "attributes") {
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
  for (let candidate = anchor; candidate && candidate !== document.body; candidate = candidate.parentElement) {
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
var PaneManager = class {
  constructor() {
    this.panes = [];
    this.active = null;
    this.backgroundActive = null;
    this.dialog = null;
  }
  refresh() {
    const next = [];
    const used = /* @__PURE__ */ new Set();
    const dialog = activeDialog();
    let defaultDialogPane = null;
    if (dialog) {
      if (!this.dialog) {
        this.backgroundActive = this.active;
      }
      const surfaces = [dialog, ...dialog.querySelectorAll(SCROLLER_SELECTOR)].filter((element) => !element.closest(OWNED_SELECTOR) && scrollSurface(element)).map((element) => ({ element, rect: element.getBoundingClientRect() })).sort((a, b) => a.rect.left - b.rect.left || a.rect.top - b.rect.top);
      for (const [index, surface] of surfaces.entries()) {
        const pane = {
          key: "dialog",
          label: surfaces.length > 1 ? `Dialog ${index + 1}` : "Dialog",
          element: surface.element
        };
        next.push(pane);
        if (!defaultDialogPane || pane.element.clientWidth * pane.element.clientHeight > defaultDialogPane.element.clientWidth * defaultDialogPane.element.clientHeight) {
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
    const active = next.find((pane) => pane.element === previous?.element) || (dialog ? defaultDialogPane : next.find((pane) => pane.key === previous?.key)) || next.find((pane) => pane.key === "chat") || next.find((pane) => pane.key !== "servers") || next[0] || null;
    const changed = active?.element !== this.active?.element || next.length !== this.panes.length || next.some(
      (pane, index) => pane.element !== this.panes[index]?.element || pane.label !== this.panes[index]?.label
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
    this.active = this.panes[Math.max(0, Math.min(this.panes.length - 1, index + Math.sign(direction)))];
  }
  scroll(delta) {
    if (!this.active || !scrollSurface(this.active.element)) {
      this.refresh();
    }
    const element = this.active?.element;
    if (!element) {
      return;
    }
    element.scrollBy({ top: delta, behavior: "instant" });
  }
  get label() {
    return this.active?.label || "";
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
};

// src/settings.js
var PLUGIN_NAME = "VimCord";
var DEFAULT_SCROLL_AMOUNT = 80;
var DEFAULT_KEYBINDS = Object.freeze({
  hint: "f",
  paneLeft: "h",
  paneRight: "l",
  scrollDown: "j",
  scrollUp: "k",
  halfPageDown: "d",
  halfPageUp: "u",
  insert: "i"
});
var KEYBIND_LABELS = Object.freeze({
  hint: "Hint mode (click elements)",
  paneLeft: "Focus pane to the left",
  paneRight: "Focus pane to the right",
  scrollDown: "Scroll down",
  scrollUp: "Scroll up",
  halfPageDown: "Half page down",
  halfPageUp: "Half page up",
  insert: "Insert mode (focus input)"
});
var ACTIONS = Object.keys(DEFAULT_KEYBINDS);
var HALF_PAGE_ACTIONS = /* @__PURE__ */ new Set(["halfPageDown", "halfPageUp"]);
function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function isBindableKey(key) {
  return typeof key === "string" && /^[\p{L}\p{N}\p{P}\p{S} ]$/u.test(key);
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
  const assigned = /* @__PURE__ */ new Map();
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
  if (typeof raw !== "number" && typeof raw !== "string" || typeof raw === "string" && !raw.trim()) {
    throw new Error("Enter a number of pixels between 10 and 1000.");
  }
  const amount = Number(raw);
  if (!Number.isFinite(amount)) {
    throw new Error("Enter a number of pixels between 10 and 1000.");
  }
  return Math.min(1e3, Math.max(10, Math.round(amount)));
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
var PluginSettings = class {
  constructor(storage = BdApi.Data) {
    this.storage = storage;
    const saved = this.load("settings");
    const savedKeybinds = isRecord(saved) && Object.hasOwn(saved, "keybinds") ? saved.keybinds : this.load("keybinds");
    let scrollAmount = DEFAULT_SCROLL_AMOUNT;
    if (isRecord(saved) && Object.hasOwn(saved, "scrollAmount")) {
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
      return void 0;
    }
  }
  save(next) {
    try {
      this.storage.save(PLUGIN_NAME, "settings", {
        scrollAmount: next.scrollAmount,
        keybinds: { ...next.keybinds }
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
      throw new Error("Unknown VimCord action.");
    }
    if (!isBindableKey(key)) {
      throw new Error("Use one visible character or Space for a keybind.");
    }
    const keybinds = { ...this.keybinds, [action]: key };
    const conflict = findConflict(keybinds);
    if (conflict) {
      const otherAction = conflict.first === action ? conflict.second : conflict.first;
      const displayKey = conflict.key === " " ? "Space" : conflict.key;
      throw new Error(`"${displayKey}" is already used for: ${KEYBIND_LABELS[otherAction]}.`);
    }
    this.save({ scrollAmount: this.scrollAmount, keybinds: Object.freeze(keybinds) });
  }
  reset() {
    this.save({ scrollAmount: DEFAULT_SCROLL_AMOUNT, keybinds: DEFAULT_KEYBINDS });
  }
};

// src/settings.css
var settings_default = ".vimcord-settings {\n    padding: 16px;\n    color: var(--header-primary, #f2f3f5);\n    font-size: 14px;\n    line-height: 1.5;\n}\n\n.vimcord-settings .vimcord-settings-heading {\n    margin: 20px 0 12px;\n    color: var(--header-primary, #f2f3f5);\n    font-size: 20px;\n    font-weight: 700;\n}\n\n.vimcord-settings .vimcord-settings-heading:first-of-type {\n    margin-top: 0;\n}\n\n.vimcord-settings-description {\n    margin: 0 0 12px;\n    color: var(--header-secondary, #b5bac1);\n}\n\n.vimcord-settings-row {\n    display: flex;\n    flex-wrap: wrap;\n    align-items: center;\n    justify-content: space-between;\n    gap: 8px 16px;\n    padding: 10px 0;\n    border-bottom: 1px solid var(--background-modifier-accent, #4e5058);\n}\n\n.vimcord-settings-input,\n.vimcord-settings-key {\n    box-sizing: border-box;\n    min-height: 34px;\n    padding: 5px 10px;\n    border: 1px solid var(--background-modifier-accent, #4e5058);\n    border-radius: 4px;\n    background: var(--background-secondary, #2b2d31);\n    color: var(--header-primary, #f2f3f5);\n    font: inherit;\n}\n\n.vimcord-settings-input {\n    width: 100px;\n    max-width: 100%;\n}\n\n.vimcord-settings-key {\n    min-width: 100px;\n    font-weight: 600;\n    cursor: pointer;\n}\n\n.vimcord-settings-key:hover,\n.vimcord-settings-key.is-capturing {\n    background: var(--background-modifier-hover, #404249);\n}\n\n.vimcord-settings-input:focus-visible,\n.vimcord-settings-key:focus-visible,\n.vimcord-settings-reset:focus-visible {\n    outline: 2px solid var(--text-link, #00a8fc);\n    outline-offset: 2px;\n}\n\n.vimcord-settings-status {\n    min-height: 20px;\n    margin: 12px 0;\n    color: var(--header-secondary, #b5bac1);\n    font-size: 13px;\n}\n\n.vimcord-settings-status.is-error {\n    color: var(--text-danger, #fa777c);\n}\n\n.vimcord-settings-reset {\n    min-height: 34px;\n    padding: 6px 12px;\n    border: 0;\n    border-radius: 4px;\n    background: var(--button-secondary-background, #4e5058);\n    color: var(--button-secondary-text, #fff);\n    font: inherit;\n    cursor: pointer;\n}\n\n.vimcord-settings-reset:hover {\n    background: var(--button-secondary-background-hover, #6d6f78);\n}\n";

// src/settings-panel.js
var MODIFIER_KEYS = /* @__PURE__ */ new Set(["Shift", "Control", "Alt", "Meta", "CapsLock", "AltGraph"]);
var nextPanelId = 0;
function keyLabel(key) {
  return key === " " ? "Space" : key;
}
function createElement(tag, className, text) {
  const element = document.createElement(tag);
  element.className = className;
  if (text !== void 0) {
    element.textContent = text;
  }
  return element;
}
var SettingsPanel = class {
  constructor(settings) {
    this.settings = settings;
    this.listeners = new AbortController();
    this.buttons = /* @__PURE__ */ new Map();
    this.captureAction = null;
    const panelId = `vimcord-settings-${++nextPanelId}`;
    this.element = createElement("div", "vimcord-settings");
    this.element.dataset.vimcordSettings = "";
    const style = document.createElement("style");
    style.textContent = settings_default;
    this.element.append(style);
    this.element.append(createElement("h2", "vimcord-settings-heading", "Preferences"));
    const scrollRow = createElement("div", "vimcord-settings-row");
    const scrollLabel = createElement("label", "", "Scroll amount (pixels)");
    scrollLabel.htmlFor = `${panelId}-scroll`;
    this.scrollInput = createElement("input", "vimcord-settings-input");
    this.scrollInput.id = scrollLabel.htmlFor;
    this.scrollInput.type = "number";
    this.scrollInput.min = "10";
    this.scrollInput.max = "1000";
    this.scrollInput.step = "1";
    this.listen(this.scrollInput, "change", () => this.saveScrollAmount());
    scrollRow.append(scrollLabel, this.scrollInput);
    this.element.append(scrollRow);
    this.element.append(createElement("h2", "vimcord-settings-heading", "Keybinds"));
    const instructions = createElement(
      "p",
      "vimcord-settings-description",
      "Select a key, then press its replacement. Shifted characters and Space are supported. Escape cancels."
    );
    instructions.id = `${panelId}-instructions`;
    this.element.append(instructions);
    for (const [action, label] of Object.entries(KEYBIND_LABELS)) {
      const row = createElement("div", "vimcord-settings-row");
      const button = createElement("button", "vimcord-settings-key");
      button.type = "button";
      button.dataset.action = action;
      button.setAttribute("aria-describedby", instructions.id);
      this.listen(button, "click", () => this.beginCapture(action));
      this.listen(button, "keydown", (event) => this.captureKey(event, action));
      this.listen(button, "blur", () => {
        if (this.captureAction === action) {
          this.cancelCapture();
        }
      });
      this.buttons.set(action, button);
      row.append(createElement("span", "", label), button);
      this.element.append(row);
    }
    this.status = createElement("p", "vimcord-settings-status");
    this.status.setAttribute("role", "status");
    this.status.setAttribute("aria-live", "polite");
    this.status.setAttribute("aria-atomic", "true");
    this.element.append(this.status);
    const resetButton = createElement("button", "vimcord-settings-reset", "Reset to defaults");
    resetButton.type = "button";
    this.listen(resetButton, "click", () => this.confirmReset());
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
      button.textContent = capturing ? "Press a key\u2026" : binding;
      button.classList.toggle("is-capturing", capturing);
      button.setAttribute(
        "aria-label",
        `${KEYBIND_LABELS[action]}: ${capturing ? "press a new key" : binding}`
      );
    }
  }
  setStatus(message, isError = false) {
    this.status.textContent = message;
    this.status.classList.toggle("is-error", isError);
  }
  saveScrollAmount() {
    try {
      this.settings.setScrollAmount(this.scrollInput.value);
      this.setStatus("Scroll amount saved.");
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
    this.setStatus("Key change canceled.");
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
    if (event.key === "Tab") {
      this.cancelCapture();
      return;
    }
    if (event.repeat || event.isComposing || event.key === "Dead" || MODIFIER_KEYS.has(event.key)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    this.cancelCapture();
    if (event.key === "Escape") {
      return;
    }
    if (event.ctrlKey || event.altKey || event.metaKey) {
      this.setStatus("Control, Alt, and Meta key combinations are not supported.", true);
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
        "Reset to defaults?",
        "This will restore all keybinds and preferences to their default values.",
        {
          confirmText: "Reset",
          cancelText: "Cancel",
          danger: true,
          onConfirm: () => {
            if (this.listeners.signal.aborted) {
              return;
            }
            try {
              this.settings.reset();
              this.render();
              this.setStatus("Keybinds and preferences reset to defaults.");
            } catch (error) {
              this.setStatus(error.message, true);
            }
          }
        }
      );
    } catch (error) {
      this.setStatus(error.message, true);
    }
  }
  dispose() {
    this.cancelCapture();
    this.listeners.abort();
  }
};

// src/styles.css
var styles_default = ".vimcord-indicator-container {\n    width: 100%;\n    padding: 4px 8px;\n    box-sizing: border-box;\n    font-size: 12px;\n    font-weight: 600;\n    border-top: 1px solid var(--vimcord-indicator-border, rgba(255, 255, 255, 0.05));\n    background: var(--vimcord-indicator-bg, var(--background-secondary, #181825));\n    color: var(--vimcord-indicator-fg, var(--text-normal, #fff));\n    white-space: nowrap;\n    overflow: hidden;\n    text-overflow: ellipsis;\n    pointer-events: none;\n    flex-shrink: 0;\n}\n\n.vimcord-indicator-container.is-floating {\n    position: fixed;\n    bottom: 8px;\n    left: 8px;\n    width: auto;\n    z-index: 2147483646;\n    border-radius: 4px;\n}\n\n.vimcord-indicator {\n    font-family: var(--vimcord-font, inherit);\n}\n\n[data-vimcord='hints'] {\n    position: fixed;\n    inset: 0;\n    z-index: 2147483647;\n    pointer-events: none;\n    contain: layout style;\n}\n\n.vimcord-hint {\n    position: absolute;\n    background: var(--vimcord-hint-bg, #ffd700);\n    color: var(--vimcord-hint-fg, #000);\n    border: 1px solid var(--vimcord-hint-border, #333);\n    border-radius: var(--vimcord-hint-radius, 4px);\n    padding: var(--vimcord-hint-padding, 2px 5px);\n    font: 700 var(--vimcord-hint-size, 12px) var(--vimcord-font, ui-monospace, monospace);\n    line-height: 1.2;\n    pointer-events: none;\n    user-select: none;\n    transform: translate(-50%, -50%);\n    white-space: nowrap;\n}\n\n.vimcord-hint.is-hidden {\n    display: none;\n}\n.vimcord-hint.is-match {\n    opacity: 1;\n}\n.vimcord-hint.is-exact {\n    box-shadow: 0 0 0 2px currentColor inset;\n}\n\n.vimcord-hint-connectors {\n    position: absolute;\n    inset: 0;\n    overflow: visible;\n    pointer-events: none;\n    color: var(--vimcord-hint-bg, #ffd700);\n}\n\n.vimcord-hint-connector {\n    stroke: currentColor;\n    stroke-width: 1;\n    fill: currentColor;\n    opacity: 0.65;\n}\n\n.vimcord-hint-connector.is-hidden {\n    display: none;\n}\n";

// src/index.js
var VimCord = class {
  constructor() {
    this.settings = new PluginSettings();
    this.settingsPanel = null;
  }
  getSettingsPanel() {
    this.settingsPanel?.dispose();
    this.settingsPanel = new SettingsPanel(this.settings);
    return this.settingsPanel.element;
  }
  start() {
    if (this.running) {
      return;
    }
    this.running = true;
    this.mode = "normal";
    this.frame = null;
    this.allowInputFocusUntil = 0;
    this.events = new AbortController();
    this.panes = new PaneManager();
    this.indicator = new ModeIndicator();
    this.hints = new HintSession({
      onSelect: (element) => this.activate(element),
      onCancel: () => this.setMode("normal")
    });
    try {
      BdApi.DOM.addStyle("VimCord", styles_default);
      const capture = { capture: true, signal: this.events.signal };
      document.addEventListener("keydown", (event) => this.onKeyDown(event), capture);
      document.addEventListener("focusin", (event) => this.onFocus(event), capture);
      document.addEventListener(
        "pointerdown",
        (event) => {
          const target = event.target instanceof Element ? event.target : null;
          const editor2 = editableTarget(target) || editableTarget(target?.closest("label")?.control);
          this.allowInputFocusUntil = editor2 ? performance.now() + 500 : 0;
        },
        capture
      );
      window.addEventListener("resize", () => this.scheduleRefresh(), {
        signal: this.events.signal
      });
      this.observer = new MutationObserver((records) => this.onMutations(records));
      this.observer.observe(document.body, { childList: true, subtree: true });
      this.refresh();
      const editor = editableTarget(document.activeElement);
      if (editor) {
        this.setMode("insert");
      }
    } catch (error) {
      this.stop();
      throw error;
    }
  }
  stop() {
    this.running = false;
    this.settingsPanel?.cancelCapture();
    this.events?.abort();
    this.observer?.disconnect();
    if (this.frame !== null && this.frame !== void 0) {
      cancelAnimationFrame(this.frame);
    }
    this.hints?.stop();
    this.panes?.stop();
    this.indicator?.stop();
    BdApi.DOM.removeStyle("VimCord");
    this.events = null;
    this.observer = null;
    this.hints = null;
    this.panes = null;
    this.indicator = null;
    this.frame = null;
    this.mode = "normal";
    this.allowInputFocusUntil = 0;
  }
  onSwitch() {
    if (!this.running) {
      return;
    }
    if (this.mode === "hint") {
      this.setMode("normal");
    }
    this.scheduleRefresh();
  }
  onMutations(records) {
    if (!this.running) {
      return;
    }
    if (!this.indicator.element.isConnected) {
      this.scheduleRefresh();
      return;
    }
    for (const record of records) {
      if (record.target instanceof Element && record.target.closest(OWNED_SELECTOR)) {
        continue;
      }
      const changed = [...record.addedNodes, ...record.removedNodes];
      if (changed.length && changed.every((node) => node instanceof Element && node.matches(OWNED_SELECTOR))) {
        continue;
      }
      if (paneMutationRelevant(record) || changed.some(
        (node) => node instanceof Element && (node.matches(USER_PANEL_SELECTOR) || node.querySelector(USER_PANEL_SELECTOR))
      )) {
        this.scheduleRefresh();
        return;
      }
    }
  }
  scheduleRefresh() {
    if (!this.running || this.frame !== null) {
      return;
    }
    this.frame = requestAnimationFrame(() => {
      this.frame = null;
      if (this.running) {
        this.refresh();
      }
    });
  }
  refresh() {
    this.panes.refresh();
    this.indicator.update(this.mode, this.panes.label, this.panes.dialog);
  }
  setMode(mode) {
    if (!this.running || this.mode === mode) {
      return;
    }
    if (this.mode === "hint") {
      this.hints.stop();
    }
    this.mode = mode;
    if (mode === "hint" && !this.hints.start()) {
      this.mode = "normal";
    }
    this.indicator.update(this.mode, this.panes.label, this.panes.dialog);
  }
  onFocus(event) {
    const editor = editableTarget(event.target);
    if (!editor || this.mode === "insert") {
      return;
    }
    if (isComposer(editor) && performance.now() > this.allowInputFocusUntil) {
      editor.blur();
      return;
    }
    this.setMode("insert");
  }
  activate(element) {
    if (!element.isConnected) {
      this.setMode("normal");
      return;
    }
    const editor = editableTarget(element);
    this.setMode(editor ? "insert" : "normal");
    if (editor) {
      editor.focus({ preventScroll: true });
    } else if (typeof element.click === "function") {
      element.click();
    } else {
      element.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true, view: window })
      );
    }
  }
  onKeyDown(event) {
    if (event.target instanceof Element && event.target.closest("[data-vimcord-settings]")) {
      return;
    }
    if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing) {
      return;
    }
    if (event.key === "Tab") {
      this.allowInputFocusUntil = performance.now() + 500;
    }
    if (this.mode === "insert") {
      if (event.key !== "Escape") {
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      this.allowInputFocusUntil = 0;
      this.setMode("normal");
      editableTarget(document.activeElement)?.blur();
      return;
    }
    if (this.mode === "hint") {
      if (/^[a-z]$/i.test(event.key) || ["Escape", "Enter", "Backspace"].includes(event.key)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (!event.repeat) {
          this.hints.handleKey(event);
        }
      }
      return;
    }
    const action = this.settings.actionForKey(event.key);
    if (!action) {
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    switch (action) {
      case "hint":
        if (!event.repeat) {
          this.setMode("hint");
        }
        break;
      case "insert": {
        if (event.repeat) {
          break;
        }
        const editor = findPreferredInput();
        this.setMode("insert");
        editor?.focus({ preventScroll: true });
        break;
      }
      case "paneLeft":
        this.panes.move(-1);
        break;
      case "paneRight":
        this.panes.move(1);
        break;
      case "scrollDown":
        this.panes.scroll(this.settings.scrollAmount);
        break;
      case "scrollUp":
        this.panes.scroll(-this.settings.scrollAmount);
        break;
      case "halfPageDown":
        this.panes.scroll(this.panes.pageSize / 2);
        break;
      case "halfPageUp":
        this.panes.scroll(-this.panes.pageSize / 2);
        break;
    }
    this.indicator.update(this.mode, this.panes.label, this.panes.dialog);
  }
};
module.exports = module.exports.default;
