import 'package:flutter/material.dart';
import '../services/auth_service.dart';
import '../models/user_dto.dart';
import '../screens/user_profile_screen.dart';

class UserAvatarMenuAction extends StatelessWidget {
  final Future<void> Function() onLogout;

  const UserAvatarMenuAction({
    super.key,
    required this.onLogout,
  });

  @override
  Widget build(BuildContext context) {
    final auth = AuthService();

    return FutureBuilder<UserDto?>(
      future: auth.getCurrentUser(),
      builder: (context, snapshot) {
        // ⛔ Not logged in yet → no avatar
        if (!snapshot.hasData) {
          return const SizedBox.shrink();
        }

        final user = snapshot.data!;
        final photoUrl = user.profilePictureUrl?.trim() ?? "";
        final initial =
            user.name.isNotEmpty ? user.name[0].toUpperCase() : "U";

        return PopupMenuButton<_MenuAction>(
          tooltip: "Account",
          position: PopupMenuPosition.under,
          onSelected: (action) async {
            switch (action) {
              case _MenuAction.profile:
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => UserProfileScreen(userId: user.id),
                  ),
                );
                break;

              case _MenuAction.logout:
                await onLogout();
                break;
            }
          },
          itemBuilder: (_) => [
            PopupMenuItem(
              value: _MenuAction.profile,
              child: Row(
                children: const [
                  Icon(Icons.person_outline, size: 18),
                  SizedBox(width: 8),
                  Text("My Profile"),
                ],
              ),
            ),
            const PopupMenuDivider(),
            PopupMenuItem(
              value: _MenuAction.logout,
              child: Row(
                children: const [
                  Icon(Icons.logout, size: 18),
                  SizedBox(width: 8),
                  Text("Logout"),
                ],
              ),
            ),
          ],
          child: Padding(
            padding: const EdgeInsets.only(right: 12),
            child: CircleAvatar(
              radius: 16,
              backgroundColor: Colors.grey.shade200,
              backgroundImage:
                  photoUrl.isNotEmpty ? NetworkImage(photoUrl) : null,
              child: photoUrl.isEmpty
                  ? Text(
                      initial,
                      style: const TextStyle(
                        fontWeight: FontWeight.w900,
                        fontSize: 14,
                      ),
                    )
                  : null,
            ),
          ),
        );
      },
    );
  }
}

enum _MenuAction {
  profile,
  logout,
}
