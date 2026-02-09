import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../models/user_dto.dart';

class UserProfileScreen extends StatefulWidget {
  final String userId;
  const UserProfileScreen({super.key, required this.userId});

  @override
  State<UserProfileScreen> createState() => _UserProfileScreenState();
}

class _UserProfileScreenState extends State<UserProfileScreen> {
  bool loading = true;
  String? error;
  UserDto? user;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { loading = true; error = null; });
    try {
      final api = ApiService();
      final u = await api.getUserById(widget.userId);
      setState(() => user = u);
    } catch (e) {
      setState(() => error = e.toString());
    } finally {
      setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (loading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    if (error != null) {
      return Scaffold(
        appBar: AppBar(title: const Text("Profile")),
        body: Center(child: Text(error!)),
      );
    }

    final u = user!;
    return Scaffold(
      appBar: AppBar(title: Text(u.name)),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            CircleAvatar(
              radius: 34,
              backgroundImage: (u.profilePictureUrl != null && u.profilePictureUrl!.isNotEmpty)
                  ? NetworkImage(u.profilePictureUrl!)
                  : null,
              child: (u.profilePictureUrl == null || u.profilePictureUrl!.isEmpty)
                  ? Text(u.name.isNotEmpty ? u.name[0].toUpperCase() : "U")
                  : null,
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(u.name, style: Theme.of(context).textTheme.titleLarge),
                  const SizedBox(height: 6),
                  Text(u.email, style: Theme.of(context).textTheme.bodyMedium),
                  const SizedBox(height: 10),
                  Text("Role: ${u.role}"),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
