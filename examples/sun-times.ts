export interface SunLocation {
  lat: number;
  lng: number;
  timeZone: string;
}

export interface SunTimes {
  sunrise: Date | null;
  sunset: Date | null;
}

export interface ZonedDateTimeParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const ZENITH_DEGREES = 90.833;

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;
const toDegrees = (radians: number): number => (radians * 180) / Math.PI;

const normalizeDegrees = (degrees: number): number => {
  const normalized = degrees % 360;
  return normalized < 0 ? normalized + 360 : normalized;
};

export const getZonedDateTimeParts = (
  date: Date,
  timeZone: string
): ZonedDateTimeParts => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  const getPart = (
    type: 'year' | 'month' | 'day' | 'hour' | 'minute' | 'second'
  ): number => {
    const value = parts.find(part => part.type === type)?.value;
    if (!value) {
      throw new Error(`Missing datetime part: ${type}`);
    }
    return Number.parseInt(value, 10);
  };

  return {
    year: getPart('year'),
    month: getPart('month'),
    day: getPart('day'),
    hour: getPart('hour'),
    minute: getPart('minute'),
    second: getPart('second'),
  };
};

const dayOfYear = (year: number, month: number, day: number): number => {
  const start = Date.UTC(year, 0, 1);
  const current = Date.UTC(year, month - 1, day);
  return Math.floor((current - start) / 86_400_000) + 1;
};

const calculateSunTimeUtcHoursRaw = (
  n: number,
  latitude: number,
  longitude: number,
  sunrise: boolean
): number | null => {
  const lngHour = longitude / 15;
  const t = n + ((sunrise ? 6 : 18) - lngHour) / 24;
  const meanAnomaly = 0.9856 * t - 3.289;

  const trueLongitude = normalizeDegrees(
    meanAnomaly +
      1.916 * Math.sin(toRadians(meanAnomaly)) +
      0.02 * Math.sin(toRadians(2 * meanAnomaly)) +
      282.634
  );

  let rightAscension = normalizeDegrees(
    toDegrees(Math.atan(0.91764 * Math.tan(toRadians(trueLongitude))))
  );
  const trueLongitudeQuadrant = Math.floor(trueLongitude / 90) * 90;
  const rightAscensionQuadrant = Math.floor(rightAscension / 90) * 90;
  rightAscension += trueLongitudeQuadrant - rightAscensionQuadrant;
  rightAscension /= 15;

  const sinDec = 0.39782 * Math.sin(toRadians(trueLongitude));
  const cosDec = Math.cos(Math.asin(sinDec));
  const cosH =
    (Math.cos(toRadians(ZENITH_DEGREES)) -
      sinDec * Math.sin(toRadians(latitude))) /
    (cosDec * Math.cos(toRadians(latitude)));

  if (cosH > 1 || cosH < -1) {
    return null;
  }

  const localHourAngle = sunrise
    ? 360 - toDegrees(Math.acos(cosH))
    : toDegrees(Math.acos(cosH));
  const localHourHours = localHourAngle / 15;
  const localMeanTime =
    localHourHours + rightAscension - 0.06571 * t - 6.622;

  return localMeanTime - lngHour;
};

export const getSunTimesForDate = (
  date: Date,
  location: SunLocation
): SunTimes => {
  const zoned = getZonedDateTimeParts(date, location.timeZone);
  const n = dayOfYear(zoned.year, zoned.month, zoned.day);

  const sunriseUtcHours = calculateSunTimeUtcHoursRaw(
    n,
    location.lat,
    location.lng,
    true
  );
  const sunsetUtcHours = calculateSunTimeUtcHoursRaw(
    n,
    location.lat,
    location.lng,
    false
  );

  const localMidnightUtcMs = Date.UTC(zoned.year, zoned.month - 1, zoned.day);

  return {
    sunrise:
      sunriseUtcHours === null
        ? null
        : new Date(localMidnightUtcMs + sunriseUtcHours * 3_600_000),
    sunset:
      sunsetUtcHours === null
        ? null
        : new Date(localMidnightUtcMs + sunsetUtcHours * 3_600_000),
  };
};
