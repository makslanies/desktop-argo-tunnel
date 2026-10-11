# Release Process

This document describes how to create a new release for Desktop Argo Tunnel.

## Automatic Release via GitHub Actions

The project uses GitHub Actions to automatically build and release the application for multiple platforms.

### Supported Platforms

- **macOS**: 
  - Apple Silicon (aarch64-apple-darwin)
  - Intel (x86_64-apple-darwin)
- **Linux**: Ubuntu 22.04 (x86_64)
- **Windows**: Latest (x86_64)

### Creating a Release

1. **Update the version** in `src-tauri/tauri.conf.json`:
   ```json
   {
     "version": "0.4.0"
   }
   ```

2. **Commit the version change**:
   ```bash
   git add src-tauri/tauri.conf.json
   git commit -m "chore: bump version to 0.4.0"
   git push
   ```

3. **Create and push a tag**:
   ```bash
   git tag v0.4.0
   git push origin v0.4.0
   ```

4. **GitHub Actions will automatically**:
   - Build the app for all platforms
   - Create installers (.dmg for macOS, .deb/.AppImage for Linux, .msi for Windows)
   - Create a draft release on GitHub
   - Upload all build artifacts to the release

5. **Review and publish the release**:
   - Go to https://github.com/makslanies/desktop-argo-tunnel/releases
   - Find the draft release
   - Edit the release notes if needed
   - Click "Publish release"

### Manual Trigger

You can also manually trigger a release build:

1. Go to https://github.com/makslanies/desktop-argo-tunnel/actions
2. Select "Release" workflow
3. Click "Run workflow"
4. Select the branch and click "Run workflow"

## Build Artifacts

After a successful build, the following artifacts will be available:

- **macOS**:
  - `Desktop-argo-tunnel_<version>_aarch64.dmg` (Apple Silicon)
  - `Desktop-argo-tunnel_<version>_x64.dmg` (Intel)
  
- **Linux**:
  - `desktop-argo-tunnel_<version>_amd64.deb`
  - `desktop-argo-tunnel_<version>_amd64.AppImage`
  
- **Windows**:
  - `Desktop-argo-tunnel_<version>_x64_en-US.msi`
  - `Desktop-argo-tunnel_<version>_x64-setup.exe`

## Troubleshooting

### Build Fails on a Specific Platform

- Check the GitHub Actions logs for the specific platform
- Common issues:
  - Missing dependencies (Linux)
  - Code signing issues (macOS/Windows)
  - Rust compilation errors

### Release Not Created

- Ensure the tag starts with `v` (e.g., `v0.4.0`)
- Check that `GITHUB_TOKEN` has proper permissions
- Verify the workflow file syntax

## Version Numbering

We follow [Semantic Versioning](https://semver.org/):

- **MAJOR** version for incompatible API changes
- **MINOR** version for new functionality in a backward compatible manner
- **PATCH** version for backward compatible bug fixes

Example: `v0.4.0` → `v0.4.1` (patch) or `v0.5.0` (minor) or `v1.0.0` (major)
