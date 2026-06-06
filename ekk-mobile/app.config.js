const IS_PREVIEW = process.env.APP_VARIANT === 'preview';

export default {
  expo: {
    name: IS_PREVIEW ? 'ekk-Idms' : 'ekk-mobile',
    slug: 'ekk-mobile',
    version: '0.1.0',
    sdkVersion: '54.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    newArchEnabled: false,
    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
    },
    ios: {
      supportsTablet: true,
      infoPlist: {
        NSSpeechRecognitionUsageDescription:
          'Allow $(PRODUCT_NAME) to use speech recognition.',
        NSMicrophoneUsageDescription:
          'Allow $(PRODUCT_NAME) to use the microphone.',
        NSLocationWhenInUseUsageDescription:
          'Allow $(PRODUCT_NAME) to capture location details on photos.',
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#ffffff',
      },
      usesCleartextTraffic: true,
      edgeToEdgeEnabled: true,
      permissions: [
        'android.permission.RECORD_AUDIO',
        'android.permission.MODIFY_AUDIO_SETTINGS',
        'android.permission.ACCESS_FINE_LOCATION',
        'android.permission.ACCESS_COARSE_LOCATION',
      ],
      package: IS_PREVIEW
        ? 'com.arunprakashm.ekkidms'
        : 'com.arunprakashm.ekkmobile',
    },
    web: {
      favicon: './assets/favicon.png',
    },
    plugins: [
      'expo-sqlite',
      'expo-secure-store',
      'expo-audio',
      'expo-speech-recognition',
      '@react-native-community/datetimepicker',
      'expo-asset',
    ],
    extra: {
      eas: {
        projectId: '2861dd0e-54f4-457b-b42e-9d79dbaf772d',
      },
    },
    runtimeVersion: {
      policy: 'appVersion',
    },
    updates: {
      url: 'https://u.expo.dev/2861dd0e-54f4-457b-b42e-9d79dbaf772d',
    },
  },
};
