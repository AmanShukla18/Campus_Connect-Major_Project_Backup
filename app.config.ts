import { ExpoConfig } from "expo/config";

export default ({ config }: { config: ExpoConfig }) => ({
  expo: {
    ...config,
    name: "CampusConnectCur",
    slug: "CampusConnectCur",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    newArchEnabled: true,
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    ios: {
      supportsTablet: true
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff"
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      package: "com.pranny.CampusConnectCur"
    },
    web: {
      favicon: "./assets/favicon.png"
    },
    plugins: [
      "expo-video"
    ],

    extra: {
      API_URL: process.env.EXPO_PUBLIC_API_URL,
      CLOUDINARY_CLOUD_NAME: process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME,
      CLOUDINARY_UPLOAD_PRESET: process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET,
      CLOUDINARY_FOLDER: process.env.EXPO_PUBLIC_CLOUDINARY_FOLDER,
    },
  }
});
