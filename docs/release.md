# Release

This project is published as a VS Code Marketplace extension by uploading a packaged `.vsix` from the Marketplace publisher management page.

## Prerequisites

- Use the repository dev environment or make sure Node.js and pnpm are available.
- Run commands from the repository root.
- Keep the working tree clean before starting a release.

```sh
git status --short
```

## Prepare The Release

1. Choose the next version number.
2. Update `package.json` `version`.
3. Add a matching entry to `CHANGELOG.md`.
4. Run the verification commands.

```sh
pnpm run compile
pnpm run package
```

`pnpm run package` runs the prepublish compile step and creates:

```text
markscope-vscode-<version>.vsix
```

The generated `.vsix` is a local release artifact and is not committed.

## Publish

1. Open the Visual Studio Marketplace publisher management page in a browser.
2. Select the `m2tkl` publisher.
3. Upload the generated `.vsix`.
4. Wait until Marketplace verification finishes.
5. Confirm the new version is visible in the extension page or publisher dashboard.

## Commit

After packaging succeeds, commit only the release metadata changes.

```sh
git add package.json CHANGELOG.md
git commit -m "Release <version>"
```

## Notes

- Do not commit access tokens or publisher credentials.
- Azure CLI is not required for the current browser-upload flow.
- If `pnpm run package` succeeds with npm config warnings, the package is still valid as long as `vsce` reports `DONE Packaged`.
