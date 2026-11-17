export type MapViewRequest = {
  id: number;
  center?: [number, number];
  zoom?: number;
  bounds?: [[number, number], [number, number]];
};
