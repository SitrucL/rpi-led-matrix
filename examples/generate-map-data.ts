/**
 * One-time generator: fetches Natural Earth 110m land polygons and rasterizes
 * them into a 256×64 equirectangular bitmap encoded as hex strings.
 *
 * Usage:  npx ts-node examples/generate-map-data.ts
 * Output: hex array + ASCII art to stdout
 */

const GEOJSON_URL =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_land.geojson';

const WIDTH = 256;
const HEIGHT = 64;
const ROW_BYTES = WIDTH / 8;

// ── GeoJSON types (minimal) ─────────────────────────────────────────────────

interface GeoJsonPolygon {
  type: 'Polygon';
  coordinates: number[][][];
}

interface GeoJsonMultiPolygon {
  type: 'MultiPolygon';
  coordinates: number[][][][];
}

interface GeoJsonFeature {
  type: 'Feature';
  geometry: GeoJsonPolygon | GeoJsonMultiPolygon;
}

interface GeoJsonFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJsonFeature[];
}

// ── Point-in-polygon (ray casting) ──────────────────────────────────────────

const pointInRing = (px: number, py: number, ring: number[][]): boolean => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
};

const pointInPolygon = (px: number, py: number, rings: number[][][]): boolean => {
  if (!pointInRing(px, py, rings[0])) return false;
  for (let i = 1; i < rings.length; i++) {
    if (pointInRing(px, py, rings[i])) return false;
  }
  return true;
};

const pointInMultiPolygon = (
  px: number,
  py: number,
  polygons: number[][][][]
): boolean => polygons.some(rings => pointInPolygon(px, py, rings));

// ── Fetch & rasterize ───────────────────────────────────────────────────────

const fetchGeoJson = async (): Promise<GeoJsonFeatureCollection> => {
  const res = await fetch(GEOJSON_URL);
  if (!res.ok) throw new Error(`Failed to fetch GeoJSON: ${res.status}`);
  return res.json() as Promise<GeoJsonFeatureCollection>;
};

const rasterize = (geojson: GeoJsonFeatureCollection): Uint8Array => {
  const bitmap = new Uint8Array(HEIGHT * ROW_BYTES);

  const allPolygons: number[][][][] = [];
  for (const feature of geojson.features) {
    const { geometry } = feature;
    if (geometry.type === 'Polygon') {
      allPolygons.push(geometry.coordinates);
    } else if (geometry.type === 'MultiPolygon') {
      allPolygons.push(...geometry.coordinates);
    }
  }

  for (let y = 0; y < HEIGHT; y++) {
    const lat = 90 - ((y + 0.5) / HEIGHT) * 180;
    for (let x = 0; x < WIDTH; x++) {
      const lon = ((x + 0.5) / WIDTH) * 360 - 180;
      const isLand = allPolygons.some(rings => pointInPolygon(lon, lat, rings));
      if (isLand) {
        const byteIndex = y * ROW_BYTES + (x >> 3);
        const bit = 7 - (x & 7);
        bitmap[byteIndex] |= 1 << bit;
      }
    }
  }

  return bitmap;
};

// ── Encode to hex strings ───────────────────────────────────────────────────

const bitmapToHexRows = (bitmap: Uint8Array): string[] => {
  const rows: string[] = [];
  for (let y = 0; y < HEIGHT; y++) {
    let hex = '';
    for (let b = 0; b < ROW_BYTES; b++) {
      hex += bitmap[y * ROW_BYTES + b].toString(16).padStart(2, '0');
    }
    rows.push(hex);
  }
  return rows;
};

// ── ASCII art visualization ─────────────────────────────────────────────────

const printAscii = (bitmap: Uint8Array): void => {
  for (let y = 0; y < HEIGHT; y++) {
    let line = '';
    for (let x = 0; x < WIDTH; x++) {
      const byteIndex = y * ROW_BYTES + (x >> 3);
      const bit = 7 - (x & 7);
      line += (bitmap[byteIndex] >> bit) & 1 ? '#' : '.';
    }
    console.log(line);
  }
};

// ── Main ────────────────────────────────────────────────────────────────────

const main = async (): Promise<void> => {
  console.log('Fetching Natural Earth 110m land polygons...');
  const geojson = await fetchGeoJson();
  console.log(`Got ${geojson.features.length} features\n`);

  console.log('Rasterizing to %dx%d...', WIDTH, HEIGHT);
  const bitmap = rasterize(geojson);

  let landCount = 0;
  for (let i = 0; i < bitmap.length; i++) {
    for (let b = 0; b < 8; b++) {
      if ((bitmap[i] >> b) & 1) landCount++;
    }
  }
  console.log(
    'Land pixels: %d / %d (%.1f%%)\n',
    landCount,
    WIDTH * HEIGHT,
    (landCount / (WIDTH * HEIGHT)) * 100
  );

  console.log('=== ASCII preview ===\n');
  printAscii(bitmap);

  const hexRows = bitmapToHexRows(bitmap);
  console.log('\n=== Hex data (paste into map-mask-world.ts) ===\n');
  console.log('export const WORLD_MAP_ROWS_HEX: readonly string[] = [');
  for (const row of hexRows) {
    console.log(`  '${row}',`);
  }
  console.log('] as const;');
};

main().catch(err => {
  console.error('Fatal:', err);
  process.exitCode = 1;
});
