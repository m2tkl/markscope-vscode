export function annotateTokenSourceLines(tokens) {
  let sourceLine = 0;

  for (const token of tokens) {
    token.sourceLine = sourceLine;
    sourceLine += countLineBreaks(token.raw ?? "");
  }
}

export function sourcePositionForWord(token, renderedText, selectionStart, selectedText) {
  if (token?.type !== "paragraph" || !Array.isArray(token.tokens)) {
    return null;
  }

  const word = selectedText.trim();
  if (!word) {
    return null;
  }

  const adjustedSelectionStart = selectionStart + selectedText.indexOf(word);
  const occurrence = countOccurrences(renderedText.slice(0, adjustedSelectionStart), word);
  const candidates = visibleWordOffsets(token, word);
  const sourceOffset = candidates[occurrence];
  if (sourceOffset === undefined) {
    return null;
  }

  return positionWithinToken(token, sourceOffset);
}

function visibleWordOffsets(token, word) {
  const ranges = [];
  collectVisibleRanges(token.tokens, token.raw ?? "", 0, ranges);
  const offsets = [];

  for (const range of ranges) {
    const text = token.raw.slice(range.start, range.end);
    let searchFrom = 0;
    let match;

    while ((match = text.indexOf(word, searchFrom)) !== -1) {
      offsets.push(range.start + match);
      searchFrom = match + word.length;
    }
  }

  return offsets;
}

function collectVisibleRanges(tokens, parentRaw, parentOffset, ranges) {
  let searchFrom = 0;

  for (const token of tokens) {
    const raw = token.raw ?? "";
    const localOffset = parentRaw.indexOf(raw, searchFrom);
    if (localOffset === -1) {
      continue;
    }

    const sourceOffset = parentOffset + localOffset;
    searchFrom = localOffset + raw.length;

    if (Array.isArray(token.tokens) && token.tokens.length > 0) {
      collectVisibleRanges(token.tokens, raw, sourceOffset, ranges);
      continue;
    }

    if (token.type !== "br" && token.type !== "html" && token.type !== "image") {
      ranges.push({ start: sourceOffset, end: sourceOffset + raw.length });
    }
  }
}

function positionWithinToken(token, sourceOffset) {
  const prefix = (token.raw ?? "").slice(0, sourceOffset);
  const lineBreaks = prefix.match(/\r\n|\r|\n/g) ?? [];
  const lastLineBreak = Math.max(prefix.lastIndexOf("\n"), prefix.lastIndexOf("\r"));

  return {
    line: (token.sourceLine ?? 0) + lineBreaks.length,
    character: lastLineBreak === -1 ? prefix.length : prefix.length - lastLineBreak - 1,
  };
}

function countOccurrences(text, search) {
  let count = 0;
  let searchFrom = 0;
  let match;

  while ((match = text.indexOf(search, searchFrom)) !== -1) {
    count += 1;
    searchFrom = match + search.length;
  }

  return count;
}

function countLineBreaks(text) {
  return text.match(/\r\n|\r|\n/g)?.length ?? 0;
}
