# Contributing to VimCord

Use Node.js 24 or later, then run `npm ci`. See the [development instructions](README.md#develop) for the source layout and manual checks in Discord.

## JavaScript style

Use the [Google JavaScript Style Guide](https://google.github.io/styleguide/jsguide.html) as a reference for naming and structure. The project conventions below and the checked-in ESLint and Prettier configurations take precedence.

- Let Prettier handle layout: four-space indentation, single quotes where they do not add escapes, semicolons, trailing commas, and parentheses around arrow parameters. The 100-character line width is a wrapping target, not a strict maximum.
- Always use braces for conditionals and loops. Avoid nested ternaries and chained assignments.
- Prefer `const`; use `let` when reassignment is necessary. Do not use `var`.
- Use strict equality (`===` and `!==`), and remove unused variables.
- Choose descriptive names. Give complicated conditions a meaningful name or extract a focused helper when it makes the intent easier to follow.
- Use comments to explain reasoning or constraints that are not clear from the code itself.

Files in `src/` are browser ES modules; BetterDiscord provides the read-only `BdApi` global. Build scripts run in Node.js. Keep code within its configured environment rather than adding broad global exceptions.

## Before submitting a change

```sh
npm run lint:fix
npm run format
npm run check
```

`lint:fix` applies available ESLint fixes; resolve any remaining findings manually. `format` writes Prettier's output. For checks without edits, use `npm run lint` and `npm run format:check`.

`npm run check` runs linting, a formatting check, the build, `node --check VimCord.plugin.js`, and `npm test`. The tests cover settings validation and DOM interaction using jsdom; run them separately with `npm test`. They do not cover full Discord integration, so use the manual checks in the README for behavior changes.

`VimCord.plugin.js` is generated and committed so users can download it. Edit source files and rebuild with `npm run build`; do not edit or format the bundle directly. Include the rebuilt bundle with source changes.
