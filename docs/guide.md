# VimCord guide

[Back to the README](../README.md)

## Install

1. Install [BetterDiscord](https://docs.betterdiscord.app/users/getting-started/installation).
2. Download [`VimCord.plugin.js`](https://raw.githubusercontent.com/CyR1en/VimCord/refs/heads/main/VimCord.plugin.js) from this repository.
3. Copy it into your BetterDiscord plugins folder:

   | Platform | Plugins folder                                        |
   | -------- | ----------------------------------------------------- |
   | Windows  | `%AppData%/BetterDiscord/plugins`                     |
   | macOS    | `~/Library/Application Support/BetterDiscord/plugins` |
   | Linux    | `~/.config/BetterDiscord/plugins`                     |

4. Enable **VimCord** in **User Settings → BetterDiscord → Plugins**.

Only the generated `VimCord.plugin.js` is needed to install. Node.js and the source folder are for development.

## Use

These are the default bindings. Action keys can be remapped in settings.

| Mode                         | Key            | Action                                                        |
| ---------------------------- | -------------- | ------------------------------------------------------------- |
| Normal                       | `h` / `l`      | Select the previous / next pane                               |
| Normal                       | `j` / `k`      | Scroll the selected pane down / up                            |
| Normal                       | `d` / `u`      | Scroll half the selected pane's height                        |
| Normal                       | `f`            | Show hints in the selected pane                               |
| Normal                       | `F`            | Show hints across the foreground view                         |
| Normal                       | `i`            | Enter Insert mode and focus an editor                         |
| Normal                       | `5j`, `3k`     | Repeat a movement by its preceding count                      |
| Normal                       | `gg` / `G`     | Top of selected pane / bottom or latest messages              |
| Normal                       | `ma` / `'a`    | Save current channel or DM as mark a / jump to mark a         |
| Normal, Message, Range       | `M`            | Manage saved marks                                            |
| Normal, Message, Range       | `H` / `L`      | Previous / next reading position (counts supported)           |
| Normal                       | `v`            | Select a message                                              |
| Normal, Message              | `V`            | Start a message range at the selected or last visible message |
| Message                      | `j` / `k`      | Select the next / previous message; counts work here too      |
| Message                      | `y`            | Copy the selected message's text                              |
| Message                      | `r`            | Start a native reply and enter Insert mode                    |
| Message                      | `e`            | Open the native editor for your own selected message          |
| Message                      | `+`            | Open the native reaction picker                               |
| Message                      | `Y`            | Copy a link to the selected message                           |
| Message                      | `gg` / `G`     | First loaded message / latest messages in Normal mode         |
| Message                      | `Escape` / `v` | Leave message selection                                       |
| Range                        | `j` / `k`      | Extend or shrink the selected range; counts work here too     |
| Range                        | `y`            | Copy selected messages in chronological order                 |
| Range                        | `V`            | Return to single-message selection at the current endpoint    |
| Range                        | `Escape` / `v` | Clear the range and return to Normal                          |
| Normal, Message, Range, Hint | `?`            | Show contextual help                                          |
| Insert                       | `Escape`       | Leave the editor and return to Normal mode                    |
| Hint                         | Letters        | Narrow the labels; activate a complete label immediately      |
| Hint                         | `Backspace`    | Undo the last hint letter                                     |
| Hint                         | `Enter`        | Activate the sole remaining match                             |
| Hint                         | `Escape`       | Cancel hints                                                  |

The badge docks beneath the controls in Discord's user panel whenever that panel is available, keeping the composer clear. When the panel is unavailable, such as behind a settings dialog, the badge floats at the bottom right of the foreground view. It shows the current mode, its target, and a key reminder.

Changing panes, modes, or text fields briefly outlines the active target. The outline fades after your configured delay (three seconds by default) and stays faded while scrolling. You can turn it off with **Show focus outline** in VimCord's preferences. Settings panes have names such as **Settings sidebar** and **Plugins**. In Insert mode, the badge shows the active text field's label. Hint mode shows **Choose a control** and hides the outline. Key reminders follow your configured bindings and hide in narrow windows.

Normal mode blocks typing into the message composer, including unbound characters and composition keys. It also blocks pastes forwarded by Discord and rejects edits while the composer's automatic focus is being cleared. Clicking or tabbing into an editable input, or pressing `i`, enters Insert mode and restores typing, paste, and IME input. An editor already focused when the plugin starts stays usable. Navigation shortcuts and copying still pass through to Discord.

When the member sidebar is open, `l` from Messages selects Members; `h` returns to Messages. Closing the selected member list returns pane selection to Messages.

On the Friends page, `l` from Friends selects **Active Now**. Use `j` / `k`, `d` / `u`, and `gg` / `G` to scroll that column; `h` returns to Friends. Active Now is omitted when Discord hides it in a narrow window and becomes selectable again when it reappears.

Pane discovery also recognizes other substantial, visible vertical scroll containers. It checks CSS overflow and whether content exceeds the container's height, then uses an accessible name or nearby heading for the badge. Panes follow their position on screen. Editors, message content, menus, small controls, and redundant nested containers are excluded. With a dialog open, only its panes are selectable. Named Discord panes remain available even when their current content fits without scrolling.

Hint labels never overlap by prefix: a label such as `A` will not coexist with `AA`. There is no selection timeout. Invalid hint letters are ignored. Scrolling, resizing, navigation, or a pointer interaction cancels hints so labels do not remain at stale positions.

Labels also avoid visual collisions. Crowded labels move to nearby free space, with a small connector pointing to the target. Placement respects your font and padding settings and stays fixed while you type. If the placement search runs out of room, lower-priority hints are omitted for that scan rather than drawn on top of another label.

Scrolling is immediate, including held `j` / `k` keys. `i` prefers an editor in the foreground dialog, then the channel composer. Native Discord controls are activated once, without temporarily disabling overlays or replaying a chain of simulated clicks.

Message mode initially selects the focused message, or the last visible message. Its subtle highlight identifies the selection; the optional focus outline still fades normally. Moving between messages uses Discord's currently rendered history. At a loaded-history boundary, scrolling can load more messages; `gg` does not download an entire channel's history. In the Messages pane, `G` uses Discord's jump-to-present action and returns to Normal mode. If that native action is unavailable, it falls back to the bottom of the loaded pane.

`y` copies message text, including line breaks and emoji labels; attachment-only messages report that there is no text to copy. `r` opens Discord's reply composer without sending a message. Selecting another pane, changing channels, opening a dialog, or clicking exits Message mode. Message selections survive rerenders of the same message and are cleared when that message disappears.

In Message mode, `e` opens Discord's editor when the selected message belongs to you and is editable. `+` opens the reaction picker; choose an emoji to react or Escape to cancel. `Y` copies the native message permalink, including for messages without text. Editing and reacting follow Discord's normal permissions and availability.

`V` anchors a range at the current selection. Move either direction with `j` / `k` to extend or shrink it; the badge shows the number selected. `y` copies the range from oldest to newest, separated by blank lines. Author names are included by default; timestamps are optional and use ISO 8601 UTC. Both are configurable. Attachment-only rows use `[No text content]`; copying does not download attachments. Ranges use currently loaded messages and clear when the anchor or endpoint disappears. Reply, edit, reaction, and link-copy actions are available only in single-message selection.

`H` and `L` follow reading positions from channel changes and jumps such as `gg`, `G`, and marks. Each stop remembers the channel, the visible message and its scroll offset, and any single-message selection. Ordinary scrolling updates the current stop. Navigating somewhere new after going back replaces the forward history. Up to 50 stops are kept for the current plugin session; disabling or reloading clears them. Discord loads a saved message when needed. Unavailable messages time out with a notice instead of trapping navigation.

Counts range from 1 to 999 and apply to pane movement, scrolling, half-page scrolling, and message movement. The badge displays an unfinished count or command. Escape, Tab, focus changes, clicks, channel switches, and mode changes clear it. Held prefix keys do not complete a sequence. Remapping the top key to `q`, for example, changes `gg` to `qq`.

Marks use letters `a` through `z`. `ma` replaces mark a with the current channel or DM; `'a` opens it through Discord's native router, even from another server. Marks are stored locally and survive restarts. They store the destination, not a scroll position, and resetting preferences does not erase them. Unset marks report an error without navigating.

`M` opens the marks manager with channel or DM names and their server or conversation context. Use Tab and Enter to open a destination, change its letter, or remove it. Occupied letters are rejected when renaming. **Undo removal** restores the last removed mark while the manager stays open. Escape closes the manager, or cancels a letter change first. **Manage saved marks** is also available in plugin settings, including when VimCord is disabled.

Pause after `m`, `'`, or the first `g` to see possible continuations above the badge. These optional hints appear after 400 ms, follow remapped bindings, and disappear when the sequence completes or is canceled. When the badge is docked, the hints stay within its column and never intercept clicks.

`?` opens a help dialog showing actions for the current mode with the configured keys. Escape, the help key, Close, or clicking the backdrop dismisses it. Tab stays within the dialog. In Hint mode, if Help is remapped to a letter, `?` remains the help key so every hint label stays selectable. In Insert mode, `?` is ordinary text; use Escape first to open help.

## Settings

Open **User Settings → BetterDiscord → Plugins → VimCord settings**. Changes take effect immediately and are saved for the next session.

- Adjust the scroll amount from **10 to 1,000 pixels** for each scroll up/down action. Half-page scrolling still uses the selected pane's height.
- Toggle **Show focus outline** to enable or disable the brief focus highlight. The mode badge stays visible either way.
- With the outline enabled, set **Fade after (seconds)** from **0.5 to 60 seconds**, in half-second steps. The default is **3 seconds**. Changes apply immediately; disabling the outline preserves your chosen delay.
- **Limit hints to the selected pane** is enabled by default. Turn it off to make `f` show hints across the foreground view. `F` always uses that broader scope. With a dialog open, both stay inside the dialog.
- Toggle **Show key-sequence hints** to show or hide the delayed prefix guide.
- Configure whether range copies include **author names** (on by default) and **timestamps** (off by default).
- Remap navigation, message actions, both hint scopes, mark prefixes, jumps, help, and Insert mode. Select a binding, then press a single character or Space. Shift characters are supported; Ctrl, Alt, and Meta combinations are not. Digits are reserved for counts. Escape or Tab cancels key capture.
- Assign each action its own key. Half-page bindings also accept their uppercase letter, and conflicting bindings are rejected for both forms.
- Existing custom bindings take priority over newly added defaults. A conflicting new action starts **Unassigned** until you choose a key for it. Old digit bindings revert to their defaults because digits now enter counts.
- Use **Reset to defaults** to restore the original keybindings and preferences, including an enabled focus outline with a three-second delay. Saved marks remain intact.

The hint alphabet and mode controls, including Escape, Enter, and Backspace, remain fixed. Mark names remain letters a–z.

## Customize appearance

Use BetterDiscord's Custom CSS. The original indicator and hint classes remain available:

```css
.vimcord-indicator-layer,
.vimcord-indicator-container {
  --vimcord-normal-color: #89b4fa;
  --vimcord-insert-color: #a6e3a1;
  --vimcord-hint-color: #f9e2af;
  --vimcord-focus-radius: 7px;
}

.vimcord-indicator-container {
  --vimcord-indicator-bg: #181825;
  --vimcord-indicator-fg: #a6adc8;
  --vimcord-indicator-border: transparent;
  --vimcord-font: ui-monospace, monospace;
}

.vimcord-hint {
  --vimcord-hint-bg: #f9e2af;
  --vimcord-hint-fg: #11111b;
  --vimcord-hint-border: transparent;
  --vimcord-hint-radius: 6px;
  --vimcord-hint-padding: 3px 6px;
  --vimcord-hint-size: 11px;
}
```

Other hooks are `.vimcord-indicator`, `.vimcord-pane-outline`, `.vimcord-hints`, and the hint classes `.is-match`, `.is-exact`, and `.is-hidden`. The badge adds a row in the user panel; the floating fallback and outline do not intercept clicks. Mode names remain visible alongside the color cues. The outline respects reduced-motion preferences by disappearing without an animated fade.

## Develop

BetterDiscord requires **one distributed JavaScript file**, but explicitly supports **multiple source files bundled into it**. See its [plugin structure](https://docs.betterdiscord.app/plugins/introduction/structure) and [bundling guide](https://docs.betterdiscord.app/plugins/tutorials/bundling).

VimCord uses plain JavaScript modules and esbuild. There are no runtime libraries. The build includes CSS as text, adds BetterDiscord's metadata header, and exports the plugin class through CommonJS. Output is readable, without minification or source maps, following the [plugin guidelines](https://docs.betterdiscord.app/plugins/publishing/guidelines).

```text
src/
  index.js       Plugin lifecycle, modes, keyboard and focus handling
  commands.js    Counts and pending command prefixes
  messages.js    Native message selection and text copying
  marks.js       Persistent channel/DM marks and native routing
  marks-panel.js Saved-mark management dialog
  marks-panel.css Standalone marks dialog appearance
  history.js     Session reading positions and asynchronous restoration
  sequence-hints.js Delayed command-prefix guide
  help.js        Contextual keyboard help and focus management
  dom.js         Editor detection, visibility and foreground surfaces
  panes.js       Pane discovery, selection and scrolling
  scroll-panels.js Cached discovery of other vertical scroll panels
  hints.js       Candidate measurement, labels and hint session cleanup
  hint-layout.js Collision placement using a spatial grid
  indicator.js   Mode indicator
  settings.js    Settings defaults, validation and persistence
  settings-panel.js Settings controls and key capture
  settings.css   Settings panel appearance
  styles.css     Default appearance
scripts/
  build.mjs      Single-file bundle and metadata
VimCord.plugin.js Generated installable plugin; do not edit directly
```

Use Node.js 24 or later:

```sh
npm ci
npm run build
npm run watch  # Rebuild after source changes; Ctrl+C to stop
npm run lint          # Check JavaScript for mistakes and readability
npm run lint:fix      # Apply available ESLint fixes
npm run format        # Format maintained source and documentation
npm run format:check  # Check formatting without changing files
npm test              # Run settings validation and DOM interaction tests
npm run check         # Lint, check formatting, build, check bundle syntax, and test
```

ESLint enforces coding rules, and Prettier handles formatting. See [CONTRIBUTING.md](../CONTRIBUTING.md) for the project style guide. The generated bundle is excluded from both tools.

The root bundle is kept in the repository so users can download it directly. Rebuild it whenever source changes. Copy it into the plugin folder to test, or symlink that file during development. The existing `create_symlink.ps1` helper supports Windows; rebuild before using it.

### Runtime design

- Each plugin instance owns its state and disposes it on disable.
- One filtered DOM observer handles structural, visibility, labeling, and scroll-style changes; route and resize events request a coalesced refresh. There is no focus polling or editor-method patching.
- Scroll containers are indexed at startup and after layout or route changes. DOM mutations rescan affected branches, while ordinary refreshes reuse the index. Empty containers remain tracked so content growth can make them selectable. Message bodies and VimCord overlays are excluded from the scan.
- Pane discovery combines known Discord sections with visible overflow containers at least 120 pixels wide and 100 pixels tall after clipping. It removes redundant wrappers and nested content, and preserves selection across a uniquely named replacement panel.
- The outline tracks scrolling and target resizing with coalesced geometry updates. Its observer and event listeners are removed when the plugin stops.
- Hints use one targeted candidate query. Geometry, priority, and a visible anchor are measured before overlays are inserted; sorting uses cached numbers.
- Label sizes are read in one batch. Collision placement checks neighboring spatial-grid cells with a bounded local search and a shared fallback cursor; it never runs during typing.
- Candidate geometry is discarded when hint mode ends. Activation rechecks that the selected element is still visible and connected.
- Selectors prefer roles and list IDs, with class-name stems as compatibility fallbacks instead of exact generated hashes.

### Check a change in Discord

Use ordinary navigation controls and an empty editor; no test messages need to be sent.

1. Enable, disable, and re-enable the plugin. Confirm the indicator and hints are removed on disable and normal input focus still works.
2. Switch servers/channels/DMs, move between panes, and hold `j` / `k`. Confirm the badge docks in the user panel, names the selected pane, and the outline fades after the configured delay without returning during scrolling.
   On Friends, move right into Active Now and confirm only its column scrolls. Narrow the window until Discord hides it, then widen the window and verify the pane returns.
3. Open hints, narrow a two-letter label, backspace, select a control, and cancel with Escape or scrolling.
4. Enter Insert mode, type a temporary draft, remove it, and Escape. Check clicks, Tab, shortcuts, and IME input. Move between fields and confirm the badge and outline follow the active field without displaying its value.
   In Normal mode, try unbound letters, Space, and composition keys; the composer must stay unchanged. Confirm `i`, clicks, and Tab still let you type in Insert mode.
5. Repeat in a dialog or settings page. Confirm the badge floats when the user panel is unavailable and docks again when it returns. Toggle **Show focus outline**, check the change applies immediately, and confirm it persists after re-enabling VimCord. Check that covered background controls are not activated.
6. Change a keybinding and scroll amount in VimCord settings. Confirm the changes work immediately and persist after re-enabling the plugin. Cancel key capture with Escape and Tab, then reset to defaults.
7. Try `5j`, `gg`, and `G` in a list and in Messages. Cancel an unfinished count or mark with Escape, Tab, a click, or a channel switch. In older message history, confirm `G` reaches the present.
8. Enter `v`, move with `j` / `k` and counts, copy with `y`, and start a reply with `r`. Confirm the intended reply target and existing draft are preserved; cancel the reply without sending. Escape exits selection, and opening a dialog or changing channels clears it.
9. Set a temporary channel mark, navigate elsewhere, and jump back. Verify persistence after a reload. Compare `f` and `F`, change the scope preference, and open help in Normal, Message, and Hint modes with remapped keys.
10. Extend and shrink a range with `V`, counts, and `j` / `k`; copy with authors and timestamps enabled or disabled. Verify chronological order and cleanup after navigation.
11. Use `H` / `L` after channel changes and top/latest jumps; verify the message selection and reading offset return. Try a new destination after going back.
12. Open `M`, rename a temporary mark, remove it, and undo. Check the manager while the plugin is disabled. Pause on each command prefix, verify hints stay above the docked badge, and disable the preference.
13. Open `e` on your own message and `+` on a selected message, then cancel without saving or reacting. Copy a message link with `Y` and verify its channel and message IDs.

`npm run check` checks lint rules, formatting, packaging, and syntax, then runs settings validation and DOM interaction tests using jsdom. These tests do not cover full Discord integration. Discord can change its DOM, so live checks are still needed when updating selectors. Unsupported custom controls should get a narrow, verified compatibility fix rather than global click retries.
