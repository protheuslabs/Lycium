import { useEffect, useState } from "react";
import type { Dispatch, FormEvent, SetStateAction } from "react";
import ConfirmModal from "../ConfirmModal/ConfirmModal";
import Dropdown from "../Dropdown/Dropdown";
import type { DropdownOption } from "../Dropdown/Dropdown";
import Modal from "../Modal/Modal";
import type { AgentKeyRecord, AgentProviderRecord, ThemeMode } from "../../courseTypes";
import { describeAgentKeyConnectionDetail, describeAgentKeyConnectionStatus } from "../../utils/aiConnectionReadiness";

type SettingsModalProps = {
  isOpen: boolean;
  agentKeys: AgentKeyRecord[];
  agentProviders: AgentProviderRecord[];
  agentProviderId: string;
  agentApiKey: string;
  apiKeySaveStatus: "idle" | "loading" | "invalid";
  verifyingAgentKeyId: string | null;
  canAddAgentKey: boolean;
  settingsStatus: "idle" | "loading" | "error" | "success";
  settingsMessage: string;
  themeMode: ThemeMode;
  onClose: () => void;
  onActivateAgentKey: (keyId: string) => void;
  onAgentModelChange: (keyId: string, model: string) => void;
  onEditAgentKey: (key: AgentKeyRecord) => void;
  onDeleteAgentKey: (keyId: string) => void;
  onAgentProviderChange: (providerId: string) => void;
  onAgentApiKeyChange: (apiKey: string) => void;
  onApiKeySaveStatusChange: Dispatch<SetStateAction<"idle" | "loading" | "invalid">>;
  onSettingsSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onThemeModeChange: (mode: ThemeMode) => void;
};

export default function SettingsModal({
  isOpen,
  agentKeys,
  agentProviders,
  agentProviderId,
  agentApiKey,
  apiKeySaveStatus,
  verifyingAgentKeyId,
  canAddAgentKey,
  settingsStatus,
  settingsMessage,
  themeMode,
  onClose,
  onActivateAgentKey,
  onAgentModelChange,
  onEditAgentKey,
  onDeleteAgentKey,
  onAgentProviderChange,
  onAgentApiKeyChange,
  onApiKeySaveStatusChange,
  onSettingsSubmit,
  onThemeModeChange,
}: SettingsModalProps) {
  const [keyPendingDelete, setKeyPendingDelete] = useState<AgentKeyRecord | null>(null);
  const [openKeyMenuId, setOpenKeyMenuId] = useState<string | null>(null);
  const pendingDelete = keyPendingDelete && agentKeys.some((key) => key.id === keyPendingDelete.id)
    ? keyPendingDelete
    : null;

  useEffect(() => {
    if (!openKeyMenuId) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const menuRoot = document.querySelector(`[data-settings-key-menu-id="${openKeyMenuId}"]`);
      if (menuRoot?.contains(event.target as Node)) {
        return;
      }
      setOpenKeyMenuId(null);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenKeyMenuId(null);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [openKeyMenuId]);

  if (!isOpen) {
    return null;
  }

  const isSavingAgentKey = apiKeySaveStatus === "loading";
  const isSettingsBusy = isSavingAgentKey || Boolean(verifyingAgentKeyId);
  const selectedProvider = agentProviders.find((provider) => provider.id === agentProviderId);
  const credentialLabel = selectedProvider?.credential_label ?? "api key";
  const credentialPlaceholder = selectedProvider?.credential_placeholder ?? credentialLabel;
  const isLocalProvider = Boolean(selectedProvider?.local_provider);
  const localProviderOptions = agentProviders.filter((provider) => provider.local_provider).map((provider) => ({
    value: provider.id,
    label: provider.label,
  }));
  const apiProviderOptions = agentProviders.filter((provider) => !provider.local_provider).map((provider) => ({
    value: provider.id,
    label: provider.label,
  }));
  const providerOptions: DropdownOption[] = agentProviders.length > 0
    ? [
        { value: "", label: "Select" },
        ...(localProviderOptions.length > 0
          ? [{ kind: "separator" as const, label: "Local" }, ...localProviderOptions]
          : []),
        ...(apiProviderOptions.length > 0
          ? [{ kind: "separator" as const, label: "API" }, ...apiProviderOptions]
          : []),
      ]
    : [];

  const handleApiKeyChange = (value: string) => {
    onAgentApiKeyChange(value);
    if (apiKeySaveStatus === "invalid") {
      onApiKeySaveStatusChange("idle");
    }
  };

  const handleConfirmDelete = () => {
    if (!pendingDelete) {
      return;
    }
    onDeleteAgentKey(pendingDelete.id);
    setKeyPendingDelete(null);
    setOpenKeyMenuId(null);
  };

  const handleClose = () => {
    setKeyPendingDelete(null);
    setOpenKeyMenuId(null);
    onClose();
  };

  const providerKindLabel = (key: AgentKeyRecord) => (key.local_provider ? "local" : "cloud");

  return (
    <Modal
      isOpen={isOpen}
      title="Settings"
      labelledById="settings-title"
      size="lg"
      className="settings-modal-content"
      onClose={handleClose}
    >
        <section className="settings-section" aria-labelledby="settings-active-ai">
          <h2 id="settings-active-ai">Active AI</h2>
          <div className="settings-ai-data-panel">
            {agentKeys.length > 0 && (
              <section className="settings-key-list" aria-label="Saved API keys">
                <div className="settings-key-stack">
                  {agentKeys.map((key) => {
                    const isUnverified = key.connection_status === "unverified";
                    const isKeyMenuOpen = openKeyMenuId === key.id;
                    const isVerifyingKey = verifyingAgentKeyId === key.id;
                    const connectionStatus = describeAgentKeyConnectionStatus(key, { isChecking: isVerifyingKey });
                    const connectionDetail = describeAgentKeyConnectionDetail(key, { isChecking: isVerifyingKey });
                    const providerKind = providerKindLabel(key);
                    const showsActiveCheck = connectionStatus.status === "active";
                    const showsStatusIndicator = !showsActiveCheck && connectionStatus.status !== "ready";
                    return (
                      <div
                        key={key.id}
                        className={`settings-key-row${key.is_active ? " settings-key-row-active" : ""}${isUnverified ? " settings-key-row-unverified" : ""}`}
                        data-connection-status={connectionStatus.status}
                        role="button"
                        tabIndex={isSettingsBusy ? -1 : 0}
                        aria-label={`${key.provider_label} ${providerKind} connection${key.is_active ? ", active" : ""}`}
                        aria-pressed={key.is_active}
                        onClick={() => onActivateAgentKey(key.id)}
                        onKeyDown={(event) => {
                          if (isSettingsBusy) return;
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            onActivateAgentKey(key.id);
                          }
                        }}
                        aria-disabled={isSettingsBusy}
                      >
                        <span className="settings-key-provider">
                          {key.provider_label}
                          <span className="settings-key-provider-kind"> - {providerKind}</span>
                        </span>
                        <label className="settings-model-field" onClick={(event) => event.stopPropagation()}>
                          <Dropdown
                            className="settings-model-dropdown"
                            value={key.model ?? ""}
                            options={(key.models ?? []).map((model) => ({
                              value: model.id,
                              label: model.label || model.id,
                            }))}
                            onChange={(nextModel) => onAgentModelChange(key.id, nextModel)}
                            disabled={isSettingsBusy || !key.models?.length}
                            ariaLabel={`Model for ${key.provider_label}`}
                            placeholder="Model"
                          />
                        </label>
                        <span
                          className="settings-key-actions"
                          data-settings-key-menu-id={key.id}
                          onClick={(event) => event.stopPropagation()}
                        >
                          <button
                            className="settings-key-menu-button"
                            type="button"
                            disabled={isSettingsBusy}
                            aria-label={`${key.provider_label} actions`}
                            aria-haspopup="menu"
                            aria-expanded={isKeyMenuOpen}
                            onClick={() => setOpenKeyMenuId((currentKeyId) => (currentKeyId === key.id ? null : key.id))}
                            title="Connection actions"
                          >
                            <MoreIcon />
                          </button>
                          {isKeyMenuOpen && (
                            <div className="settings-key-menu" role="menu" aria-label={`${key.provider_label} actions`}>
                              <button
                                className="settings-key-menu-item"
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                  onEditAgentKey(key);
                                  setOpenKeyMenuId(null);
                                }}
                              >
                                Edit
                              </button>
                              <button
                                className="settings-key-menu-item settings-key-menu-item-danger"
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                  setKeyPendingDelete(key);
                                  setOpenKeyMenuId(null);
                                }}
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </span>
                        {showsActiveCheck ? (
                          <span className="settings-key-active-check" title="Active connection" aria-label="Active connection">
                            <CheckIcon />
                          </span>
                        ) : showsStatusIndicator ? (
                          <span className="settings-key-state" title={connectionDetail} aria-label={connectionDetail}>
                            {connectionStatus.label}
                          </span>
                        ) : (
                          <span className="settings-key-state-placeholder" aria-hidden="true" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
            <form className="settings-form" onSubmit={onSettingsSubmit}>
              <div className="settings-entry-row">
                <div className="settings-entry-field settings-provider-picker">
                  <Dropdown
                    className="settings-provider-dropdown"
                    value={agentProviderId}
                    options={providerOptions}
                    onChange={onAgentProviderChange}
                    ariaLabel="AI provider"
                    disabled={isSettingsBusy}
                    emptyLabel="No providers available"
                    placeholder="Select"
                  />
                </div>
                <label className="settings-entry-field settings-entry-field-key" htmlFor="agent-api-key">
                  <input
                    id="agent-api-key"
                    className={`settings-input${apiKeySaveStatus === "invalid" ? " settings-input--invalid" : ""}`}
                    type={isLocalProvider ? "text" : "password"}
                    value={agentApiKey}
                    onChange={(event) => handleApiKeyChange(event.target.value)}
                    placeholder={apiKeySaveStatus === "invalid" ? `${credentialLabel} invalid` : credentialPlaceholder}
                    autoComplete="off"
                    disabled={isSettingsBusy}
                  />
                </label>
                <button
                  className={`settings-save-button${isSavingAgentKey ? " settings-save-button-loading" : ""}`}
                  type="submit"
                  disabled={!canAddAgentKey}
                  aria-label="Add API key"
                >
                  {isSavingAgentKey ? (
                    <span className="settings-save-spinner" aria-hidden="true" />
                  ) : (
                    <svg className="settings-save-plus" aria-hidden="true" viewBox="0 0 24 24" focusable="false">
                      <path d="M11 5a1 1 0 1 1 2 0v6h6a1 1 0 1 1 0 2h-6v6a1 1 0 1 1-2 0v-6H5a1 1 0 1 1 0-2h6V5Z" />
                    </svg>
                  )}
                </button>
              </div>
              {settingsMessage && (
                <p
                  className={`settings-status-message settings-status-message-${settingsStatus}`}
                  role={settingsStatus === "error" ? "alert" : "status"}
                >
                  {settingsMessage}
                </p>
              )}
            </form>
          </div>
        </section>
        <section className="settings-section" aria-labelledby="settings-display">
          <h2 id="settings-display">Display</h2>
          <div className="theme-toggle" data-mode={themeMode} role="radiogroup" aria-label="Color mode">
            <button className="theme-toggle-option" type="button" role="radio" aria-checked={themeMode === "light"} aria-label="Light mode" onClick={() => onThemeModeChange("light")}>
              <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false"><path d="M12 4.4a.8.8 0 0 0 .8-.8V2a.8.8 0 0 0-1.6 0v1.6a.8.8 0 0 0 .8.8Zm0 15.2a.8.8 0 0 0-.8.8V22a.8.8 0 0 0 1.6 0v-1.6a.8.8 0 0 0-.8-.8ZM4.93 6.06a.8.8 0 0 0 1.13-1.13L4.93 3.8A.8.8 0 1 0 3.8 4.93l1.13 1.13Zm14.14 11.88a.8.8 0 0 0-1.13 1.13l1.13 1.13a.8.8 0 0 0 1.13-1.13l-1.13-1.13ZM3.6 11.2H2a.8.8 0 0 0 0 1.6h1.6a.8.8 0 0 0 0-1.6Zm18.4 0h-1.6a.8.8 0 0 0 0 1.6H22a.8.8 0 0 0 0-1.6ZM4.93 20.2l1.13-1.13a.8.8 0 0 0-1.13-1.13L3.8 19.07a.8.8 0 1 0 1.13 1.13ZM18.5 6.3c.2 0 .41-.08.57-.24l1.13-1.13a.8.8 0 0 0-1.13-1.13l-1.13 1.13A.8.8 0 0 0 18.5 6.3ZM12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10Z" /></svg>
            </button>
            <button className="theme-toggle-option" type="button" role="radio" aria-checked={themeMode === "auto"} aria-label="Auto color mode" onClick={() => onThemeModeChange("auto")}>
              <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false"><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2h11A2.5 2.5 0 0 1 20 4.5v8A2.5 2.5 0 0 1 17.5 15h-3.1l.45 2H17a1 1 0 1 1 0 2H7a1 1 0 1 1 0-2h2.15l.45-2H6.5A2.5 2.5 0 0 1 4 12.5v-8Zm2.5-.8a.8.8 0 0 0-.8.8v8c0 .44.36.8.8.8h11c.44 0 .8-.36.8-.8v-8a.8.8 0 0 0-.8-.8h-11Z" /></svg>
            </button>
            <button className="theme-toggle-option" type="button" role="radio" aria-checked={themeMode === "dark"} aria-label="Dark mode" onClick={() => onThemeModeChange("dark")}>
              <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false"><path d="M20.2 14.5a.8.8 0 0 0-.86-.18 7.35 7.35 0 0 1-9.65-9.65.8.8 0 0 0-1.03-1.03A8.96 8.96 0 1 0 20.36 15.67a.8.8 0 0 0-.16-1.17Z" /></svg>
            </button>
          </div>
        </section>
        <ConfirmModal
          isOpen={Boolean(pendingDelete)}
          title="Delete AI connection?"
          eyebrow="Active AI"
          labelledById="settings-delete-ai-title"
          message={`Delete ${pendingDelete?.provider_label ?? "this AI"} connection? You can add it again later.`}
          confirmLabel="Delete"
          tone="danger"
          onCancel={() => setKeyPendingDelete(null)}
          onConfirm={handleConfirmDelete}
        />
    </Modal>
  );
}

function MoreIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
      <path d="M5 12a2 2 0 1 1 4 0 2 2 0 0 1-4 0Zm5 0a2 2 0 1 1 4 0 2 2 0 0 1-4 0Zm5 0a2 2 0 1 1 4 0 2 2 0 0 1-4 0Z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
      <path d="M9.6 17.2a1 1 0 0 1-.7-.3l-4.1-4.1a1 1 0 1 1 1.4-1.4l3.4 3.4 8.2-8.2a1 1 0 1 1 1.4 1.4l-8.9 8.9a1 1 0 0 1-.7.3Z" />
    </svg>
  );
}
