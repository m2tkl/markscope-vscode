export function startPreview({ marked }) {
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

  connectControls();
  connectDivider();
  connectHostMessages();
  vscode.postMessage({ type: "ready" });

  function connectControls() {
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

    window.addEventListener("resize", () => {
      if (state.layout === "auto") {
        content.style.gridTemplateColumns = "";
        content.style.gridTemplateRows = "";
      }
      applyLayout();
    });
  }

  function connectDivider() {
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
  }

  function connectHostMessages() {
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
  }

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
    const lines = markdown.split(/\r?\n/);
    const headingLines = [];
    let inFence = false;

    lines.forEach((line, index) => {
      if (/^ {0,3}(```|~~~)/.test(line)) {
        inFence = !inFence;
        return;
      }

      if (inFence) {
        return;
      }

      if (/^ {0,3}#{1,6}\s+/.test(line)) {
        headingLines.push(index);
        return;
      }

      if (index > 0 && /^ {0,3}(=+|-+)\s*$/.test(line) && lines[index - 1].trim()) {
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

    const sections = visibleSections();
    const fallbackSection = sections[0] ?? state.sections[0];

    if (!sections.some((section) => section.id === state.activeId)) {
      state.activeId = fallbackSection.id;
    }

    readingList.replaceChildren(...sections.map(renderSectionCard));
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
    return paragraph?.text?.replace(/\s+/g, " ").trim() ?? "";
  }
}
