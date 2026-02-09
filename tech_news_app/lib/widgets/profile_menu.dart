import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../models/user_dto.dart';
import '../screens/user_profile_screen.dart';
import '../services/auth_service.dart';

class ProfileMenu extends StatefulWidget {
  const ProfileMenu({super.key});

  @override
  State<ProfileMenu> createState() => _ProfileMenuState();
}

class _ProfileMenuState extends State<ProfileMenu> {
  UserDto? me;

  @override
  void initState() {
    super.initState();
    _loadMe();
  }

  Future<void> _loadMe() async {
    try {
      final api = ApiService();
      final u = await api.getMe();
      if (mounted) setState(() => me = u);
    } catch (_) {
      // not logged in or endpoint not reachable
    }
  }

  @override
  Widget build(BuildContext context) {
    final letter = (me?.name.isNotEmpty ?? false) ? me!.name[0].toUpperCase() : "A";
    final img = (me?.profilePictureUrl != null && me!.profilePictureUrl!.isNotEmpty)
        ? NetworkImage(me!.profilePictureUrl!)
        : null;

    return PopupMenuButton<String>(
      onSelected: (v) async {
        if (v == "profile" && me != null) {
          Navigator.push(
            context,
            MaterialPageRoute(builder: (_) => UserProfileScreen(userId: me!.id)),
          );
        }
        if (v == "logout") {
          await AuthService().logout(); // remove token
          if (mounted) setState(() => me = null);
        }
      },
      itemBuilder: (_) => [
        PopupMenuItem(
          value: "profile",
          enabled: me != null,
          child: const Text("My Profile"),
        ),
        const PopupMenuItem(
          value: "logout",
          child: Text("Logout"),
        ),
      ],
      child: Padding(
        padding: const EdgeInsets.only(right: 12),
        child: CircleAvatar(
          radius: 16,
          backgroundImage: img,
          child: img == null ? Text(letter, style: const TextStyle(fontSize: 12)) : null,
        ),
      ),
    );
  }
}
