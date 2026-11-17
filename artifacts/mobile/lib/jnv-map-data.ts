export type JnvMapSchool = {
  id: string;
  name: string;
  district: string;
  state: string;
  latitude: number;
  longitude: number;
  osmObject: string;
  sourceUrl: string;
};

/**
 * Small prototype dataset from mapped OSM school features. This is not a
 * complete or NVS-verified national directory; each point links to its OSM
 * object so the source and location can be reviewed.
 */
export const JNV_MAP_PILOT_SCHOOLS: JnvMapSchool[] = [
  {
    id: "osm-node-6310942341",
    name: "JNV Deoghar",
    district: "Deoghar",
    state: "Jharkhand",
    latitude: 24.55319,
    longitude: 86.72896,
    osmObject: "node/6310942341",
    sourceUrl: "https://www.openstreetmap.org/node/6310942341",
  },
  {
    id: "osm-node-6302864750",
    name: "JNV Ashoknagar",
    district: "Ashoknagar",
    state: "Madhya Pradesh",
    latitude: 24.79337,
    longitude: 77.76895,
    osmObject: "node/6302864750",
    sourceUrl: "https://www.openstreetmap.org/node/6302864750",
  },
  {
    id: "osm-way-798490190",
    name: "JNV Ernakulam",
    district: "Ernakulam",
    state: "Kerala",
    latitude: 10.05401,
    longitude: 76.77579,
    osmObject: "way/798490190",
    sourceUrl: "https://www.openstreetmap.org/way/798490190",
  },
  {
    id: "osm-node-6698737254",
    name: "JNV Barnala",
    district: "Barnala",
    state: "Punjab",
    latitude: 30.33131,
    longitude: 75.35588,
    osmObject: "node/6698737254",
    sourceUrl: "https://www.openstreetmap.org/node/6698737254",
  },
  {
    id: "osm-way-663468473",
    name: "JNV West Sikkim",
    district: "Soreng",
    state: "Sikkim",
    latitude: 27.16385,
    longitude: 88.294,
    osmObject: "way/663468473",
    sourceUrl: "https://www.openstreetmap.org/way/663468473",
  },
];

export function hasValidCoordinates(school: Pick<JnvMapSchool, "latitude" | "longitude">) {
  return Number.isFinite(school.latitude)
    && Number.isFinite(school.longitude)
    && school.latitude >= -90
    && school.latitude <= 90
    && school.longitude >= -180
    && school.longitude <= 180;
}
