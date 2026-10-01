# VimCord

Vim-style keyboard navigation and link hints for BetterDiscord.

VimCord has three modes: **Normal** for navigation, **Insert** for typing, and **Hint** for selecting controls by their labels. It works with server and channel lists, DMs, chat, member lists, friends, and scrollable dialogs.

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

These are the default bindings. Normal-mode actions can be remapped in settings.

| Mode   | Key         | Action                                                   |
| ------ | ----------- | -------------------------------------------------------- |
| Normal | `h` / `l`   | Select the previous / next pane                          |
| Normal | `j` / `k`   | Scroll the selected pane down / up                       |
| Normal | `d` / `u`   | Scroll half the selected pane's height                   |
| Normal | `f`         | Show hints for visible controls                          |
| Normal | `i`         | Enter Insert mode and focus an editor                    |
| Insert | `Escape`    | Leave the editor and return to Normal mode               |
| Hint   | Letters     | Narrow the labels; activate a complete label immediately |
| Hint   | `Backspace` | Undo the last hint letter                                |
| Hint   | `Enter`     | Activate the sole remaining match                        |
| Hint   | `Escape`    | Cancel hints                                             |

The indicator shows the current mode and selected pane. Clicking or tabbing into an editable input enters Insert mode. An editor already focused when the plugin starts stays usable. Ctrl, Alt, and Meta shortcuts and IME composition pass through to Discord.

When the member sidebar is open, `l` from Channel selects Member List; `h` returns to Channel. Closing the selected member list returns pane selection to Channel.

Hint labels never overlap by prefix: a label such as `A` will not coexist with `AA`. There is no selection timeout. Invalid hint letters are ignored. Scrolling, resizing, navigation, or a pointer interaction cancels hints so labels do not remain at stale positions.

Labels also avoid visual collisions. Crowded labels move to nearby free space, with a small connector pointing to the target. Placement respects your font and padding settings and stays fixed while you type. If the placement search runs out of room, lower-priority hints are omitted for that scan rather than drawn on top of another label.

Scrolling is immediate, including held `j` / `k` keys. `i` prefers an editor in the foreground dialog, then the channel composer. Native Discord controls are activated once, without temporarily disabling overlays or replaying a chain of simulated clicks.

Visual mode is not implemented, and `v` has no default VimCord binding.

## Settings

Open **User Settings → BetterDiscord → Plugins → VimCord settings**. Changes take effect immediately and are saved for the next session.

- Adjust the scroll amount from **10 to 1,000 pixels** for each scroll up/down action. Half-page scrolling still uses the selected pane's height.
- Remap pane selection, scrolling, half-page scrolling, hints, and Insert mode. Select a binding, then press a single character or Space. Shift characters are supported; Ctrl, Alt, and Meta combinations are not. Escape or Tab cancels key capture.
- Assign each action its own key. Half-page bindings also accept their uppercase letter, and conflicting bindings are rejected for both forms.
- Use **Reset to defaults** to restore the original keybindings and scroll amount.

The hint alphabet and mode controls, including Escape, Enter, and Backspace, remain fixed. There is no Visual mode setting.

## Customize appearance

Use BetterDiscord's Custom CSS. The original indicator and hint classes remain available:

```css
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

Other hooks are `.vimcord-indicator`, `.vimcord-hints`, and the hint classes `.is-match`, `.is-exact`, and `.is-hidden`. The indicator appears in the user panel, or floats at the bottom left when that panel is unavailable.

## Develop

BetterDiscord requires **one distributed JavaScript file**, but explicitly supports **multiple source files bundled into it**. See its [plugin structure](https://docs.betterdiscord.app/plugins/introduction/structure) and [bundling guide](https://docs.betterdiscord.app/plugins/tutorials/bundling).

VimCord uses plain JavaScript modules and esbuild. There are no runtime libraries. The build includes CSS as text, adds BetterDiscord's metadata header, and exports the plugin class through CommonJS. Output is readable, without minification or source maps, following the [plugin guidelines](https://docs.betterdiscord.app/plugins/publishing/guidelines).

```text
src/
  index.js       Plugin lifecycle, modes, keyboard and focus handling
  dom.js         Editor detection, visibility and foreground surfaces
  panes.js       Pane discovery, selection and scrolling
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

ESLint enforces coding rules, and Prettier handles formatting. See [CONTRIBUTING.md](CONTRIBUTING.md) for the project style guide. The generated bundle is excluded from both tools.

The root bundle is kept in the repository so users can download it directly. Rebuild it whenever source changes. Copy it into the plugin folder to test, or symlink that file during development. The existing `create_symlink.ps1` helper supports Windows; rebuild before using it.

### Runtime design

- Each plugin instance owns its state and disposes it on disable.
- One filtered DOM observer handles structural changes; route and resize events request a coalesced refresh. There is no focus polling or editor-method patching.
- Pane references remain valid when content grows from non-scrollable to scrollable. Ordinary message updates do not rescan the entire interface.
- Hints use one targeted candidate query. Geometry, priority, and a visible anchor are measured before overlays are inserted; sorting uses cached numbers.
- Label sizes are read in one batch. Collision placement checks neighboring spatial-grid cells with a bounded local search and a shared fallback cursor; it never runs during typing.
- Candidate geometry is discarded when hint mode ends. Activation rechecks that the selected element is still visible and connected.
- Selectors prefer roles and list IDs, with class-name stems as compatibility fallbacks instead of exact generated hashes.

### Check a change in Discord

Use ordinary navigation controls and an empty editor; no test messages need to be sent.

1. Enable, disable, and re-enable the plugin. Confirm the indicator and hints are removed on disable and normal input focus still works.
2. Switch servers/channels/DMs, move between panes, and hold `j` / `k`.
3. Open hints, narrow a two-letter label, backspace, select a control, and cancel with Escape or scrolling.
4. Enter Insert mode, type a temporary draft, remove it, and Escape. Check clicks, Tab, shortcuts, and IME input.
5. Repeat in a dialog or settings page. Check that covered background controls are not activated.
6. Change a keybinding and scroll amount in VimCord settings. Confirm the changes work immediately and persist after re-enabling the plugin. Cancel key capture with Escape and Tab, then reset to defaults.

`npm run check` checks lint rules, formatting, packaging, and syntax, then runs settings validation and DOM interaction tests using jsdom. These tests do not cover full Discord integration. Discord can change its DOM, so live checks are still needed when updating selectors. Unsupported custom controls should get a narrow, verified compatibility fix rather than global click retries.

## Credits

Thanks to [@moistgreen](https://github.com/moistgreen) for the original settings and keybindings contribution in [PR #1](https://github.com/CyR1en/VimCord/pull/1).
