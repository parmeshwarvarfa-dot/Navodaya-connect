function slug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function makeJnvId(state: string, schoolName: string) {
  const canonicalName = schoolName
    .replace(/^Jawahar Navodaya Vidyalaya\s*,\s*/i, "")
    .replace(/^JNV\s+/i, "")
    .trim();
  return `jnv:${slug(state)}:${slug(canonicalName)}`;
}
