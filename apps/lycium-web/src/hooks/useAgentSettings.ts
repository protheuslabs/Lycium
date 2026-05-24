import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { AgentKeyRecord, AgentProviderRecord, ThemeMode } from "../courseTypes";

const DEFAULT_AGENT_PROVIDERS: AgentProviderRecord[] = [
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

export function useAgentSettings(routeKind: string, apiBase: string) {
  const [agentProviders, setAgentProviders] = useState<AgentProviderRecord[]>(DEFAULT_AGENT_PROVIDERS);
  const [agentProviderId, setAgentProviderId] = useState("openai");
  const [agentApiKey, setAgentApiKey] = useState("");
  const [agentKeys, setAgentKeys] = useState<AgentKeyRecord[]>([]);
  const [apiKeySaveStatus, setApiKeySaveStatus] = useState<"idle" | "loading" | "invalid">("idle");
  const [settingsStatus, setSettingsStatus] = useState<"idle" | "loading" | "error" | "success">("idle");
  const [settingsMessage, setSettingsMessage] = useState("");
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    const storedTheme = localStorage.getItem("lycium-theme-mode");
    return storedTheme === "light" || storedTheme === "dark" || storedTheme === "auto" ? storedTheme : "auto";
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
      setSettingsStatus("error");
      setSettingsMessage("Enter an API key before saving.");
      return;
    }

    setApiKeySaveStatus("loading");
    setSettingsStatus("loading");
    setSettingsMessage("");

    try {
      const response = await fetch(`${apiBase}/v1/local/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider_id: agentProviderId, agent_api_key: trimmedKey }),
      });
      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        throw new Error(errorBody?.detail ?? "Settings save failed");
      }

      const settings = await response.json();
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
      const response = await fetch(`${apiBase}/v1/local/settings/active-key`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key_id: keyId }),
      });
      if (!response.ok) {
        throw new Error("Active key update failed");
      }

      const settings = await response.json();
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
      const response = await fetch(`${apiBase}/v1/local/settings/key-model`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key_id: keyId, model }),
      });
      if (!response.ok) {
        throw new Error("Model update failed");
      }

      const settings = await response.json();
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
    localStorage.setItem("lycium-theme-mode", mode);
  };

  useEffect(() => {
    const root = document.documentElement;

    const applyResolvedTheme = (resolvedTheme: "light" | "dark") => {
      root.setAttribute("data-theme", resolvedTheme);
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
    if (routeKind !== "settings") {
      return;
    }

    let ignored = false;
    setSettingsStatus("loading");
    setSettingsMessage("Loading settings...");

    Promise.all([
      fetch(`${apiBase}/v1/local/ai/providers`).then((response) => {
        if (!response.ok) throw new Error("AI providers unavailable");
        return response.json();
      }),
      fetch(`${apiBase}/v1/local/settings`).then((response) => {
        if (!response.ok) throw new Error("Settings unavailable");
        return response.json();
      }),
    ])
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
        setSettingsMessage(
          activeKey ? `${activeKey.provider_label} is active with ${activeKey.model ?? "no model selected"}.` : "No agent API key saved yet."
        );
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
  }, [routeKind, apiBase]);

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
    setAgentProviderId,
    setApiKeySaveStatus,
  };
}
