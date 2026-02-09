import 'package:flutter/material.dart';
import 'package:tech_news_app/screens/about_screen.dart';
import 'package:tech_news_app/screens/breaking_news_screen.dart';
import 'package:tech_news_app/screens/editor_my_posts_screen.dart';
import 'package:tech_news_app/screens/moderation_screen.dart';
import 'package:tech_news_app/screens/settings_screen.dart';
import 'package:tech_news_app/widgets/user_avatar_menu_action.dart';
import '../../services/auth_service.dart';
import '../login_screen.dart';
import '../feed_screen.dart';
import '../editor/create_post_screen.dart';
import '../news_screen.dart';


class AppShell extends StatefulWidget {
  final String role; // "Admin" | "Editor" | "User"
  const AppShell({super.key, required this.role});

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
  int _index = 0;
  final _auth = AuthService();

  bool get isAdmin => widget.role.toLowerCase() == "admin";
  bool get isEditor => widget.role.toLowerCase() == "editor";

  List<_NavItem> get _tabs {
    // Pages (reuse FeedScreen with props)
 final home = _NavItem(
  label: "News",
  icon: Icons.home_outlined,
  page: const NewsScreen(), // ✅ Home is now aggregated news
);


final explore = _NavItem(
  label: "Articles",
  icon: Icons.groups_outlined, // or Icons.forum_outlined
  page: FeedScreen(
    title: "Articles",
    canCreate: false,
    showVerifyQueue: isAdmin, // optional (keep if you want admin tools here)
  ),
);





final breaking = _NavItem(
  label: "Breaking",
  icon: Icons.flash_on,
  page: const BreakingNewsScreen(),
);


    final create = _NavItem(
      label: "Create",
      icon: Icons.add_circle_outline,
      page: const CreatePostScreen(),
    );

final moderation = _NavItem(
  label: "Moderation",
  icon: Icons.verified_outlined,
  page: const ModerationScreen(),
);

final myPosts = _NavItem(
  label: "My Posts",
  icon: Icons.article_outlined,
  page: const EditorMyPostsScreen(),
);

if (isEditor) {
  return [breaking, home, explore, create, myPosts];
}

 // Role-based arrangement (Profile removed from tabs; Breaking added)
if (isAdmin) {
  // Admin: [News, Moderation, Create, Community, Breaking]
  return [breaking,home, moderation, create, explore];
}

if (isEditor) {
  // Editor: [News, Community, Create, My Posts, Breaking]
  // (My Posts is your requested editor feature; we keep it as a tab for now,
  // but you can later move it to the avatar menu if you prefer.)
  return [breaking,home, explore, create, myPosts];
}

// User: [News, Community, Bookmarks, Breaking]
return [breaking,home, explore, myPosts];

  }

  String get _title => _tabs[_index].label;

  Future<void> _logout() async {
    await _auth.logout();
    if (!mounted) return;
    Navigator.pushAndRemoveUntil(
      context,
      MaterialPageRoute(builder: (_) => const LoginScreen()),
      (_) => false,
    );
  }

  @override
  Widget build(BuildContext context) {
    final tabs = _tabs;

    // Defensive: if role changes and index is out of range
    if (_index >= tabs.length) _index = 0;

    return Scaffold(
      appBar: AppBar(
        title: Text(_title),
actions: [
  UserAvatarMenuAction(onLogout: _logout),
],

      ),
      drawer: _AppDrawer(
        role: widget.role,
        isAdmin: isAdmin,
        isEditor: isEditor,
        onLogout: _logout,
        onNavigate: (target) {
          // Drawer navigation is optional "secondary routes"
          Navigator.pop(context); // close drawer
          if (target == _DrawerTarget.bookmarks && isAdmin) {
            Navigator.push(
              context,
              MaterialPageRoute(
                builder: (_) => const _PlaceholderScreen(
                  title: "Bookmarks",
                  subtitle: "Saved posts coming next.",
                ),
              ),
            );
          }
          if (target == _DrawerTarget.settings) {
     Navigator.push(
  context,
  MaterialPageRoute(builder: (_) => const SettingsScreen()),
);

          }
          if (target == _DrawerTarget.about) {
     Navigator.push(
  context,
  MaterialPageRoute(builder: (_) => const AboutScreen()),
);

          }
        },
      ),
      body: IndexedStack(
        index: _index,
        children: tabs.map((t) => t.page).toList(),
      ),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _index,
        onTap: (i) => setState(() => _index = i),
        type: BottomNavigationBarType.fixed, // important when >3 tabs
        items: tabs
            .map(
              (t) => BottomNavigationBarItem(
                icon: Icon(t.icon),
                label: t.label,
              ),
            )
            .toList(),
      ),
    );
  }
}

class _NavItem {
  final String label;
  final IconData icon;
  final Widget page;
  _NavItem({required this.label, required this.icon, required this.page});
}

enum _DrawerTarget { bookmarks, settings, about }

class _AppDrawer extends StatelessWidget {
  final String role;
  final bool isAdmin;
  final bool isEditor;
  final Future<void> Function() onLogout;
  final void Function(_DrawerTarget target) onNavigate;

  const _AppDrawer({
    required this.role,
    required this.isAdmin,
    required this.isEditor,
    required this.onLogout,
    required this.onNavigate,
  });

  @override
  Widget build(BuildContext context) {
    return Drawer(
      child: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(12),
          children: [
            const SizedBox(height: 8),
            const Text(
              "Wargal",
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900),
            ),
            const SizedBox(height: 6),
            Text(
              "Role: $role",
              style: TextStyle(color: Colors.grey.shade700),
            ),
            const SizedBox(height: 14),
            const Divider(),

            // Admin: Bookmarks moved here (Option A)
            if (isAdmin)
              ListTile(
                leading: const Icon(Icons.bookmark_border),
                title: const Text("Bookmarks"),
                onTap: () => onNavigate(_DrawerTarget.bookmarks),
              ),

            ListTile(
              leading: const Icon(Icons.settings_outlined),
              title: const Text("Settings"),
              onTap: () => onNavigate(_DrawerTarget.settings),
            ),
            ListTile(
              leading: const Icon(Icons.info_outline),
              title: const Text("About"),
              onTap: () => onNavigate(_DrawerTarget.about),
            ),

            const Divider(),
         
          ],
        ),
      ),
    );
  }
}

class _PlaceholderScreen extends StatelessWidget {
  final String title;
  final String subtitle;

  const _PlaceholderScreen({required this.title, required this.subtitle});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(title, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900)),
            const SizedBox(height: 8),
            Text(subtitle, textAlign: TextAlign.center),
          ],
        ),
      ),
    );
  }
}

class _ProfileScreen extends StatelessWidget {
  final String role;
  final Future<void> Function() onLogout;

  const _ProfileScreen({required this.role, required this.onLogout});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.person, size: 56),
            const SizedBox(height: 10),
            Text("Role: $role", style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
            const SizedBox(height: 18),
            ElevatedButton.icon(
              onPressed: onLogout,
              icon: const Icon(Icons.logout),
              label: const Text("Logout"),
            ),
          ],
        ),
      ),
    );
  }
}
