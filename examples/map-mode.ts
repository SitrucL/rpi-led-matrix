import { LedMatrix } from '../src';
import { matrixOptions, runtimeOptions } from './_config';
import {
  createWorldMask,
  type WorldMask,
  WORLD_MAP_HEIGHT,
  WORLD_MAP_WIDTH,
} from './map-mask-world';
import { getSunTimesForDate, getZonedDateTimeParts, type SunLocation } from './sun-times';

interface Rgb {
  r: number;
  g: number;
  b: number;
}

interface MapModeConfig {
  worldWidth: number;
  worldHeight: number;
  frameMs: number;
  panPixelsPerSecond: number;
  lat: number;
  lng: number;
  timeZone: string;
  dayBrightness: number;
  nightBrightness: number;
  transitionMinutes: number;
  landColor: Rgb;
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
  frameMs: 100,
  panPixelsPerSecond: 0.5,
  lat: 37.7749,
  lng: -122.4194,
  timeZone: 'America/Los_Angeles',
  dayBrightness: 100,
  nightBrightness: 20,
  transitionMinutes: 45,
  landColor: { r: 255, g: 238, b: 214 },
  invertPolarity: false,
};

const zonedMinutes = (date: Date, timeZone: string): number => {
  const parts = getZonedDateTimeParts(date, timeZone);
  return parts.hour * 60 + parts.minute + parts.second / 60;
};

const getBrightnessForNow = (date: Date, config: MapModeConfig): number => {
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
};

const setPixelRgb = (
  buffer: Buffer,
  width: number,
  x: number,
  y: number,
  color: Rgb
): void => {
  const index = (y * width + x) * 3;
  buffer[index] = color.r;
  buffer[index + 1] = color.g;
  buffer[index + 2] = color.b;
};

const clearPixel = (buffer: Buffer, width: number, x: number, y: number): void => {
  const index = (y * width + x) * 3;
  buffer[index] = 0;
  buffer[index + 1] = 0;
  buffer[index + 2] = 0;
};

const renderViewport = (
  mask: WorldMask,
  buffer: Buffer,
  viewWidth: number,
  viewHeight: number,
  panOffset: number,
  config: MapModeConfig
): void => {
  for (let y = 0; y < viewHeight; y += 1) {
    const worldY =
      viewHeight === 1
        ? 0
        : Math.round((y / (viewHeight - 1)) * (config.worldHeight - 1));

    for (let x = 0; x < viewWidth; x += 1) {
      const worldX = (x + panOffset) % config.worldWidth;
      const land = mask.isLand(worldX, worldY);
      const pixelOn = config.invertPolarity ? !land : land;

      if (pixelOn) {
        setPixelRgb(buffer, viewWidth, x, y, config.landColor);
      } else {
        clearPixel(buffer, viewWidth, x, y);
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

  const frameBuffer = Buffer.alloc(viewWidth * viewHeight * 3);
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

  matrix.clear();

  while (shouldRun) {
    const now = new Date();
    const brightness = getBrightnessForNow(now, MAP_MODE_CONFIG);
    const elapsedSeconds = (Date.now() - start) / 1000;
    const panOffset =
      Math.floor(elapsedSeconds * MAP_MODE_CONFIG.panPixelsPerSecond) %
      MAP_MODE_CONFIG.worldWidth;

    renderViewport(
      mask,
      frameBuffer,
      viewWidth,
      viewHeight,
      panOffset,
      MAP_MODE_CONFIG
    );

    matrix.brightness(brightness).drawBuffer(frameBuffer, viewWidth, viewHeight).sync();

    await wait(MAP_MODE_CONFIG.frameMs);
  }

  matrix.clear().sync();
};

main().catch(error => {
  console.error('[map-mode] fatal:', error);
  process.exitCode = 1;
});
