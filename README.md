# Markscope VS Code

Review Markdown structure inside VS Code.

Markscope opens Markdown files as a custom preview with an outline pane and a focused section body. It is useful for reviewing document shape, topic flow, and section balance while editing.

The preview runs entirely inside the extension webview. It does not require the `markscope` command or any sibling checkout.

Markdown parsing is bundled with the extension, so the published extension is self-contained.

## Features

- Open Markdown files with `Markscope Preview`.
- Switch between outline-only and first-paragraph reading.
- Filter the outline by heading depth.
- Switch the reading panes between automatic, side-by-side, and stacked layouts.
- Navigate sections with `ArrowUp`, `ArrowDown`, `j`, and `k` after clicking the preview.
- Sync the selected outline item from the active Markdown editor cursor.

## Usage

Open a Markdown file, then run:

```text
Markscope: Open Preview
```

You can also use `Reopen Editor With...` or `Open With...` and choose `Markscope Preview`.

From the Explorer context menu, use `Open in Markscope` on a Markdown file.

## Development Setup

Install dependencies:

```sh
pnpm install
```

Compile the extension:

```sh
pnpm run compile
```

Run the extension from VS Code with the `Run Extension` launch target. In the Extension Development Host window, open a Markdown file and use `Reopen Editor With...` or `Open With...` to choose `Markscope Preview`.

Package a local `.vsix`:

```sh
pnpm run package
```

## Commands

- `Markscope: Open Preview`: opens the active Markdown file with the `Markscope Preview` custom editor.
- `Open in Markscope`: available from the Explorer context menu for Markdown files.
