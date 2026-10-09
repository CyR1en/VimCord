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
function elementLabel(element4) {
  if (!element4) {
    return "";
  }
  const labelledBy = (element4.getAttribute("aria-labelledby") || "").split(/\s+/).filter(Boolean).map((id) => element4.ownerDocument.getElementById(id)?.textContent || "").join(" ").trim();
  const label = labelledBy || element4.getAttribute("aria-label") || [...element4.labels || []].map((node) => node.textContent).join(" ");
  return label.replace(/\s+/g, " ").trim();
}
function editableTarget(element4) {
  const target = element4?.nodeType === 1 ? element4 : element4?.parentElement;
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
function isVisible(element4) {
  if (!element4?.isConnected || element4.closest('[hidden], [inert], [aria-hidden="true"]')) {
    return false;
  }
  const rect = element4.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0 || rect.bottom <= 0 || rect.right <= 0 || rect.top >= window.innerHeight || rect.left >= window.innerWidth) {
    return false;
  }
  const style = getComputedStyle(element4);
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
function isComposer(element4) {
  const editor = editableTarget(element4);
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

// src/commands.js
var CommandSequence = class {
  constructor() {
    this.reset();
  }
  reset() {
    this.count = "";
    this.prefix = null;
    this.prefixKey = "";
  }
  get label() {
    return this.count + this.prefixKey;
  }
  feed(key, action, repeat = false) {
    if (this.prefix) {
      if (repeat) {
        return null;
      }
      const prefix = this.prefix;
      const count2 = Number(this.count) || 1;
      this.reset();
      if (prefix === "jumpTop") {
        return action === prefix ? { action: prefix, count: count2 } : null;
      }
      return /^[a-z]$/i.test(key) ? { action: prefix, mark: key.toLowerCase(), count: 1 } : null;
    }
    if (/^[0-9]$/.test(key)) {
      if (!repeat && (key !== "0" || this.count)) {
        this.count = String(Math.min(999, Number(this.count + key)));
      }
      return null;
    }
    if (["jumpTop", "setMark", "jumpMark"].includes(action)) {
      if (!repeat) {
        this.prefix = action;
        this.prefixKey = key;
      }
      return null;
    }
    const count = Number(this.count) || 1;
    this.reset();
    return action ? { action, count } : null;
  }
};

// src/settings.js
var PLUGIN_NAME = "VimCord";
var DEFAULT_SCROLL_AMOUNT = 80;
var DEFAULT_FOCUS_OUTLINE_FADE_DELAY = 3;
var DEFAULT_KEYBINDS = Object.freeze({
  hint: "f",
  paneLeft: "h",
  paneRight: "l",
  scrollDown: "j",
  scrollUp: "k",
  halfPageDown: "d",
  halfPageUp: "u",
  insert: "i",
  hintAll: "F",
  visual: "v",
  copyMessage: "y",
  replyMessage: "r",
  jumpTop: "g",
  jumpBottom: "G",
  setMark: "m",
  jumpMark: "'",
  help: "?",
  range: "V",
  historyBack: "H",
  historyForward: "L",
  manageMarks: "M",
  editMessage: "e",
  reactMessage: "+",
  copyMessageLink: "Y"
});
var KEYBIND_LABELS = Object.freeze({
  hint: "Hint mode (click elements)",
  paneLeft: "Focus pane to the left",
  paneRight: "Focus pane to the right",
  scrollDown: "Scroll down",
  scrollUp: "Scroll up",
  halfPageDown: "Half page down",
  halfPageUp: "Half page up",
  insert: "Insert mode (focus input)",
  hintAll: "Hints across the foreground view",
  visual: "Message selection mode",
  copyMessage: "Copy selected message",
  replyMessage: "Reply to selected message",
  jumpTop: "Go to top (press twice)",
  jumpBottom: "Go to bottom / latest messages",
  setMark: "Set channel mark (then a\u2013z)",
  jumpMark: "Jump to channel mark (then a\u2013z)",
  help: "Show contextual help",
  range: "Select a message range",
  historyBack: "Previous reading position",
  historyForward: "Next reading position",
  manageMarks: "Manage saved marks",
  editMessage: "Edit selected message",
  reactMessage: "Add a reaction to selected message",
  copyMessageLink: "Copy selected message link"
});
var EXTRA_PREFERENCES = Object.freeze({
  showSequenceHints: "Show key-sequence hints",
  rangeCopyAuthors: "Include author names when copying a range",
  rangeCopyTimestamps: "Include timestamps when copying a range"
});
var EXTRA_DEFAULTS = {
  showSequenceHints: true,
  rangeCopyAuthors: true,
  rangeCopyTimestamps: false
};
var ACTIONS = Object.keys(DEFAULT_KEYBINDS);
var HALF_PAGE_ACTIONS = /* @__PURE__ */ new Set(["halfPageDown", "halfPageUp"]);
var NEW_ACTIONS = /* @__PURE__ */ new Set([
  "hintAll",
  "visual",
  "copyMessage",
  "replyMessage",
  "jumpTop",
  "jumpBottom",
  "setMark",
  "jumpMark",
  "help",
  "range",
  "historyBack",
  "historyForward",
  "manageMarks",
  "editMessage",
  "reactMessage",
  "copyMessageLink"
]);
function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function isBindableKey(key) {
  return typeof key === "string" && /^[\p{L}\p{N}\p{P}\p{S} ]$/u.test(key) && !/^[0-9]$/.test(key);
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
function normalizeFocusOutlineFadeDelay(raw) {
  if (typeof raw !== "number" && typeof raw !== "string" || typeof raw === "string" && !raw.trim() || !Number.isFinite(Number(raw))) {
    throw new Error("Enter a number of seconds between 0.5 and 60.");
  }
  return Math.min(60, Math.max(0.5, Math.round(Number(raw) * 2) / 2));
}
function normalizeKeybinds(saved) {
  const keybinds = { ...DEFAULT_KEYBINDS };
  if (isRecord(saved)) {
    for (const action of ACTIONS) {
      if (Object.hasOwn(saved, action) && (saved[action] === null && NEW_ACTIONS.has(action) || isBindableKey(saved[action]))) {
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
    keybinds[unassigned] = null;
    conflict = findConflict(keybinds);
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
    const showFocusOutline = isRecord(saved) && typeof saved.showFocusOutline === "boolean" ? saved.showFocusOutline : true;
    let focusOutlineFadeDelay = DEFAULT_FOCUS_OUTLINE_FADE_DELAY;
    if (isRecord(saved) && Object.hasOwn(saved, "focusOutlineFadeDelay")) {
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
      hintsCurrentPane: isRecord(saved) && typeof saved.hintsCurrentPane === "boolean" ? saved.hintsCurrentPane : true,
      ...Object.fromEntries(
        Object.entries(EXTRA_DEFAULTS).map(([key, value]) => [
          key,
          isRecord(saved) && typeof saved[key] === "boolean" ? saved[key] : value
        ])
      )
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
      return void 0;
    }
  }
  save(next) {
    try {
      this.storage.save(PLUGIN_NAME, "settings", {
        scrollAmount: next.scrollAmount,
        keybinds: { ...next.keybinds },
        showFocusOutline: next.showFocusOutline,
        focusOutlineFadeDelay: next.focusOutlineFadeDelay,
        hintsCurrentPane: next.hintsCurrentPane,
        ...Object.fromEntries(Object.keys(EXTRA_DEFAULTS).map((key) => [key, next[key]]))
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to save VimCord settings: ${reason}`, { cause: error });
    }
    this.current = next;
  }
  actionForKey(key, mode = "normal") {
    return ACTIONS.find(
      (action) => actionsForMode(mode).includes(action) && effectiveKeys(action, this.keybinds[action]).includes(key)
    );
  }
  helpKeyForMode(mode) {
    const key = this.keybinds.help;
    return mode === "hint" && (!key || /^[a-z]$/i.test(key)) ? "?" : key;
  }
  setScrollAmount(raw) {
    const scrollAmount = normalizeScrollAmount(raw);
    this.save({ ...this.current, scrollAmount });
    return scrollAmount;
  }
  setKeybind(action, key) {
    if (!Object.hasOwn(DEFAULT_KEYBINDS, action)) {
      throw new Error("Unknown VimCord action.");
    }
    if (!isBindableKey(key)) {
      throw new Error("Use one visible character or Space. Digits are reserved for counts.");
    }
    const keybinds = { ...this.keybinds, [action]: key };
    const conflict = findConflict(keybinds);
    if (conflict) {
      const otherAction = conflict.first === action ? conflict.second : conflict.first;
      const displayKey = conflict.key === " " ? "Space" : conflict.key;
      throw new Error(`"${displayKey}" is already used for: ${KEYBIND_LABELS[otherAction]}.`);
    }
    this.save({ ...this.current, keybinds: Object.freeze(keybinds) });
  }
  setShowFocusOutline(showFocusOutline) {
    if (typeof showFocusOutline !== "boolean") {
      throw new Error("Choose whether to show the focus outline.");
    }
    this.save({ ...this.current, showFocusOutline });
  }
  setFocusOutlineFadeDelay(raw) {
    const focusOutlineFadeDelay = normalizeFocusOutlineFadeDelay(raw);
    this.save({ ...this.current, focusOutlineFadeDelay });
  }
  setHintsCurrentPane(value) {
    if (typeof value !== "boolean") {
      throw new Error("Choose whether to limit hints to the selected pane.");
    }
    this.save({ ...this.current, hintsCurrentPane: value });
  }
  preference(key) {
    return this.current[key];
  }
  setPreference(key, value) {
    if (!Object.hasOwn(EXTRA_DEFAULTS, key) || typeof value !== "boolean") {
      throw new Error("Choose a valid preference.");
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
      ...EXTRA_DEFAULTS
    });
  }
};
function actionsForMode(mode) {
  const messageActions = [
    "copyMessage",
    "replyMessage",
    "editMessage",
    "reactMessage",
    "copyMessageLink"
  ];
  if (mode === "hint") {
    return ["help"];
  }
  if (mode === "insert") {
    return [];
  }
  if (mode === "visual") {
    return ACTIONS.filter((action) => !HALF_PAGE_ACTIONS.has(action));
  }
  if (mode === "range") {
    return ACTIONS.filter(
      (action) => !HALF_PAGE_ACTIONS.has(action) && (!messageActions.includes(action) || action === "copyMessage")
    );
  }
  return ACTIONS.filter((action) => !messageActions.includes(action));
}

// src/help.js
var MODE_NAMES = {
  normal: "Normal",
  visual: "Message selection",
  range: "Message range",
  hint: "Hint",
  insert: "Insert"
};
function element(tag, text, className = "") {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
}
var ContextHelp = class {
  constructor() {
    this.root = null;
  }
  show(mode, settings) {
    this.close();
    this.previousFocus = document.activeElement;
    const root = element("div", "", "vimcord-help-backdrop");
    root.dataset.vimcord = "help";
    const dialog = element("section", "", "vimcord-help");
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", "vimcord-help-title");
    const title = element("h2", `VimCord \xB7 ${MODE_NAMES[mode]}`);
    title.id = "vimcord-help-title";
    const close = element("button", "Close", "vimcord-help-close");
    close.type = "button";
    close.addEventListener("click", () => this.close());
    const header = element("header", "");
    header.append(title, close);
    dialog.append(header);
    const list = element("dl", "", "vimcord-help-keys");
    const messageMode = mode === "visual" || mode === "range";
    const add = (key, description) => {
      if (!key) {
        return;
      }
      const term = element("dt", "");
      term.append(element("kbd", key));
      list.append(term, element("dd", description));
    };
    for (const action of actionsForMode(mode)) {
      let key = action === "help" ? settings.helpKeyForMode(mode) : settings.keybinds[action];
      if (!key) {
        continue;
      }
      key = key === " " ? "Space" : key;
      let label = KEYBIND_LABELS[action];
      if (action === "jumpTop") {
        key = `${key} ${key}`;
        label = messageMode ? "First loaded message" : "Top of selected pane";
      } else if (messageMode && action === "jumpBottom") {
        label = "Latest messages (returns to Normal)";
      } else if (action === "setMark" || action === "jumpMark") {
        key += " a\u2013z";
      } else if (messageMode && ["scrollDown", "scrollUp"].includes(action)) {
        label = action === "scrollDown" ? "Next message" : "Previous message";
        if (mode === "range") {
          label += " (extend or shrink range)";
        }
      } else if (mode === "range" && action === "copyMessage") {
        label = "Copy selected messages in chronological order";
      } else if (mode === "range" && action === "range") {
        label = "Return to single-message selection";
      } else if (messageMode && action === "visual") {
        label = "Leave message selection";
      } else if (action === "hint") {
        label = settings.hintsCurrentPane ? "Hints in selected pane" : "Hints in foreground view";
      }
      add(key, label);
    }
    if (mode === "hint") {
      add("A\u2013Z", "Narrow hints and activate a complete label");
      add("Backspace", "Undo a hint letter");
      add("Enter", "Activate the only matching hint");
    } else if (mode !== "insert") {
      add("1\u2013999", "Repeat the next movement (for example, 5 + your down key)");
    }
    add("Escape", mode === "normal" ? "Cancel an unfinished command" : "Return to Normal mode");
    dialog.append(list);
    dialog.append(
      element(
        "p",
        "Escape closes this help. Typing is available in Insert mode.",
        "vimcord-help-note"
      )
    );
    root.append(dialog);
    root.addEventListener("pointerdown", (event) => {
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
    if (event.key === "Escape" || event.key === helpKey) {
      this.close();
    } else if (event.key === "Tab") {
      this.root.querySelector("button").focus();
    } else if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End"].includes(event.key)) {
      const dialog = this.root.querySelector("section");
      if (event.key === "Home" || event.key === "End") {
        dialog.scrollTop = event.key === "Home" ? 0 : dialog.scrollHeight;
      } else {
        const sign = ["ArrowUp", "PageUp"].includes(event.key) ? -1 : 1;
        const distance = event.key.startsWith("Page") ? dialog.clientHeight : 60;
        dialog.scrollBy({ top: sign * distance, behavior: "instant" });
      }
    } else if (event.key === "Enter" || event.key === " ") {
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
};

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
var measureTarget = (element4, viewport) => {
  if (!element4.isConnected || element4.closest(EXCLUDED_SELECTOR) || element4.matches(":disabled")) {
    return null;
  }
  const style = window.getComputedStyle(element4);
  if (style.visibility !== "visible" || style.display === "none" || style.opacity === "0" || style.pointerEvents === "none") {
    return null;
  }
  const rect = element4.getBoundingClientRect();
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
    if (hit && element4.contains(hit)) {
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
  return { element: element4, anchor, score: z * 1e9 + area * 1e3 - distance };
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
  start(scope = document) {
    this.stop();
    if (!scope) {
      return false;
    }
    const viewport = viewportSize();
    const targets = [];
    const candidates = [...scope.querySelectorAll(CLICKABLE_SELECTOR)];
    if (scope.matches?.(CLICKABLE_SELECTOR)) {
      candidates.unshift(scope);
    }
    for (const element4 of candidates) {
      const target = measureTarget(element4, viewport);
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
    const element4 = entry.element;
    this.stop();
    this.onSelect(element4);
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

// src/history.js
var CHANNEL_PATH = /^\/channels\/(?:@me|\d+)\/\d+$/;
function captureReadingPosition(panes, messages) {
  const path = window.location.pathname.split("/").slice(0, 4).join("/");
  const pane = panes.panes.find((candidate) => candidate.key === "chat");
  if (panes.dialog || !pane?.element.isConnected || !CHANNEL_PATH.test(path)) {
    return null;
  }
  const channel = path.split("/")[3];
  const articles = [...pane.element.querySelectorAll('[id^="chat-messages-"] [role="article"]')];
  if (articles.some(
    (article) => !article.closest('[id^="chat-messages-"]').id.startsWith(`chat-messages-${channel}-`)
  )) {
    return null;
  }
  const bounds = pane.element.getBoundingClientRect();
  const anchor = articles.find((article) => {
    const rect = article.getBoundingClientRect();
    return rect.height > 0 && rect.bottom > bounds.top && rect.top < bounds.bottom;
  });
  return {
    path,
    anchorId: anchor?.closest('[id^="chat-messages-"]').id || null,
    offset: anchor ? anchor.getBoundingClientRect().top - bounds.top : 0,
    scrollTop: pane.element.scrollTop,
    selectedId: pane.element.contains(messages.selected) ? messages.rowId : null
  };
}
function samePosition(first, second) {
  return first.path === second.path && first.anchorId === second.anchorId && first.selectedId === second.selectedId && Math.abs(first.offset - second.offset) < 2 && Math.abs(first.scrollTop - second.scrollTop) < 2;
}
var ReadingHistory = class {
  constructor({ capture, restore, navigate, notify }) {
    this.capture = capture;
    this.restore = restore;
    this.navigate = navigate;
    this.notify = notify;
    this.entries = [];
    this.cursor = -1;
    this.pending = null;
    this.pendingCursor = null;
    this.canceledPaths = /* @__PURE__ */ new Set();
    this.lastPath = null;
    this.restored = null;
    this.jumpFrom = null;
  }
  update() {
    const position = this.capture();
    if (!position) {
      return;
    }
    const previousPath = this.lastPath;
    this.lastPath = position.path;
    if (this.pending) {
      if (position.path === this.pending.path && this.restore(this.pending)) {
        this.restored = this.pending;
        this.cursor = this.pendingCursor;
        this.cancelPending();
        this.canceledPaths.clear();
        this.entries[this.cursor] = this.capture() || position;
      }
      return;
    }
    if (this.canceledPaths.has(position.path)) {
      return;
    }
    if (position.path !== previousPath) {
      this.canceledPaths.clear();
    }
    const current = this.entries[this.cursor];
    if (!current || current.path !== position.path || this.jumpFrom && !samePosition(this.jumpFrom, position)) {
      this.entries.splice(this.cursor + 1);
      this.entries.push(position);
      if (this.entries.length > 50) {
        this.entries.shift();
      }
      this.cursor = this.entries.length - 1;
      this.clearJump();
    } else {
      this.entries[this.cursor] = position;
    }
  }
  beforeJump() {
    this.restored = null;
    this.cancelPending();
    this.canceledPaths.clear();
    this.update();
    this.clearJump();
    this.jumpFrom = this.entries[this.cursor] || null;
    this.jumpTimer = setTimeout(() => {
      this.update();
      this.clearJump();
    }, 2e3);
  }
  go(amount) {
    this.restored = null;
    if (!this.pending) {
      this.update();
    }
    this.clearJump();
    const from = this.pendingCursor ?? this.cursor;
    const next = Math.max(0, Math.min(this.entries.length - 1, from + amount));
    if (next === from || !this.entries[next]) {
      this.notify(amount < 0 ? "No earlier reading position." : "No later reading position.");
      return;
    }
    this.cancelPending();
    this.pendingCursor = next;
    this.pending = this.entries[next];
    try {
      if (this.capture()?.path === this.pending.path && this.restore(this.pending)) {
        this.restored = this.pending;
        this.cursor = next;
        this.cancelPending();
        this.canceledPaths.clear();
        return;
      }
      const target = this.pending;
      const messageId = target.anchorId?.split("-").at(-1);
      this.navigate(messageId ? `${target.path}/${messageId}` : target.path);
      this.restoreTimer = setTimeout(() => {
        this.cancelPending();
        this.notify(
          "That reading position could not be restored. The message may be unavailable."
        );
      }, 4e3);
    } catch (error) {
      this.cancelPending();
      throw error;
    }
  }
  clearJump() {
    clearTimeout(this.jumpTimer);
    this.jumpTimer = null;
    this.jumpFrom = null;
  }
  cancelPending() {
    if (this.pending && this.pending.path !== this.entries[this.cursor]?.path) {
      this.canceledPaths.add(this.pending.path);
    }
    clearTimeout(this.restoreTimer);
    this.restoreTimer = null;
    this.pending = null;
    this.pendingCursor = null;
  }
  stop() {
    this.restored = null;
    this.clearJump();
    this.cancelPending();
    this.canceledPaths.clear();
    this.lastPath = null;
  }
};

// src/indicator.js
var MODE_LABELS = {
  normal: "Normal",
  insert: "Insert",
  hint: "Hint",
  visual: "Message",
  range: "Range"
};
var USER_PANEL_SELECTOR = 'section[class*="panels_"]';
function setText(element4, text) {
  if (element4.textContent !== text) {
    element4.textContent = text;
  }
}
function editorLabel(editor) {
  if (!editor) {
    return "No text field";
  }
  return elementLabel(editor) || editor.getAttribute("placeholder")?.trim() || (isComposer(editor) ? "Message editor" : "Text input");
}
var ModeIndicator = class {
  constructor() {
    this.element = document.createElement("div");
    this.element.dataset.vimcord = "indicator";
    this.element.className = "vimcord-indicator-layer";
    this.outline = document.createElement("div");
    this.outline.className = "vimcord-pane-outline";
    this.outline.setAttribute("aria-hidden", "true");
    this.outline.hidden = true;
    this.badge = document.createElement("div");
    this.badge.dataset.vimcord = "badge";
    this.badge.className = "vim-indicator-container vimcord-indicator-container";
    this.badge.setAttribute("role", "status");
    this.badge.setAttribute("aria-live", "polite");
    this.badge.setAttribute("aria-atomic", "true");
    this.label = document.createElement("span");
    this.label.className = "vim-indicator vimcord-indicator";
    this.modeLabel = document.createElement("span");
    this.modeLabel.className = "vimcord-mode";
    this.targetLabel = document.createElement("span");
    this.targetLabel.className = "vimcord-target";
    this.label.append(this.modeLabel, " ", this.targetLabel);
    this.shortcuts = document.createElement("span");
    this.shortcuts.className = "vimcord-shortcuts";
    this.shortcuts.setAttribute("aria-hidden", "true");
    this.commandLabel = document.createElement("kbd");
    this.commandLabel.className = "vimcord-command";
    this.commandLabel.hidden = true;
    this.badge.append(this.label, this.commandLabel, this.shortcuts);
    this.element.append(this.outline, this.badge);
    this.target = null;
    this.frame = null;
    this.fadeTimer = null;
    this.showFocusOutline = true;
    this.shortcutSignature = "";
    this.events = new AbortController();
    this.resizeObserver = typeof ResizeObserver === "function" ? new ResizeObserver(() => this.schedulePosition()) : null;
    this.resizeObserver?.observe(this.element);
    window.addEventListener("scroll", () => this.schedulePosition(), {
      capture: true,
      passive: true,
      signal: this.events.signal
    });
  }
  update({
    mode,
    pane,
    dialog = null,
    keybinds,
    showFocusOutline = true,
    focusOutlineFadeDelay,
    selectedMessage = null,
    rangeCount = 0,
    command = ""
  }) {
    const parent = dialog || document.body;
    if (this.element.parentElement !== parent) {
      parent.append(this.element);
    }
    const panel = [...document.querySelectorAll(USER_PANEL_SELECTOR)].find(
      (candidate) => (!dialog || dialog.contains(candidate)) && isVisible(candidate)
    );
    const badgeParent = panel || this.element;
    if (this.badge.parentElement !== badgeParent) {
      badgeParent.append(this.badge);
    }
    this.badge.classList.toggle("is-docked", !!panel);
    this.badge.classList.toggle("is-floating", !panel);
    let target = null;
    let label = pane?.label || "No scrollable pane";
    if (mode === "normal") {
      target = pane?.element || null;
    } else if (mode === "insert") {
      const editor = editableTarget(document.activeElement);
      target = editor && (!dialog || dialog.contains(editor)) ? editor : null;
      label = editorLabel(target);
    } else if (mode === "hint") {
      label = "Choose a control";
    } else if (mode === "visual" || mode === "range") {
      target = selectedMessage;
      label = mode === "range" ? `${rangeCount} selected` : "Selected message";
    }
    const focusChanged = this.target !== target || this.element.dataset.mode !== mode || this.targetLabel.textContent !== label || this.showFocusOutline !== showFocusOutline || this.focusOutlineFadeDelay !== focusOutlineFadeDelay;
    this.element.dataset.mode = mode;
    this.badge.dataset.mode = mode;
    this.showFocusOutline = showFocusOutline;
    this.focusOutlineFadeDelay = focusOutlineFadeDelay;
    setText(this.modeLabel, MODE_LABELS[mode]);
    setText(this.targetLabel, label);
    setText(this.commandLabel, command);
    this.commandLabel.hidden = !command;
    this.updateShortcuts(mode, pane, keybinds);
    if (this.target !== target) {
      if (this.target) {
        this.resizeObserver?.unobserve(this.target);
      }
      this.target = target;
      if (target) {
        this.resizeObserver?.observe(target);
      }
    }
    if (focusChanged) {
      this.revealOutline();
    }
    this.position();
  }
  revealOutline() {
    clearTimeout(this.fadeTimer);
    this.fadeTimer = null;
    const visible = this.showFocusOutline && !!this.target;
    this.outline.classList.toggle("is-visible", visible);
    if (visible) {
      this.fadeTimer = setTimeout(() => {
        this.fadeTimer = null;
        this.outline.classList.remove("is-visible");
      }, this.focusOutlineFadeDelay * 1e3);
    }
  }
  updateShortcuts(mode, pane, keybinds) {
    let keys = ["Esc"];
    let action = mode === "hint" ? "cancel" : "normal";
    if (mode === "normal") {
      keys = pane ? [keybinds.scrollDown, keybinds.scrollUp] : [];
      action = pane ? "scroll" : "";
    } else if (mode === "visual" || mode === "range") {
      keys = [keybinds.scrollDown, keybinds.scrollUp];
      action = mode === "range" ? "extend" : "select";
    }
    keys = keys.filter(Boolean);
    const signature = JSON.stringify([keys, action]);
    if (this.shortcutSignature === signature) {
      return;
    }
    this.shortcutSignature = signature;
    const labels = keys.map((key) => {
      const element4 = document.createElement("kbd");
      element4.textContent = key === " " ? "Space" : key;
      return element4;
    });
    this.shortcuts.replaceChildren(...labels, action ? ` ${action}` : "");
    this.shortcuts.hidden = !keys.length;
  }
  schedulePosition() {
    if (this.events.signal.aborted || this.frame !== null || !this.outline.classList.contains("is-visible")) {
      return;
    }
    this.frame = requestAnimationFrame(() => {
      this.frame = null;
      this.position();
    });
  }
  position() {
    if (this.events.signal.aborted || !this.showFocusOutline || !isVisible(this.target)) {
      this.outline.hidden = true;
      return;
    }
    const rect = this.target.getBoundingClientRect();
    const layer = this.element.getBoundingClientRect();
    let left = Math.max(0, layer.left, rect.left);
    let top = Math.max(0, layer.top, rect.top);
    let right = Math.min(window.innerWidth, layer.right, rect.right);
    let bottom = Math.min(window.innerHeight, layer.bottom, rect.bottom);
    for (let ancestor = this.target.parentElement; ancestor && ancestor !== document.body; ancestor = ancestor.parentElement) {
      const style = getComputedStyle(ancestor);
      const clipsX = /^(auto|scroll|hidden|clip|overlay)$/.test(style.overflowX);
      const clipsY = /^(auto|scroll|hidden|clip|overlay)$/.test(style.overflowY);
      if (!clipsX && !clipsY) {
        continue;
      }
      const bounds = ancestor.getBoundingClientRect();
      if (clipsX) {
        left = Math.max(left, bounds.left);
        right = Math.min(right, bounds.right);
      }
      if (clipsY) {
        top = Math.max(top, bounds.top);
        bottom = Math.min(bottom, bounds.bottom);
      }
    }
    if (right <= left || bottom <= top) {
      this.outline.hidden = true;
      return;
    }
    const scaleX = layer.width / (this.element.clientWidth || layer.width);
    const scaleY = layer.height / (this.element.clientHeight || layer.height);
    Object.assign(this.outline.style, {
      left: `${(left - layer.left) / scaleX}px`,
      top: `${(top - layer.top) / scaleY}px`,
      width: `${(right - left) / scaleX}px`,
      height: `${(bottom - top) / scaleY}px`
    });
    this.outline.hidden = false;
  }
  stop() {
    this.events.abort();
    this.resizeObserver?.disconnect();
    clearTimeout(this.fadeTimer);
    this.fadeTimer = null;
    if (this.frame !== null) {
      cancelAnimationFrame(this.frame);
    }
    this.frame = null;
    this.target = null;
    this.badge.remove();
    this.element.remove();
  }
};

// src/scroll-panels.js
var EXCLUDED = `${OWNED_SELECTOR}, input, textarea, select, button, svg, [contenteditable],
    [role="textbox"], [role="button"], [role="combobox"], [class*="channelTextArea_"],
    [role="article"], [role="menu"], [role="tooltip"], pre, code`;
var HEADING = 'h1, h2, h3, [role="heading"]';
function excluded(element4) {
  return !!element4.closest(EXCLUDED);
}
function isScrollSurface(element4) {
  return /^(auto|scroll|overlay)$/.test(getComputedStyle(element4).overflowY);
}
function hasPanelArea(element4) {
  const rect = element4.getBoundingClientRect();
  let left = Math.max(0, rect.left);
  let right = Math.min(window.innerWidth, rect.right);
  let top = Math.max(0, rect.top);
  let bottom = Math.min(window.innerHeight, rect.bottom);
  for (let parent = element4.parentElement; parent; parent = parent.parentElement) {
    const style = getComputedStyle(parent);
    const bounds = parent.getBoundingClientRect();
    if (/^(auto|scroll|overlay|hidden|clip)$/.test(style.overflowX)) {
      left = Math.max(left, bounds.left);
      right = Math.min(right, bounds.right);
    }
    if (/^(auto|scroll|overlay|hidden|clip)$/.test(style.overflowY)) {
      top = Math.max(top, bounds.top);
      bottom = Math.min(bottom, bounds.bottom);
    }
  }
  return right - left >= 120 && bottom - top >= 100;
}
var ScrollPanels = class {
  constructor() {
    this.candidates = /* @__PURE__ */ new Set();
    this.dirtyRoots = /* @__PURE__ */ new Set([document.body]);
  }
  invalidate(root = document.body) {
    if (!(root instanceof Element) || excluded(root)) {
      return false;
    }
    for (const pending of this.dirtyRoots) {
      if (pending.contains(root)) {
        return true;
      }
      if (root.contains(pending)) {
        this.dirtyRoots.delete(pending);
      }
    }
    this.dirtyRoots.add(root);
    return true;
  }
  onMutation(record) {
    const target = record.target instanceof Element ? record.target : record.target.parentElement;
    if (!(target instanceof Element) || excluded(target)) {
      return false;
    }
    if (record.type === "attributes") {
      return this.invalidate(target);
    }
    let changed = false;
    for (const node of record.addedNodes) {
      changed = this.invalidate(node) || changed;
    }
    return changed || [...record.removedNodes].some((node) => node instanceof Element && !excluded(node)) || !!target.closest(HEADING) || [...this.candidates].some((candidate) => candidate.contains(target));
  }
  scan(root) {
    const visit = (element4) => {
      if (isScrollSurface(element4)) {
        this.candidates.add(element4);
      } else {
        this.candidates.delete(element4);
      }
    };
    if (!root.isConnected || excluded(root)) {
      return;
    }
    visit(root);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, {
      acceptNode: (element4) => element4.matches(EXCLUDED) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
    });
    while (walker.nextNode()) {
      visit(walker.currentNode);
    }
  }
  discover(scope, knownElements) {
    for (const root of this.dirtyRoots) {
      this.scan(root);
    }
    this.dirtyRoots.clear();
    const eligible = [];
    for (const element4 of this.candidates) {
      if (!element4.isConnected) {
        this.candidates.delete(element4);
        continue;
      }
      if (!scope.contains(element4) || excluded(element4) || !isVisible(element4) || element4.scrollHeight <= element4.clientHeight + 1 || !isScrollSurface(element4) || !hasPanelArea(element4) || knownElements.some((known) => known.contains(element4) || element4.contains(known))) {
        continue;
      }
      eligible.push(element4);
    }
    return eligible.filter(
      (element4) => !eligible.some((parent) => parent !== element4 && parent.contains(element4))
    );
  }
  stop() {
    this.candidates.clear();
    this.dirtyRoots.clear();
  }
};

// src/panes.js
var PANE_DEFINITIONS = [
  {
    key: "servers",
    label: "Servers",
    list: '[data-list-id="guildsnav"]',
    container: '[class*="guilds_"]'
  },
  { key: "channels", label: "Channels", list: '#channels, [data-list-id="channels"]' },
  {
    key: "dms",
    label: "Direct messages",
    list: '[data-list-id="private-channels"]',
    container: '[class*="privateChannels_"]'
  },
  {
    key: "friends",
    label: "Friends",
    list: '[data-list-id="people"]',
    container: '[class*="peopleList_"]'
  },
  {
    key: "chat",
    label: "Messages",
    list: '[data-list-id="chat-messages"]',
    container: '[class*="messagesWrapper_"]'
  },
  {
    key: "members",
    label: "Members",
    list: '[data-list-id^="members-"]',
    container: '[class*="membersWrap_"]'
  },
  {
    key: "activeNow",
    label: "Active Now",
    list: '[class*="nowPlayingColumn_"] aside',
    container: '[class*="nowPlayingColumn_"]'
  }
];
var SCROLLER_SELECTOR = '[class*="scroller" i], [data-list-id], [role="list"], [role="listbox"]';
var HEADING_SELECTOR = 'h1, h2, h3, [role="heading"]';
var SETTINGS_SELECTOR = '[class*="standardSidebarView_"]';
var SETTINGS_SIDEBAR_SELECTOR = '[class*="sidebarRegion_"], [class*="sidebarRegionScroller_"]';
var PANES_SELECTOR = `${PANE_DEFINITIONS.flatMap((pane) => [pane.list, pane.container]).filter(Boolean).join(", ")}, ${DIALOG_SELECTOR}`;
function paneMutationRelevant(record) {
  if (record.type === "attributes") {
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
    const selector = inDialog ? `${PANES_SELECTOR}, ${SCROLLER_SELECTOR}, ${HEADING_SELECTOR}` : PANES_SELECTOR;
    return node.matches(selector) || !!node.querySelector(selector);
  });
}
function headingLabel(scope) {
  const heading = scope?.querySelector(HEADING_SELECTOR);
  return heading?.textContent.replace(/\s+/g, " ").trim() || "";
}
function dialogPaneLabel(element4, dialog) {
  const sidebar = element4.closest('aside, [role="complementary"]');
  const sidebarLabel = sidebar && dialog.contains(sidebar) ? elementLabel(sidebar) || headingLabel(sidebar) : "";
  if (dialog.matches(SETTINGS_SELECTOR)) {
    if (element4.closest(SETTINGS_SIDEBAR_SELECTOR) || element4.querySelector('[role="tablist"]')) {
      return "Settings sidebar";
    }
    const selected = dialog.querySelector('[role="tab"][aria-selected="true"]');
    const selectedLabel = selected?.textContent.replace(/\s+/g, " ").trim();
    const content = element4.closest('[class*="contentRegion_"]');
    return selectedLabel || headingLabel(content) || headingLabel(element4) || headingLabel(dialog) || "Settings";
  }
  return elementLabel(element4) || sidebarLabel || headingLabel(element4) || elementLabel(dialog) || headingLabel(dialog) || "Dialog content";
}
function scrollSurface(element4) {
  return isVisible(element4) && isScrollSurface(element4);
}
function discoveredLabel(element4, scope, surfaces) {
  for (let region = element4; region && scope.contains(region); region = region.parentElement) {
    if (region !== element4 && surfaces.some((other) => other !== element4 && region.contains(other))) {
      break;
    }
    const heading = [...region.querySelectorAll(HEADING_SELECTOR)].find(
      (node) => !node.closest(`${OWNED_SELECTOR}, [role="article"], [contenteditable]`)
    );
    const label = elementLabel(region) || heading?.textContent.replace(/\s+/g, " ").trim();
    if (label) {
      return label.slice(0, 80);
    }
    if (region === scope || region === document.body) {
      break;
    }
  }
  return "Scrollable panel";
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
    this.scrollPanels = new ScrollPanels();
    this.panelKeys = /* @__PURE__ */ new WeakMap();
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
    const used = /* @__PURE__ */ new Set();
    const dialog = activeDialog();
    let defaultDialogPane = null;
    if (dialog) {
      if (!this.dialog) {
        this.backgroundActive = this.active;
      }
      const surfaces2 = [dialog, ...dialog.querySelectorAll(SCROLLER_SELECTOR)].filter((element4) => !element4.closest(OWNED_SELECTOR) && scrollSurface(element4)).map((element4) => ({ element: element4, rect: element4.getBoundingClientRect() })).sort((a, b) => a.rect.left - b.rect.left || a.rect.top - b.rect.top);
      for (const surface of surfaces2) {
        const pane = {
          key: "dialog",
          label: dialogPaneLabel(surface.element, dialog),
          element: surface.element
        };
        next.push(pane);
        if (!defaultDialogPane || pane.element.clientWidth * pane.element.clientHeight > defaultDialogPane.element.clientWidth * defaultDialogPane.element.clientHeight) {
          defaultDialogPane = pane;
        }
      }
    } else {
      for (const definition of PANE_DEFINITIONS) {
        const element4 = findPaneSurface(definition);
        if (!element4 || used.has(element4)) {
          continue;
        }
        used.add(element4);
        next.push({ key: definition.key, label: definition.label, element: element4 });
      }
    }
    const scope = dialog || document.body;
    const knownElements = next.map((pane) => pane.element);
    const discovered = this.scrollPanels.discover(scope, knownElements);
    const surfaces = [...knownElements, ...discovered];
    for (const element4 of discovered) {
      if (!this.panelKeys.has(element4)) {
        this.panelKeys.set(element4, `scrollable-${++this.nextPanelKey}`);
      }
      const pane = {
        key: this.panelKeys.get(element4),
        label: discoveredLabel(element4, scope, surfaces),
        element: element4
      };
      next.push(pane);
      if (dialog && (!defaultDialogPane || element4.clientWidth * element4.clientHeight > defaultDialogPane.element.clientWidth * defaultDialogPane.element.clientHeight)) {
        defaultDialogPane = pane;
      }
    }
    const bounds = new Map(next.map((pane) => [pane, pane.element.getBoundingClientRect()]));
    next.sort(
      (first, second) => bounds.get(first).left - bounds.get(second).left || bounds.get(first).top - bounds.get(second).top
    );
    const previous = !dialog && this.dialog ? this.backgroundActive : this.active;
    const replacements = previous?.key.startsWith("scrollable-") && previous.label !== "Scrollable panel" ? next.filter(
      (pane) => pane.key.startsWith("scrollable-") && pane.label === previous.label
    ) : [];
    const active = next.find((pane) => pane.element === previous?.element) || (replacements.length === 1 ? replacements[0] : null) || (dialog ? defaultDialogPane : next.find((pane) => pane.key === previous?.key)) || (previous?.key === "activeNow" ? next.find((pane) => pane.key === "friends") : null) || next.find((pane) => pane.key === "chat") || next.find((pane) => pane.key !== "servers") || next[0] || null;
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
    this.active = this.panes[Math.max(0, Math.min(this.panes.length - 1, index + direction))];
  }
  scroll(delta) {
    if (!this.active || !scrollSurface(this.active.element)) {
      this.refresh();
    }
    const element4 = this.active?.element;
    if (!element4) {
      return;
    }
    element4.scrollBy({ top: delta, behavior: "instant" });
  }
  get label() {
    return this.active?.label || "";
  }
  jump(edge) {
    this.refresh();
    const element4 = this.active?.element;
    if (!element4) {
      return;
    }
    element4.scrollTo({ top: edge === "top" ? 0 : element4.scrollHeight, behavior: "instant" });
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
};

// src/marks.js
var CHANNEL_PATH2 = /^\/channels\/(?:@me|\d+)\/\d+$/;
function markLetter(value) {
  const key = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!/^[a-z]$/.test(key)) {
    throw new Error("Choose one letter from a to z.");
  }
  return key;
}
function destinationName(path) {
  const [, , guildId, channelId] = path.split("/");
  const channel = BdApi.Webpack?.getStore?.("ChannelStore")?.getChannel(channelId);
  if (guildId !== "@me") {
    const guild = BdApi.Webpack?.getStore?.("GuildStore")?.getGuild(guildId);
    return {
      name: channel?.name ? `#${channel.name}` : "Unavailable channel",
      detail: guild?.name || "Server channel"
    };
  }
  const users = BdApi.Webpack?.getStore?.("UserStore");
  const recipients = (channel?.recipients || []).map((id) => users?.getUser(id)).filter(Boolean).map((user) => user.globalName || user.username);
  return {
    name: channel?.name || recipients.join(", ") || "Unavailable conversation",
    detail: channel?.type === 3 ? "Group DM" : "Direct message"
  };
}
function navigateTo(path) {
  const navigate = BdApi.Webpack?.getByStrings("transitionTo -", { searchExports: true });
  if (typeof navigate !== "function") {
    throw new Error("Discord navigation is unavailable. Try the Quick Switcher.");
  }
  navigate(path);
}
var ChannelMarks = class {
  constructor(storage = BdApi.Data) {
    this.storage = storage;
    this.marks = {};
    try {
      const saved = storage.load("VimCord", "marks");
      for (const [key, path] of Object.entries(saved || {})) {
        if (/^[a-z]$/.test(key) && typeof path === "string" && CHANNEL_PATH2.test(path)) {
          this.marks[key] = path;
        }
      }
    } catch (error) {
      console.error("[VimCord] Failed to load channel marks", error);
    }
  }
  save(key) {
    key = markLetter(key);
    const path = window.location.pathname.split("/").slice(0, 4).join("/");
    if (!CHANNEL_PATH2.test(path)) {
      throw new Error("Open a channel or DM before setting a mark.");
    }
    this.persist({ ...this.marks, [key]: path });
  }
  persist(next) {
    this.storage.save("VimCord", "marks", next);
    this.marks = next;
  }
  entries() {
    return Object.entries(this.marks).sort(([a], [b]) => a.localeCompare(b)).map(([key, path]) => ({ key, path, ...destinationName(path) }));
  }
  rename(from, value) {
    const key = markLetter(value);
    if (!this.marks[from]) {
      throw new Error("That mark no longer exists.");
    }
    if (key === from) {
      return key;
    }
    if (this.marks[key]) {
      throw new Error(`Mark \u201C${key}\u201D is already used. Choose another letter.`);
    }
    const next = { ...this.marks, [key]: this.marks[from] };
    delete next[from];
    this.persist(next);
    return key;
  }
  remove(key) {
    const path = this.marks[key];
    if (!path) {
      throw new Error("That mark no longer exists.");
    }
    const next = { ...this.marks };
    delete next[key];
    this.persist(next);
    return { key, path };
  }
  restore({ key, path }) {
    if (this.marks[key]) {
      throw new Error(`Mark \u201C${key}\u201D is already used.`);
    }
    this.persist({ ...this.marks, [key]: path });
  }
  jump(key) {
    const path = this.marks[key];
    if (!path) {
      throw new Error(`Mark \u201C${key}\u201D has not been set.`);
    }
    navigateTo(path);
  }
};

// src/marks-panel.css
var marks_panel_default = ".vimcord-marks-backdrop {\n    position: fixed;\n    inset: 0;\n    z-index: 2147483647;\n    display: grid;\n    place-items: center;\n    padding: 20px;\n    background: rgba(0, 0, 0, 0.5);\n}\n\n.vimcord-marks {\n    box-sizing: border-box;\n    width: min(680px, 100%);\n    max-height: 80vh;\n    overflow-y: auto;\n    padding: 24px;\n    border: 1px solid var(--background-modifier-accent, #454550);\n    border-radius: 12px;\n    background: var(--background-floating, #1c1c24);\n    color: var(--text-normal, #eee);\n    box-shadow: 0 16px 60px rgba(0, 0, 0, 0.35);\n    font: 14px/1.5 var(--font-primary, sans-serif);\n}\n\n.vimcord-marks header,\n.vimcord-mark-actions {\n    display: flex;\n    align-items: center;\n    gap: 8px;\n}\n\n.vimcord-marks header {\n    justify-content: space-between;\n    margin-bottom: 20px;\n}\n\n.vimcord-marks h2 {\n    margin: 0;\n    font-size: 18px;\n    font-weight: 600;\n}\n\n.vimcord-marks button,\n.vimcord-marks input {\n    color: var(--text-normal, #eee);\n    background: var(--background-modifier-accent, #454550);\n    border: 1px solid transparent;\n    border-radius: 5px;\n    padding: 6px 10px;\n    font: inherit;\n}\n\n.vimcord-marks button {\n    cursor: pointer;\n}\n\n.vimcord-marks input {\n    width: 2ch;\n    text-align: center;\n}\n\n.vimcord-marks :focus-visible {\n    outline: 2px solid var(--brand-500, #5865f2);\n    outline-offset: 2px;\n}\n\n.vimcord-mark-row {\n    display: grid;\n    grid-template-columns: 32px minmax(0, 1fr) auto;\n    align-items: center;\n    gap: 12px;\n    padding: 14px 0;\n    border-bottom: 1px solid var(--background-modifier-accent, #454550);\n}\n\n.vimcord-mark-description {\n    display: flex;\n    flex-direction: column;\n    min-width: 0;\n}\n\n.vimcord-mark-description strong,\n.vimcord-mark-description span {\n    overflow: hidden;\n    text-overflow: ellipsis;\n    white-space: nowrap;\n}\n\n.vimcord-mark-description span,\n.vimcord-marks-note {\n    color: var(--text-muted, #b5b5c2);\n    font-size: 12px;\n}\n\n.vimcord-mark-row kbd {\n    text-align: center;\n    font: 600 14px var(--font-code, monospace);\n}\n\n.vimcord-marks-status {\n    min-height: 1.5em;\n    margin: 16px 0 8px;\n}\n\n.vimcord-marks-status.is-error {\n    color: var(--text-danger, #fa777c);\n}\n\n.vimcord-marks button[hidden] {\n    display: none;\n}\n\n@media (max-width: 620px) {\n    .vimcord-mark-row {\n        grid-template-columns: 32px minmax(0, 1fr);\n    }\n    .vimcord-mark-actions {\n        grid-column: 2;\n        flex-wrap: wrap;\n    }\n}\n";

// src/marks-panel.js
function element2(tag, text = "", className = "") {
  const node = document.createElement(tag);
  node.textContent = text;
  node.className = className;
  return node;
}
var MarksPanel = class {
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
    this.root = element2("div", "", "vimcord-marks-backdrop");
    this.root.dataset.vimcord = "marks";
    const style = element2("style", marks_panel_default);
    this.dialog = element2("section", "", "vimcord-marks");
    this.dialog.setAttribute("role", "dialog");
    this.dialog.setAttribute("aria-modal", "true");
    this.dialog.setAttribute("aria-labelledby", "vimcord-marks-title");
    const title = element2("h2", "Saved marks");
    title.id = "vimcord-marks-title";
    const header = element2("header");
    this.closeButton = this.button("Close", () => this.close());
    header.append(title, this.closeButton);
    this.list = element2("div", "", "vimcord-marks-list");
    this.status = element2("p", "", "vimcord-marks-status");
    this.status.setAttribute("role", "status");
    this.status.setAttribute("aria-live", "polite");
    this.undo = this.button("Undo removal", () => this.undoRemove());
    this.undo.hidden = true;
    this.dialog.append(
      header,
      this.list,
      this.status,
      this.undo,
      element2(
        "p",
        "Tab moves between controls \xB7 Enter activates \xB7 Escape closes",
        "vimcord-marks-note"
      )
    );
    this.root.append(style, this.dialog);
    this.root.addEventListener("pointerdown", (event) => {
      if (event.target === this.root) {
        event.preventDefault();
        this.close();
      }
    });
    document.addEventListener("keydown", (event) => this.handleKey(event), {
      capture: true,
      signal: this.events.signal
    });
    for (const type of ["beforeinput", "paste", "cut"]) {
      document.addEventListener(
        type,
        (event) => {
          if (!this.root.contains(event.target)) {
            event.preventDefault();
          }
          event.stopImmediatePropagation();
        },
        { capture: true, signal: this.events.signal }
      );
    }
    document.body.append(this.root);
    this.render();
    this.closeButton.focus();
  }
  button(label, action) {
    const button = element2("button", label);
    button.type = "button";
    button.addEventListener("click", action);
    return button;
  }
  render(focusKey, control = "change") {
    this.list.replaceChildren();
    const entries = this.marks.entries();
    if (!entries.length) {
      const key = this.keybinds.setMark || "the set-mark key";
      this.list.append(
        element2(
          "p",
          `No saved marks yet. Open a channel or DM, then press ${key} and a letter.`,
          "vimcord-marks-empty"
        )
      );
    }
    for (const entry of entries) {
      const row = element2("div", "", "vimcord-mark-row");
      row.dataset.mark = entry.key;
      const description = element2("div", "", "vimcord-mark-description");
      description.append(element2("strong", entry.name), element2("span", entry.detail));
      const actions = element2("div", "", "vimcord-mark-actions");
      if (this.editing === entry.key) {
        const input = element2("input");
        input.type = "text";
        input.maxLength = 1;
        input.value = entry.key;
        input.setAttribute("aria-label", `New letter for mark ${entry.key}`);
        input.autocomplete = "off";
        input.spellcheck = false;
        this.renameInput = input;
        row.append(input, description);
        actions.append(
          this.button("Save", () => this.saveRename()),
          this.button("Cancel", () => this.cancelRename())
        );
      } else {
        row.append(element2("kbd", entry.key), description);
        for (const [name, label, callback] of [
          ["open", "Open", () => this.open(entry.key)],
          [
            "change",
            "Change letter",
            () => {
              this.editing = entry.key;
              this.render();
              this.renameInput.focus();
              this.renameInput.select();
            }
          ],
          ["remove", "Remove", () => this.remove(entry.key)]
        ]) {
          const button = this.button(label, callback);
          button.dataset.control = name;
          button.setAttribute("aria-label", `${label} mark ${entry.key}: ${entry.name}`);
          actions.append(button);
        }
      }
      row.append(actions);
      this.list.append(row);
    }
    this.undo.hidden = !this.removed;
    if (focusKey) {
      const target = this.list.querySelector(
        `[data-mark="${focusKey}"] [data-control="${control}"]`
      );
      (target || this.closeButton).focus();
    }
  }
  report(message, error = false) {
    this.status.textContent = message;
    this.status.classList.toggle("is-error", error);
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
    if (event.key === "Escape") {
      event.preventDefault();
      if (this.editing) {
        this.cancelRename();
      } else {
        this.close();
      }
    } else if (event.key === "Tab") {
      event.preventDefault();
      const controls = [...this.dialog.querySelectorAll("button:not([hidden]), input")];
      const index = controls.indexOf(document.activeElement);
      const next = (index + (event.shiftKey ? -1 : 1) + controls.length) % controls.length;
      controls[next].focus();
    } else if (this.editing && event.target === this.renameInput && event.key === "Enter") {
      event.preventDefault();
      this.saveRename();
    } else if (!this.editing && event.key === this.keybinds.manageMarks) {
      event.preventDefault();
      if (!event.repeat) {
        this.close();
      }
    } else if (!this.editing && event.key.length === 1 && event.key !== " ") {
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
};

// src/messages.js
var MESSAGE_LIST = '[data-list-id="chat-messages"]';
var MESSAGE_ROW = '[id^="chat-messages-"]';
var BLOCK_LINE_BREAKS = {
  P: 2,
  DIV: 1,
  UL: 1,
  OL: 1,
  LI: 1,
  BLOCKQUOTE: 1,
  PRE: 1,
  H1: 1,
  H2: 1,
  H3: 1,
  H4: 1,
  H5: 1,
  H6: 1,
  HR: 1
};
function messageText(article) {
  const content = article.querySelector('[id^="message-content-"]');
  let text = "";
  let pendingBreaks = 0;
  const append = (value) => {
    if (!value) {
      return;
    }
    if (text && pendingBreaks) {
      const trailingBreaks = text.match(/\n*$/)[0].length;
      text += "\n".repeat(Math.max(0, pendingBreaks - trailingBreaks));
    }
    text += value;
    pendingBreaks = 0;
  };
  const visit = (node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      append(node.textContent);
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) {
      return;
    }
    if (node.tagName === "BR") {
      append("\n");
      return;
    }
    if (node.matches("img[alt]")) {
      append(node.alt);
      return;
    }
    const breaks = BLOCK_LINE_BREAKS[node.tagName] || 0;
    pendingBreaks = Math.max(pendingBreaks, breaks);
    for (const child of node.childNodes) {
      visit(child);
    }
    pendingBreaks = Math.max(pendingBreaks, breaks);
  };
  for (const child of content?.childNodes || []) {
    visit(child);
  }
  return text;
}
function messageAuthor(article) {
  const ids = (article.getAttribute("aria-labelledby") || "").split(/\s+/);
  const reference = ids.find((id) => id.startsWith("message-username-"));
  const name = reference && document.getElementById(reference)?.textContent;
  if (name) {
    return name.trim();
  }
  for (let row = article.closest(MESSAGE_ROW); row; row = row.previousElementSibling) {
    const author = row.querySelector('[id^="message-username-"], [class*="username_"]');
    if (author?.textContent.trim()) {
      return author.textContent.trim();
    }
  }
  return "Unknown author";
}
var MessageSelection = class {
  constructor() {
    this.list = null;
    this.selected = null;
    this.rowId = null;
    this.rangeAnchorId = null;
    this.highlighted = /* @__PURE__ */ new Set();
  }
  rows() {
    if (!this.list?.isConnected) {
      return [];
    }
    return [...this.list.querySelectorAll(MESSAGE_ROW)].map((row) => row.querySelector('[role="article"]')).filter(
      (article) => article && !article.closest('[hidden], [inert], [aria-hidden="true"]') && article.getBoundingClientRect().height > 0
    );
  }
  visibleRows(rows) {
    let top = 0;
    let bottom = window.innerHeight;
    for (let parent = this.list; parent && parent !== document.body; parent = parent.parentElement) {
      if (/^(auto|scroll|overlay|hidden|clip)$/.test(getComputedStyle(parent).overflowY)) {
        const rect = parent.getBoundingClientRect();
        top = Math.max(top, rect.top);
        bottom = Math.min(bottom, rect.bottom);
      }
    }
    return rows.filter((row) => {
      const rect = row.getBoundingClientRect();
      return isVisible(row) && rect.bottom > top && rect.top < bottom;
    });
  }
  start(pane, beforeSelect = () => {
  }) {
    this.stop();
    if (activeDialog()) {
      return false;
    }
    this.list = [...document.querySelectorAll(MESSAGE_LIST)].find(
      (list) => isVisible(list) && (!pane || pane.contains(list) || list.contains(pane))
    );
    if (!this.list) {
      this.list = [...document.querySelectorAll(MESSAGE_LIST)].find(isVisible);
    }
    const rows = this.rows();
    const focused = rows.find((row) => row.contains(document.activeElement));
    const visible = this.visibleRows(rows);
    const selected = focused || visible.at(-1);
    if (!selected) {
      return false;
    }
    beforeSelect();
    return this.select(selected);
  }
  select(article, scroll = true) {
    if (!article?.isConnected) {
      return false;
    }
    this.selected?.classList.remove("vimcord-message-selected");
    this.selected = article;
    this.rowId = article.closest(MESSAGE_ROW)?.id;
    article.classList.add("vimcord-message-selected");
    article.focus({ preventScroll: true });
    if (scroll) {
      article.scrollIntoView({ block: "nearest", behavior: "instant" });
    }
    this.paintRange();
    return true;
  }
  refresh() {
    if (activeDialog() || !this.list?.isConnected || this.rangeAnchorId && !this.list.contains(document.getElementById(this.rangeAnchorId))) {
      return false;
    }
    if (this.selected?.isConnected) {
      this.paintRange();
      return true;
    }
    const article = document.getElementById(this.rowId)?.querySelector('[role="article"]');
    return !!article && this.list.contains(article) && this.select(article);
  }
  move(amount) {
    if (!this.refresh()) {
      return false;
    }
    const rows = this.rows();
    const index = rows.indexOf(this.selected);
    return this.select(rows[Math.max(0, Math.min(rows.length - 1, index + amount))]);
  }
  jump(edge) {
    const rows = this.rows();
    return this.select(edge === "top" ? rows[0] : rows.at(-1));
  }
  setRange(enabled) {
    this.rangeAnchorId = enabled ? this.rowId : null;
    this.paintRange();
  }
  selectedRows() {
    if (!this.rangeAnchorId) {
      return this.selected ? [this.selected] : [];
    }
    const rows = this.rows();
    const anchor = rows.findIndex((row) => row.closest(MESSAGE_ROW).id === this.rangeAnchorId);
    const end = rows.indexOf(this.selected);
    if (anchor < 0 || end < 0) {
      return [];
    }
    return rows.slice(Math.min(anchor, end), Math.max(anchor, end) + 1);
  }
  paintRange() {
    for (const row of this.highlighted) {
      row.classList.remove("vimcord-message-in-range");
    }
    this.highlighted.clear();
    if (this.rangeAnchorId) {
      for (const row of this.selectedRows()) {
        row.classList.add("vimcord-message-in-range");
        this.highlighted.add(row);
      }
    }
  }
  async copy({ authors = true, timestamps = false } = {}) {
    if (!this.refresh()) {
      throw new Error("That message is no longer available. Select a message again.");
    }
    let text = messageText(this.selected);
    if (this.rangeAnchorId) {
      text = this.selectedRows().map((row) => {
        const header = [];
        if (authors) {
          header.push(messageAuthor(row));
        }
        const date = row.querySelector("time[datetime]")?.getAttribute("datetime");
        if (timestamps && date && Number.isFinite(Date.parse(date))) {
          header.push(`[${new Date(date).toISOString()}]`);
        }
        const content = messageText(row) || "[No text content]";
        return header.length ? `${header.join(" ")}
${content}` : content;
      }).join("\n\n");
    }
    if (!text) {
      throw new Error("This message has no text to copy.");
    }
    await navigator.clipboard.writeText(text);
  }
  async copyLink() {
    if (!this.refresh()) {
      throw new Error("That message is no longer available.");
    }
    const ids = this.rowId?.match(/^chat-messages-(\d+)-(\d+)$/);
    const guild = window.location.pathname.split("/")[2];
    if (!ids || !/^(?:@me|\d+)$/.test(guild)) {
      throw new Error("A link is unavailable for this message.");
    }
    await navigator.clipboard.writeText(
      `https://discord.com/channels/${guild}/${ids[1]}/${ids[2]}`
    );
  }
  stop() {
    this.rangeAnchorId = null;
    this.paintRange();
    this.selected?.classList.remove("vimcord-message-selected");
    if (this.selected === document.activeElement) {
      this.selected.blur();
    }
    this.selected = null;
    this.list = null;
    this.rowId = null;
  }
};

// src/settings.css
var settings_default = ".vimcord-settings {\n    padding: 16px;\n    color: var(--header-primary, #f2f3f5);\n    font-size: 14px;\n    line-height: 1.5;\n}\n\n.vimcord-settings .vimcord-settings-heading {\n    margin: 20px 0 12px;\n    color: var(--header-primary, #f2f3f5);\n    font-size: 20px;\n    font-weight: 700;\n}\n\n.vimcord-settings .vimcord-settings-heading:first-of-type {\n    margin-top: 0;\n}\n\n.vimcord-settings-description {\n    margin: 0 0 12px;\n    color: var(--header-secondary, #b5bac1);\n}\n\n.vimcord-settings-row {\n    display: flex;\n    flex-wrap: wrap;\n    align-items: center;\n    justify-content: space-between;\n    gap: 8px 16px;\n    padding: 10px 0;\n    border-bottom: 1px solid var(--background-modifier-accent, #4e5058);\n}\n\n.vimcord-settings-row[hidden] {\n    display: none;\n}\n\n.vimcord-settings-preference {\n    flex: 1;\n    min-width: 180px;\n}\n\n.vimcord-settings-preference .vimcord-settings-description {\n    margin: 4px 0 0;\n    font-size: 12px;\n}\n\n.vimcord-settings-toggle {\n    appearance: none;\n    position: relative;\n    flex-shrink: 0;\n    width: 36px;\n    height: 20px;\n    margin: 0;\n    border: 0;\n    border-radius: 10px;\n    background: var(--interactive-muted, #4e5058);\n    cursor: pointer;\n}\n\n.vimcord-settings-toggle::before {\n    content: '';\n    position: absolute;\n    top: 2px;\n    left: 2px;\n    width: 16px;\n    height: 16px;\n    border-radius: 50%;\n    background: #fff;\n}\n\n.vimcord-settings-toggle:checked {\n    background: var(--brand-500, #5865f2);\n}\n\n.vimcord-settings-toggle:checked::before {\n    transform: translateX(16px);\n}\n\n.vimcord-settings-input,\n.vimcord-settings-key {\n    box-sizing: border-box;\n    min-height: 34px;\n    padding: 5px 10px;\n    border: 1px solid var(--background-modifier-accent, #4e5058);\n    border-radius: 4px;\n    background: var(--background-secondary, #2b2d31);\n    color: var(--header-primary, #f2f3f5);\n    font: inherit;\n}\n\n.vimcord-settings-input {\n    width: 100px;\n    max-width: 100%;\n}\n\n.vimcord-settings-key {\n    min-width: 100px;\n    font-weight: 600;\n    cursor: pointer;\n}\n\n.vimcord-settings-key:hover,\n.vimcord-settings-key.is-capturing {\n    background: var(--background-modifier-hover, #404249);\n}\n\n.vimcord-settings-input:focus-visible,\n.vimcord-settings-toggle:focus-visible,\n.vimcord-settings-key:focus-visible,\n.vimcord-settings-reset:focus-visible {\n    outline: 2px solid var(--text-link, #00a8fc);\n    outline-offset: 2px;\n}\n\n.vimcord-settings-status {\n    min-height: 20px;\n    margin: 12px 0;\n    color: var(--header-secondary, #b5bac1);\n    font-size: 13px;\n}\n\n.vimcord-settings-status.is-error {\n    color: var(--text-danger, #fa777c);\n}\n\n.vimcord-settings-reset {\n    min-height: 34px;\n    padding: 6px 12px;\n    border: 0;\n    border-radius: 4px;\n    background: var(--button-secondary-background, #4e5058);\n    color: var(--button-secondary-text, #fff);\n    font: inherit;\n    cursor: pointer;\n}\n\n.vimcord-settings-reset:hover {\n    background: var(--button-secondary-background-hover, #6d6f78);\n}\n";

// src/settings-panel.js
var MODIFIER_KEYS = /* @__PURE__ */ new Set(["Shift", "Control", "Alt", "Meta", "CapsLock", "AltGraph"]);
var nextPanelId = 0;
function keyLabel(key) {
  if (!key) {
    return "Unassigned";
  }
  return key === " " ? "Space" : key;
}
function createElement(tag, className, text) {
  const element4 = document.createElement(tag);
  element4.className = className;
  if (text !== void 0) {
    element4.textContent = text;
  }
  return element4;
}
var SettingsPanel = class {
  constructor(settings, onChange = () => {
  }, onManageMarks = () => {
  }) {
    this.settings = settings;
    this.onChange = onChange;
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
    const outlineRow = createElement("div", "vimcord-settings-row");
    const outlineText = createElement("div", "vimcord-settings-preference");
    const outlineLabel = createElement("label", "", "Show focus outline");
    outlineLabel.htmlFor = `${panelId}-outline`;
    const outlineDescription = createElement(
      "p",
      "vimcord-settings-description",
      "Briefly highlight the active pane or text field when focus changes."
    );
    outlineDescription.id = `${panelId}-outline-description`;
    outlineText.append(outlineLabel, outlineDescription);
    this.outlineInput = createElement("input", "vimcord-settings-toggle");
    this.outlineInput.id = outlineLabel.htmlFor;
    this.outlineInput.type = "checkbox";
    this.outlineInput.setAttribute("role", "switch");
    this.outlineInput.setAttribute("aria-describedby", outlineDescription.id);
    this.listen(this.outlineInput, "change", () => this.saveFocusOutline());
    outlineRow.append(outlineText, this.outlineInput);
    this.element.append(outlineRow);
    this.fadeDelayRow = createElement("div", "vimcord-settings-row");
    const fadeDelayLabel = createElement("label", "", "Fade after (seconds)");
    fadeDelayLabel.htmlFor = `${panelId}-fade-delay`;
    this.fadeDelayInput = createElement("input", "vimcord-settings-input");
    this.fadeDelayInput.id = fadeDelayLabel.htmlFor;
    this.fadeDelayInput.type = "number";
    this.fadeDelayInput.min = "0.5";
    this.fadeDelayInput.max = "60";
    this.fadeDelayInput.step = "0.5";
    this.listen(this.fadeDelayInput, "change", () => this.saveFocusOutlineFadeDelay());
    this.fadeDelayRow.append(fadeDelayLabel, this.fadeDelayInput);
    this.element.append(this.fadeDelayRow);
    const hintsRow = createElement("div", "vimcord-settings-row");
    const hintsLabel = createElement("label", "", "Limit hints to the selected pane");
    hintsLabel.htmlFor = `${panelId}-hints-pane`;
    this.hintsInput = createElement("input", "vimcord-settings-toggle");
    this.hintsInput.id = hintsLabel.htmlFor;
    this.hintsInput.type = "checkbox";
    this.hintsInput.setAttribute("role", "switch");
    this.listen(this.hintsInput, "change", () => {
      try {
        this.settings.setHintsCurrentPane(this.hintsInput.checked);
        this.onChange();
        this.setStatus(
          "Hint scope saved. Use the all-hints binding for the foreground view."
        );
      } catch (error) {
        this.setStatus(error.message, true);
      }
      this.render();
    });
    hintsRow.append(hintsLabel, this.hintsInput);
    this.element.append(hintsRow);
    this.preferenceInputs = /* @__PURE__ */ new Map();
    for (const [key, label] of Object.entries(EXTRA_PREFERENCES)) {
      const row = createElement("div", "vimcord-settings-row");
      const text = createElement("label", "", label);
      text.htmlFor = `${panelId}-${key}`;
      const input = createElement("input", "vimcord-settings-toggle");
      input.type = "checkbox";
      input.id = text.htmlFor;
      input.setAttribute("role", "switch");
      this.listen(input, "change", () => {
        try {
          this.settings.setPreference(key, input.checked);
          this.onChange();
          this.setStatus("Preference saved.");
        } catch (error) {
          this.setStatus(error.message, true);
        }
        this.render();
      });
      this.preferenceInputs.set(key, input);
      row.append(text, input);
      this.element.append(row);
    }
    const marksButton = createElement("button", "vimcord-settings-reset", "Manage saved marks");
    marksButton.type = "button";
    this.listen(marksButton, "click", () => {
      this.cancelCapture();
      onManageMarks();
    });
    this.element.append(marksButton);
    this.element.append(createElement("h2", "vimcord-settings-heading", "Keybinds"));
    const instructions = createElement(
      "p",
      "vimcord-settings-description",
      "Select a key, then press its replacement. Shifted characters and Space are supported. Digits are reserved for counts. Escape cancels. The top binding is pressed twice; mark bindings are followed by a letter."
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
  listen(element4, eventName, handler) {
    element4.addEventListener(eventName, handler, { signal: this.listeners.signal });
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
  saveFocusOutline() {
    try {
      this.settings.setShowFocusOutline(this.outlineInput.checked);
      this.onChange();
      this.setStatus(
        this.settings.showFocusOutline ? "Focus outline enabled." : "Focus outline disabled."
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
      this.setStatus("Focus outline fade delay saved.");
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
              this.onChange();
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

// src/sequence-hints.js
function element3(tag, text, className = "") {
  const node = document.createElement(tag);
  node.textContent = text;
  node.className = className;
  return node;
}
var SequenceHints = class {
  constructor() {
    this.root = null;
    this.signature = "";
  }
  update({ enabled, commands, marks, keybinds, badge }) {
    const signature = enabled && commands.prefix ? commands.prefix + commands.label : "";
    if (signature === this.signature) {
      if (this.root) {
        this.position(badge);
      }
      return;
    }
    this.stop();
    this.signature = signature;
    if (!signature) {
      return;
    }
    this.timer = setTimeout(() => {
      this.timer = null;
      const root = element3("div", "", "vimcord-sequence-hints");
      root.dataset.vimcord = "sequence-hints";
      root.setAttribute("role", "status");
      root.setAttribute("aria-live", "polite");
      const prefix = commands.prefix;
      if (prefix === "jumpTop") {
        root.append(element3("kbd", keybinds.jumpTop), " Go to top");
      } else {
        root.append(
          element3("strong", prefix === "setMark" ? "Set mark \xB7 a\u2013z" : "Jump to mark")
        );
        const entries = marks.entries();
        for (const entry of entries.slice(0, 8)) {
          const row = element3("div", "", "vimcord-sequence-row");
          row.append(
            element3("kbd", entry.key),
            element3("span", `${entry.name} \xB7 ${entry.detail}`)
          );
          root.append(row);
        }
        let note = "No saved marks yet.";
        if (prefix === "setMark") {
          note = "Any letter saves here. Used letters replace their mark.";
        } else if (entries.length) {
          note = "Press a saved letter to jump.";
        }
        if (entries.length > 8) {
          note += ` ${entries.length - 8} more saved.`;
        }
        if (keybinds.manageMarks) {
          note += ` Esc, then ${keybinds.manageMarks} to manage.`;
        }
        root.append(element3("small", note));
      }
      this.root = root;
      document.body.append(root);
      this.position(badge);
    }, 400);
  }
  position(badge) {
    const rect = badge.getBoundingClientRect();
    const width = Math.max(
      1,
      Math.min(
        badge.classList.contains("is-docked") ? rect.width : 280,
        window.innerWidth - 16
      )
    );
    Object.assign(this.root.style, {
      width: `${width}px`,
      left: `${Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))}px`,
      bottom: `${Math.max(8, window.innerHeight - rect.top + 8)}px`,
      maxHeight: `${Math.max(0, rect.top - 16)}px`
    });
  }
  stop() {
    clearTimeout(this.timer);
    this.timer = null;
    this.root?.remove();
    this.root = null;
    this.signature = "";
  }
};

// src/styles.css
var styles_default = ".vimcord-indicator-layer,\n.vimcord-indicator-container {\n    --vimcord-mode-color: var(--vimcord-normal-color, var(--brand-500, #5865f2));\n}\n\n.vimcord-indicator-layer {\n    position: fixed;\n    inset: 0;\n    z-index: 2147483646;\n    pointer-events: none;\n}\n\n.vimcord-indicator-layer[data-mode='insert'],\n.vimcord-indicator-container[data-mode='insert'] {\n    --vimcord-mode-color: var(--vimcord-insert-color, var(--status-positive, #3ba55c));\n}\n\n.vimcord-indicator-layer[data-mode='hint'],\n.vimcord-indicator-container[data-mode='hint'] {\n    --vimcord-mode-color: var(--vimcord-hint-color, var(--status-warning, #faa61a));\n}\n\n.vimcord-indicator-layer[data-mode='visual'],\n.vimcord-indicator-container[data-mode='visual'],\n.vimcord-indicator-layer[data-mode='range'],\n.vimcord-indicator-container[data-mode='range'] {\n    --vimcord-mode-color: var(--vimcord-visual-color, #b39df3);\n}\n\n.vimcord-message-in-range {\n    background: var(--background-message-highlight, rgba(179, 157, 243, 0.12)) !important;\n}\n\n.vimcord-sequence-hints {\n    position: fixed;\n    z-index: 2147483647;\n    box-sizing: border-box;\n    overflow: hidden;\n    pointer-events: none;\n    padding: 12px;\n    border: 1px solid var(--background-modifier-accent, #454550);\n    border-radius: 8px;\n    background: var(--background-floating, #1c1c24);\n    color: var(--text-normal, #eee);\n    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);\n    font: 12px/1.5 var(--font-primary, sans-serif);\n}\n\n.vimcord-sequence-hints strong,\n.vimcord-sequence-hints small {\n    display: block;\n}\n\n.vimcord-sequence-hints small {\n    margin-top: 8px;\n    color: var(--text-muted, #b5b5c2);\n}\n\n.vimcord-sequence-hints kbd {\n    font: 600 12px var(--font-code, monospace);\n    color: var(--vimcord-visual-color, #b39df3);\n}\n\n.vimcord-sequence-row {\n    display: flex;\n    gap: 10px;\n    margin-top: 6px;\n}\n\n.vimcord-sequence-row span {\n    overflow: hidden;\n    white-space: nowrap;\n    text-overflow: ellipsis;\n}\n\n.vimcord-message-selected {\n    background: var(--background-message-highlight, rgba(179, 157, 243, 0.12)) !important;\n    box-shadow: inset 3px 0 var(--vimcord-visual-color, #b39df3);\n}\n\n.vimcord-command {\n    font: 600 12px var(--vimcord-font, ui-monospace, monospace);\n    color: var(--vimcord-mode-color);\n}\n\n.vimcord-help-backdrop {\n    position: fixed;\n    inset: 0;\n    z-index: 2147483647;\n    display: grid;\n    place-items: center;\n    padding: 20px;\n    background: rgba(0, 0, 0, 0.5);\n}\n\n.vimcord-help {\n    box-sizing: border-box;\n    width: min(560px, 100%);\n    max-height: 80vh;\n    overflow-y: auto;\n    padding: 24px;\n    border: 1px solid var(--background-modifier-accent, #454550);\n    border-radius: 12px;\n    background: var(--background-floating, #1c1c24);\n    color: var(--text-normal, #eee);\n    box-shadow: 0 16px 60px rgba(0, 0, 0, 0.35);\n    font: 14px/1.5 var(--font-primary, sans-serif);\n}\n\n.vimcord-help header {\n    display: flex;\n    justify-content: space-between;\n    align-items: center;\n    gap: 12px;\n    margin-bottom: 20px;\n}\n\n.vimcord-help h2 {\n    font-size: 18px;\n    font-weight: 600;\n    margin: 0;\n}\n\n.vimcord-help-close {\n    color: var(--text-normal, #eee);\n    background: var(--background-modifier-accent, #454550);\n    border: 0;\n    border-radius: 5px;\n    padding: 6px 12px;\n    cursor: pointer;\n}\n\n.vimcord-help-close:focus-visible {\n    outline: 2px solid var(--brand-500, #5865f2);\n    outline-offset: 3px;\n}\n\n.vimcord-help-keys {\n    display: grid;\n    grid-template-columns: max-content 1fr;\n    gap: 10px 20px;\n    margin: 0;\n}\n\n.vimcord-help-keys dt,\n.vimcord-help-keys dd {\n    margin: 0;\n}\n\n.vimcord-help kbd {\n    font: 12px var(--font-code, monospace);\n    border: 1px solid var(--background-modifier-accent, #454550);\n    padding: 3px 6px;\n    border-radius: 4px;\n}\n\n.vimcord-help-note {\n    margin: 20px 0 0;\n    color: var(--text-muted, #b5b5c2);\n    font-size: 12px;\n}\n\n.vimcord-pane-outline {\n    position: absolute;\n    box-sizing: border-box;\n    border: 1.5px solid var(--vimcord-mode-color);\n    border-radius: var(--vimcord-focus-radius, 7px);\n    pointer-events: none;\n    opacity: 0;\n    transition: opacity 250ms ease-out;\n}\n\n.vimcord-pane-outline.is-visible {\n    opacity: 1;\n    transition: none;\n}\n\n.vimcord-indicator-container {\n    position: absolute;\n    bottom: 12px;\n    inset-inline-end: 12px;\n    display: flex;\n    align-items: center;\n    gap: 12px;\n    max-width: calc(100% - 24px);\n    padding: 7px 10px;\n    box-sizing: border-box;\n    font-size: 12px;\n    font-weight: 500;\n    line-height: 1.4;\n    border: 1px solid\n        var(--vimcord-indicator-border, var(--background-modifier-accent, rgba(255, 255, 255, 0.1)));\n    border-radius: 7px;\n    background: var(--vimcord-indicator-bg, var(--background-floating, #1c1c24));\n    color: var(--vimcord-indicator-fg, var(--text-normal, #fff));\n    white-space: nowrap;\n    pointer-events: none;\n}\n\n.vimcord-indicator-container.is-docked {\n    position: static;\n    flex-shrink: 0;\n    width: 100%;\n    max-width: 100%;\n    padding: 4px 8px;\n    gap: 8px;\n    border-width: 1px 0 0;\n    border-radius: 0;\n    background: var(--vimcord-indicator-bg, transparent);\n}\n\n.vimcord-indicator {\n    display: flex;\n    align-items: center;\n    gap: 8px;\n    min-width: 0;\n    font-family: var(--vimcord-font, inherit);\n}\n\n.vimcord-mode {\n    display: inline-flex;\n    align-items: center;\n    gap: 6px;\n    flex-shrink: 0;\n    font-size: 11px;\n    font-weight: 600;\n    letter-spacing: 0.04em;\n    text-transform: uppercase;\n}\n\n.vimcord-mode::before {\n    content: '';\n    width: 6px;\n    height: 6px;\n    border-radius: 50%;\n    background: var(--vimcord-mode-color);\n}\n\n.vimcord-target {\n    min-width: 0;\n    max-width: 36ch;\n    overflow: hidden;\n    text-overflow: ellipsis;\n}\n\n.vimcord-shortcuts {\n    display: flex;\n    align-items: center;\n    gap: 4px;\n    flex-shrink: 0;\n    color: var(--text-muted, #b5b5c2);\n    font-family: var(--vimcord-font, inherit);\n    font-size: 11px;\n}\n\n.vimcord-shortcuts kbd {\n    border: 1px solid var(--vimcord-indicator-border, var(--background-modifier-accent, #454550));\n    border-radius: 3px;\n    padding: 1px 4px;\n    font: inherit;\n}\n\n.vimcord-pane-outline[hidden],\n.vimcord-shortcuts[hidden] {\n    display: none;\n}\n\n@media (max-width: 420px) {\n    .vimcord-shortcuts {\n        display: none;\n    }\n}\n\n@media (prefers-reduced-motion: reduce) {\n    .vimcord-pane-outline {\n        transition: none;\n    }\n}\n\n[data-vimcord='hints'] {\n    position: fixed;\n    inset: 0;\n    z-index: 2147483647;\n    pointer-events: none;\n    contain: layout style;\n}\n\n.vimcord-hint {\n    position: absolute;\n    background: var(--vimcord-hint-bg, #ffd700);\n    color: var(--vimcord-hint-fg, #000);\n    border: 1px solid var(--vimcord-hint-border, #333);\n    border-radius: var(--vimcord-hint-radius, 4px);\n    padding: var(--vimcord-hint-padding, 2px 5px);\n    font: 700 var(--vimcord-hint-size, 12px) var(--vimcord-font, ui-monospace, monospace);\n    line-height: 1.2;\n    pointer-events: none;\n    user-select: none;\n    transform: translate(-50%, -50%);\n    white-space: nowrap;\n}\n\n.vimcord-hint.is-hidden {\n    display: none;\n}\n.vimcord-hint.is-match {\n    opacity: 1;\n}\n.vimcord-hint.is-exact {\n    box-shadow: 0 0 0 2px currentColor inset;\n}\n\n.vimcord-hint-connectors {\n    position: absolute;\n    inset: 0;\n    overflow: visible;\n    pointer-events: none;\n    color: var(--vimcord-hint-bg, #ffd700);\n}\n\n.vimcord-hint-connector {\n    stroke: currentColor;\n    stroke-width: 1;\n    fill: currentColor;\n    opacity: 0.65;\n}\n\n.vimcord-hint-connector.is-hidden {\n    display: none;\n}\n";

// src/index.js
function isTextEntryKey(event) {
  return [...event.key].length === 1 || event.isComposing || event.keyCode === 229 || ["Dead", "Process", "Unidentified"].includes(event.key);
}
function isMessageMode(mode) {
  return mode === "visual" || mode === "range";
}
var VimCord = class {
  constructor() {
    this.settings = new PluginSettings();
    this.settingsPanel = null;
  }
  getSettingsPanel() {
    this.settingsPanel?.dispose();
    this.settingsPanel = new SettingsPanel(
      this.settings,
      () => {
        this.commands?.reset();
        this.help?.close();
        this.updateIndicator();
      },
      () => this.openMarks()
    );
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
    this.nativeMessageAction = null;
    this.events = new AbortController();
    this.panes = new PaneManager();
    this.commands = new CommandSequence();
    this.messages = new MessageSelection();
    this.marksPanel?.close(false);
    this.marks = new ChannelMarks();
    this.marksPanel = null;
    this.help = new ContextHelp();
    this.nativeKeys = /* @__PURE__ */ new WeakSet();
    this.indicator = new ModeIndicator();
    this.sequenceHints = new SequenceHints();
    this.history = new ReadingHistory({
      capture: () => captureReadingPosition(this.panes, this.messages),
      restore: (position) => this.restoreReadingPosition(position),
      navigate: (path) => {
        this.setMode("normal");
        navigateTo(path);
      },
      notify: (message) => this.notify(message)
    });
    this.hints = new HintSession({
      onSelect: (element4) => this.activate(element4),
      onCancel: () => this.setMode("normal")
    });
    try {
      BdApi.DOM.addStyle("VimCord", styles_default);
      const capture = { capture: true, signal: this.events.signal };
      document.addEventListener("keydown", (event) => this.onKeyDown(event), capture);
      for (const type of ["beforeinput", "paste", "cut"]) {
        document.addEventListener(type, (event) => this.onComposerInput(event), capture);
      }
      document.addEventListener("focusin", (event) => this.onFocus(event), capture);
      document.addEventListener("focusout", () => this.scheduleRefresh(), capture);
      document.addEventListener(
        "pointerdown",
        (event) => {
          const target = event.target instanceof Element ? event.target : null;
          if (target?.closest(OWNED_SELECTOR)) {
            return;
          }
          this.history.cancelPending();
          this.history.restored = null;
          this.history.clearJump();
          this.history.update();
          this.commands.reset();
          if (isMessageMode(this.mode)) {
            this.setMode("normal");
          }
          this.updateIndicator();
          const editor2 = editableTarget(target) || editableTarget(target?.closest("label")?.control);
          this.allowInputFocusUntil = editor2 ? performance.now() + 500 : 0;
        },
        capture
      );
      window.addEventListener(
        "resize",
        () => {
          this.panes.invalidate();
          this.scheduleRefresh();
        },
        {
          signal: this.events.signal
        }
      );
      document.addEventListener(
        "scroll",
        (event) => {
          if (this.panes.panes.some(
            (pane) => pane.key === "chat" && pane.element === event.target
          )) {
            this.scheduleRefresh();
          }
        },
        { capture: true, passive: true, signal: this.events.signal }
      );
      window.addEventListener(
        "blur",
        () => {
          this.commands.reset();
          this.updateIndicator();
        },
        { signal: this.events.signal }
      );
      this.observer = new MutationObserver((records) => this.onMutations(records));
      this.observer.observe(document.body, {
        childList: true,
        characterData: true,
        subtree: true,
        attributes: true,
        attributeFilter: [
          "class",
          "style",
          "hidden",
          "inert",
          "aria-hidden",
          "role",
          "aria-label",
          "aria-labelledby"
        ]
      });
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
    this.help?.close(false);
    this.marksPanel?.close(false);
    this.history?.stop();
    this.sequenceHints?.stop();
    this.messages?.stop();
    this.commands?.reset();
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
    this.nativeMessageAction = null;
  }
  onSwitch() {
    if (!this.running) {
      return;
    }
    this.panes.invalidate();
    this.help?.close(false);
    this.marksPanel?.close(false);
    this.nativeMessageAction = null;
    this.commands.reset();
    const restored = this.history.restored;
    const restoredSelection = restored?.selectedId && restored.path === window.location.pathname.split("/").slice(0, 4).join("/") && this.messages.rowId === restored.selectedId && this.messages.selected?.isConnected;
    if (this.mode === "hint" || isMessageMode(this.mode) && !restoredSelection) {
      this.setMode("normal");
    }
    this.scheduleRefresh();
  }
  onMutations(records) {
    if (!this.running) {
      return;
    }
    if (isMessageMode(this.mode) && (!this.messages.selected?.isConnected || this.messages.rangeAnchorId && !document.getElementById(this.messages.rangeAnchorId)) || this.history.pending) {
      this.scheduleRefresh();
    }
    if (!this.indicator.element.isConnected || !this.indicator.badge.isConnected) {
      this.scheduleRefresh();
    }
    for (const record of records) {
      const target = record.target instanceof Element ? record.target : record.target.parentElement;
      if (target?.closest(OWNED_SELECTOR)) {
        continue;
      }
      const changed = [...record.addedNodes, ...record.removedNodes];
      if (changed.length && changed.every((node) => node instanceof Element && node.matches(OWNED_SELECTOR))) {
        continue;
      }
      if (this.panes.onMutation(record) || changed.some(
        (node) => node instanceof Element && (node.matches(USER_PANEL_SELECTOR) || node.querySelector(USER_PANEL_SELECTOR))
      )) {
        this.scheduleRefresh();
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
    const previousDialog = this.panes.dialog;
    this.panes.refresh();
    if (this.panes.dialog !== previousDialog) {
      this.commands.reset();
      this.help.close(false);
      this.marksPanel?.close(false);
    }
    if (isMessageMode(this.mode) && !this.messages.refresh()) {
      this.setMode("normal");
    }
    this.history.update();
    this.updateIndicator();
  }
  updateIndicator() {
    if (this.running) {
      this.indicator.update({
        mode: this.mode,
        pane: this.panes.active,
        dialog: this.panes.dialog,
        keybinds: this.settings.keybinds,
        showFocusOutline: this.settings.showFocusOutline,
        focusOutlineFadeDelay: this.settings.focusOutlineFadeDelay,
        selectedMessage: this.messages.selected,
        rangeCount: this.mode === "range" ? this.messages.selectedRows().length : 0,
        command: this.commands.label
      });
      this.sequenceHints.update({
        enabled: this.settings.preference("showSequenceHints"),
        commands: this.commands,
        marks: this.marks,
        keybinds: this.settings.keybinds,
        badge: this.indicator.badge
      });
    }
  }
  setMode(mode, hintScope = document) {
    if (!this.running || this.mode === mode) {
      return;
    }
    if (this.mode === "hint") {
      this.hints.stop();
    }
    const wasMessageMode = isMessageMode(this.mode);
    if (wasMessageMode && !isMessageMode(mode)) {
      this.messages.stop();
    }
    this.commands.reset();
    this.mode = mode;
    if (mode === "hint" && !this.hints.start(hintScope)) {
      this.mode = "normal";
    }
    if (isMessageMode(mode) && !wasMessageMode) {
      this.panes.refresh();
      if (this.messages.start(this.panes.active?.element, () => {
        this.dispatchNativeKey(document.body, "Tab", "Tab", 9);
      })) {
        const chat = this.panes.panes.find(
          (pane) => pane.element.contains(this.messages.list)
        );
        if (chat) {
          this.panes.active = chat;
        }
      } else {
        this.mode = "normal";
        this.notify("No messages are available to select.");
      }
    }
    if (isMessageMode(this.mode)) {
      this.messages.setRange(this.mode === "range");
    }
    this.updateIndicator();
  }
  onFocus(event) {
    if (!event.target?.closest?.(OWNED_SELECTOR)) {
      this.commands.reset();
    }
    if (this.mode === "insert") {
      this.updateIndicator();
      return;
    }
    const editor = editableTarget(event.target);
    if (!editor) {
      this.updateIndicator();
      return;
    }
    if (this.nativeMessageAction && performance.now() <= this.allowInputFocusUntil) {
      this.nativeMessageAction.editor = editor;
    }
    if (isComposer(editor) && performance.now() > this.allowInputFocusUntil) {
      const { signal } = this.events;
      setTimeout(() => {
        if (!signal.aborted && this.mode !== "insert" && editor.isConnected && document.activeElement === editor && performance.now() > this.allowInputFocusUntil) {
          editor.blur();
        }
      }, 0);
      return;
    }
    this.setMode("insert");
  }
  activate(element4) {
    if (!element4.isConnected) {
      this.setMode("normal");
      return;
    }
    const editor = editableTarget(element4);
    if (!editor) {
      this.history.beforeJump();
    }
    this.setMode(editor ? "insert" : "normal");
    if (editor) {
      editor.focus({ preventScroll: true });
    } else if (typeof element4.click === "function") {
      element4.click();
    } else {
      element4.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true, view: window })
      );
    }
  }
  onComposerInput(event) {
    if (this.mode === "insert" || this.marksPanel?.root) {
      return;
    }
    const editor = editableTarget(event.target);
    if (isComposer(editor) || event.type === "paste" && !editor) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }
  onKeyDown(event) {
    if (this.nativeKeys.has(event)) {
      return;
    }
    if (this.marksPanel?.root) {
      return;
    }
    if (event.target instanceof Element && event.target.closest("[data-vimcord-settings]")) {
      return;
    }
    if (this.help.root) {
      event.preventDefault();
      event.stopImmediatePropagation();
      this.help.handleKey(event, this.settings.helpKeyForMode(this.mode));
      return;
    }
    if (this.mode !== "insert") {
      const composerEdit = isComposer(event.target) && (["Enter", "Backspace", "Delete"].includes(event.key) || (event.ctrlKey || event.metaKey) && /^[vxzy]$/i.test(event.key));
      const composedText = !event.metaKey && (!event.ctrlKey || event.getModifierState("AltGraph")) && (event.altKey || event.isComposing || event.keyCode === 229) && isTextEntryKey(event);
      if (composerEdit || composedText) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
    }
    if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing) {
      this.commands.reset();
      this.updateIndicator();
      return;
    }
    if (event.key === "Shift" || event.key === "CapsLock") {
      return;
    }
    if (event.key === "Tab") {
      this.allowInputFocusUntil = performance.now() + 500;
      this.commands.reset();
    }
    if (this.mode === "insert") {
      if (event.key !== "Escape") {
        return;
      }
      const editor = editableTarget(event.target);
      if (editor && this.nativeMessageAction?.editor === editor) {
        this.nativeMessageAction = null;
        this.allowInputFocusUntil = 0;
        this.setMode("normal");
        const { signal } = this.events;
        setTimeout(() => {
          if (!signal.aborted && this.mode === "normal" && document.activeElement === editor) {
            editor.blur();
          }
        }, 0);
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
      if (event.key === this.settings.helpKeyForMode("hint")) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (!event.repeat) {
          this.help.show(this.mode, this.settings);
        }
        return;
      }
      if (/^[a-z]$/i.test(event.key) || ["Escape", "Enter", "Backspace"].includes(event.key)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (!event.repeat) {
          this.hints.handleKey(event);
        }
      } else if (isTextEntryKey(event)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
      return;
    }
    if (event.key === "Escape") {
      if (this.mode === "normal" && !this.commands.label) {
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      if (this.commands.label) {
        this.commands.reset();
      } else {
        this.setMode("normal");
      }
      this.updateIndicator();
      return;
    }
    const action = this.settings.actionForKey(event.key, this.mode);
    const countDigit = !this.commands.prefix && /^[0-9]$/.test(event.key);
    if (!countDigit && !["historyBack", "historyForward"].includes(action)) {
      this.history.cancelPending();
      this.history.restored = null;
    }
    const hasPrefix = !!this.commands.label;
    const command = this.commands.feed(event.key, action, event.repeat);
    if (!command) {
      if (isTextEntryKey(event) || hasPrefix || isMessageMode(this.mode) && event.key !== "Tab") {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
      this.updateIndicator();
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    this.runCommand(command, event);
    this.history.update();
    this.updateIndicator();
  }
  notify(message, type = "info") {
    if (this.running) {
      BdApi.UI?.showToast?.(message, { type });
    }
  }
  runCommand({ action, count, mark }, event) {
    switch (action) {
      case "hint":
      case "hintAll":
        if (!event.repeat) {
          this.panes.refresh();
          let scope = this.panes.dialog || document;
          if (action === "hint" && this.settings.hintsCurrentPane) {
            scope = this.panes.active?.element || scope;
          }
          this.setMode("hint", scope);
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
        this.setMode("normal");
        this.panes.move(-count);
        break;
      case "paneRight":
        this.setMode("normal");
        this.panes.move(count);
        break;
      case "scrollDown":
        if (isMessageMode(this.mode)) {
          if (!this.messages.move(count)) {
            this.setMode("normal");
          }
        } else {
          this.panes.scroll(this.settings.scrollAmount * count);
        }
        break;
      case "scrollUp":
        if (isMessageMode(this.mode)) {
          if (!this.messages.move(-count)) {
            this.setMode("normal");
          }
        } else {
          this.panes.scroll(-this.settings.scrollAmount * count);
        }
        break;
      case "halfPageDown":
        this.panes.scroll(this.panes.pageSize * count / 2);
        break;
      case "halfPageUp":
        this.panes.scroll(-this.panes.pageSize * count / 2);
        break;
      case "jumpTop":
      case "jumpBottom": {
        if (this.panes.active?.key === "chat") {
          this.history.beforeJump();
        }
        const edge = action === "jumpTop" ? "top" : "bottom";
        if (edge === "bottom") {
          if (!this.jumpToLatest()) {
            this.setMode("normal");
            this.panes.jump(edge);
          }
        } else if (isMessageMode(this.mode)) {
          this.messages.jump(edge);
        } else {
          this.panes.jump(edge);
        }
        break;
      }
      case "visual":
        if (!event.repeat) {
          this.setMode(isMessageMode(this.mode) ? "normal" : "visual");
        }
        break;
      case "range":
        if (!event.repeat) {
          this.setMode(this.mode === "range" ? "visual" : "range");
        }
        break;
      case "copyMessage":
        if (!event.repeat) {
          const range = this.mode === "range";
          this.messages.copy({
            authors: this.settings.preference("rangeCopyAuthors"),
            timestamps: this.settings.preference("rangeCopyTimestamps")
          }).then(
            () => this.notify(range ? "Message range copied." : "Message copied."),
            (error) => this.notify(error.message, "error")
          );
        }
        break;
      case "replyMessage":
      case "editMessage":
      case "reactMessage":
        if (!event.repeat) {
          this.messageAction(action);
        }
        break;
      case "copyMessageLink":
        if (!event.repeat) {
          this.messages.copyLink().then(
            () => this.notify("Message link copied."),
            (error) => this.notify(error.message, "error")
          );
        }
        break;
      case "historyBack":
      case "historyForward":
        try {
          this.history.go(action === "historyBack" ? -count : count);
        } catch (error) {
          this.notify(error.message, "error");
        }
        break;
      case "manageMarks":
        if (!event.repeat) {
          this.openMarks();
        }
        break;
      case "setMark":
      case "jumpMark":
        try {
          if (action === "setMark") {
            this.marks.save(mark);
            this.notify(`Channel saved to mark \u201C${mark}\u201D.`);
          } else {
            this.history.beforeJump();
            this.marks.jump(mark);
            this.setMode("normal");
          }
        } catch (error) {
          this.history.clearJump();
          this.notify(error.message, "error");
        }
        break;
      case "help":
        if (!event.repeat) {
          this.help.show(this.mode, this.settings);
        }
        break;
    }
  }
  messageAction(action) {
    if (!this.messages.refresh()) {
      this.setMode("normal");
      return;
    }
    const selected = this.messages.selected;
    selected.focus({ preventScroll: true });
    this.nativeMessageAction = { action, editor: null };
    this.allowInputFocusUntil = performance.now() + 500;
    const shortcuts = {
      replyMessage: ["r", "KeyR", 82],
      editMessage: ["e", "KeyE", 69],
      reactMessage: ["+", "Equal", 187, { shiftKey: true }]
    };
    this.dispatchNativeKey(selected, ...shortcuts[action]);
    const { signal } = this.events;
    setTimeout(() => {
      if (!signal.aborted && this.mode === "visual" && this.messages.selected === selected && action !== "reactMessage") {
        this.allowInputFocusUntil = 0;
        this.nativeMessageAction = null;
        this.notify(
          action === "editMessage" ? "Editing is only available for your own editable messages." : "Reply is unavailable for this message."
        );
      }
    }, 300);
  }
  dispatchNativeKey(target, key, code, keyCode, options = {}) {
    const event = new KeyboardEvent("keydown", {
      ...options,
      key,
      code,
      keyCode,
      which: keyCode,
      bubbles: true,
      cancelable: true
    });
    this.nativeKeys.add(event);
    target.dispatchEvent(event);
  }
  openMarks() {
    if (this.running) {
      this.history.update();
      this.help.close(false);
      this.setMode("normal");
      this.commands.reset();
      this.updateIndicator();
    }
    this.marks ??= new ChannelMarks();
    this.marksPanel ??= new MarksPanel(this.marks, (key) => {
      if (this.running) {
        this.history.beforeJump();
      }
      this.marks.jump(key);
    });
    this.marksPanel.show(this.settings.keybinds);
  }
  restoreReadingPosition(position) {
    const pane = this.panes.panes.find((candidate) => candidate.key === "chat");
    if (this.panes.dialog || !pane?.element.isConnected) {
      return false;
    }
    const article = (id) => document.getElementById(id)?.querySelector('[role="article"]');
    const anchor = position.anchorId ? article(position.anchorId) : null;
    const selected = position.selectedId ? article(position.selectedId) : null;
    if (position.anchorId && !pane.element.contains(anchor) || position.selectedId && !pane.element.contains(selected)) {
      return false;
    }
    this.setMode("normal");
    this.panes.active = pane;
    const restoreScroll = () => {
      const top = anchor ? pane.element.scrollTop + anchor.getBoundingClientRect().top - pane.element.getBoundingClientRect().top - position.offset : position.scrollTop;
      pane.element.scrollTo({ top, behavior: "instant" });
    };
    restoreScroll();
    if (selected) {
      this.setMode("visual");
      this.messages.select(selected, false);
      restoreScroll();
    }
    return true;
  }
  jumpToLatest() {
    if (this.panes.active?.key !== "chat" || this.panes.dialog) {
      return false;
    }
    const row = this.panes.active.element.querySelector('[id^="chat-messages-"]');
    const channelId = row?.id.match(/^chat-messages-(\d+)-/)?.[1];
    const actions = BdApi.Webpack?.getByKeys?.("jumpToPresent");
    if (!channelId || typeof actions?.jumpToPresent !== "function") {
      return false;
    }
    this.setMode("normal");
    actions.jumpToPresent(channelId, 50);
    return true;
  }
};
module.exports = module.exports.default;
