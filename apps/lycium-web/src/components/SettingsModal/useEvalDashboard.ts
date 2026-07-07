import { useCallback, useEffect, useState } from "react";
import type { LyciumGenerationEvalTrend, LyciumGenerationRun } from "@lycium/data-access";
import { lyciumApi } from "../../runtime/appRuntime";

type EvalDashboardState = {
  runs: LyciumGenerationRun[];
  evalTrend: LyciumGenerationEvalTrend | null;
  loadState: "loading" | "error" | "success";
  message: string;
};

type EvalDashboardLoadResult = Omit<EvalDashboardState, "runs" | "evalTrend"> & {
  runs?: LyciumGenerationRun[];
  evalTrend?: LyciumGenerationEvalTrend | null;
};

const MAX_EVAL_RUNS = 12;

async function requestEvalDashboard(): Promise<EvalDashboardLoadResult> {
  const [runResult, trendResult] = await Promise.allSettled([
    lyciumApi.listGenerationRuns({ limit: MAX_EVAL_RUNS }),
    lyciumApi.loadGenerationEvalTrend({ limit: MAX_EVAL_RUNS }),
  ]);
  const hasData = runResult.status === "fulfilled" || trendResult.status === "fulfilled";
  const error = runResult.status === "rejected"
    ? runResult.reason
    : trendResult.status === "rejected"
      ? trendResult.reason
      : null;

  return {
    ...(runResult.status === "fulfilled" ? { runs: runResult.value } : {}),
    ...(trendResult.status === "fulfilled" ? { evalTrend: trendResult.value.trend } : {}),
    loadState: hasData ? "success" : "error",
    message: error instanceof Error
      ? error.message
      : hasData && error
        ? "Some eval data is unavailable."
        : hasData
          ? ""
          : "Eval dashboard unavailable.",
  };
}

async function fetchEvalDashboard(): Promise<EvalDashboardLoadResult> {
  try {
    return await requestEvalDashboard();
  } catch (error) {
    return {
      loadState: "error",
      message: error instanceof Error ? error.message : "Eval dashboard unavailable.",
    };
  }
}

function mergeState(current: EvalDashboardState, result: EvalDashboardLoadResult): EvalDashboardState {
  return {
    runs: result.runs ?? current.runs,
    evalTrend: result.evalTrend === undefined ? current.evalTrend : result.evalTrend,
    loadState: result.loadState,
    message: result.message,
  };
}

export function useEvalDashboard() {
  const [dashboard, setDashboard] = useState<EvalDashboardState>({
    runs: [],
    evalTrend: null,
    loadState: "loading",
    message: "",
  });

  const refresh = useCallback(async () => {
    setDashboard((current) => ({ ...current, loadState: "loading", message: "" }));
    const result = await fetchEvalDashboard();
    setDashboard((current) => mergeState(current, result));
  }, []);

  useEffect(() => {
    let active = true;
    void fetchEvalDashboard().then((result) => {
      if (active) setDashboard((current) => mergeState(current, result));
    });
    return () => {
      active = false;
    };
  }, []);

  return { ...dashboard, refresh };
}
