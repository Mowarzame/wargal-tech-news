import 'package:flutter/material.dart';
import '../models/post.dart';
import '../services/api_service.dart';
import '../widgets/post_card.dart';

class FeedScreen extends StatefulWidget {
  // Keep these for compatibility with your existing calls (AdminShell/EditorShell old code)
  // but we no longer use them because:
  // - AppShell handles titles via AppBar
  // - Create is a tab now, not a FAB
  // - Pending verification is only in Moderation tab
  final String? title;
  final bool? canCreate;
  final bool? showVerifyQueue;

  const FeedScreen({
    super.key,
    this.title,
    this.canCreate,
    this.showVerifyQueue,
  });

  @override
  State<FeedScreen> createState() => _FeedScreenState();
}

class _FeedScreenState extends State<FeedScreen> {
  final _api = ApiService();

  List<Post> _posts = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadPosts();
  }

  Future<void> _loadPosts() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      // ✅ Normal feed for ALL roles: verified posts only
      final posts = await _api.getPosts();

      if (!mounted) return;
      setState(() => _posts = posts);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    } finally {
      if (!mounted) return;
      setState(() => _loading = false);
    }
  }

  Widget _buildBody() {
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_error != null) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          const SizedBox(height: 120),
          Center(child: Text(_error!, textAlign: TextAlign.center)),
          const SizedBox(height: 12),
          Center(
            child: ElevatedButton(
              onPressed: _loadPosts,
              child: const Text("Retry"),
            ),
          ),
        ],
      );
    }

    if (_posts.isEmpty) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: const [
          SizedBox(height: 140),
          Center(child: Text("No posts yet")),
        ],
      );
    }

    // ✅ Modern spacing rhythm
    return ListView.separated(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.only(top: 8, bottom: 20),
      itemCount: _posts.length,
      separatorBuilder: (_, __) => const SizedBox(height: 2),
      itemBuilder: (context, index) {
        final post = _posts[index];
        return PostCard(
          key: ValueKey(post.id),
          post: post,
          // ✅ Feed should look normal: no moderation badges/actions here
          showAdminVerify: false,
          onVerified: null,
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: _loadPosts,
      child: _buildBody(),
    );
  }
}
