# Release

This project is published as a VS Code Marketplace extension by uploading a packaged `.vsix` from the Marketplace publisher management page.

## Prerequisites

- Use the repository Nix development shell. It provides the expected Node.js and pnpm versions.
- Run commands from the repository root.
- Keep the working tree clean before starting a release.

```sh
nix develop
git status --short
```

## Prepare The Release

1. Choose the next version number.
2. Update `package.json` `version`.
3. Add a matching entry to `CHANGELOG.md`.
4. Install dependencies in the Nix shell.
5. Run the verification commands in the same Nix shell.

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm run compile
pnpm run package
```

`pnpm run package` runs the prepublish compile step and creates:

```text
dist/markscope-vscode-<version>.vsix
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
git add package.json CHANGELOG.md docs/release.md
git commit -m "Release <version>"
```

## Notes

- Do not commit access tokens or publisher credentials.
- Azure CLI is not required for the current browser-upload flow.
- Prefer `nix develop` for release packaging so `pnpm run package` uses the repository's pinned pnpm 10 toolchain.
- If `pnpm run package` succeeds with npm config warnings, the package is still valid as long as `vsce` reports `DONE Packaged`.
