import type { Viewport } from "next";
import { HomeScreen } from "@/components/home/home-screen";

// dark screen in both themes: status bar and Android toolbar match it
export const viewport: Viewport = { themeColor: "#141518" };

export default function Home() {
  return <HomeScreen />;
}
