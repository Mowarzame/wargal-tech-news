import 'package:flutter/material.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:tech_news_app/utils/app_links.dart';

class AboutScreen extends StatefulWidget {
  const AboutScreen({super.key});

  @override
  State<AboutScreen> createState() => _AboutScreenState();
}

class _AboutScreenState extends State<AboutScreen> {
  String _version = "-";
  String _build = "-";

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final info = await PackageInfo.fromPlatform();
    setState(() {
      _version = info.version;
      _build = info.buildNumber;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text("About")),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              "Wargal News",
              style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900),
            ),
            const SizedBox(height: 6),
            Text("Version $_version ($_build)", style: TextStyle(color: Colors.grey.shade700)),
            const SizedBox(height: 14),

            const Text(
              "Wargal News is a Somali tech news aggregator + community where users can share posts, comment, and react.",
              style: TextStyle(height: 1.5),
            ),

            const SizedBox(height: 20),
            const Divider(),
ListTile(
  leading: const Icon(Icons.privacy_tip_outlined),
  title: const Text("Privacy Policy"),
  onTap: () => AppLinks.open(AppLinks.privacyPolicy),
),

ListTile(
  leading: const Icon(Icons.description_outlined),
  title: const Text("Terms of Service"),
  onTap: () => AppLinks.open(AppLinks.termsOfService),
),

            const Spacer(),
            Text(
              "© ${DateTime.now().year} Wargal News",
              style: TextStyle(color: Colors.grey.shade600),
            ),
          ],
        ),
      ),
    );
  }
}
