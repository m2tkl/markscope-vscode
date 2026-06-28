import * as path from "node:path";

import * as vscode from "vscode";

const previewViewType = "markscope.preview";
const markdownExtensions = [".md", ".markdown", ".mdown", ".mkd"];

type WebviewMessage = {
  readonly type?: string;
};

export function activate(context: vscode.ExtensionContext): void {
  const provider = new MarkscopePreviewProvider(context.extensionUri);

  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(previewViewType, provider, {
      supportsMultipleEditorsPerDocument: false,
      webviewOptions: {
        retainContextWhenHidden: true,
      },
    }),
    vscode.commands.registerCommand("markscope.openPreview", async () => {
      const uri = await getMarkdownUri();
      if (uri) {
        await openMarkscopePreview(uri);
      }
    }),
    vscode.commands.registerCommand("markscope.openPreviewFromExplorer", async (uri?: vscode.Uri) => {
      const markdownUri = await getMarkdownUri(uri);
      if (markdownUri) {
        await openMarkscopePreview(markdownUri);
      }
    }),
  );
}

export function deactivate(): void {
  // Markscope runs entirely inside the webview.
}

class MarkscopePreviewProvider implements vscode.CustomTextEditorProvider {
  constructor(private readonly extensionUri: vscode.Uri) {}

  resolveCustomTextEditor(document: vscode.TextDocument, panel: vscode.WebviewPanel): void {
    const mediaRoot = vscode.Uri.joinPath(this.extensionUri, "media");

    panel.webview.options = {
      enableScripts: true,
      localResourceRoots: [mediaRoot],
    };
    panel.webview.html = getPreviewHtml(panel.webview, this.extensionUri);

    const update = (): void => {
      panel.webview.postMessage({
        type: "update",
        markdown: document.getText(),
        version: document.version,
      });
    };
    const syncCursor = (editor = vscode.window.activeTextEditor): void => {
      if (!editor || editor.document.uri.toString() !== document.uri.toString()) {
        return;
      }

      panel.webview.postMessage({
        type: "cursor",
        line: editor.selection.active.line,
      });
    };

    const changeSubscription = vscode.workspace.onDidChangeTextDocument((event) => {
      if (event.document.uri.toString() === document.uri.toString()) {
        update();
      }
    });
    const selectionSubscription = vscode.window.onDidChangeTextEditorSelection((event) => {
      syncCursor(event.textEditor);
    });
    const activeEditorSubscription = vscode.window.onDidChangeActiveTextEditor((editor) => {
      syncCursor(editor);
    });

    panel.onDidDispose(() => {
      changeSubscription.dispose();
      selectionSubscription.dispose();
      activeEditorSubscription.dispose();
    });
    panel.webview.onDidReceiveMessage((message: WebviewMessage) => {
      if (message.type === "ready") {
        update();
        syncCursor();
      }
    });
  }
}

async function getMarkdownUri(uri?: vscode.Uri): Promise<vscode.Uri | undefined> {
  if (uri) {
    return validateMarkdownUri(uri);
  }

  const activeEditor = vscode.window.activeTextEditor;
  if (activeEditor) {
    return validateMarkdownUri(activeEditor.document.uri);
  }

  const selection = await vscode.window.showOpenDialog({
    canSelectFiles: true,
    canSelectFolders: false,
    canSelectMany: false,
    filters: {
      Markdown: ["md", "markdown", "mdown", "mkd"],
    },
    title: "Open Markdown in Markscope",
  });

  return selection?.[0] ? validateMarkdownUri(selection[0]) : undefined;
}

function validateMarkdownUri(uri: vscode.Uri): vscode.Uri | undefined {
  if (uri.scheme !== "file") {
    vscode.window.showWarningMessage("Markscope can only open local Markdown files.");
    return undefined;
  }

  if (!isMarkdownPath(uri.fsPath)) {
    vscode.window.showWarningMessage("Select a Markdown file to open in Markscope.");
    return undefined;
  }

  return uri;
}

function isMarkdownPath(filePath: string): boolean {
  return markdownExtensions.includes(path.extname(filePath).toLowerCase());
}

async function openMarkscopePreview(uri: vscode.Uri): Promise<void> {
  await vscode.commands.executeCommand("vscode.openWith", uri, previewViewType, vscode.ViewColumn.Beside);
}

function getPreviewHtml(webview: vscode.Webview, extensionUri: vscode.Uri): string {
  const nonce = getNonce();
  const markedUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, "media", "vendor", "marked.esm.js"));
  const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, "media", "preview.js"));
  const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, "media", "preview.css"));

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} data:; script-src 'nonce-${nonce}' ${webview.cspSource}; style-src ${webview.cspSource};">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Markscope</title>
  <link rel="stylesheet" href="${styleUri}">
</head>
<body>
  <div class="shell" data-layout="auto">
    <header class="toolbar">
      <div class="mode-group" aria-label="Reading mode">
        <button type="button" data-mode="outline" aria-pressed="true">Outline</button>
        <button type="button" data-mode="firstParagraph" aria-pressed="false">First Paragraph</button>
      </div>
      <div class="level-group" aria-label="Heading level">
        <button type="button" data-level="all" aria-pressed="true">All</button>
        <button type="button" data-level="1" aria-pressed="false">H1</button>
        <button type="button" data-level="2" aria-pressed="false">H2</button>
        <button type="button" data-level="3" aria-pressed="false">H3</button>
        <button type="button" data-level="4" aria-pressed="false">H4</button>
      </div>
      <div class="layout-group" aria-label="Pane layout">
        <button type="button" data-layout="auto" aria-pressed="true">Auto</button>
        <button type="button" data-layout="side" aria-pressed="false">Side</button>
        <button type="button" data-layout="stack" aria-pressed="false">Stack</button>
      </div>
    </header>
    <main class="content" tabindex="0" aria-label="Markscope preview">
      <section class="reading-list" id="reading-list" aria-label="Document sections"></section>
      <div class="divider" id="divider" role="separator" aria-orientation="vertical"></div>
      <section class="section-body" id="section-body" aria-label="Selected section"></section>
    </main>
  </div>
  <script nonce="${nonce}" type="module">
    import { marked } from "${markedUri}";
    import { startPreview } from "${scriptUri}";

    startPreview({ marked });
  </script>
</body>
</html>`;
}

function getNonce(): string {
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let text = "";

  for (let i = 0; i < 32; i += 1) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }

  return text;
}
