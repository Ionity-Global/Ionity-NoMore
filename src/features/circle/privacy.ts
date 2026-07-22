export type LocationPrecision = 0 | 100 | 500 | 1000

export interface PrivateLocation {
  latitude: number
  longitude: number
  accuracy: number
  sharedAt: number
  precision: LocationPrecision
}

interface SourceLocation {
  latitude: number
  longitude: number
  accuracy: number
  timestamp?: number
}

const METERS_PER_LATITUDE_DEGREE = 111_320

export function bufferLocation(
  location: SourceLocation,
  precision: LocationPrecision = 500,
): PrivateLocation {
  if (precision === 0) {
    return {
      ...location,
      sharedAt: location.timestamp ?? Date.now(),
      precision,
    }
  }

  const latitudeStep = precision / METERS_PER_LATITUDE_DEGREE
  const longitudeScale = Math.max(Math.cos((location.latitude * Math.PI) / 180), 0.01)
  const longitudeStep = precision / (METERS_PER_LATITUDE_DEGREE * longitudeScale)

  return {
    latitude: roundToGrid(location.latitude, latitudeStep),
    longitude: roundToGrid(location.longitude, longitudeStep),
    accuracy: Math.max(location.accuracy, precision),
    sharedAt: location.timestamp ?? Date.now(),
    precision,
  }
}

function roundToGrid(value: number, step: number) {
  return Number((Math.round(value / step) * step).toFixed(6))
}