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

  // ✅ Typed keys (fixes: "_NewsScreenState isn't a type")
  final GlobalKey<NewsScreenState> _newsKey = GlobalKey<NewsScreenState>();
  final GlobalKey<BreakingNewsScreenState> _breakingKey =
      GlobalKey<BreakingNewsScreenState>();

  bool get isAdmin => widget.role.toLowerCase() == "admin";
  bool get isEditor => widget.role.toLowerCase() == "editor";

  List<_NavItem> get _tabs {
    final home = _NavItem(
      label: "News",
      icon: Icons.home_outlined,
      page: NewsScreen(key: _newsKey),
    );

    final explore = _NavItem(
      label: "Articles",
      icon: Icons.groups_outlined,
      page: FeedScreen(
        title: "Articles",
        canCreate: false,
        showVerifyQueue: isAdmin,
      ),
    );

    final breaking = _NavItem(
      label: "Breaking",
      icon: Icons.flash_on,
      page: BreakingNewsScreen(key: _breakingKey),
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

    if (isAdmin) return [breaking, home, moderation, create, explore];
    if (isEditor) return [breaking, home, explore, create, myPosts];
    return [breaking, home, explore];
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

  void _activateTab(_NavItem tab, {required bool isRetap}) {
    // ✅ Always scroll-to-top on BOTH:
    // - re-tap same tab
    // - switching into tab from another tab
    if (tab.label == "News") {
      final st = _newsKey.currentState;
      st?.onTabActivated(
        scrollTop: true,
        forceRefresh: isRetap, // ✅ refresh only on re-tap (keeps UI fast)
        resetSlider: true,
      );
      return;
    }

    if (tab.label == "Breaking") {
      final st = _breakingKey.currentState;
      st?.onTabActivated(
        scrollTop: true,
        forceRefresh: isRetap, // ✅ refresh only on re-tap
        resetSlider: true,
      );
      return;
    }
  }

  @override
  Widget build(BuildContext context) {
    final tabs = _tabs;
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
          Navigator.pop(context);
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
        type: BottomNavigationBarType.fixed,
        onTap: (i) {
          final tappedTab = tabs[i];

          // ✅ Re-tap same tab: activate (scrollTop + optional refresh)
          if (i == _index) {
            _activateTab(tappedTab, isRetap: true);
            return;
          }

          // ✅ Switch tab then activate after frame
          setState(() => _index = i);
          WidgetsBinding.instance.addPostFrameCallback((_) {
            _activateTab(tappedTab, isRetap: false); // ✅ also scrollTop on switch
          });
        },
        items: tabs
            .map((t) =>
                BottomNavigationBarItem(icon: Icon(t.icon), label: t.label))
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

enum _DrawerTarget { settings, about }

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
            const Text("Wargal",
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900)),
            const SizedBox(height: 6),
            Text("Role: $role", style: TextStyle(color: Colors.grey.shade700)),
            const SizedBox(height: 14),
            const Divider(),
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
