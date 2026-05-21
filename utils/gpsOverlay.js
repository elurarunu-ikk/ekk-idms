// ekk-mobile/utils/gpsOverlay.js
// Captures GPS metadata and stamps it as visible text onto captured photos.

import * as Location from 'expo-location';
import Marker, { ImageFormat, Position, TextBackgroundType } from 'react-native-image-marker';

/**
 * Request location permissions
 */
export async function requestLocationPermission() {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.log('[GPS] Permission error:', error.message);
    return false;
  }
}

/**
 * Get current GPS location (lat, lng, accuracy)
 */
export async function getCurrentLocation() {
  try {
    const hasPermission = await requestLocationPermission();
    if (!hasPermission) {
      console.log('[GPS] Location permission denied');
      return null;
    }

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Best,
    });

    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracy: Math.round(location.coords.accuracy),
      timestamp: new Date(),
    };
  } catch (error) {
    console.log('[GPS] Error getting location:', error.message);
    return null;
  }
}

/**
 * Reverse geocode coordinates to get address (using Nominatim/OSM)
 * Returns address string or null if offline/failed
 */
export async function reverseGeocode(latitude, longitude) {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=16&addressdetails=0`,
      {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'ekk-mobile/1.0',
        },
      }
    );

    if (!response.ok) return null;

    const data = await response.json();
    return data.display_name || null;
  } catch (error) {
    console.log('[Geocode] Reverse geocode failed (offline?):', error.message);
    return null;
  }
}

/**
 * Format location data for display
 * Returns { coords, address, timestamp }
 */
export async function getLocationWithAddress() {
  const location = await getCurrentLocation();
  if (!location) return null;

  const address = await reverseGeocode(location.latitude, location.longitude);

  return {
    coords: {
      latitude: location.latitude,
      longitude: location.longitude,
      accuracy: location.accuracy,
    },
    address: address,
    timestamp: location.timestamp,
  };
}

/**
 * Format location for overlay text/display
 */
export function formatLocationText(locationData) {
  if (!locationData) return '';

  const { coords, address, timestamp } = locationData;
  const lat = coords.latitude.toFixed(6);
  const lng = coords.longitude.toFixed(6);
  const time = timestamp.toLocaleTimeString('en-IN');
  const date = timestamp.toLocaleDateString('en-IN');
  
  let text = `${date} ${time}\n`;
  text += `Lat: ${lat}, Lng: ${lng}\n`;
  text += `Accuracy: ±${coords.accuracy}m`;
  
  if (address) {
    const displayAddress = String(address).split(',').slice(0, 3).join(',').trim();
    text += `\n${displayAddress}`;
  }

  return text;
}

/**
 * Ensure marker result is a valid file URI for React Native usage
 */
function normalizeMarkedUri(pathOrUri) {
  if (!pathOrUri) return null;
  if (String(pathOrUri).startsWith('file://')) return pathOrUri;
  if (String(pathOrUri).startsWith('/')) return `file://${pathOrUri}`;
  return pathOrUri;
}

function getMarkerImageSource(imageUri) {
  // react-native-image-marker accepts ImageSource-compatible values.
  // Passing `{ uri }` is the most compatible path across RN/Expo versions.
  return { uri: imageUri };
}

/**
 * Burn overlay text onto image pixels and return stamped file URI
 */
export async function addGPSOverlayToImage(imageUri, locationData) {
  try {
    if (!locationData) return imageUri;

    const overlayText = formatLocationText(locationData);
    const stampedPath = await Marker.markText({
      backgroundImage: {
        src: getMarkerImageSource(imageUri),
        scale: 1,
      },
      watermarkTexts: [
        {
          text: overlayText,
          // `positionOptions` is the backward-compatible key used by this library.
          positionOptions: {
            position: Position.bottomLeft,
            X: 20,
            Y: 24,
          },
          style: {
            color: '#FFFFFF',
            fontSize: 26,
            textAlign: 'left',
            bold: true,
            shadowStyle: {
              dx: 1,
              dy: 1,
              radius: 2,
              color: '#000000',
            },
            textBackgroundStyle: {
              type: TextBackgroundType.stretchX,
              color: '#00000099',
              paddingX: 14,
              paddingY: 10,
            },
          },
        },
      ],
      quality: 92,
      filename: `photo_overlay_${Date.now()}`,
      saveFormat: ImageFormat.jpg,
    });

    const stampedUri = normalizeMarkedUri(stampedPath) || imageUri;
    if (!stampedUri) {
      throw new Error('Marker did not return output URI');
    }

    console.log('[Overlay] GPS overlay stamped on image:', stampedUri);
    return stampedUri;
  } catch (error) {
    console.log('[Overlay] Failed to stamp image, using original:', error.message);
    return imageUri;
  }
}

/**
 * Complete flow: capture location and prepare image with overlay
 * 
 * Returns { imageUri, locationData }
 */
export async function capturePhotoWithGPSOverlay(baseImageUri) {
  try {
    // Get location
    const locationData = await getLocationWithAddress();
    
    if (!locationData) {
      console.log('[GPS] Could not get location, returning original image');
      return { imageUri: baseImageUri, locationData: null };
    }

    const stampedUri = await addGPSOverlayToImage(baseImageUri, locationData);

    // Log for verification
    console.log('[GPS] Photo captured with location:', {
      latitude: locationData.coords.latitude.toFixed(6),
      longitude: locationData.coords.longitude.toFixed(6),
      accuracy: locationData.coords.accuracy,
      address: locationData.address,
    });

    return {
      imageUri: stampedUri,
      locationData: locationData,
    };
  } catch (error) {
    console.log('[GPS] Error in photo with overlay:', error.message);
    return { imageUri: baseImageUri, locationData: null };
  }
}
