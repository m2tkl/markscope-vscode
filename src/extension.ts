import * as path from "node:path";

import * as vscode from "vscode";

const previewViewType = "markscope.preview";
const markdownExtensions = [".md", ".markdown", ".mdown", ".mkd"];

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
  // Nothing to clean up. Markscope runs inside the webview.
}

class MarkscopePreviewProvider implements vscode.CustomTextEditorProvider {
  constructor(private readonly extensionUri: vscode.Uri) {}

  resolveCustomTextEditor(document: vscode.TextDocument, panel: vscode.WebviewPanel): void {
    const markedRoot = vscode.Uri.joinPath(this.extensionUri, "node_modules", "marked", "lib");

    panel.webview.options = {
      enableScripts: true,
      localResourceRoots: [markedRoot],
    };
    panel.webview.html = getPreviewHtml(panel.webview, this.extensionUri, document.uri.fsPath);

    const update = (): void => {
      panel.webview.postMessage({
        type: "update",
        filePath: document.uri.fsPath,
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
    panel.webview.onDidReceiveMessage((message: { type?: string }) => {
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

function getPreviewHtml(webview: vscode.Webview, extensionUri: vscode.Uri, filePath: string): string {
  const nonce = getNonce();
  const markedUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, "node_modules", "marked", "lib", "marked.esm.js"));

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} data:; script-src 'nonce-${nonce}' ${webview.cspSource}; style-src 'nonce-${nonce}';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Markscope</title>
  <style nonce="${nonce}">
    :root {
      color-scheme: light dark;
    }

    * {
      box-sizing: border-box;
    }

    html,
    body {
      height: 100%;
      margin: 0;
      overflow: hidden;
      width: 100%;
    }

    body {
      background: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
      font-family: var(--vscode-font-family);
      font-size: 13px;
    }

    button {
      background: var(--vscode-button-secondaryBackground);
      border: 1px solid var(--vscode-button-border, transparent);
      border-radius: 4px;
      color: var(--vscode-button-secondaryForeground);
      cursor: pointer;
      font: inherit;
      font-size: 12px;
      line-height: 1;
      min-height: 24px;
      padding: 4px 9px;
      white-space: nowrap;
    }

    button:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }

    button[aria-pressed="true"] {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }

    .shell {
      display: grid;
      grid-template-rows: auto 1fr;
      height: 100%;
      min-width: 0;
    }

    .toolbar {
      align-items: center;
      border-bottom: 1px solid var(--vscode-panel-border);
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      justify-content: flex-start;
      min-height: 36px;
      padding: 5px 10px;
    }

    .mode-group,
    .level-group,
    .layout-group {
      display: flex;
      flex: 0 0 auto;
      gap: 3px;
    }

    .mode-group,
    .level-group {
      border-right: 1px solid var(--vscode-panel-border);
      margin-right: 3px;
      padding-right: 8px;
    }

    .content {
      display: grid;
      grid-template-columns: minmax(280px, 38%) 5px minmax(320px, 1fr);
      min-height: 0;
      outline: none;
    }

    .reading-list,
    .section-body {
      min-width: 0;
      overflow: auto;
    }

    .reading-list {
      background: var(--vscode-sideBar-background);
      border-right: 1px solid var(--vscode-panel-border);
      padding: 8px 0 16px;
    }

    .divider {
      background: var(--vscode-panel-border);
      cursor: col-resize;
    }

    .divider:hover {
      background: var(--vscode-focusBorder);
    }

    .shell[data-layout="stack"] .content {
      grid-template-columns: 1fr;
      grid-template-rows: minmax(180px, 42%) 5px minmax(220px, 1fr);
    }

    .shell[data-layout="stack"] .reading-list {
      border-bottom: 1px solid var(--vscode-panel-border);
      border-right: 0;
    }

    .shell[data-layout="stack"] .divider {
      cursor: row-resize;
    }

    .section-body {
      background: var(--vscode-editor-background);
      overflow-x: hidden;
      padding: 22px 20px 40px;
    }

    .section-card {
      align-items: center;
      border-left: 2px solid transparent;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      justify-content: center;
      margin: 0 8px;
      min-height: 32px;
      padding: 5px 8px 6px;
    }

    .section-card:hover,
    .section-card.is-active {
      background: var(--vscode-list-hoverBackground);
    }

    .section-card.is-active {
      border-left-color: var(--vscode-focusBorder);
      color: var(--vscode-list-activeSelectionForeground, var(--vscode-editor-foreground));
    }

    .section-card:focus {
      outline: none;
    }

    .section-heading {
      align-self: stretch;
      font-weight: 500;
      line-height: 1.32;
      overflow-wrap: anywhere;
    }

    .section-heading.level-1 { font-size: 13px; font-weight: 650; }
    .section-heading.level-2 { font-size: 13px; }
    .section-heading.level-3 { font-size: 12px; }
    .section-heading.level-4,
    .section-heading.level-5,
    .section-heading.level-6 { color: var(--vscode-descriptionForeground); font-size: 12px; }

    .section-preview {
      align-self: stretch;
      color: var(--vscode-descriptionForeground);
      display: -webkit-box;
      font-size: 12px;
      line-height: 1.4;
      margin-top: 3px;
      overflow: hidden;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
    }

    .section-body article {
      line-height: 1.62;
      margin: 0;
      max-width: 100%;
      min-width: 0;
      overflow-wrap: anywhere;
    }

    .section-body h1 { font-size: 28px; }
    .section-body h2 { font-size: 21px; }
    .section-body h3 { font-size: 17px; }
    .section-body h4,
    .section-body h5,
    .section-body h6 { font-size: 14px; }

    .section-body h1,
    .section-body h2,
    .section-body h3,
    .section-body h4,
    .section-body h5,
    .section-body h6 {
      line-height: 1.25;
      margin: 1.4em 0 0.55em;
    }

    .section-body h1:first-child,
    .section-body h2:first-child,
    .section-body h3:first-child {
      margin-top: 0;
    }

    .section-body p,
    .section-body ul,
    .section-body ol,
    .section-body blockquote,
    .section-body pre {
      margin: 0.85em 0;
    }

    .section-body ul,
    .section-body ol {
      padding-left: 1.45em;
    }

    .section-body pre {
      background: var(--vscode-textCodeBlock-background);
      border-radius: 4px;
      overflow: auto;
      padding: 12px;
    }

    .section-body code {
      background: var(--vscode-textCodeBlock-background);
      border-radius: 3px;
      font-family: var(--vscode-editor-font-family);
      font-size: 0.92em;
      padding: 0.1em 0.25em;
    }

    .section-body blockquote {
      border-left: 3px solid var(--vscode-textBlockQuote-border);
      color: var(--vscode-textBlockQuote-foreground);
      margin-left: 0;
      padding-left: 12px;
    }

    .empty {
      align-items: center;
      color: var(--vscode-descriptionForeground);
      display: flex;
      height: 100%;
      justify-content: center;
      text-align: center;
    }

    @media (max-width: 760px) {
      .shell[data-layout="auto"] .content {
        grid-template-columns: 1fr;
        grid-template-rows: minmax(180px, 42%) 5px minmax(220px, 1fr);
      }

      .shell[data-layout="auto"] .reading-list {
        border-bottom: 1px solid var(--vscode-panel-border);
        border-right: 0;
      }

      .shell[data-layout="auto"] .divider {
        cursor: row-resize;
      }

      .shell[data-layout="side"] .content {
        grid-template-columns: minmax(240px, 38%) 5px minmax(280px, 1fr);
        grid-template-rows: none;
      }

      .shell[data-layout="side"] .reading-list {
        border-bottom: 0;
        border-right: 1px solid var(--vscode-panel-border);
      }

      .shell[data-layout="side"] .divider {
        cursor: col-resize;
      }

      .section-body {
        padding: 18px 16px 32px;
      }

      .section-body article {
        max-width: calc(100vw - 32px);
      }
    }
  </style>
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

    const vscode = acquireVsCodeApi();
    const shell = document.querySelector(".shell");
    const readingList = document.getElementById("reading-list");
    const sectionBody = document.getElementById("section-body");
    const content = document.querySelector(".content");
    const state = {
      markdown: "",
      sections: [],
      activeId: undefined,
      mode: "outline",
      level: "all",
      layout: localStorage.getItem("markscope:layout") ?? "auto",
    };

    for (const button of document.querySelectorAll("[data-mode]")) {
      button.addEventListener("click", () => {
        state.mode = button.dataset.mode;
        render();
      });
    }

    for (const button of document.querySelectorAll("[data-level]")) {
      button.addEventListener("click", () => {
        state.level = button.dataset.level;
        render();
      });
    }

    for (const button of document.querySelectorAll("button[data-layout]")) {
      button.addEventListener("click", () => {
        state.layout = button.dataset.layout;
        localStorage.setItem("markscope:layout", state.layout);
        content.style.gridTemplateColumns = "";
        content.style.gridTemplateRows = "";
        applyLayout();
        render();
      });
    }

    content.addEventListener("click", () => {
      content.focus({ preventScroll: true });
    });

    content.addEventListener("keydown", (event) => {
      if (event.target instanceof HTMLButtonElement) {
        return;
      }

      if (event.key === "ArrowDown" || event.key === "j" || event.key === "ArrowUp" || event.key === "k") {
        event.preventDefault();
        moveOutlineSelection(event.key === "ArrowDown" || event.key === "j" ? 1 : -1);
      }
    });

    document.getElementById("divider").addEventListener("pointerdown", (event) => {
      event.preventDefault();
      const move = (moveEvent) => {
        const rect = content.getBoundingClientRect();
        if (isStackedLayout()) {
          const topHeight = Math.min(Math.max(moveEvent.clientY - rect.top, 160), rect.height - 220);
          content.style.gridTemplateRows = topHeight + "px 5px minmax(220px, 1fr)";
          return;
        }

        const leftWidth = Math.min(Math.max(moveEvent.clientX - rect.left, 240), rect.width - 320);
        content.style.gridTemplateColumns = leftWidth + "px 5px minmax(320px, 1fr)";
      };
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    });

    window.addEventListener("resize", () => {
      if (state.layout === "auto") {
        content.style.gridTemplateColumns = "";
        content.style.gridTemplateRows = "";
      }
      applyLayout();
    });

    window.addEventListener("message", (event) => {
      if (event.data?.type === "cursor") {
        selectSectionForLine(event.data.line);
        return;
      }

      if (event.data?.type !== "update") {
        return;
      }

      state.markdown = event.data.markdown ?? "";
      state.sections = parseSections(state.markdown);
      if (!state.sections.some((section) => section.id === state.activeId)) {
        state.activeId = state.sections[0]?.id;
      }
      render();
    });

    vscode.postMessage({ type: "ready" });

    function parseSections(markdown) {
      const tokens = marked.lexer(markdown);
      const headingLines = headingLineNumbers(markdown);
      const sections = [];
      let current;
      let headingIndex = 0;

      for (const token of tokens) {
        if (token.type === "heading") {
          current = {
            id: "section-" + sections.length,
            depth: token.depth,
            heading: token.text,
            line: headingLines[headingIndex] ?? 0,
            tokens: [token],
          };
          headingIndex += 1;
          sections.push(current);
          continue;
        }

        if (!current) {
          current = {
            id: "section-" + sections.length,
            depth: 1,
            heading: "Document Start",
            line: 0,
            tokens: [],
          };
          sections.push(current);
        }

        current.tokens.push(token);
      }

      return sections;
    }

    function headingLineNumbers(markdown) {
      const lines = markdown.split(/\\r?\\n/);
      const headingLines = [];
      let inFence = false;

      lines.forEach((line, index) => {
        if (/^ {0,3}(\\\`\\\`\\\`|~~~)/.test(line)) {
          inFence = !inFence;
          return;
        }

        if (inFence) {
          return;
        }

        if (/^ {0,3}#{1,6}\\s+/.test(line)) {
          headingLines.push(index);
          return;
        }

        if (index > 0 && /^ {0,3}(=+|-+)\\s*$/.test(line) && lines[index - 1].trim()) {
          headingLines.push(index - 1);
        }
      });

      return headingLines;
    }

    function render() {
      applyLayout();
      updatePressed("[data-mode]", state.mode);
      updatePressed("[data-level]", state.level);
      updatePressed("button[data-layout]", state.layout);

      if (state.sections.length === 0) {
        readingList.innerHTML = '<div class="empty">No Markdown content.</div>';
        sectionBody.innerHTML = '<div class="empty">No Markdown content.</div>';
        return;
      }

      const visibleSections = state.sections.filter((section) => {
        return state.level === "all" || section.depth <= Number(state.level);
      });
      const fallbackSection = visibleSections[0] ?? state.sections[0];

      if (!visibleSections.some((section) => section.id === state.activeId)) {
        state.activeId = fallbackSection.id;
      }

      readingList.replaceChildren(...visibleSections.map(renderSectionCard));
      renderBody(state.sections.find((section) => section.id === state.activeId) ?? fallbackSection);
    }

    function visibleSections() {
      return state.sections.filter((section) => {
        return state.level === "all" || section.depth <= Number(state.level);
      });
    }

    function updatePressed(selector, activeValue) {
      for (const button of document.querySelectorAll(selector)) {
        const value = button.dataset.mode ?? button.dataset.level ?? button.dataset.layout;
        button.setAttribute("aria-pressed", String(value === activeValue));
      }
    }

    function applyLayout() {
      shell.dataset.layout = state.layout;
    }

    function isStackedLayout() {
      return state.layout === "stack" || (state.layout === "auto" && window.matchMedia("(max-width: 760px)").matches);
    }

    function renderSectionCard(section) {
      const card = document.createElement("article");
      card.className = "section-card" + (section.id === state.activeId ? " is-active" : "");
      card.dataset.sectionId = section.id;
      card.style.paddingLeft = 8 + Math.max(section.depth - 1, 0) * 14 + "px";
      card.setAttribute("aria-current", String(section.id === state.activeId));

      const heading = document.createElement("div");
      heading.className = "section-heading level-" + section.depth;
      heading.textContent = section.heading;
      card.append(heading);

      if (state.mode === "firstParagraph") {
        const preview = firstParagraph(section);
        if (preview) {
          const paragraph = document.createElement("div");
          paragraph.className = "section-preview";
          paragraph.textContent = preview;
          card.append(paragraph);
        }
      }

      card.addEventListener("click", () => selectSection(section.id, { focusPreview: true }));

      return card;
    }

    function selectSection(sectionId, { focusPreview = false } = {}) {
      state.activeId = sectionId;
      render();
      scrollSectionCardIntoView(sectionId);

      if (focusPreview) {
        focusPreviewSurface();
      }
    }

    function moveOutlineSelection(delta) {
      const sections = visibleSections();
      const currentIndex = Math.max(0, sections.findIndex((section) => section.id === state.activeId));
      const nextIndex = Math.min(Math.max(currentIndex + delta, 0), sections.length - 1);
      const nextSection = sections[nextIndex];

      if (nextSection) {
        selectSection(nextSection.id, { focusPreview: true });
      }
    }

    function selectSectionForLine(line) {
      const nextSection = sectionForLine(line);
      if (!nextSection || nextSection.id === state.activeId) {
        return;
      }

      state.activeId = nextSection.id;
      render();
      scrollSectionCardIntoView(nextSection.id);
    }

    function sectionForLine(line) {
      let match = state.sections[0];
      for (const section of state.sections) {
        if (section.line > line) {
          break;
        }
        match = section;
      }
      return match;
    }

    function scrollSectionCardIntoView(sectionId) {
      readingList
        .querySelector('[data-section-id="' + CSS.escape(sectionId) + '"]')
        ?.scrollIntoView({ block: "nearest" });
    }

    function focusPreviewSurface() {
      content.focus({ preventScroll: true });
    }

    function renderBody(section) {
      const article = document.createElement("article");
      article.innerHTML = marked.parser(sectionBodyTokens(section));
      sectionBody.replaceChildren(article);
    }

    function sectionBodyTokens(section) {
      const start = state.sections.findIndex((candidate) => candidate.id === section.id);
      if (start === -1) {
        return section.tokens;
      }

      const tokens = [];
      for (let index = start; index < state.sections.length; index += 1) {
        const candidate = state.sections[index];
        if (index > start && candidate.depth <= section.depth) {
          break;
        }
        tokens.push(...candidate.tokens);
      }
      return tokens;
    }

    function firstParagraph(section) {
      const paragraph = section.tokens.find((token) => token.type === "paragraph");
      return paragraph?.text?.replace(/\\s+/g, " ").trim() ?? "";
    }
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

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return character;
    }
  });
}
