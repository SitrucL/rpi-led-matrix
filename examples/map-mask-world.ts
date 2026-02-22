export const WORLD_MAP_WIDTH = 256;
export const WORLD_MAP_HEIGHT = 32;

export const WORLD_MAP_ROWS_HEX: readonly string[] = [
  '0000000000000000000000000000000000000000000000000000000000000000',
  '000000000000001ff7ffffffffffc0000007e000600000003e00000000000000',
  '0000000000198000ff00ffffffffc0000030000000c00007fffe000000000000',
  '001ffffffffffa7fffff00ffffff0000000fffc0071effffffffffffffffff7f',
  'ff7ffffffffffffff01ff03ffc01ac0003ffffffffffffffffffffffffffffff',
  '003ffefffffffffc007ff0008000000a0ff8fffffffffffffffffffffffdffc0',
  '001000001ffffffffcffff000000007f9ffffffffffffffffffffffff401e000',
  '0000000003fffffffffff1c000000001fffffffffffffffffffffffff6000000',
  '0000000000fffffffffc40000000003ffbfff7ffefffffffffffffff0e000000',
  '00000000007fffffffc000000000003fff61fffffffffffffffff873f0000000',
  '000000000007fffffe0000000000007ffffffffffffffffffffffe0400000000',
  '000000000001ffe002800000000007ffffffffbffffffffffffff80000000000',
  '00008000000007ffc0dc800000000fffffffffefffc02ffc3ff2020000000000',
  '0000000000000003f800000000000ffffffffffff800078007fc040000000000',
  '0000000000000000187ffc00000003fffffffffff00003400310098000000000',
  '000000000000000000fffff00000000003ffffffc00000000fc3f00000000000',
  '000000000000000003fffffff800000003fffffc0000000000e3e606fe000000',
  '000000000000000001fffffffe000000007ffff000000000000f04801fe10000',
  '0000000000000000007ffffff800000000fffff8700000000000007f86000000',
  '00000000000000000003fffff0000000007fffc1e000000000003fffffc00400',
  '00000000000000000003fffe00000000003fff81c000000000007ffffff80000',
  '0000000000000000000ffe0000000000000ffc000000000000003ffffff80000',
  '0000000000000000000ffe00000000000000000000000000000000007fe0001e',
  '0000000000000000001ff0000000000000000000000000000000000000000068',
  '0000000000000000003f00000000000000000000000000000040000000000180',
  '0000000000000000001fc0000000000000000000000000000000000000000000',
  '0000000000000000000000000000000000000000000000000000000000000000',
  '00000000000000000000700000000000000000000700000000c0800080000000',
  '0000000000000000001ef000000000ffffffffffffffdfffffffffffffffffc0',
  '0001e7ffffffffffffffe000003ffffffffffffffffffffffffffffffffffc00',
  '00001ffffffffffffffffdfffffffffffffffffffffffffffffffffffffffc00',
  'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
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
