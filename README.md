# Markscope VS Code

Open Markdown files in Markscope as a VS Code preview. The preview runs inside the extension webview and does not require the `markscope` command.

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

## Commands

- `Markscope: Open Preview`: opens the active Markdown file with the `Markscope Preview` custom editor.
- `Open in Markscope`: available from the Explorer context menu for Markdown files.
