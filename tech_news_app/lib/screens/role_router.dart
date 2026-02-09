import 'package:flutter/material.dart';
import 'package:tech_news_app/models/session.dart';
import '../services/auth_service.dart';
import 'login_screen.dart';
import 'admin/admin_shell.dart';
import 'editor/editor_shell.dart';
import 'user/user_shell.dart';

class RoleRouter extends StatefulWidget {
  const RoleRouter({super.key});

  @override
  State<RoleRouter> createState() => _RoleRouterState();
}

class _RoleRouterState extends State<RoleRouter> {
  late Future<Session?> _sessionFuture;

  @override
  void initState() {
    super.initState();
    _sessionFuture = AuthService().getSession();
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<Session?>(
      future: _sessionFuture,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Scaffold(
            body: Center(child: CircularProgressIndicator()),
          );
        }

        if (!snapshot.hasData || snapshot.data == null) {
          return const LoginScreen();
        }

        final session = snapshot.data!;

        switch (session.normalizedRole) {
          case "admin":
            return const AdminShell();
          case "editor":
            return const EditorShell();
          default:
            return const UserShell();
        }
      },
    );
  }
}

