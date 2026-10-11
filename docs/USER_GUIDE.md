# User Guide

## Introduction

This guide covers the Desktop Argo Tunnel Manager. The application gives you a graphical interface for `cloudflared access` connections to SSH, RDP, and TCP services, plus a built-in KeePass password manager.

## Installation

1.  Download the latest release for your operating system.
2.  Install the application following the standard procedure for your platform.
3.  Launch the application.

## Dashboard Overview

The **Dashboard** is the start page. It shows:

-   **Statistics**: Counts of servers and active connections.
-   **Add Server**: Opens the form for a new server.
-   **Recent Connections** and **Favorites** (sidebar): quick access to the services you used most often or pinned.

## Connecting to Services

### Adding a Server

1.  Go to the **Servers** tab.
2.  Click **Add Server**.
3.  Enter a name and description for the server.
4.  Add services (SSH, RDP, or TCP) by specifying the host and port.

### Establishing a Connection

1.  Select a server from the list.
2.  Click **Connect** next to the service.
3.  The application starts a `cloudflared access tcp` tunnel on a free local port (10000–60000) and shows that port.
4.  For SSH and RDP, the default system client is launched with the correct parameters.

### Active Connections

The **Active Connections** tab lists every running tunnel with its hostname, local port, and process ID. You can copy the local port or stop a tunnel from here.

Tunnels are not restored after the application restarts.

## KeePass Passwords

The **KeePass** tab (shield icon in the sidebar) opens KeePass (`.kdbx`) databases.

### Where databases live

Databases created in the app are stored in `~/KeePassContainers`. You can open a `.kdbx` file from any folder with **Browse**.

### Creating a database

1.  Enter a file name. Letters, digits, spaces, `-`, `_`, and `.` are allowed.
2.  Enter a master password of at least 8 characters and confirm it.
3.  Optionally pick a key file. If you use one, you need it every time you open the database.
4.  Click **Create**. The database is written to disk and opened.

### Opening a database

1.  Select a database from the list, or click **Browse** to pick a `.kdbx` file.
2.  Enter the master password, and the key file if the database uses one.
3.  Click **Open**. If the file is already open, the existing session is shown.

A wrong password, a wrong key file, and a damaged file all give the same message, because they cannot be told apart.

### Working with entries

-   **Groups** (left column): click a group to show its entries and everything in its subgroups. Create groups with the field at the bottom. The root group cannot be deleted. Deleting a group also deletes everything inside it.
-   **Search**: filters the current group by title, username, or URL.
-   **Add entry** (+): fills in title, username, password, URL, notes, and the group.
-   **Show, copy, edit, delete**: use the icons in the entry view. Copied values are removed from the clipboard after 30 seconds, or as soon as you lock the database.

Every change is written to the file immediately. Deleting an entry is permanent: there is no recycle bin. The previous version of the file is kept next to it as `.kdbx.bak`.

Attachments, entry history, TOTP codes, and importing or exporting other password managers are not supported yet.

### Changing the master password

Click **Change password** in the database header. The database is re-encrypted with the new password. Keep the old one until you have checked that the new one opens the file.

### Locking

The database locks, and its key is removed from memory, when:

-   You click **Lock** in the header.
-   It has had no mouse or keyboard input for the chosen time. The choice is 1, 5 (default), 15, or 30 minutes, or **Never**. The setting is in the header of the database view.
-   You minimize the window, or the window is fully covered by another window.

The timer keeps running while you use other tabs, so a database opened on one tab still locks on schedule.

## Settings

Customize your experience in the **Settings** tab:

-   **Language**: Switch between English and Russian.
-   **Theme**: Choose Dark or Light.
-   **Cloudflared**: See the installed `cloudflared` version, install it, or update it.

## Troubleshooting

1.  If a connection fails, check that your Cloudflare access is valid and that the internet connection is stable.
2.  If a KeePass database will not open, check that the password and key file are the ones used to create it. If the file itself is damaged, restore `<name>.kdbx.bak` from the same folder.
