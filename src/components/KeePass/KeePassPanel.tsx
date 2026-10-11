import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { open as openFileDialog } from "@tauri-apps/plugin-dialog";
import { readText, writeText } from "@tauri-apps/plugin-clipboard-manager";
import { Copy, Eye, EyeOff, FolderOpen, FolderPlus, KeyRound, Lock, Pencil, Plus, Search, Trash2 } from "lucide-react";
import Button from "../Button/Button";
import ConfirmationModal from "../ConfirmationModal";
import Modal from "../Modal/Modal";
import { useToast } from "../../hooks/useToast";
import { AUTO_LOCK_OPTIONS, useKeePassSession } from "../../store/keepassSession";
import type { EntryInput } from "../../generated/ts-rs/EntryInput";
import type { VaultEntry } from "../../generated/ts-rs/VaultEntry";
import type { VaultEntrySummary } from "../../generated/ts-rs/VaultEntrySummary";
import type { VaultGroup } from "../../generated/ts-rs/VaultGroup";
import type { VaultInfo } from "../../generated/ts-rs/VaultInfo";

const inputClass =
  "w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50";

const errorMessage = (e: unknown) => (typeof e === "string" ? e : String(e));

const KDBX_FILTERS = [{ name: "KeePass", extensions: ["kdbx"] }];

/** Shows the system file picker. Returns the chosen path, or null if the user cancelled. */
async function pickFile(filters?: { name: string; extensions: string[] }[]): Promise<string | null> {
  const selected = await openFileDialog({ multiple: false, directory: false, filters });
  return typeof selected === "string" ? selected : null;
}

/** How long a copied secret stays on the clipboard. */
const CLIPBOARD_CLEAR_MS = 30_000;

export default function KeePassPanel() {
  // The session lives in a store, not in this component, so the vault stays open
  // (and keeps auto-locking) when the user switches to another tab.
  const vault = useKeePassSession((s) => s.vault);
  const setVault = useKeePassSession((s) => s.setVault);
  const lock = useKeePassSession((s) => s.lock);

  return vault ? (
    <VaultView vault={vault} onLock={lock} />
  ) : (
    <VaultOpener onOpened={setVault} />
  );
}

function VaultOpener({ onOpened }: { onOpened: (vault: VaultInfo) => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [files, setFiles] = useState<string[]>([]);
  const [selectedPath, setSelectedPath] = useState("");
  const [password, setPassword] = useState("");
  const [openKeyfile, setOpenKeyfile] = useState("");
  const [newName, setNewName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [newKeyfile, setNewKeyfile] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    invoke<string[]>("keepass_list_files")
      .then(setFiles)
      .catch((e) => toast.error(errorMessage(e)));
    // Load the file list once when the panel opens.
  }, []);

  const browse = async (setter: (path: string) => void, filters?: { name: string; extensions: string[] }[]) => {
    try {
      const path = await pickFile(filters);
      if (path) setter(path);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const open = async () => {
    if (!selectedPath) return;
    setBusy(true);
    try {
      const info = await invoke<VaultInfo>("keepass_open", {
        path: selectedPath,
        password,
        keyfilePath: openKeyfile || null,
      });
      setPassword("");
      onOpened(info);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const create = async () => {
    if (newPassword !== confirmPassword) {
      toast.error(t("keepass.passwordMismatch"));
      return;
    }
    setBusy(true);
    try {
      const info = await invoke<VaultInfo>("keepass_create", {
        name: newName,
        password: newPassword,
        keyfilePath: newKeyfile || null,
      });
      setNewPassword("");
      setConfirmPassword("");
      onOpened(info);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto p-8 grid grid-cols-1 lg:grid-cols-2 gap-6 content-start">
      <section className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-4">
        <h2 className="text-lg font-semibold text-white">{t("keepass.openTitle")}</h2>
        {files.length === 0 ? (
          <p className="text-sm text-gray-500">{t("keepass.noFiles")}</p>
        ) : (
          <ul className="space-y-1 max-h-48 overflow-y-auto">
            {files.map((path) => (
              <li key={path}>
                <button
                  type="button"
                  onClick={() => setSelectedPath(path)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm truncate ${
                    selectedPath === path
                      ? "bg-emerald-500/15 text-emerald-300"
                      : "text-gray-300 hover:bg-white/5"
                  }`}
                >
                  {path.split(/[\\/]/).pop()}
                </button>
              </li>
            ))}
          </ul>
        )}
        <Button
          variant="secondary"
          onClick={() => browse(setSelectedPath, KDBX_FILTERS)}
          icon={<FolderOpen size={16} />}
        >
          {t("keepass.browse")}
        </Button>
        {selectedPath && <p className="text-xs text-gray-500 truncate">{selectedPath}</p>}
        <input
          type="password"
          className={inputClass}
          placeholder={t("keepass.masterPassword")}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && open()}
        />
        <FileField
          placeholder={t("keepass.keyfileOptional")}
          value={openKeyfile}
          onChange={setOpenKeyfile}
          onBrowse={() => browse(setOpenKeyfile)}
          browseLabel={t("keepass.browse")}
        />
        <Button onClick={open} loading={busy} disabled={!selectedPath} icon={<KeyRound size={16} />}>
          {t("keepass.open")}
        </Button>
      </section>

      <section className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-4">
        <h2 className="text-lg font-semibold text-white">{t("keepass.createTitle")}</h2>
        <input
          className={inputClass}
          placeholder={t("keepass.fileName")}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <input
          type="password"
          className={inputClass}
          placeholder={t("keepass.masterPassword")}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
        <input
          type="password"
          className={inputClass}
          placeholder={t("keepass.confirmPassword")}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
        <FileField
          placeholder={t("keepass.keyfileOptional")}
          value={newKeyfile}
          onChange={setNewKeyfile}
          onBrowse={() => browse(setNewKeyfile)}
          browseLabel={t("keepass.browse")}
        />
        <p className="text-xs text-gray-500">{t("keepass.createHint")}</p>
        <Button
          onClick={create}
          loading={busy}
          disabled={!newName || !newPassword}
          icon={<Plus size={16} />}
        >
          {t("keepass.create")}
        </Button>
      </section>
    </div>
  );
}

interface EntryDraft {
  id: string | null;
  groupId: string;
  title: string;
  username: string;
  password: string;
  url: string;
  notes: string;
}

const emptyDraft = (groupId: string): EntryDraft => ({
  id: null,
  groupId,
  title: "",
  username: "",
  password: "",
  url: "",
  notes: "",
});

function VaultView({ vault, onLock }: { vault: VaultInfo; onLock: () => Promise<void> }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [groups, setGroups] = useState<VaultGroup[]>([]);
  const [entries, setEntries] = useState<VaultEntrySummary[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [detail, setDetail] = useState<VaultEntry | null>(null);
  const [draft, setDraft] = useState<EntryDraft | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [pendingDelete, setPendingDelete] = useState<
    { kind: "entry"; id: string; title: string } | { kind: "group"; id: string; name: string } | null
  >(null);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const autoLockMinutes = useKeePassSession((s) => s.autoLockMinutes);
  const setAutoLockMinutes = useKeePassSession((s) => s.setAutoLockMinutes);
  const pendingCopy = useRef<{ value: string; timer: number } | null>(null);

  const rootGroup = groups.find((g) => g.parentId === null) ?? null;
  const selectedGroup = groups.find((g) => g.id === selectedGroupId) ?? null;

  const loadAll = async () => {
    try {
      const [nextGroups, nextEntries] = await Promise.all([
        invoke<VaultGroup[]>("keepass_list_groups", { vaultId: vault.id }),
        invoke<VaultEntrySummary[]>("keepass_list_entries", { vaultId: vault.id }),
      ]);
      setGroups(nextGroups);
      setEntries(nextEntries);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const selectEntry = async (id: string) => {
    setSelectedEntryId(id);
    setShowPassword(false);
    setDraft(null);
    try {
      setDetail(await invoke<VaultEntry>("keepass_get_entry", { vaultId: vault.id, entryId: id }));
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  useEffect(() => {
    loadAll();
    // Reload only when a different vault is opened.
  }, [vault.id]);

  // Entries of the selected group include those in its subgroups.
  const visibleGroupIds = useMemo(() => {
    if (!selectedGroupId) return null;
    const ids = new Set<string>([selectedGroupId]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const g of groups) {
        if (g.parentId && ids.has(g.parentId) && !ids.has(g.id)) {
          ids.add(g.id);
          grew = true;
        }
      }
    }
    return ids;
  }, [groups, selectedGroupId]);

  const visibleEntries = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter(
      (e) =>
        (!visibleGroupIds || visibleGroupIds.has(e.groupId)) &&
        (!q || e.title.toLowerCase().includes(q) || e.username.toLowerCase().includes(q) || e.url.toLowerCase().includes(q)),
    );
  }, [entries, visibleGroupIds, query]);

  // Groups in tree order with their depth, for indentation.
  const groupRows = useMemo(() => {
    const rows: { group: VaultGroup; depth: number }[] = [];
    const walk = (parentId: string | null, depth: number) => {
      for (const g of groups.filter((x) => x.parentId === parentId)) {
        rows.push({ group: g, depth });
        walk(g.id, depth + 1);
      }
    };
    walk(null, 0);
    return rows;
  }, [groups]);

  const copy = async (value: string, label: string) => {
    await writeText(value);
    if (pendingCopy.current) window.clearTimeout(pendingCopy.current.timer);
    const timer = window.setTimeout(() => {
      pendingCopy.current = null;
      void clearClipboardIfUnchanged(value);
    }, CLIPBOARD_CLEAR_MS);
    pendingCopy.current = { value, timer };
    toast.success(t("keepass.copied", { label }));
  };

  // Leaving the vault wipes a copied secret that is still on the clipboard.
  useEffect(
    () => () => {
      const pending = pendingCopy.current;
      if (pending) {
        window.clearTimeout(pending.timer);
        void clearClipboardIfUnchanged(pending.value);
      }
    },
    [],
  );

  const startNew = () => {
    setSelectedEntryId(null);
    setDetail(null);
    setDraft(emptyDraft(selectedGroupId ?? rootGroup?.id ?? ""));
  };

  const startEdit = () => {
    if (!detail) return;
    setDraft({
      id: detail.id,
      groupId: detail.groupId,
      title: detail.title,
      username: detail.username,
      password: detail.password,
      url: detail.url,
      notes: detail.notes,
    });
  };

  const saveDraft = async () => {
    if (!draft) return;
    const input: EntryInput = { ...draft };
    try {
      const id = await invoke<string>("keepass_save_entry", { vaultId: vault.id, entry: input });
      setDraft(null);
      await loadAll();
      await selectEntry(id);
      toast.success(t("keepass.saved"));
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const target = pendingDelete;
    setPendingDelete(null);
    try {
      if (target.kind === "entry") {
        await invoke("keepass_delete_entry", { vaultId: vault.id, entryId: target.id });
        setSelectedEntryId(null);
        setDetail(null);
      } else {
        await invoke("keepass_delete_group", { vaultId: vault.id, groupId: target.id });
        setSelectedGroupId(null);
      }
      await loadAll();
      toast.success(t("keepass.deleted"));
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const createGroup = async () => {
    const name = newGroupName.trim();
    if (!name) return;
    try {
      await invoke<string>("keepass_create_group", {
        vaultId: vault.id,
        parentId: selectedGroupId,
        name,
      });
      setNewGroupName("");
      await loadAll();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const close = () => onLock();

  return (
    <div className="h-full flex flex-col p-6 gap-4 min-h-0">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">{vault.name}</h2>
          <p className="text-xs text-gray-500 truncate">
            {t("keepass.entryCount", { count: vault.entryCount })} · {vault.path}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setShowChangePassword(true)} icon={<KeyRound size={16} />}>
            {t("keepass.changePassword")}
          </Button>
          <label className="flex items-center gap-2 text-xs text-gray-400">
            {t("keepass.autoLock")}
            <select
              className="px-2 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:outline-none"
              value={autoLockMinutes}
              onChange={(e) => setAutoLockMinutes(Number(e.target.value))}
            >
              {AUTO_LOCK_OPTIONS.map((minutes) => (
                <option key={minutes} value={minutes} className="bg-[#0a0a0a]">
                  {minutes === 0 ? t("keepass.autoLockNever") : t("keepass.autoLockAfter", { count: minutes })}
                </option>
              ))}
            </select>
          </label>
          <Button variant="secondary" onClick={close} icon={<Lock size={16} />}>
            {t("keepass.lock")}
          </Button>
        </div>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-[180px_260px_1fr] gap-4">
        {/* Groups */}
        <section className="flex flex-col min-h-0 rounded-2xl bg-white/5 border border-white/10 p-3 gap-2">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-2">
            {t("keepass.groups")}
          </div>
          <div className="flex-1 overflow-y-auto space-y-0.5">
            <GroupButton
              label={t("keepass.allEntries")}
              depth={0}
              active={selectedGroupId === null}
              onClick={() => setSelectedGroupId(null)}
            />
            {groupRows
              .filter((row) => row.group.id !== rootGroup?.id)
              .map(({ group, depth }) => (
                <GroupButton
                  key={group.id}
                  label={group.name}
                  depth={depth}
                  active={selectedGroupId === group.id}
                  onClick={() => setSelectedGroupId(group.id)}
                />
              ))}
          </div>
          <input
            className={inputClass}
            placeholder={t("keepass.newGroup")}
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createGroup()}
          />
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" onClick={createGroup} icon={<FolderPlus size={14} />} className="flex-1">
              {t("keepass.addGroup")}
            </Button>
            {selectedGroup && selectedGroup.parentId !== null && (
              <IconButton
                variant="ghost"
                onClick={() => setPendingDelete({ kind: "group", id: selectedGroup.id, name: selectedGroup.name })}
                icon={<Trash2 size={14} />}
                ariaLabel={t("keepass.deleteGroup")}
              />
            )}
          </div>
        </section>

        {/* Entries */}
        <section className="flex flex-col min-h-0 rounded-2xl bg-white/5 border border-white/10 p-3 gap-2">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                className={`${inputClass} pl-8`}
                placeholder={t("keepass.search")}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <IconButton onClick={startNew} icon={<Plus size={14} />} ariaLabel={t("keepass.addEntry")} />
          </div>
          <ul className="flex-1 overflow-y-auto space-y-0.5">
            {visibleEntries.length === 0 && (
              <li className="text-sm text-gray-500 px-2 py-4">{t("keepass.noEntries")}</li>
            )}
            {visibleEntries.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => selectEntry(e.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg ${
                    selectedEntryId === e.id ? "bg-emerald-500/15" : "hover:bg-white/5"
                  }`}
                >
                  <div className="text-sm text-white truncate">{e.title || t("keepass.untitled")}</div>
                  <div className="text-xs text-gray-500 truncate">{e.username}</div>
                </button>
              </li>
            ))}
          </ul>
        </section>

        {/* Details / editor */}
        <section className="min-h-0 overflow-y-auto rounded-2xl bg-white/5 border border-white/10 p-6">
          {draft ? (
            <EntryEditor
              draft={draft}
              groups={groups}
              onChange={setDraft}
              onSave={saveDraft}
              onCancel={() => setDraft(null)}
            />
          ) : detail ? (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-xl font-semibold text-white break-all">{detail.title}</h3>
                <div className="flex gap-1 shrink-0">
                  <IconButton variant="ghost" onClick={startEdit} icon={<Pencil size={14} />} ariaLabel={t("keepass.edit")} />
                  <IconButton
                    variant="danger"
                    onClick={() => setPendingDelete({ kind: "entry", id: detail.id, title: detail.title })}
                    icon={<Trash2 size={14} />}
                    ariaLabel={t("keepass.deleteEntry")}
                  />
                </div>
              </div>
              <Field label={t("keepass.username")} value={detail.username} onCopy={() => copy(detail.username, t("keepass.username"))} />
              <div>
                <div className="text-xs text-gray-500 mb-1">{t("keepass.password")}</div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 rounded-lg bg-black/30 text-sm text-emerald-300 break-all">
                    {showPassword ? detail.password : "••••••••"}
                  </code>
                  <IconButton variant="ghost" onClick={() => setShowPassword((v) => !v)} icon={showPassword ? <EyeOff size={14} /> : <Eye size={14} />} ariaLabel={t("keepass.togglePassword")} />
                  <IconButton variant="ghost" onClick={() => copy(detail.password, t("keepass.password"))} icon={<Copy size={14} />} ariaLabel={t("keepass.copy")} />
                </div>
              </div>
              <Field label={t("keepass.url")} value={detail.url} onCopy={() => copy(detail.url, t("keepass.url"))} />
              {detail.notes && (
                <div>
                  <div className="text-xs text-gray-500 mb-1">{t("keepass.notes")}</div>
                  <p className="text-sm text-gray-300 whitespace-pre-wrap">{detail.notes}</p>
                </div>
              )}
              <div className="text-xs text-gray-600">
                {t("keepass.modified")}: {detail.modifiedAt ? new Date(detail.modifiedAt).toLocaleString() : "—"}
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500">{t("keepass.selectEntry")}</p>
          )}
        </section>
      </div>

      <ChangePasswordModal
        isOpen={showChangePassword}
        vaultId={vault.id}
        onDone={() => setShowChangePassword(false)}
      />

      <ConfirmationModal
        isOpen={pendingDelete !== null}
        title={t("keepass.confirmDeleteTitle")}
        message={
          pendingDelete?.kind === "group"
            ? t("keepass.confirmDeleteGroup", { name: pendingDelete.name })
            : t("keepass.confirmDeleteEntry", { name: pendingDelete?.kind === "entry" ? pendingDelete.title : "" })
        }
        isDestructive
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}

/** Clears the clipboard, but only if it still holds the value we put there. */
async function clearClipboardIfUnchanged(value: string) {
  try {
    if ((await readText()) === value) await writeText("");
  } catch {
    // The clipboard is not available; nothing to clear.
  }
}

function FileField({
  placeholder,
  value,
  onChange,
  onBrowse,
  browseLabel,
}: {
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  onBrowse: () => void;
  browseLabel: string;
}) {
  return (
    <div className="flex gap-2">
      <input
        className={inputClass}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <Button size="sm" variant="secondary" onClick={onBrowse}>
        {browseLabel}
      </Button>
    </div>
  );
}

function ChangePasswordModal({
  isOpen,
  vaultId,
  onDone,
}: {
  isOpen: boolean;
  vaultId: string;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [keyfile, setKeyfile] = useState("");
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setPassword("");
    setConfirm("");
    setKeyfile("");
  };

  const close = () => {
    reset();
    onDone();
  };

  const submit = async () => {
    if (password !== confirm) {
      toast.error(t("keepass.passwordMismatch"));
      return;
    }
    setBusy(true);
    try {
      await invoke("keepass_change_password", {
        vaultId,
        newPassword: password,
        keyfilePath: keyfile || null,
      });
      toast.success(t("keepass.passwordChanged"));
      close();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={close} title={t("keepass.changePasswordTitle")} size="sm">
      <div className="p-6 space-y-3">
        <h3 className="text-lg font-semibold text-white">{t("keepass.changePasswordTitle")}</h3>
        <input
          type="password"
          className={inputClass}
          placeholder={t("keepass.newPassword")}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <input
          type="password"
          className={inputClass}
          placeholder={t("keepass.confirmPassword")}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
        <FileField
          placeholder={t("keepass.keyfileOptional")}
          value={keyfile}
          onChange={setKeyfile}
          onBrowse={async () => {
            try {
              const path = await pickFile();
              if (path) setKeyfile(path);
            } catch (e) {
              toast.error(errorMessage(e));
            }
          }}
          browseLabel={t("keepass.browse")}
        />
        <p className="text-xs text-amber-400/80">{t("keepass.changePasswordWarning")}</p>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={close}>
            {t("common.cancel")}
          </Button>
          <Button onClick={submit} loading={busy} disabled={password.length < 8}>
            {t("common.save")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function IconButton({
  icon,
  ariaLabel,
  onClick,
  variant = "ghost",
}: {
  icon: React.ReactNode;
  ariaLabel: string;
  onClick: () => void;
  variant?: "ghost" | "danger";
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      title={ariaLabel}
      onClick={onClick}
      className={`shrink-0 p-1.5 rounded-lg transition-colors ${
        variant === "danger"
          ? "text-red-400 hover:bg-red-500/10"
          : "text-gray-400 hover:text-emerald-300 hover:bg-white/5"
      }`}
    >
      {icon}
    </button>
  );
}

function GroupButton({
  label,
  depth,
  active,
  onClick,
}: {
  label: string;
  depth: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ paddingLeft: `${8 + depth * 12}px` }}
      className={`w-full text-left pr-2 py-1.5 rounded-lg text-sm truncate ${
        active ? "bg-emerald-500/15 text-emerald-300" : "text-gray-300 hover:bg-white/5"
      }`}
    >
      {label}
    </button>
  );
}

function Field({ label, value, onCopy }: { label: string; value: string; onCopy: () => void }) {
  const { t } = useTranslation();
  return (
    <div>
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className="flex items-center gap-2">
        <span className="flex-1 px-3 py-2 rounded-lg bg-black/30 text-sm text-gray-200 break-all">{value || "—"}</span>
        {value && (
          <IconButton variant="ghost" onClick={onCopy} icon={<Copy size={14} />} ariaLabel={t("keepass.copy")} />
        )}
      </div>
    </div>
  );
}

function EntryEditor({
  draft,
  groups,
  onChange,
  onSave,
  onCancel,
}: {
  draft: EntryDraft;
  groups: VaultGroup[];
  onChange: (draft: EntryDraft) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [showPassword, setShowPassword] = useState(false);
  const set = (patch: Partial<EntryDraft>) => onChange({ ...draft, ...patch });

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold text-white">
        {draft.id ? t("keepass.editEntry") : t("keepass.newEntry")}
      </h3>
      <input className={inputClass} placeholder={t("keepass.title")} value={draft.title} onChange={(e) => set({ title: e.target.value })} />
      <input className={inputClass} placeholder={t("keepass.username")} value={draft.username} onChange={(e) => set({ username: e.target.value })} />
      <div className="flex gap-2">
        <input
          type={showPassword ? "text" : "password"}
          className={inputClass}
          placeholder={t("keepass.password")}
          value={draft.password}
          onChange={(e) => set({ password: e.target.value })}
        />
        <IconButton variant="ghost" onClick={() => setShowPassword((v) => !v)} icon={showPassword ? <EyeOff size={14} /> : <Eye size={14} />} ariaLabel={t("keepass.togglePassword")} />
      </div>
      <input className={inputClass} placeholder={t("keepass.url")} value={draft.url} onChange={(e) => set({ url: e.target.value })} />
      <select className={inputClass} value={draft.groupId} onChange={(e) => set({ groupId: e.target.value })}>
        {groups.map((g) => (
          <option key={g.id} value={g.id} className="bg-[#0a0a0a]">
            {g.name}
          </option>
        ))}
      </select>
      <textarea
        className={`${inputClass} min-h-24`}
        placeholder={t("keepass.notes")}
        value={draft.notes}
        onChange={(e) => set({ notes: e.target.value })}
      />
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" onClick={onCancel}>
          {t("common.cancel")}
        </Button>
        <Button onClick={onSave} disabled={!draft.title}>
          {t("common.save")}
        </Button>
      </div>
    </div>
  );
}
