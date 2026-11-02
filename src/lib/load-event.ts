import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { BaseData } from "./types";

const read = async <T,>(file: string): Promise<T> =>
  JSON.parse(await readFile(path.join(process.cwd(), "public/data", file), "utf8")) as T;

/** Generated files in public/data are the base dataset; admin overrides layer on top client-side. */
export async function loadBaseData(): Promise<BaseData> {
  "use cache";
  const [event, route, landmarks, facilities, restAreas, corridor, content] = await Promise.all([
    read<BaseData["event"]>("event.json"),
    read<BaseData["route"]>("urban-walk-route.geojson"),
    read<BaseData["landmarks"]>("urban-walk-landmarks.geojson"),
    read<BaseData["facilities"]>("urban-walk-facilities.geojson"),
    read<BaseData["restAreas"]>("urban-walk-rest-areas.geojson"),
    read<BaseData["corridor"]>("urban-walk-corridor.geojson"),
    read<{ landmarks: BaseData["content"] }>("landmark-content.json"),
  ]);
  return { event, route, landmarks, facilities, restAreas, corridor, content: content.landmarks };
}
