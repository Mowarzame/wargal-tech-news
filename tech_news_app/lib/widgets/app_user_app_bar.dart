import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/user_provider.dart';
import '../screens/user_profile_screen.dart';

class AppUserAppBar extends StatelessWidget implements PreferredSizeWidget {
  final String title;

  const AppUserAppBar({super.key, required this.title});

  @override
  Widget build(BuildContext context) {
    final user = context.watch<UserProvider>().user;

    return AppBar(
      title: Text(title),
      actions: [
        if (user != null)
          GestureDetector(
            onTap: () {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => UserProfileScreen(userId: user.id),
                ),
              );
            },
            child: Padding(
              padding: const EdgeInsets.only(right: 12),
              child: CircleAvatar(
                radius: 16,
                backgroundColor: Colors.grey.shade200,
                backgroundImage: (user.profilePictureUrl != null &&
                        user.profilePictureUrl!.isNotEmpty)
                    ? NetworkImage(user.profilePictureUrl!)
                    : null,
                child: (user.profilePictureUrl == null ||
                        user.profilePictureUrl!.isEmpty)
                    ? Text(
                        user.name.isNotEmpty
                            ? user.name[0].toUpperCase()
                            : "U",
                        style: const TextStyle(fontWeight: FontWeight.bold),
                      )
                    : null,
              ),
            ),
          ),
      ],
    );
  }

  @override
  Size get preferredSize => const Size.fromHeight(kToolbarHeight);
}
