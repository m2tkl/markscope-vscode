import assert from "node:assert/strict";
import test from "node:test";

import { marked } from "marked";

import { annotateTokenSourceLines, sourcePositionForWord } from "../media/preview-position.mjs";

test("annotateTokenSourceLines records the actual line of each heading", () => {
  const tokens = marked.lexer("# First\n\n````text\n~~~\n# Not a heading\n````\n\n## Second\n");

  annotateTokenSourceLines(tokens);

  assert.equal(tokens[0].sourceLine, 0);
  assert.equal(tokens.find((token) => token.type === "heading" && token.depth === 2)?.sourceLine, 7);
});

test("sourcePositionForWord locates a word inside Markdown emphasis", () => {
  const tokens = marked.lexer("Paragraph with **target** word.\n");
  annotateTokenSourceLines(tokens);
  const paragraph = tokens[0];
  const renderedText = "Paragraph with target word.";

  assert.deepEqual(sourcePositionForWord(paragraph, renderedText, renderedText.indexOf("target"), "target"), {
    line: 0,
    character: 17,
  });
});

test("sourcePositionForWord ignores matching text in a link destination", () => {
  const tokens = marked.lexer("See [link](https://target.example). Then target.\n");
  annotateTokenSourceLines(tokens);
  const paragraph = tokens[0];
  const renderedText = "See link. Then target.";

  assert.deepEqual(sourcePositionForWord(paragraph, renderedText, renderedText.indexOf("target"), "target"), {
    line: 0,
    character: 41,
  });
});

test("sourcePositionForWord locates a Japanese word on a later paragraph line", () => {
  const tokens = marked.lexer("# 見出し\n\n一行目。\n二行目の単語です。\n");
  annotateTokenSourceLines(tokens);
  const paragraph = tokens.find((token) => token.type === "paragraph");
  const renderedText = "一行目。\n二行目の単語です。";

  assert.deepEqual(sourcePositionForWord(paragraph, renderedText, renderedText.indexOf("単語"), "単語"), {
    line: 3,
    character: 4,
  });
});
