// Replaceable map configuration. Any OpenMapTiles-schema vector style works;
// the 3D layer reads `building.render_height` from source "openmaptiles".
export const BASEMAP_STYLE = process.env.NEXT_PUBLIC_BASEMAP_STYLE ?? "https://tiles.openfreemap.org/styles/positron";
export const BASEMAP_STYLE_DARK = process.env.NEXT_PUBLIC_BASEMAP_STYLE_DARK ?? "https://tiles.openfreemap.org/styles/dark";
export const VECTOR_SOURCE = "openmaptiles";
export const BUILDING_LAYER = "building";

export const ZOOM_TIERS = { mid: 15.2, close: 16.6 } as const;
export const MIN_3D_ZOOM = 14.5;
export const PITCH_3D = 56;

const LIGHT = {
  blue: "#004b87", // route
  green: "#319b24", // rest areas
  ink: "#141518", // walked dashes
  casing: "#ffffff", // halo under the route
  corridor: "rgba(255, 255, 255, 0.42)",
  background: "#eceef1",
  water: "#c3d4e4",
  park: "#d7e8d1",
  building2d: "#e1e4e8",
  building3d: "#fbfbfc",
  road: "#ffffff",
  label: "#7b8796",
};

// brand blue is 2:1 on dark tiles, so the route uses a lifted blue (5.2:1)
const DARK: typeof LIGHT = {
  blue: "#3f8fdb",
  green: "#3fae31",
  ink: "#eef0f3",
  casing: "#0e1012",
  corridor: "rgba(255, 255, 255, 0.05)",
  background: "#15181b",
  water: "#1b2733",
  park: "#18261a",
  building2d: "#22262b",
  building3d: "#343a41",
  road: "#2a2f35",
  label: "#8a94a0",
};

export const MAP_COLORS = { light: LIGHT, dark: DARK };
export type MapColors = typeof LIGHT;
