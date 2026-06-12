# Release Process

SpaceGuard public Windows releases are published from version tags.

## Public Download Links

- Latest release page: https://github.com/codeprakhar25/windows-clean/releases/latest
- Latest installer: https://github.com/codeprakhar25/windows-clean/releases/latest/download/SpaceGuardSetup.exe
- Latest checksums: https://github.com/codeprakhar25/windows-clean/releases/latest/download/SHA256SUMS.txt

The direct installer link works after the first tagged release workflow finishes successfully.

## Release A Version

1. Update the version in:
   - `package.json`
   - `package-lock.json`
   - `src-tauri/Cargo.toml`
   - `src-tauri/tauri.conf.json`

2. Verify locally on Windows:

```powershell
npm test
npm run native:build
```

3. Merge the release PR into `main`.

4. Tag the exact merged commit:

```powershell
git switch main
git pull origin main
git tag v0.1.0
git push origin v0.1.0
```

5. Wait for the `Release Windows` GitHub Actions workflow.

The workflow builds Windows installers, renames the normal installer to `SpaceGuardSetup.exe`, creates `SHA256SUMS.txt`, and publishes the files to GitHub Releases.

## Public Release Notes

For the initial release, publish as a beta unless the installer is code signed.

Suggested notes:

```text
SpaceGuard v0.1.0 beta

Initial Windows desktop release.

- Scan C: drive space usage.
- Review cleanable areas.
- Delete selected built-in cleanup targets after confirmation.
- Explore C: usage with a visual breakdown.

Known release note:
- If unsigned, Windows SmartScreen may show an unknown publisher warning.
```

## Signing

Before broad public distribution, sign the Windows installer with a code signing certificate. Unsigned builds are installable, but Windows SmartScreen can warn users and reduce trust.
