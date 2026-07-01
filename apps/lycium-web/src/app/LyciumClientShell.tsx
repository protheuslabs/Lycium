"use client";

import LyciumApp from "../App";

type LyciumClientShellProps = {
  initialPath?: string;
};

export default function LyciumClientShell({ initialPath }: LyciumClientShellProps) {
  return <LyciumApp initialPath={initialPath} />;
}
