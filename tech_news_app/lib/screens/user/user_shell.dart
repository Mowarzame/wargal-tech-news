import 'package:flutter/material.dart';
import '../shell/app_shell.dart';

class UserShell extends StatelessWidget {
  const UserShell({super.key});

  @override
  Widget build(BuildContext context) {
    return const AppShell(role: "User");
  }
}
