# Desktop Argo Tunnel Manager - Architecture

## Overview

Desktop Argo Tunnel Manager is a Tauri-based desktop application that provides a graphical interface for managing `cloudflared access` TCP tunnels. The application focuses on client-side tunnel management, allowing users to connect to remote services via the secure Cloudflare network.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React)                        │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │  Dashboard   │  │   Servers    │  │   Active     │       │
│  │              │  │  Management  │  │ Connections  │       │
│  │              │  │              │  │              │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│                                                             │
│  ┌──────────────────────────────────────────────────┐       │
│  │           Zustand Store (State)                  │       │
│  │  - tunnels: ActiveTunnel[]                       │       │
│  │  - servers: Server[]                             │       │
│  │  - recentConnections: RecentConnection[]         │       │
│  └──────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────┘
                             | IPC (Tauri Commands)
┌─────────────────────────────────────────────────────────────┐
│                    Backend (Rust/Tauri)                     │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────┐       │
│  │         Cloudflared Commands Module              │       │
│  │  - start_tcp_tunnel(hostname, port)              │       │
│  │  - stop_tcp_tunnel(id)                           │       │
│  │  - check_cloudflared_version()                   │       │
│  └──────────────────────────────────────────────────┘       │
│                                                             │
│  ┌──────────────────────────────────────────────────┐       │
│  │    TunnelState (Process Manager)                 │       │
│  │  - processes: HashMap<String, u32>               │       │
│  │    (tunnel_id -> PID)                            │       │
│  └──────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────┘
                             | Process Launch
┌─────────────────────────────────────────────────────────────┐
│                 Cloudflared Binary                          │
│  cloudflared access tcp --hostname <host> --url <local>     │
└─────────────────────────────────────────────────────────────┘
```

## Core Components

### Frontend (React + TypeScript)

#### 1. **Dashboard**
- **Purpose**: System status overview and recent activity.
- **Features**:
  - Count of active tunnels
  - Recent connection history
  - Quick access to favorites
  - Statistics visualization

#### 2. **Server Management**
- **Purpose**: Management of remote servers and services.
- **Features**:
  - Hierarchical view (Company -> Server -> Service)
  - Service protocols: SSH, RDP, TCP
  - One-click connection
  - Favorites management
  - Connection status tracking

**Connection Process**:
```
User clicks "Connect" 
  -> Random port generation (10000-60000)
  -> startTcpTunnel(hostname, port) call
  -> Backend starts cloudflared process
  -> Tunnel saved in state
  -> Local port displayed to user
```

#### 3. **Active Connections**
- **Purpose**: Monitoring and management of running TCP tunnels.
- **Features**:
  - List of all active tunnels
  - Display: hostname, local port, PID, uptime
  - Stop tunnel
  - Copy local port to clipboard

#### 4. **Settings**
- **Purpose**: Application configuration.
- **Features**:
  - Language selection (EN/RU)
  - Theme selection (Dark/Light/System)
  - Cloudflared binary path
  - Auto-connection settings

#### 5. **KeePass**
Location: `src/components/KeePass/`

- `KeePassPanel.tsx`: the opener (file list, Browse, password, optional key file, create form) and the vault view (groups, search, entries, entry editor, change-password modal).
- `useKeePassAutoLock.ts`: app-wide hook that locks the vault after inactivity and when the window is hidden. It is mounted once in the main route, so it keeps running on other tabs.

### Backend (Rust + Tauri)

#### 1. **Cloudflared Command Module**
Location: `src-tauri/src/cloudflared/commands.rs`

**Functions**:
- `check_cloudflared_version()` - Check cloudflared installation
- `start_tcp_tunnel(hostname, port)` - Start TCP tunnel
- `stop_tcp_tunnel(id)` - Stop tunnel

**ActiveTunnel Structure**:
- `id` - Identifier (format: "{hostname}-{port}")
- `hostname` - Remote host
- `local_port` - Local listening port
- `pid` - Process ID

#### 2. **TunnelState (Process Manager)**
Location: `src-tauri/src/cloudflared/commands.rs`

**Purpose**: Tracking active cloudflared processes.

**Structure**: HashMap where key is tunnel_id, value is process PID.

**Lifecycle**:
1. `start_tcp_tunnel`: Start process -> Save PID
2. `stop_tcp_tunnel`: Find PID -> Terminate process -> Remove from map

#### 3. **KeePass Vault Module**
Location: `src-tauri/src/keepass/`

- `vault.rs`: the `Vault` type. It wraps the `keepass` crate (0.15, `save_kdbx4`) and owns the decrypted database and its key while the vault is open. It has all read and write operations, including the rules for file names, the minimum password length, and the Argon2 profile.
- `commands.rs`: Tauri commands (`keepass_*`). It resolves `~/KeePassContainers`, reads key files, and turns Rust errors into strings for the frontend.
- `models.rs`: DTOs exported to TypeScript through `ts-rs` (`VaultInfo`, `VaultGroup`, `VaultEntrySummary`, `VaultEntry`, `EntryInput`).
- `mod.rs`: `KeePassState`, a `Mutex<HashMap<vault id, Vault>>` of open vaults.

**Write path.** Every change calls `save()`, which encrypts the whole database into memory, writes `<name>.kdbx.tmp`, copies the current file to `<name>.kdbx.bak`, and renames the temp file over the target.

**Key handling.** Passwords are never returned in listings. `keepass_get_entry` is the only command that returns one. Closing a vault drops its `Vault` and therefore its `DatabaseKey`, which is zeroized on drop.

### State Management (Zustand)

Location: `src/store.ts`

**State Structure**:
- `tunnels` - Active TCP tunnels
- `services_by_server_by_company` - Server hierarchy
- `activeTab` - Current UI tab
- `selectedServerId` / `selectedServiceId` - Selected items
- `recentConnections` - Recent connections
- `favorites` - Favorites
- `settings` - User settings

**Actions**:
- Tunnel management: `startTcpTunnel`, `stopTcpTunnel`
- Server management: `handleConnectService`, `handleDisconnectService`
- UI state: `setActiveTab`, `toggleFavorite`

### KeePass Session Store

Location: `src/store/keepassSession.ts`

Separate from the main store, so the open vault survives tab switches.

- `vault`: the open `VaultInfo`, or `null` when locked
- `autoLockMinutes`: 1, 5 (default), 15, 30, or 0 for never. Saved in `localStorage`.
- `lastActivity`: timestamp of the last input, throttled to one update per second
- `lock()`: hides the vault in the UI first, then calls `keepass_close` so the backend drops the key

## Data Flow

### Establishing Connection

```
1. User Interface
   └─> ServerManagement.tsx
       └─> handleToggleConnection()
           └─> Generate random port
           
2. Store Action
   └─> startTcpTunnel(hostname, localPort)
       └─> invoke('start_tcp_tunnel', { hostname, localPort })
       
3. Rust Backend
   └─> start_tcp_tunnel()
       └─> Start cloudflared via Command::spawn()
       └─> Save PID to TunnelState
       └─> Return ActiveTunnel
       
4. Frontend Update
   └─> Add tunnel to state.tunnels[]
   └─> Update UI (show local port)
```

### Terminating Connection

```
1. User Interface
   └─> ActiveConnections.tsx or ServerManagement.tsx
       └─> handleStopTunnel(id)
       
2. Store Action
   └─> stopTcpTunnel(id)
       └─> invoke('stop_tcp_tunnel', { id })
       
3. Rust Backend
   └─> stop_tcp_tunnel()
       └─> Find PID in TunnelState
       └─> Terminate process (platform dependent)
           - Unix: kill <pid>
           - Windows: taskkill /F /PID <pid>
       └─> Remove from TunnelState
       
4. Frontend Update
   └─> Remove tunnel from state.tunnels[]
   └─> Update UI
```

## KeePass Vault Lifecycle

```
Open / Create
  -> keepass_open / keepass_create (Rust reads or writes the file, KDF runs)
  -> Vault registered in KeePassState, id returned as VaultInfo
  -> setVault() in keepassSession store, lastActivity = now

Working
  -> keepass_list_* / keepass_get_entry (read)
  -> keepass_save_entry / delete / group / change_password (read-modify-write, then save())
  -> any input calls touch()

Locked (Lock button, inactivity timeout, window hidden)
  -> keepassSession.lock(): vault = null in the UI
  -> keepass_close: Vault dropped in Rust, key zeroized
  -> clipboard cleared if it still holds a copied secret
```

## File Structure

```
desktop-argo-tunnel/
├── src/                           # Frontend
│   ├── components/
│   │   ├── Dashboard/
│   │   │   └── Dashboard.tsx      # Main dashboard
│   │   ├── Servers/
│   │   │   └── ServerManagement.tsx  # Server management
│   │   ├── Tunnels/
│   │   │   └── ActiveConnections.tsx # Active tunnels list
│   │   ├── KeePass/
│   │   │   ├── KeePassPanel.tsx   # Vault opener and vault view
│   │   │   └── useKeePassAutoLock.ts # Inactivity and hidden-window lock
│   │   ├── Settings/
│   │   │   └── Settings.tsx       # Application settings
│   │   ├── Navigation/
│   │   │   ├── Sidebar.tsx        # Main navigation
│   │   │   └── NavItem.tsx
│   │   └── CommandPalette/
│   │       └── CommandPalette.tsx # Cmd+K search
│   ├── generated/ts-rs/           # Types generated from Rust (do not edit)
│   ├── routes/
│   │   ├── __root.tsx             # Root layout
│   │   └── index.tsx              # Main route
│   ├── i18n/
│   │   └── locales/
│   │       ├── en.json            # English translations
│   │       └── ru.json            # Russian translations
│   ├── store/
│   │   └── keepassSession.ts      # Open vault and auto-lock settings
│   ├── store.ts                   # Zustand state management
│   └── main.tsx                   # Entry point
│
├── src-tauri/                     # Backend
│   ├── src/
│   │   ├── cloudflared/
│   │   │   ├── mod.rs             # Module definition
│   │   │   └── commands.rs        # Tauri commands
│   │   ├── keepass/
│   │   │   ├── mod.rs             # KeePassState and setup
│   │   │   ├── vault.rs           # Vault: file format and operations, with tests
│   │   │   ├── commands.rs        # keepass_* Tauri commands
│   │   │   └── models.rs          # DTOs exported to TypeScript
│   │   ├── lib.rs                 # Main library
│   │   └── main.rs                # Entry point
│   ├── Cargo.toml                 # Rust dependencies
│   └── tauri.conf.json            # Tauri configuration
│
└── docs/
    ├── ARCHITECTURE.md            # This file
    ├── USER_GUIDE.md              # User guide
    └── screenshots/               # UI Screenshots
```

## Key Technologies

### Frontend
- **React 18** - UI Framework
- **TypeScript** - Type Safety
- **Zustand** - State Management
- **TanStack Router** - Routing
- **i18next** - Internationalization
- **Tailwind CSS** - Styling
- **Lucide React** - Icons

### Backend
- **Rust** - Systems Programming Language
- **Tauri 2.0** - Desktop Framework
- **Serde** - Serialization
- **Tokio** - Async runtime (implicitly via Tauri)

### External Dependencies
- **cloudflared** - Cloudflare tunnel binary
- **keepass 0.15** - KDBX 4 reading and writing (Argon2 key derivation, AES-256 outer cipher)
- **tauri-plugin-dialog** - Native file picker for `.kdbx` and key files
- **OS Process Management** - Native process management

## Security

1. **Process Isolation**: Each tunnel runs as a separate `cloudflared` process
2. **Local Storage**: All data stored locally, no cloud synchronization
3. **Credential Storage**: Uses native secure OS storage (keychain)
4. **IPC Security**: Protected Tauri IPC layer between frontend and backend
5. **No Elevated Privileges**: Application runs with user privileges
6. **KeePass Key Lifetime**: An open vault keeps its key in memory. It is dropped on lock, on inactivity timeout (1–30 minutes, or never), or when the window is hidden
7. **KeePass Clipboard**: Copied passwords are cleared after 30 seconds, or when the vault locks, if the clipboard still holds the copied value
8. **KeePass Passwords in Transit**: Entry listings never include passwords. Only `keepass_get_entry` returns one, for a single entry
9. **KeePass Key Derivation**: Argon2 with 64 MiB memory and 2 iterations, the KeePass default profile

## Limitations and Roadmap

### Current Limitations
1. **No Process Persistence**: Active tunnels are lost when application restarts
2. **Random Port Only**: Cannot specify custom local port
3. **No Log Streaming**: Cannot view cloudflared logs in real-time
4. **No Tunnel Configuration**: Cannot manage ingress rules
5. **KeePass Feature Gaps**: No attachments, entry history, TOTP, or import/export of other password managers
6. **Auto-lock Timing**: The inactivity timer runs in the webview. A heavily throttled background webview can lock late

### Planned Improvements
1. **Process Recovery**: Discovery and reconnection to existing cloudflared processes
2. **Custom Port Selection**: Ability to manually specify local port
3. **Log Viewing**: Streaming and display of cloudflared output
4. **Configuration Editor**: Management of tunnel configuration files
5. **Auto-Reconnection**: Tunnel restart on failure
6. **Tunnel Metrics**: Throughput, latency, connection count

## Performance Characteristics

- **Startup Time**: ~1-2 seconds (Tauri overhead)
- **Memory Usage**: ~50-100 MB (base application + active tunnels)
- **Process Overhead**: ~10-20 MB per active tunnel (cloudflared process)
- **Port Range**: 10000-60000 (50,000 possible ports)
- **Max Concurrent Tunnels**: Limited by available ports and system resources
