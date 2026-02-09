import 'package:flutter/material.dart';
import '../shell/app_shell.dart';

class AdminShell extends StatelessWidget {
  const AdminShell({super.key});

  @override
  Widget build(BuildContext context) {
    return const AppShell(role: "Admin");
  }
}
