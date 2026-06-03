import { useEffect, useMemo, useState } from "react";
import type {
  LyciumLocalDataBackup,
  LyciumLocalDataExport,
  LyciumLocalStorageStatus,
} from "@lycium/data-access";
import { lyciumApi } from "../../runtime/appRuntime";

type LoadState = "idle" | "loading" | "error" | "success";

function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let size = value;
  let index = 0;
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }
  return `${size >= 10 || index === 0 ? Math.round(size) : size.toFixed(1)} ${units[index]}`;
}

function formatDate(value?: string | null): string {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function downloadExport(payload: LyciumLocalDataExport) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `lycium-local-data-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function backupSummary(backup: LyciumLocalDataBackup | null, status: LyciumLocalStorageStatus | null): string {
  if (backup) {
    return `${formatBytes(backup.byte_count)} across ${backup.file_count} files`;
  }
  if (status?.latest_backup_path) {
    return "Latest backup is recorded locally";
  }
  return "No backup recorded yet";
}

export default function LocalStoragePanel() {
  const [status, setStatus] = useState<LyciumLocalStorageStatus | null>(null);
  const [latestBackup, setLatestBackup] = useState<LyciumLocalDataBackup | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [message, setMessage] = useState("");
  const [busyAction, setBusyAction] = useState<"backup" | "export" | null>(null);

  const totalBytes = useMemo(
    () => status?.directories.reduce((total, directory) => total + directory.byte_count, 0) ?? 0,
    [status],
  );
  const totalFiles = useMemo(
    () => status?.directories.reduce((total, directory) => total + directory.file_count, 0) ?? 0,
    [status],
  );

  const loadStatus = async () => {
    setLoadState("loading");
    setMessage("");
    try {
      setStatus(await lyciumApi.loadLocalStorageStatus());
      setLoadState("success");
    } catch (error) {
      setLoadState("error");
      setMessage(error instanceof Error ? error.message : "Local storage status unavailable.");
    }
  };

  useEffect(() => {
    void loadStatus();
  }, []);

  const handleBackup = async () => {
    setBusyAction("backup");
    setMessage("");
    try {
      const backup = await lyciumApi.createLocalBackup(false);
      setLatestBackup(backup);
      setMessage(`Backup created at ${backup.path}.`);
      await loadStatus();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Local backup failed.");
    } finally {
      setBusyAction(null);
    }
  };

  const handleExport = async () => {
    setBusyAction("export");
    setMessage("");
    try {
      const payload = await lyciumApi.exportLocalData(false);
      downloadExport(payload);
      setMessage(`Export downloaded with ${payload.file_count} files. Secrets were excluded.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Local data export failed.");
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <section className="settings-section" aria-labelledby="settings-local-storage">
      <div className="settings-section-heading-row">
        <h2 id="settings-local-storage">Local Storage</h2>
        <button
          className="settings-run-refresh-button"
          type="button"
          disabled={loadState === "loading"}
          onClick={() => void loadStatus()}
        >
          Refresh
        </button>
      </div>

      <div className="settings-storage-panel">
        {loadState === "loading" && !status && <p className="settings-storage-empty">Loading local storage...</p>}
        {loadState === "error" && !status && <p className="settings-storage-empty">{message}</p>}
        {status && (
          <>
            <div className="settings-storage-summary-grid">
              <article>
                <span>Schema</span>
                <strong>
                  {status.schema_version}/{status.target_schema_version}
                </strong>
              </article>
              <article>
                <span>Files</span>
                <strong>{totalFiles}</strong>
              </article>
              <article>
                <span>Size</span>
                <strong>{formatBytes(totalBytes)}</strong>
              </article>
              <article>
                <span>Backups</span>
                <strong>{status.backup_count}</strong>
              </article>
            </div>

            <div className="settings-storage-path-card">
              <span>Local data directory</span>
              <strong>{status.local_data_dir}</strong>
            </div>

            <div className="settings-storage-actions">
              <button
                className="settings-run-resume-button"
                type="button"
                disabled={busyAction !== null}
                onClick={() => void handleBackup()}
              >
                {busyAction === "backup" ? "Creating" : "Create backup"}
              </button>
              <button
                className="settings-run-resume-button"
                type="button"
                disabled={busyAction !== null}
                onClick={() => void handleExport()}
              >
                {busyAction === "export" ? "Exporting" : "Download export"}
              </button>
            </div>

            <div className="settings-storage-backup-card">
              <span>Latest backup</span>
              <strong>{backupSummary(latestBackup, status)}</strong>
              <small>{latestBackup ? formatDate(latestBackup.created_at) : status.latest_backup_path ?? "Create a backup to record one."}</small>
            </div>

            {status.json_error_count > 0 && (
              <div className="settings-storage-error-card">
                <strong>{status.json_error_count} local JSON issue{status.json_error_count === 1 ? "" : "s"} found</strong>
                <span>{status.json_errors.slice(0, 2).join(" | ")}</span>
              </div>
            )}

            {status.repair_warning_count > 0 && (
              <div className="settings-storage-warning-card">
                <strong>{status.repair_warning_count} local repair warning{status.repair_warning_count === 1 ? "" : "s"}</strong>
                <span>
                  {status.repair_warnings
                    .slice(-2)
                    .map((warning) => [warning.path, warning.action].filter(Boolean).join(": "))
                    .join(" | ")}
                </span>
              </div>
            )}

            <div className="settings-storage-directory-list">
              {status.directories.map((directory) => (
                <article className="settings-storage-directory-row" key={directory.name}>
                  <div>
                    <strong>{directory.name}</strong>
                    <span>{directory.description ?? directory.path}</span>
                  </div>
                  <span>
                    {directory.file_count} files · {formatBytes(directory.byte_count)}
                  </span>
                </article>
              ))}
            </div>
          </>
        )}
      </div>
      <p className="settings-storage-note">
        Backups and exports exclude saved AI secrets. Import support will use this same export format once the restore endpoint is enabled.
      </p>
      {message && status && <p className="settings-run-message">{message}</p>}
    </section>
  );
}
