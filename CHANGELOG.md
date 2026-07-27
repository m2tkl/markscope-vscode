# Changelog

## 0.0.9

- Added support for rendering Mermaid diagrams from fenced `mermaid` code blocks.
- Added support for rendering PlantUML diagrams from fenced `plantuml` and `puml` code blocks.

## 0.0.8

- Improved Markdown table styling in the selected section body.
- Kept preview keyboard focus after command palette interactions.
- Added preview text size controls.
- Replaced heading level filter buttons with a compact selector.

## 0.0.7

- Focus the preview automatically after opening so keyboard navigation works immediately.

## 0.0.6

- Added support for rendering local Markdown images in the selected section body.

## 0.0.5

- Open Markscope Preview in the current editor group instead of a side split.
- Added an in-preview Edit action that returns to the focused Markdown section.
- Removed the editor title button for opening Markscope Preview.
- Fixed fenced code block styling in the selected section body.

## 0.0.4

- Aligned selected section heading styles with the Markscope reading pane.

## 0.0.3

- Stabilized preview selection updates to avoid unnecessary outline scrolling during keyboard navigation.
- Preserved reading list and section body scroll positions across structural preview updates.

## 0.0.2

- Fixed the section body pane to show only the selected section body.
- Added a Nix development shell with Node.js 22 and pnpm 10.
- Documented browser-based Marketplace upload flow.

## 0.0.1

- Initial Markscope preview extension.
- Added outline and first-paragraph reading modes.
- Added heading-depth filters.
- Added automatic, side-by-side, and stacked pane layouts.
- Added keyboard navigation and editor cursor synchronization.
