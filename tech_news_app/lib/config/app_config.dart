import 'dart:io';

class AppConfig {
  static String get apiBaseUrl {
    // Android emulator can't use localhost
    if (Platform.isAndroid) {
      return "https://wargal-api.onrender.com/api";
    }

    // iOS simulator runs on host network
    return "https://wargal-api.onrender.com/api";
  }
}
