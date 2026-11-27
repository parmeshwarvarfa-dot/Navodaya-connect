import React from "react";
import Map, { Marker, NavigationControl } from "react-map-gl/maplibre";
import type { VenueMapCanvasProps } from "./VenueMapCanvas";

const styleUrl = process.env.EXPO_PUBLIC_MAP_STYLE_URL || "https://demotiles.maplibre.org/style.json";

export default function VenueMapCanvas({ selectedCoordinate, onCoordinateSelect }: VenueMapCanvasProps) {
  return (
    <div style={{ height: 300, width: "100%", overflow: "hidden", borderRadius: 14 }}>
      <Map
        initialViewState={{ longitude: 82.8, latitude: 22.9, zoom: 4.1 }}
        mapStyle={styleUrl}
        style={{ width: "100%", height: "100%" }}
        attributionControl={{ compact: true }}
        onClick={(event) => onCoordinateSelect([event.lngLat.lng, event.lngLat.lat])}
      >
        <NavigationControl position="top-right" showCompass={false} />
        {selectedCoordinate ? (
          <Marker longitude={selectedCoordinate[0]} latitude={selectedCoordinate[1]} color="#7C3AED" />
        ) : null}
      </Map>
    </div>
  );
}
