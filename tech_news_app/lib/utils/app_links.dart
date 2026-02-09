import 'package:url_launcher/url_launcher.dart';

class AppLinks {
  static const privacyPolicy =
      "https://mowarzame.github.io/wargal-repository/privacy";

  static const termsOfService =
      "https://mowarzame.github.io/wargal-repository/terms";

  static Future<void> open(String url) async {
    final uri = Uri.parse(url);

    if (!await launchUrl(
      uri,
      mode: LaunchMode.externalApplication,
    )) {
      throw Exception("Could not launch $url");
    }
  }
}
