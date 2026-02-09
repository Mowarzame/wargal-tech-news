import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:package_info_plus/package_info_plus.dart';

import '../services/auth_service.dart';
import '../models/user_dto.dart';
import 'user_profile_screen.dart';
import 'about_screen.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  final _auth = AuthService();

  UserDto? _me;
  bool _loadingMe = true;
  String? _meError;

  @override
  void initState() {
    super.initState();
    _loadMe();
  }

  Future<void> _loadMe() async {
    setState(() {
      _loadingMe = true;
      _meError = null;
    });
    try {
      final me = await _auth.getCurrentUser();
      setState(() => _me = me);
    } catch (e) {
      setState(() => _meError = e.toString());
    } finally {
      setState(() => _loadingMe = false);
    }
  }

  Future<void> _clearCache() async {
    try {
      await CachedNetworkImage.evictFromCache(""); // no-op safe call
      PaintingBinding.instance.imageCache.clear();
      PaintingBinding.instance.imageCache.clearLiveImages();

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text("Cache cleared ✅")),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text("Failed to clear cache: $e")),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text("Settings")),
      body: ListView(
        children: [
          const SizedBox(height: 8),

          // Account section
          _SectionTitle("Account"),
          if (_loadingMe)
            const ListTile(
              leading: CircleAvatar(child: Icon(Icons.person)),
              title: Text("Loading user..."),
            )
          else if (_meError != null)
            ListTile(
              leading: const Icon(Icons.error_outline),
              title: const Text("Failed to load account"),
              subtitle: Text(_meError!),
              trailing: TextButton(onPressed: _loadMe, child: const Text("Retry")),
            )
          else if (_me != null)
            ListTile(
              leading: CircleAvatar(
                backgroundColor: Colors.grey.shade200,
                backgroundImage: (_me!.profilePictureUrl != null &&
                        _me!.profilePictureUrl!.isNotEmpty)
                    ? NetworkImage(_me!.profilePictureUrl!)
                    : null,
                child: (_me!.profilePictureUrl == null ||
                        _me!.profilePictureUrl!.isEmpty)
                    ? Text(_me!.name.isNotEmpty ? _me!.name[0].toUpperCase() : "U")
                    : null,
              ),
              title: Text(_me!.name, maxLines: 1, overflow: TextOverflow.ellipsis),
              subtitle: Text(_me!.email, maxLines: 1, overflow: TextOverflow.ellipsis),
              trailing: const Icon(Icons.chevron_right),
              onTap: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => UserProfileScreen(userId: _me!.id),
                  ),
                );
              },
            )
          else
            const ListTile(
              leading: Icon(Icons.person_outline),
              title: Text("Not logged in"),
            ),

          const Divider(height: 24),

          // App section (can expand later to theme/language)
          _SectionTitle("App"),
          SwitchListTile(
            value: true,
            onChanged: (_) {
              // TODO: Wire to real notifications setting later
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text("Coming soon")),
              );
            },
            title: const Text("Notifications"),
            subtitle: const Text("Breaking news and community updates"),
          ),

          ListTile(
            leading: const Icon(Icons.cleaning_services_outlined),
            title: const Text("Clear cache"),
            subtitle: const Text("Frees storage used by images"),
            onTap: _clearCache,
          ),

          const Divider(height: 24),

          // Support / legal
          _SectionTitle("Support & Legal"),
          ListTile(
            leading: const Icon(Icons.info_outline),
            title: const Text("About"),
            onTap: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const AboutScreen()),
              );
            },
          ),
          ListTile(
            leading: const Icon(Icons.privacy_tip_outlined),
            title: const Text("Privacy Policy"),
            subtitle: const Text("Required for Play Store"),
            onTap: () {
              // TODO: Replace with your real privacy policy URL (WebView or launchUrl)
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text("Add your Privacy Policy URL")),
              );
            },
          ),
          ListTile(
            leading: const Icon(Icons.description_outlined),
            title: const Text("Terms of Service"),
            onTap: () {
              // TODO: Replace with your terms URL
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text("Add your Terms URL")),
              );
            },
          ),

          const SizedBox(height: 30),
        ],
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  final String text;
  const _SectionTitle(this.text);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 6),
      child: Text(
        text,
        style: TextStyle(
          fontSize: 13,
          fontWeight: FontWeight.w900,
          color: Colors.grey.shade700,
          letterSpacing: 0.2,
        ),
      ),
    );
  }
}
