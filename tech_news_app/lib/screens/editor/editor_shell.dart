import 'package:flutter/material.dart';
import '../shell/app_shell.dart';

class EditorShell extends StatelessWidget {
  const EditorShell({super.key});

  @override
  Widget build(BuildContext context) {
    return const AppShell(role: "Editor");
  }
}
