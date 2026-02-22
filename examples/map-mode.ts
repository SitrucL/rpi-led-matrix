import { LedMatrix, LedMatrixInstance } from '../src';
import { matrixOptions, runtimeOptions } from './_config';
import {
  createWorldMask,
  type WorldMask,
  WORLD_MAP_HEIGHT,
  WORLD_MAP_WIDTH,
} from './map-mask-world';
import { getSunTimesForDate, getZonedDateTimeParts, type SunLocation } from './sun-times';

interface MapModeConfig {
  worldWidth: number;
  worldHeight: number;
  worldYStart: number;
  worldYEnd: number;
  frameMs: number;
  panPixelsPerSecond: number;
  lat: number;
  lng: number;
  timeZone: string;
  dayBrightness: number;
  nightBrightness: number;
  transitionMinutes: number;
  landColorHex: number;
  invertPolarity: boolean;
}

const wait = (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms));

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

const FALLBACK_DAY_START_MINUTE = 8 * 60;
const FALLBACK_DAY_END_MINUTE = 20 * 60;

// Personal hardware defaults. Update these once and keep the script offline.
const MAP_MODE_CONFIG: MapModeConfig = {
  worldWidth: WORLD_MAP_WIDTH,
  worldHeight: WORLD_MAP_HEIGHT,
  worldYStart: 5,
  worldYEnd: 55,
  frameMs: 50,
  panPixelsPerSecond: 2,
  lat: 37.7749,
  lng: -122.4194,
  timeZone: 'America/Los_Angeles',
  dayBrightness: 100,
  nightBrightness: 20,
  transitionMinutes: 45,
  landColorHex: (255 << 16) | (238 << 8) | 214,
  invertPolarity: false,
};

const zonedMinutes = (date: Date, timeZone: string): number => {
  const parts = getZonedDateTimeParts(date, timeZone);
  return parts.hour * 60 + parts.minute + parts.second / 60;
};

const getBrightnessForNow = (date: Date, config: MapModeConfig): number => {
  try {
    const location: SunLocation = {
      lat: config.lat,
      lng: config.lng,
      timeZone: config.timeZone,
    };
    const { sunrise, sunset } = getSunTimesForDate(date, location);
    const transition = config.transitionMinutes;

    if (!sunrise || !sunset) {
      const localMinute = zonedMinutes(date, config.timeZone);
      return localMinute >= FALLBACK_DAY_START_MINUTE &&
        localMinute < FALLBACK_DAY_END_MINUTE
        ? config.dayBrightness
        : config.nightBrightness;
    }

    const nowMs = date.getTime();
    const sunriseMs = sunrise.getTime();
    const sunsetMs = sunset.getTime();
    const transitionMs = transition * 60_000;

    if (
      !Number.isFinite(nowMs) ||
      !Number.isFinite(sunriseMs) ||
      !Number.isFinite(sunsetMs) ||
      !Number.isFinite(transitionMs) ||
      transitionMs <= 0
    ) {
      return config.dayBrightness;
    }

    if (nowMs < sunriseMs - transitionMs) {
      return config.nightBrightness;
    }

    if (nowMs <= sunriseMs + transitionMs) {
      const t = clamp(
        (nowMs - (sunriseMs - transitionMs)) / (transitionMs * 2),
        0,
        1
      );
      return Math.round(lerp(config.nightBrightness, config.dayBrightness, t));
    }

    if (nowMs < sunsetMs - transitionMs) {
      return config.dayBrightness;
    }

    if (nowMs <= sunsetMs + transitionMs) {
      const t = clamp(
        (nowMs - (sunsetMs - transitionMs)) / (transitionMs * 2),
        0,
        1
      );
      return Math.round(lerp(config.dayBrightness, config.nightBrightness, t));
    }

    return config.nightBrightness;
  } catch (error) {
    console.warn('[map-mode] brightness fallback:', error);
    return config.dayBrightness;
  }
};

const renderViewport = (
  mask: WorldMask,
  matrix: LedMatrixInstance,
  viewWidth: number,
  viewHeight: number,
  panOffset: number,
  config: MapModeConfig
): void => {
  matrix.clear().fgColor(config.landColorHex);

  const bandRows = config.worldYEnd - config.worldYStart;
  const xScale = 1;

  for (let y = 0; y < viewHeight; y += 1) {
    const worldY =
      viewHeight === 1
        ? config.worldYStart
        : config.worldYStart + Math.round((y / (viewHeight - 1)) * (bandRows - 1));

    for (let x = 0; x < viewWidth; x += 1) {
      const worldX = Math.floor(x * xScale + panOffset) % config.worldWidth;
      const land = mask.isLand(worldX, worldY);
      const pixelOn = config.invertPolarity ? !land : land;

      if (pixelOn) {
        matrix.setPixel(x, y);
      }
    }
  }
};

const main = async (): Promise<void> => {
  const matrix = new LedMatrix(matrixOptions, runtimeOptions);
  const viewWidth = matrix.width();
  const viewHeight = matrix.height();

  if (viewWidth > MAP_MODE_CONFIG.worldWidth) {
    throw new Error(
      `Matrix width ${viewWidth} exceeds world width ${MAP_MODE_CONFIG.worldWidth}`
    );
  }

  const mask = createWorldMask();
  const start = Date.now();

  let shouldRun = true;
  const stop = (): void => {
    shouldRun = false;
  };

  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);

  console.log(
    `[map-mode] view=${viewWidth}x${viewHeight} world=${MAP_MODE_CONFIG.worldWidth}x${MAP_MODE_CONFIG.worldHeight}`
  );
  console.log(
    `[map-mode] tz=${MAP_MODE_CONFIG.timeZone} lat=${MAP_MODE_CONFIG.lat} lng=${MAP_MODE_CONFIG.lng} pan=${MAP_MODE_CONFIG.panPixelsPerSecond}px/s`
  );

  matrix.clear().brightness(MAP_MODE_CONFIG.dayBrightness).sync();

  while (shouldRun) {
    const now = new Date();
    const brightness = clamp(
      getBrightnessForNow(now, MAP_MODE_CONFIG),
      1,
      100
    );
    const elapsedSeconds = (Date.now() - start) / 1000;
    const panOffset =
      (elapsedSeconds * MAP_MODE_CONFIG.panPixelsPerSecond) %
      MAP_MODE_CONFIG.worldWidth;

    renderViewport(
      mask,
      matrix,
      viewWidth,
      viewHeight,
      panOffset,
      MAP_MODE_CONFIG
    );

    matrix.brightness(brightness).sync();

    await wait(MAP_MODE_CONFIG.frameMs);
  }

  matrix.clear().sync();
};

main().catch(error => {
  console.error('[map-mode] fatal:', error);
  process.exitCode = 1;
});
