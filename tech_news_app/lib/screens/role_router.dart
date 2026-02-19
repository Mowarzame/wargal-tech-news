import 'package:flutter/material.dart';
import '../models/session.dart';
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
  final AuthService _auth = AuthService();

  @override
  Widget build(BuildContext context) {
    // ✅ IMPORTANT: do NOT cache the future in initState
    // so logout/login updates are respected immediately.
    return FutureBuilder<Session?>(
      future: _auth.getSession(),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Scaffold(
            body: Center(child: CircularProgressIndicator()),
          );
        }

        final session = snapshot.data;
        if (session == null) {
          return const LoginScreen();
        }

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
