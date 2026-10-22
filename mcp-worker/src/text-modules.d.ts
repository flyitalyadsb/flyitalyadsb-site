// Files imported as text (or, *.webp, as bytes) by wrangler (`rules` in
// wrangler.jsonc; *.html is a default Text rule): the in-chat aircraft map,
// src/lib/mcp/apps/aircraft-map.ts.
declare module '*.html' {
  const text: string;
  export default text;
}
declare module '*.view.js' {
  const text: string;
  export default text;
}
declare module '*/leaflet/dist/leaflet.js' {
  const text: string;
  export default text;
}
declare module '*/leaflet/dist/leaflet.css' {
  const text: string;
  export default text;
}
declare module '*.webp' {
  const data: ArrayBuffer;
  export default data;
}
