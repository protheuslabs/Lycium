import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { createBrowserStorageRepository, createLyciumLocalApi } from "@lycium/data-access";
import type { AgentKeyRecord, AgentProviderRecord, ThemeMode } from "../courseTypes";

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
];

const browserStorage = createBrowserStorageRepository();

export function useAgentSettings(routeKind: string, apiBase: string) {
  const lyciumApi = useMemo(() => createLyciumLocalApi(apiBase), [apiBase]);
  const [agentProviders, setAgentProviders] = useState<AgentProviderRecord[]>(DEFAULT_AGENT_PROVIDERS);
  const [agentProviderId, setAgentProviderId] = useState("openai");
  const [agentApiKey, setAgentApiKey] = useState("");
  const [agentKeys, setAgentKeys] = useState<AgentKeyRecord[]>([]);
  const [apiKeySaveStatus, setApiKeySaveStatus] = useState<"idle" | "loading" | "invalid">("idle");
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
      const settings = await lyciumApi.saveSettings({
        provider_id: agentProviderId,
        agent_api_key: trimmedKey,
      });
      const activeKey = (settings.agent_keys ?? []).find((key: AgentKeyRecord) => key.is_active);
      setAgentApiKey("");
      setApiKeySaveStatus("idle");
      setAgentKeys(settings.agent_keys ?? []);
      setSettingsStatus("success");
      setSettingsMessage(
        activeKey ? `${activeKey.provider_label} verified with ${activeKey.models?.length ?? 0} models.` : "API key verified."
      );
    } catch (err) {
      console.warn("Unable to save settings:", err);
      setAgentApiKey("");
      setApiKeySaveStatus("invalid");
      setSettingsStatus("error");
      setSettingsMessage("");
    }
  };

  const handleActivateAgentKey = async (keyId: string) => {
    setSettingsStatus("loading");
    setSettingsMessage("Switching active key...");

    try {
      const settings = await lyciumApi.activateAgentKey({ key_id: keyId });
      const activeKey = (settings.agent_keys ?? []).find((key: AgentKeyRecord) => key.is_active);
      setAgentKeys(settings.agent_keys ?? []);
      setSettingsStatus("success");
      setSettingsMessage(activeKey ? `${activeKey.provider_label} is now active.` : "Active key updated.");
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
      setSettingsMessage(`Model set to ${model}.`);
    } catch (err) {
      console.warn("Unable to update model:", err);
      setSettingsStatus("error");
      setSettingsMessage("Could not update that model.");
    }
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
    let ignored = false;

    lyciumApi
      .loadSettings()
      .then((settings) => {
        if (!ignored) {
          setAgentKeys(settings.agent_keys ?? []);
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
        const activeKey = (settings.agent_keys ?? []).find((key: AgentKeyRecord) => key.is_active);
        setSettingsStatus("idle");
        setAgentProviders(loadedProviders);
        setAgentProviderId((currentProviderId) =>
          loadedProviders.some((provider) => provider.id === currentProviderId)
            ? currentProviderId
            : loadedProviders[0]?.id || "openai"
        );
        setAgentKeys(settings.agent_keys ?? []);
        setSettingsMessage(activeKey ? `${activeKey.provider_label} is active with ${activeKey.model ?? "no model selected"}.` : "");
      })
      .catch((err) => {
        if (ignored) return;
        console.warn("Unable to load settings:", err);
        setAgentProviders(DEFAULT_AGENT_PROVIDERS);
        setAgentProviderId((currentProviderId) =>
          DEFAULT_AGENT_PROVIDERS.some((provider) => provider.id === currentProviderId)
            ? currentProviderId
            : DEFAULT_AGENT_PROVIDERS[0]?.id || "openai"
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
    canAddAgentKey,
    settingsStatus,
    settingsMessage,
    themeMode,
    handleActivateAgentKey,
    handleAgentModelChange,
    handleSettingsSubmit,
    handleThemeModeChange,
    setAgentApiKey,
    setAgentProviderId: handleAgentProviderChange,
    setApiKeySaveStatus,
  };
}
