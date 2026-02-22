export const WORLD_MAP_WIDTH = 128;
export const WORLD_MAP_HEIGHT = 32;

export const WORLD_MAP_ROWS_HEX: readonly string[] = [
  '00000000000000000000000000000000',
  '00000007ffffff8003c0c00070000000',
  '00000780f0ffff8004000803ff000000',
  '07ffffffff0fff0003f837ffffffffff',
  'ffffffffc7c7e1e01fffffffffffffff',
  '07fffffe0fc080033efffffffffffff8',
  '04007fffeff0000fffffffffffffe1c0',
  '00001fffffd80001fffffffffffff000',
  '00000ffffe800007ffffffffffff3000',
  '00000ffff8000007fdffffffffedc000',
  '000003fff000000ffffffffffff20000',
  '000001fc1800003fffffffffffe00000',
  '0080003f8e80003ffffff87e7d100000',
  '00000001e000003fffffe0383e200000',
  '000000006fe0001fffffc01814380000',
  '000000000ffc00001fff800039c00000',
  '000000001fffe0001ffe00000df3f000',
  '000000001ffff0000ffc000003287d00',
  '000000000fffe0000ffec000000fb000',
  '0000000001ffc0000ff9c000007ff820',
  '0000000001ff000007f9800000fffe00',
  '0000000003f0000003e00000007ffe00',
  '0000000003f00000000000000000fc07',
  '0000000007c00000000000000000000e',
  '00000000070000000000000008000018',
  '00000000078000000000000000000000',
  '00000000000000000000000000000000',
  '0000000000c000000000300008808000',
  '0000000007c0000ffffffffffffffff8',
  '01ffffffffc007ffffffffffffffffe0',
  '007fffffffffffffffffffffffffffe0',
  'ffffffffffffffffffffffffffffffff',
] as const;

export interface WorldMask {
  readonly width: number;
  readonly height: number;
  isLand(x: number, y: number): boolean;
}

const ROW_BYTES = WORLD_MAP_WIDTH / 8;

export const decodeWorldMapRowsHex = (rows: readonly string[]): Uint8Array => {
  if (rows.length !== WORLD_MAP_HEIGHT) {
    throw new Error(`Expected ${WORLD_MAP_HEIGHT} rows, got ${rows.length}`);
  }

  const bytes = new Uint8Array(WORLD_MAP_HEIGHT * ROW_BYTES);

  rows.forEach((row, rowIndex) => {
    if (row.length !== ROW_BYTES * 2) {
      throw new Error(`Row ${rowIndex} expected ${ROW_BYTES * 2} hex chars, got ${row.length}`);
    }

    for (let i = 0; i < ROW_BYTES; i += 1) {
      const value = Number.parseInt(row.slice(i * 2, i * 2 + 2), 16);
      if (Number.isNaN(value)) {
        throw new Error(`Invalid hex in row ${rowIndex}`);
      }
      bytes[rowIndex * ROW_BYTES + i] = value;
    }
  });

  return bytes;
};

export const createWorldMask = (): WorldMask => {
  const bytes = decodeWorldMapRowsHex(WORLD_MAP_ROWS_HEX);

  return {
    width: WORLD_MAP_WIDTH,
    height: WORLD_MAP_HEIGHT,
    isLand(x: number, y: number): boolean {
      const wrappedX = ((Math.floor(x) % WORLD_MAP_WIDTH) + WORLD_MAP_WIDTH) % WORLD_MAP_WIDTH;
      const clampedY = Math.max(0, Math.min(WORLD_MAP_HEIGHT - 1, Math.floor(y)));
      const byteIndex = clampedY * ROW_BYTES + (wrappedX >> 3);
      const bit = 7 - (wrappedX & 7);
      return ((bytes[byteIndex] >> bit) & 1) === 1;
    },
  };
};
