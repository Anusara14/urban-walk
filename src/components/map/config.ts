// Replaceable map configuration. Any OpenMapTiles-schema vector style works;
// the 3D layer reads `building.render_height` from source "openmaptiles".
export const BASEMAP_STYLE = process.env.NEXT_PUBLIC_BASEMAP_STYLE ?? "https://tiles.openfreemap.org/styles/positron";
export const VECTOR_SOURCE = "openmaptiles";
export const BUILDING_LAYER = "building";

export const ZOOM_TIERS = { mid: 15.2, close: 16.6 } as const;
export const MIN_3D_ZOOM = 14.5;
export const PITCH_3D = 56;

export const COLORS = {
  yellow: "#ffe500",
  ink: "#141518",
  white: "#ffffff",
  background: "#eceef1",
  water: "#c5d2dc",
  park: "#dde5da",
  building2d: "#e1e4e8",
  building3d: "#fbfbfc",
  road: "#ffffff",
  label: "#7b8796",
};
