import { memo } from "react";
import ProgressBar from "../ProgressBar/ProgressBar";

type ProgressMeterProps = {
  progressPercentage: number;
  viewedPercentage: number;
  cacheKey: string;
};

type ProgressMeterValues = {
  complete: number;
  viewed: number;
};

const stableProgressValues = new Map<string, ProgressMeterValues>();

function normalizePercentage(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(value * 100) / 100));
}

function hasRealProgress(values: ProgressMeterValues) {
  return values.complete > 0 || values.viewed > 0;
}

function ProgressMeter({ progressPercentage, viewedPercentage, cacheKey }: ProgressMeterProps) {
  const complete = normalizePercentage(progressPercentage);
  const viewed = normalizePercentage(viewedPercentage);
  const incomingValues = { complete, viewed };
  const previousValues = stableProgressValues.get(cacheKey);
  const displayValues =
    previousValues && hasRealProgress(previousValues) && !hasRealProgress(incomingValues)
      ? previousValues
      : incomingValues;
  const valuesChanged =
    !previousValues ||
    previousValues.complete !== displayValues.complete ||
    previousValues.viewed !== displayValues.viewed;

  if (valuesChanged) {
    stableProgressValues.set(cacheKey, displayValues);
  }

  return (
    <div className="progress-meter">
      <ProgressBar complete={displayValues.complete} viewed={displayValues.viewed} animate={valuesChanged} />
      <p className="progress-percentage">
        {Math.round(displayValues.complete)}% complete · {Math.round(displayValues.viewed)}% viewed
      </p>
    </div>
  );
}

export default memo(
  ProgressMeter,
  (prev, next) =>
    prev.cacheKey === next.cacheKey &&
    normalizePercentage(prev.progressPercentage) === normalizePercentage(next.progressPercentage) &&
    normalizePercentage(prev.viewedPercentage) === normalizePercentage(next.viewedPercentage),
);
