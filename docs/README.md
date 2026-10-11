# Desktop Argo Tunnel Manager

## Overview

Desktop Argo Tunnel Manager is a professional graphical user interface (GUI) for managing Cloudflare Tunnels. It is designed to simplify the process of creating, configuring, and monitoring tunnels, eliminating the need for complex command-line interactions.

## Key Features

-   **Intuitive Dashboard**: Get a real-time overview of your server infrastructure, active connections, and tunnel status.
-   **Tunnel Management**: Start and stop `cloudflared access` tunnels from the Active Connections view.
-   **One-Click Connections**: Connect to SSH, RDP, and TCP services with a single click.
-   **Multi-Language Support**: Fully localized interface in English and Russian.
-   **Secure Credential Storage**: Safely store and manage access credentials for your services.
-   **Built-in Password Manager**: Create and edit KeePass (`.kdbx`) databases, with auto-lock after inactivity and when the window is minimized.
-   **Cross-Platform**: Optimized for macOS, Windows, and Linux.

## Getting Started

Please refer to the [User Guide](./USER_GUIDE.md) for detailed instructions on installation, configuration, and usage.

## Architecture

The application is built using a modern tech stack to ensure performance and security:

-   **Frontend**: React, TypeScript, TanStack Router, Tailwind CSS
-   **Backend**: Rust (Tauri 2.0)
-   **Core**: Cloudflared binary integration, KeePass (`.kdbx`) vaults via the `keepass` crate

## License

This project is licensed under the MIT License - see the [LICENSE](../LICENSE) file for details.
