"use client";

import dynamic from "next/dynamic";

const LyciumApp = dynamic(() => import("../App"), {
  ssr: false,
});

export default function LyciumClientShell() {
  return <LyciumApp />;
}
