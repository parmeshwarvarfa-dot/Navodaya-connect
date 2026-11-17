import React, { useEffect, useRef } from "react";
import Map, { Marker, NavigationControl } from "react-map-gl/maplibre";
import type { MapRef } from "react-map-gl/maplibre";
// MapLibre's stylesheet is loaded by the web shell; importing it here breaks
// Metro's package resolver on mobile/web previews.
import type { JnvMapSchool } from "@/lib/jnv-map-data";
import type { MapViewRequest } from "./map-types";

type Props = {
  schools: JnvMapSchool[];
  selectedId: string | null;
  request?: MapViewRequest;
  onSelect: (school: JnvMapSchool) => void;
  onMapReady: () => void;
  onMapError: (message: string) => void;
};

const styleUrl = process.env.EXPO_PUBLIC_MAP_STYLE_URL || "https://demotiles.maplibre.org/style.json";

export default function MapCanvas({ schools, selectedId, request, onSelect, onMapReady, onMapError }: Props) {
  const mapRef = useRef<MapRef>(null);

  useEffect(() => {
    if (!request || !mapRef.current) return;
    const map = mapRef.current;
    if (request.bounds) {
      map.fitBounds(request.bounds, { padding: 48, duration: 700, maxZoom: 11 });
    } else if (request.center) {
      map.flyTo({ center: request.center, zoom: request.zoom ?? 10, duration: 700 });
    }
  }, [request?.id]);

  return <div style={{ width: "100%", height: "100%", position: "relative" }}>
    <Map
      ref={mapRef}
      initialViewState={{ longitude: 82.8, latitude: 22.9, zoom: 4.1 }}
      mapStyle={styleUrl}
      style={{ width: "100%", height: "100%" }}
      onLoad={onMapReady}
      onError={(event) => onMapError(event.error?.message || "Map tiles could not be loaded.")}
      reuseMaps
      attributionControl={{ compact: true }}
    >
      <NavigationControl position="top-right" showCompass={false} />
      {schools.map((school) => <Marker
        key={school.id}
        longitude={school.longitude}
        latitude={school.latitude}
        anchor="bottom"
        onClick={(event) => { event.originalEvent.stopPropagation(); onSelect(school); }}
      >
        <button
          type="button"
          aria-label={`Select ${school.name}`}
          title={school.name}
          style={{
            width: selectedId === school.id ? 34 : 28,
            height: selectedId === school.id ? 34 : 28,
            borderRadius: "50% 50% 50% 0",
            transform: "rotate(-45deg)",
            border: "2px solid white",
            transition: "width 150ms ease, height 150ms ease, background-color 150ms ease, box-shadow 150ms ease",
            background: selectedId === school.id ? "#E34E55" : "#7C3AED",
            boxShadow: "0 2px 9px #17203355",
            cursor: "pointer",
            display: "grid",
            placeItems: "center",
            padding: 0,
          }}
        ><span style={{ transform: "rotate(45deg)", color: "white", fontWeight: 800, fontSize: 11 }}>J</span></button>
      </Marker>)}
    </Map>
  </div>;
}
