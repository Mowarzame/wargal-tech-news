import 'dart:io';

class AppConfig {
  static String get apiBaseUrl {
    // Android emulator can't use localhost
    if (Platform.isAndroid) {
      return "http://10.0.2.2:5194/api";
    }

    // iOS simulator runs on host network
    return "http://localhost:5194/api";
  }
}
