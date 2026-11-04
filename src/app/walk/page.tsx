import { Suspense } from "react";
import { WalkScreen } from "@/components/walk/walk-screen";

export default function WalkPage() {
  return (
    <Suspense fallback={<div className="h-dvh bg-uw-paper" />}>
      <WalkScreen />
    </Suspense>
  );
}
