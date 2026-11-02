import { Suspense } from "react";
import { LandmarkScreen } from "@/components/landmark/landmark-screen";
import { loadBaseData } from "@/lib/load-event";

export async function generateStaticParams() {
  const base = await loadBaseData();
  return [...base.landmarks.features, ...base.facilities.features].map((f) => ({ id: f.properties.id }));
}

async function Landmark({ params }: { params: PageProps<"/landmark/[id]">["params"] }) {
  const { id } = await params;
  return <LandmarkScreen id={id} />;
}

export default function LandmarkPage({ params }: PageProps<"/landmark/[id]">) {
  return (
    <Suspense fallback={<div className="h-[64dvh] bg-uw-charcoal" />}>
      <Landmark params={params} />
    </Suspense>
  );
}
