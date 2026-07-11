import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { createBrowserStorageRepository, createLyciumLocalApi } from "@lycium/data-access";
import type { AgentKeyRecord, AgentProviderRecord, ThemeMode } from "../courseTypes";
import { localApiSyncEnabled } from "../runtime/appRuntime";

const DEFAULT_AGENT_PROVIDERS: AgentProviderRecord[] = [
  {
    id: "local-model",
    label: "Ollama Local",
    default_model: "kimi-k2.6:cloud",
    recommended_model: "kimi-k2.6:cloud",
    minimum_recommended_parameters_billion: 70,
    model_recommendation_note:
      "Course generation is a long-form synthesis task. Prefer Kimi K2.6 Cloud or another high-capability model around 70B+ parameters.",
    model_fetch_supported: true,
    generation_adapter: "ollama-chat",
    local_provider: true,
    credential_label: "local path",
    credential_placeholder: "Local Path",
    credential_default: "http://localhost:11434",
  },
  {
    id: "openai",
    label: "OpenAI",
    default_model: "gpt-4.1-mini",
    model_fetch_supported: true,
    generation_adapter: "openai-chat-completions",
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    default_model: "openai/gpt-4.1-mini",
    model_fetch_supported: true,
    generation_adapter: "openai-chat-completions",
  },
  {
    id: "anthropic",
    label: "Anthropic",
    default_model: "claude-3-5-sonnet-latest",
    model_fetch_supported: true,
    generation_adapter: "anthropic-messages",
  },
  {
    id: "google-gemini",
    label: "Google Gemini",
    default_model: "models/gemini-2.5-flash",
    model_fetch_supported: true,
    generation_adapter: "gemini-generate-content",
  },
  {
    id: "claude-code-runtime",
    label: "Claude Code",
    default_model: "claude-code",
    recommended_model: "claude-code",
    model_recommendation_note:
      "Uses a local Lycium agent-runtime bridge. Add a bridge command that can read Lycium JSON requests from stdin.",
    model_fetch_supported: true,
    generation_adapter: "local-agent-runtime",
    local_provider: true,
    credential_label: "bridge command",
    credential_placeholder: "Auto-filled Lycium bridge command",
    credential_default: "python3 services/lycium-api/scripts/agent_runtime_bridge.py --runtime claude-code",
    credential_kind: "local_runtime",
    contract: {
      provider_kind: "agent_runtime",
      credential_kind: "local_runtime",
      generation_adapter: "local-agent-runtime",
      requires_verified_connection: true,
      supports_model_list: true,
      supports_json_mode: true,
      supports_streaming: false,
      supports_tool_use: false,
      supports_usage_metadata: false,
      model_source: "runtime_bridge",
      capabilities: {
        agent_runtime: true,
        local_execution: true,
        runtime_bridge: true,
      },
    },
  },
  {
    id: "codex-runtime",
    label: "Codex",
    default_model: "codex",
    recommended_model: "codex",
    model_recommendation_note:
      "Uses a local Lycium agent-runtime bridge. Add a bridge command that can read Lycium JSON requests from stdin.",
    model_fetch_supported: true,
    generation_adapter: "local-agent-runtime",
    local_provider: true,
    credential_label: "bridge command",
    credential_placeholder: "Auto-filled Lycium bridge command",
    credential_default: "python3 services/lycium-api/scripts/agent_runtime_bridge.py --runtime codex",
    credential_kind: "local_runtime",
    contract: {
      provider_kind: "agent_runtime",
      credential_kind: "local_runtime",
      generation_adapter: "local-agent-runtime",
      requires_verified_connection: true,
      supports_model_list: true,
      supports_json_mode: true,
      supports_streaming: false,
      supports_tool_use: false,
      supports_usage_metadata: false,
      model_source: "runtime_bridge",
      capabilities: {
        agent_runtime: true,
        local_execution: true,
        runtime_bridge: true,
      },
    },
  },
];

const browserStorage = createBrowserStorageRepository();

const isLocalAgentKey = (key: AgentKeyRecord | undefined, providers: AgentProviderRecord[]) => {
  if (!key) return false;
  return Boolean(providers.find((provider) => provider.id === key.provider_id)?.local_provider);
};

const activeAgentKey = (settings: { agent_keys?: AgentKeyRecord[] }) =>
  (settings.agent_keys ?? []).find((key: AgentKeyRecord) => key.is_active);

const localEndpointPattern = /^(https?:\/\/)?(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?(\/.*)?$/i;

function providerExists(providers: AgentProviderRecord[], providerId: string) {
  return providers.some((provider) => provider.id === providerId);
}

function detectedProviderIdFromCredential(credential: string, providers: AgentProviderRecord[]): string | null {
  const trimmedCredential = credential.trim();
  if (!trimmedCredential) {
    return null;
  }

  const candidates: Array<[RegExp, string]> = [
    [localEndpointPattern, "local-model"],
    [/^sk-or-v1-/i, "openrouter"],
    [/^sk-ant-/i, "anthropic"],
    [/^AIza[a-z0-9_-]{16,}$/i, "google-gemini"],
    [/^sk-(proj-|svcacct-|admin-)/i, "openai"],
    [/^sk-[a-z0-9_-]{20,}$/i, "openai"],
  ];

  for (const [pattern, providerId] of candidates) {
    if (pattern.test(trimmedCredential) && providerExists(providers, providerId)) {
      return providerId;
    }
  }

  return null;
}

const errorMessage = (err: unknown) => (err instanceof Error ? err.message : "");

const isInvalidCredentialError = (err: unknown) => {
  const message = errorMessage(err).toLowerCase();
  return message.includes("api key invalid") || message.includes("invalid api key");
};

export function useAgentSettings(routeKind: string, apiBase: string) {
  const lyciumApi = useMemo(() => createLyciumLocalApi(apiBase), [apiBase]);
  const [agentProviders, setAgentProviders] = useState<AgentProviderRecord[]>(DEFAULT_AGENT_PROVIDERS);
  const [agentProviderId, setAgentProviderId] = useState("");
  const [agentApiKey, setAgentApiKey] = useState("");
  const [agentKeys, setAgentKeys] = useState<AgentKeyRecord[]>([]);
  const [apiKeySaveStatus, setApiKeySaveStatus] = useState<"idle" | "loading" | "invalid">("idle");
  const [verifyingAgentKeyId, setVerifyingAgentKeyId] = useState<string | null>(null);
  const [settingsStatus, setSettingsStatus] = useState<"idle" | "loading" | "error" | "success">("idle");
  const [settingsMessage, setSettingsMessage] = useState("");
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    return browserStorage.readThemeMode() ?? "auto";
  });

  const handleSettingsSubmit = async (evt: FormEvent<HTMLFormElement>) => {
    evt.preventDefault();
    const trimmedKey = agentApiKey.trim();
    if (!agentProviderId) {
      setSettingsStatus("error");
      setSettingsMessage("Choose a provider before saving.");
      return;
    }
    if (!trimmedKey) {
      const selectedProvider = agentProviders.find((provider) => provider.id === agentProviderId);
      setSettingsStatus("error");
      setSettingsMessage(`Enter a ${selectedProvider?.credential_label ?? "api key"} before saving.`);
      return;
    }

    setApiKeySaveStatus("loading");
    setSettingsStatus("loading");
    setSettingsMessage("");

    try {
      const selectedProvider = agentProviders.find((provider) => provider.id === agentProviderId);
      const providerIdForCredential =
        !selectedProvider?.local_provider &&
        localEndpointPattern.test(trimmedKey) &&
        agentProviders.some((provider) => provider.id === "local-model")
          ? "local-model"
          : agentProviderId;
      const settings = await lyciumApi.saveSettings({
        provider_id: providerIdForCredential,
        agent_api_key: trimmedKey,
      });
      const activeKey = activeAgentKey(settings);
      setAgentApiKey(isLocalAgentKey(activeKey, agentProviders) ? activeKey?.key_preview ?? trimmedKey : "");
      setApiKeySaveStatus("idle");
      setAgentKeys(settings.agent_keys ?? []);
      if (activeKey?.provider_id) {
        setAgentProviderId(activeKey.provider_id);
      }
      setSettingsStatus("success");
      if (activeKey?.connection_status === "unverified") {
        setSettingsMessage(`${activeKey.provider_label} saved, but Lycium could not verify it yet.`);
      } else {
        setSettingsMessage("");
      }
    } catch (err) {
      console.warn("Unable to save settings:", err);
      setSettingsStatus("error");
      if (isInvalidCredentialError(err)) {
        setAgentApiKey("");
        setApiKeySaveStatus("invalid");
        setSettingsMessage("");
      } else {
        setAgentApiKey(trimmedKey);
        setApiKeySaveStatus("idle");
        setSettingsMessage(
          localEndpointPattern.test(trimmedKey)
            ? "Could not reach the Lycium API to save this local model path. Start the API and try again."
            : errorMessage(err) || "Could not save settings. Is the Lycium API running?"
        );
      }
    }
  };

  const handleActivateAgentKey = async (keyId: string) => {
    setSettingsStatus("loading");
    setSettingsMessage("Switching active key...");

    try {
      const settings = await lyciumApi.activateAgentKey({ key_id: keyId });
      setAgentKeys(settings.agent_keys ?? []);
      setSettingsStatus("success");
      setSettingsMessage("");
    } catch (err) {
      console.warn("Unable to activate key:", err);
      setSettingsStatus("error");
      setSettingsMessage("Could not switch keys. Is the API running?");
    }
  };

  const handleAgentModelChange = async (keyId: string, model: string) => {
    setSettingsStatus("loading");
    setSettingsMessage("Updating model...");

    try {
      const settings = await lyciumApi.updateAgentKeyModel({ key_id: keyId, model });
      setAgentKeys(settings.agent_keys ?? []);
      setSettingsStatus("success");
      setSettingsMessage("");
    } catch (err) {
      console.warn("Unable to update model:", err);
      setSettingsStatus("error");
      setSettingsMessage("Could not update that model.");
    }
  };

  const handleVerifyAgentKey = async (keyId: string) => {
    setVerifyingAgentKeyId(keyId);
    setSettingsStatus("loading");
    setSettingsMessage("Verifying connection...");

    try {
      const settings = await lyciumApi.verifyAgentKey({ key_id: keyId });
      const activeKey = activeAgentKey(settings);
      setAgentKeys(settings.agent_keys ?? []);
      if (activeKey?.provider_id) {
        setAgentProviderId(activeKey.provider_id);
      }
      setAgentApiKey(isLocalAgentKey(activeKey, agentProviders) ? activeKey?.key_preview ?? "" : "");
      setSettingsStatus(activeKey?.connection_status === "unverified" ? "error" : "success");
      setSettingsMessage(
        activeKey?.connection_status === "unverified"
          ? activeKey.last_error || activeKey.connection_message || "Connection could not be verified."
          : ""
      );
    } catch (err) {
      console.warn("Unable to verify key:", err);
      setSettingsStatus("error");
      setSettingsMessage(err instanceof Error ? err.message : "Could not verify that connection.");
    } finally {
      setVerifyingAgentKeyId(null);
    }
  };

  const handleDeleteAgentKey = async (keyId: string) => {
    setSettingsStatus("loading");
    setSettingsMessage("Deleting AI connection...");

    try {
      const settings = await lyciumApi.deleteAgentKey(keyId);
      const activeKey = activeAgentKey(settings);
      setAgentKeys(settings.agent_keys ?? []);
      if (activeKey?.provider_id) {
        setAgentProviderId(activeKey.provider_id);
      }
      setAgentApiKey(isLocalAgentKey(activeKey, agentProviders) ? activeKey?.key_preview ?? "" : "");
      setSettingsStatus("success");
      setSettingsMessage(activeKey ? "" : "AI connection deleted.");
    } catch (err) {
      console.warn("Unable to delete key:", err);
      setSettingsStatus("error");
      setSettingsMessage(err instanceof Error ? err.message : "Could not delete that AI connection.");
    }
  };

  const handleEditAgentKey = (key: AgentKeyRecord) => {
    setAgentProviderId(key.provider_id);
    setAgentApiKey(key.local_provider ? key.key_preview : "");
    setApiKeySaveStatus("idle");
    setSettingsStatus("idle");
    setSettingsMessage("");
  };

  const handleThemeModeChange = (mode: ThemeMode) => {
    setThemeMode(mode);
    browserStorage.writeThemeMode(mode);
  };

  const handleAgentProviderChange = (providerId: string) => {
    const selectedProvider = agentProviders.find((provider) => provider.id === providerId);
    setAgentProviderId(providerId);
    setAgentApiKey(selectedProvider?.credential_default ?? "");
    setApiKeySaveStatus("idle");
    setSettingsStatus("idle");
    setSettingsMessage("");
  };

  const handleAgentApiKeyChange = (apiKey: string) => {
    const detectedProviderId = detectedProviderIdFromCredential(apiKey, agentProviders);
    setAgentApiKey(apiKey);
    if (detectedProviderId && detectedProviderId !== agentProviderId) {
      setAgentProviderId(detectedProviderId);
    }
  };

  useLayoutEffect(() => {
    const root = document.documentElement;

    const applyResolvedTheme = (resolvedTheme: "light" | "dark") => {
      root.setAttribute("data-theme", resolvedTheme);
      root.setAttribute("data-theme-mode", themeMode);
      root.style.colorScheme = resolvedTheme;
    };

    if (themeMode !== "auto") {
      applyResolvedTheme(themeMode);
      return;
    }

    const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");
    const applySystemTheme = () => applyResolvedTheme(systemTheme.matches ? "dark" : "light");

    applySystemTheme();
    systemTheme.addEventListener("change", applySystemTheme);

    return () => {
      systemTheme.removeEventListener("change", applySystemTheme);
    };
  }, [themeMode]);

  useEffect(() => {
    if (!localApiSyncEnabled) {
      return;
    }

    let ignored = false;

    lyciumApi
      .loadSettings()
      .then((settings) => {
        if (!ignored) {
          const activeKey = activeAgentKey(settings);
          setAgentKeys(settings.agent_keys ?? []);
          if (activeKey?.provider_id) {
            setAgentProviderId(activeKey.provider_id);
          }
        }
      })
      .catch((err) => {
        if (!ignored) {
          console.warn("Unable to preload AI settings:", err);
        }
      });

    return () => {
      ignored = true;
    };
  }, [lyciumApi]);

  useEffect(() => {
    if (routeKind !== "settings") {
      return;
    }

    let ignored = false;
    setSettingsStatus("loading");
    setSettingsMessage("");

    Promise.all([lyciumApi.loadAgentProviders(), lyciumApi.loadSettings()])
      .then(([providers, settings]) => {
        if (ignored) return;
        const loadedProviders =
          Array.isArray(providers) && providers.length > 0 ? providers : DEFAULT_AGENT_PROVIDERS;
        const activeKey = activeAgentKey(settings);
        setSettingsStatus("idle");
        setAgentProviders(loadedProviders);
        setAgentProviderId((currentProviderId) =>
          activeKey?.provider_id && loadedProviders.some((provider) => provider.id === activeKey.provider_id)
            ? activeKey.provider_id
            : currentProviderId && loadedProviders.some((provider) => provider.id === currentProviderId)
              ? currentProviderId
              : ""
        );
        setAgentApiKey(isLocalAgentKey(activeKey, loadedProviders) ? activeKey?.key_preview ?? "" : "");
        setAgentKeys(settings.agent_keys ?? []);
        setSettingsMessage(
          activeKey?.connection_status === "unverified"
            ? `${activeKey.provider_label} is saved but not verified yet.`
            : ""
        );
      })
      .catch((err) => {
        if (ignored) return;
        console.warn("Unable to load settings:", err);
        setAgentProviders(DEFAULT_AGENT_PROVIDERS);
        setAgentProviderId((currentProviderId) =>
          currentProviderId && DEFAULT_AGENT_PROVIDERS.some((provider) => provider.id === currentProviderId)
            ? currentProviderId
            : ""
        );
        setSettingsStatus("error");
        setSettingsMessage("");
      });

    return () => {
      ignored = true;
    };
  }, [routeKind, lyciumApi]);

  const isSavingAgentKey = apiKeySaveStatus === "loading";
  const canAddAgentKey = Boolean(agentProviderId && agentApiKey.trim()) && !isSavingAgentKey;

  return {
    agentProviders,
    agentProviderId,
    agentApiKey,
    agentKeys,
    apiKeySaveStatus,
    verifyingAgentKeyId,
    canAddAgentKey,
    settingsStatus,
    settingsMessage,
    themeMode,
    handleActivateAgentKey,
    handleAgentModelChange,
    handleEditAgentKey,
    handleVerifyAgentKey,
    handleDeleteAgentKey,
    handleSettingsSubmit,
    handleThemeModeChange,
    setAgentApiKey: handleAgentApiKeyChange,
    setAgentProviderId: handleAgentProviderChange,
    setApiKeySaveStatus,
  };
}
