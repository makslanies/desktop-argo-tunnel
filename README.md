# Desktop Argo Tunnel Manager

> A modern, professional GUI for managing Cloudflare Tunnels and remote server connections

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Latest version](https://img.shields.io/github/v/tag/makslanies/desktop-argo-tunnel?sort=semver&label=version)](https://github.com/makslanies/desktop-argo-tunnel/tags)
[![Release workflow](https://github.com/makslanies/desktop-argo-tunnel/actions/workflows/release.yml/badge.svg?event=push)](https://github.com/makslanies/desktop-argo-tunnel/actions/workflows/release.yml)
[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey)]()
[![Built with Tauri 2](https://img.shields.io/badge/built%20with-Tauri%202-24C8DB?logo=tauri&logoColor=white)](https://tauri.app)
[![Rust](https://img.shields.io/badge/Rust-stable-DEA584?logo=rust&logoColor=black)](https://www.rust-lang.org)

<a href="https://www.producthunt.com/products/desktop-cloudflare-tunnel-ui?embed=true&utm_source=badge-featured&utm_medium=badge&utm_source=badge-desktop&#0045;cloudflare&#0045;tunnel&#0045;ui" target="_blank"><img src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1046645&theme=dark&t=1764960674909" alt="Desktop&#0032;Cloudflare&#0032;Tunnel&#0032;UI - One&#0045;click&#0032;GUI&#0032;for&#0032;Cloudflare&#0032;RDP&#0044;&#0032;SSH&#0032;&#0038;&#0032;TCP&#0032;tunnels | Product Hunt" style="width: 250px; height: 54px;" width="250" height="54" /></a>

## Overview

**Desktop Argo Tunnel Manager** is a desktop application that provides a graphical interface for managing `cloudflared access` connections. Connect to remote services (SSH, RDP, TCP) through Cloudflare's secure network with automatic local port forwarding.

### Why Use This Application?

- **No Command Line Required**: All `cloudflared access` functionality through a beautiful GUI
- **Automatic Cloudflared Installation**: App can automatically download and install cloudflared if not present
- **Automatic Port Management**: Random local port assignment for each connection
- **One-Click Connections**: Connect to SSH, RDP, and TCP services instantly
- **Centralized Management**: Manage all your servers and active tunnels from a single dashboard
- **Secure Credential Storage**: Built-in KeePass integration for password management
- **Multi-Language**: Full support for English and Russian

## Features

### Core Capabilities

- **Active Connection Management**
  - View all running TCP tunnels in real-time
  - Monitor local ports and process IDs
  - Stop tunnels with one click
  - Automatic port assignment (10000-60000 range)
  
- **Server & Service Management**
  - Organize servers by groups/companies
  - Support for SSH, RDP, and TCP protocols
  - Secure credential storage
  - One-click connection via `cloudflared access tcp`
  - Automatic tunnel creation on connect

- **KeePass Password Management**
  - Create, open, and edit KeePass (.kdbx, KDBX 4) databases, with optional key files
  - Every change is saved to the file straight away; the previous version is kept as `.kdbx.bak`
  - Group tree, search, and an entry editor for titles, usernames, passwords, URLs, and notes
  - Copied passwords are cleared from the clipboard after 30 seconds
  - Auto-lock after 1, 5, 15, or 30 minutes of inactivity (or never), and lock when the window is minimized
  - Change the master password from inside an open database

- **Dashboard & Analytics**
  - Real-time connection statistics
  - Recent activity tracking
  - Connection health monitoring
  - Quick access to favorites

### Modern UI/UX

- **Premium Design**: Glassmorphism effects, gradients, and smooth animations
- **Dark Theme**: Optimized for long working sessions
- **Responsive Layout**: Adapts to different window sizes
- **Keyboard Shortcuts**: Power-user friendly with command palette (Cmd/Ctrl+K)

### Internationalization

- English (default)
- Russian
- Easy to add more languages

## Screenshots

### Dashboard
![Dashboard](docs/screenshots/dashboard.png)

## Installation

### Prerequisites

- **Cloudflared** (Optional): The application can automatically download and install `cloudflared` if not present
  
  If you prefer manual installation:
  ```bash
  # macOS
  brew install cloudflared
  
  # Windows
  winget install Cloudflare.cloudflared
  
  # Linux
  wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
  sudo dpkg -i cloudflared-linux-amd64.deb
  ```

### Download & Install

1. Download the latest release for your platform from [Releases](https://github.com/makslanies/desktop-argo-tunnel/releases)
2. Install the application:
   - **macOS**: Open the `.dmg` file and drag to Applications
   - **Windows**: Run the `.exe` installer
   - **Linux**: Install the `.deb` or `.AppImage` package

## Quick Start

1. **Launch the Application**
   - The dashboard will show your current infrastructure status

2. **Add Your First Server**
   - Click "Add Server" in the sidebar
   - Enter server details (name, host, port, protocol)
   - Save credentials if needed

3. **Connect to a Service**
   - Navigate to the "Servers" tab
   - Select a server from the list
   - Choose a service (SSH, RDP, or TCP)
   - Click "Connect"
   - The application will:
     - Automatically assign a random local port (10000-60000)
     - Start a `cloudflared access tcp` tunnel
     - Display the local port in the service details

4. **View Active Connections**
   - Navigate to "Active Connections" tab
   - See all running tunnels with their local ports and PIDs
   - Stop tunnels when no longer needed

## Architecture

### Technology Stack

**Frontend**
- React 18 with TypeScript
- TanStack Router for routing
- Tailwind CSS for styling
- Framer Motion for animations
- i18next for internationalization

**Backend**
- Rust with Tauri 2.0
- Native OS integration
- Secure IPC communication
- Process management for `cloudflared`
- KeePass (.kdbx) database integration

**Core Integration**
- `cloudflared` binary for tunnel operations
- Automatic cloudflared download and installation
- Native SSH/RDP client integration
- Secure credential storage using OS keychain
- KeePass password database support

### Project Structure

```
desktop-argo-tunnel/
├── src/                    # Frontend source
│   ├── components/         # React components (incl. KeePass/)
│   ├── routes/             # Route definitions
│   ├── i18n/               # Translations
│   └── store.ts            # State management
├── src-tauri/              # Rust backend
│   ├── src/
│   │   ├── main.rs         # Entry point
│   │   ├── cloudflared/    # Cloudflared integration
│   │   └── keepass/        # KeePass vault commands and file handling
│   └── Cargo.toml
├── docs/                  # Documentation
└── public/                # Static assets
```

## Development

### Prerequisites

- Node.js 18+ and npm
- Rust 1.70+
- Tauri CLI

### Setup

```bash
# Clone the repository
git clone <repository-url>
cd desktop-argo-tunnel

# Install dependencies
npm install

# Run in development mode
npm run tauri dev

# Build for production
npm run tauri build
```

### Available Scripts

- `npm run dev` - Start Vite dev server
- `npm run build` - Type-check and build frontend
- `npm test` - Run the frontend test suite (Vitest)
- `npm run tauri dev` - Run Tauri in development mode
- `npm run tauri build` - Build production application
- `cargo test` (in `src-tauri/`) - Run the Rust tests, including the KeePass vault tests

## Configuration

The application stores configuration in:
- **macOS**: `~/Library/Application Support/com.desktop-argo-tunnel`
- **Windows**: `%APPDATA%\desktop-argo-tunnel`
- **Linux**: `~/.config/desktop-argo-tunnel`

### Settings

Access settings via the Settings tab to configure:
- Language preference
- Cloudflared binary path
- Default tunnel configurations
- Connection timeouts
- Log levels

## Cloudflared Integration

This application provides a GUI for the following `cloudflared` commands:

| CLI Command | GUI Equivalent |
|-------------|----------------|
| `cloudflared access ssh` | Connect to SSH Service |
| `cloudflared access rdp` | Connect to RDP Service |
| `cloudflared access tcp` | Connect to TCP Service |

## Troubleshooting

### Application won't start
- Ensure `cloudflared` is installed and in PATH
- Check application logs in the config directory

### Tunnel creation fails
- Verify Cloudflare account credentials
- Check internet connectivity
- Review tunnel logs in the Logs tab

### Connection issues
- Verify server host and port are correct
- Check firewall settings
- Ensure `cloudflared` has necessary permissions

For more help, see [docs/USER_GUIDE.md](docs/USER_GUIDE.md)

## Planned Features
- **Native RDP Integration**: Automatically launch `mstsc` (Remote Desktop Connection) with the target host pre-configured upon connection.
- **Native SSH Integration**: Automatically launch `putty` with the target host pre-configured for SSH connections.
- **Credential Management**: Securely save and auto-fill login credentials (username, password, domain) for both `mstsc` and `putty` sessions.

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built with [Tauri](https://tauri.app/)
- Powered by [Cloudflare Tunnels](https://www.cloudflare.com/products/tunnel/)
- UI inspired by modern design systems

---

**Made for simplified tunnel management**
