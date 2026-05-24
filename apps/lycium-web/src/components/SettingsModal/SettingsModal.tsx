import type { Dispatch, FormEvent, MouseEvent, SetStateAction } from "react";
import Dropdown from "../Dropdown/Dropdown";
import type { AgentKeyRecord, AgentProviderRecord, ThemeMode } from "../../courseTypes";
import "./SettingsModal.css";
import "./SettingsModal.theme.css";

type SettingsModalProps = {
  isOpen: boolean;
  agentKeys: AgentKeyRecord[];
  agentProviders: AgentProviderRecord[];
  agentProviderId: string;
  agentApiKey: string;
  apiKeySaveStatus: "idle" | "loading" | "invalid";
  canAddAgentKey: boolean;
  themeMode: ThemeMode;
  settingsMessage: string;
  settingsStatus: "idle" | "loading" | "error" | "success";
  onClose: () => void;
  onActivateAgentKey: (keyId: string) => void;
  onAgentModelChange: (keyId: string, model: string) => void;
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
  canAddAgentKey,
  themeMode,
  settingsMessage,
  settingsStatus,
  onClose,
  onActivateAgentKey,
  onAgentModelChange,
  onAgentProviderChange,
  onAgentApiKeyChange,
  onApiKeySaveStatusChange,
  onSettingsSubmit,
  onThemeModeChange,
}: SettingsModalProps) {
  if (!isOpen) {
    return null;
  }

  const isSavingAgentKey = apiKeySaveStatus === "loading";
  const selectedProvider =
    agentProviders.find((provider) => provider.id === agentProviderId) ?? agentProviders[0];
  const providerOptions = agentProviders.map((provider) => ({
    value: provider.id,
    label: provider.label,
  }));

  const handleClose = () => {
    onClose();
  };

  const handleBackdropMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      handleClose();
    }
  };

  const handleApiKeyChange = (value: string) => {
    onAgentApiKeyChange(value);
    if (apiKeySaveStatus === "invalid") {
      onApiKeySaveStatusChange("idle");
    }
  };

  return (
    <div className="settings-modal-backdrop" role="presentation" onMouseDown={handleBackdropMouseDown}>
      <section
        className="settings-card settings-card-modal"
        aria-labelledby="settings-title"
        role="dialog"
        aria-modal="true"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="settings-close-button" type="button" aria-label="Close settings" onClick={handleClose}>
          <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
            <path d="M6.3 5.3a1 1 0 0 1 1.4 0l4.3 4.3 4.3-4.3a1 1 0 1 1 1.4 1.4L13.4 11l4.3 4.3a1 1 0 0 1-1.4 1.4L12 12.4l-4.3 4.3a1 1 0 0 1-1.4-1.4l4.3-4.3-4.3-4.3a1 1 0 0 1 0-1.4Z" />
          </svg>
        </button>
        <h1 id="settings-title">Settings</h1>
        <section className="settings-section" aria-labelledby="settings-active-ai">
          <h2 id="settings-active-ai">Active AI</h2>
          <div className="settings-ai-data-panel">
            {agentKeys.length > 0 && (
              <section className="settings-key-list" aria-label="Saved API keys">
                <div className="settings-key-stack">
                  {agentKeys.map((key) => (
                    <div
                      key={key.id}
                      className={`settings-key-row${key.is_active ? " settings-key-row-active" : ""}`}
                      role="button"
                      tabIndex={isSavingAgentKey ? -1 : 0}
                      onClick={() => onActivateAgentKey(key.id)}
                      onKeyDown={(event) => {
                        if (isSavingAgentKey) return;
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          onActivateAgentKey(key.id);
                        }
                      }}
                      aria-disabled={isSavingAgentKey}
                    >
                      <span className="settings-key-provider">{key.provider_label}</span>
                      <span className="settings-key-preview">{key.key_preview}</span>
                      <label className="settings-model-field" onClick={(event) => event.stopPropagation()}>
                        <Dropdown
                          className="settings-model-dropdown"
                          value={key.model ?? ""}
                          options={(key.models ?? []).map((model) => ({
                            value: model.id,
                            label: model.label || model.id,
                          }))}
                          onChange={(nextModel) => onAgentModelChange(key.id, nextModel)}
                          disabled={isSavingAgentKey || !key.models?.length}
                          ariaLabel={`Model for ${key.provider_label}`}
                          placeholder="Model"
                        />
                      </label>
                      <span className="settings-key-state">{key.is_active ? "Active" : "Use"}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}
            <form className="settings-form" onSubmit={onSettingsSubmit}>
              <div className="settings-entry-row">
                <div className="settings-entry-field settings-provider-picker">
                  <Dropdown
                    className="settings-provider-dropdown"
                    value={selectedProvider?.id ?? ""}
                    options={providerOptions}
                    onChange={onAgentProviderChange}
                    ariaLabel="AI provider"
                    disabled={isSavingAgentKey}
                    emptyLabel="No providers available"
                    placeholder="Provider"
                  />
                </div>
                <label className="settings-entry-field settings-entry-field-key" htmlFor="agent-api-key">
                  <input
                    id="agent-api-key"
                    className={`settings-input${apiKeySaveStatus === "invalid" ? " settings-input--invalid" : ""}`}
                    type="password"
                    value={agentApiKey}
                    onChange={(event) => handleApiKeyChange(event.target.value)}
                    placeholder={apiKeySaveStatus === "invalid" ? "API key invalid" : "api key"}
                    autoComplete="off"
                    disabled={isSavingAgentKey}
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
        {settingsMessage && <p className={`settings-status settings-status-${settingsStatus}`}>{settingsMessage}</p>}
      </section>
    </div>
  );
}
