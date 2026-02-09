import 'package:flutter/material.dart';
import '../models/post.dart';
import '../services/api_service.dart';
import 'post_detail_screen.dart';

class EditorMyPostsScreen extends StatefulWidget {
  const EditorMyPostsScreen({super.key});

  @override
  State<EditorMyPostsScreen> createState() => _EditorMyPostsScreenState();
}

class _EditorMyPostsScreenState extends State<EditorMyPostsScreen> {
  final _api = ApiService();

  List<Post> _posts = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final posts = await _api.getMyPosts();
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

  void _open(Post p) {
    if (!p.isVerified) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text("This post is pending verification.")),
      );
      return;
    }

    Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => PostDetailScreen(postId: p.id)),
    );
  }

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: _load,
      child: _loading
          ? ListView(children: const [SizedBox(height: 220), Center(child: CircularProgressIndicator())])
          : _error != null
              ? ListView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  children: [
                    const SizedBox(height: 140),
                    Center(child: Text(_error!, textAlign: TextAlign.center)),
                    const SizedBox(height: 12),
                    Center(child: ElevatedButton(onPressed: _load, child: const Text("Retry"))),
                  ],
                )
              : _posts.isEmpty
                  ? ListView(
                      physics: const AlwaysScrollableScrollPhysics(),
                      children: const [
                        SizedBox(height: 160),
                        Center(child: Text("You have no posts yet.")),
                      ],
                    )
                  : ListView.separated(
                      physics: const AlwaysScrollableScrollPhysics(),
                      padding: const EdgeInsets.only(top: 8, bottom: 20),
                      itemCount: _posts.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 2),
                      itemBuilder: (_, i) {
                        final p = _posts[i];
                        return _MyPostTile(post: p, onTap: () => _open(p));
                      },
                    ),
    );
  }
}

class _MyPostTile extends StatelessWidget {
  final Post post;
  final VoidCallback onTap;

  const _MyPostTile({required this.post, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final hasImage = post.imageUrl.isNotEmpty;

    return Card(
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Thumbnail
              ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: Container(
                  width: 72,
                  height: 72,
                  color: Colors.grey.shade200,
                  child: hasImage
                      ? Image.network(
                          post.imageUrl,
                          fit: BoxFit.cover,
                          errorBuilder: (_, __, ___) =>
                              const Icon(Icons.broken_image_outlined),
                        )
                      : const Icon(Icons.image_not_supported_outlined),
                ),
              ),
              const SizedBox(width: 12),

              // Content
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Title + status chip
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: Text(
                            post.title,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontWeight: FontWeight.w900,
                              height: 1.2,
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        _StatusChip(isVerified: post.isVerified),
                      ],
                    ),

                    const SizedBox(height: 8),

                    // Metrics (only when verified)
                    if (post.isVerified)
                      Row(
                        children: [
                          _Metric(icon: Icons.thumb_up_alt_outlined, value: post.likes),
                          const SizedBox(width: 14),
                          _Metric(icon: Icons.comment_outlined, value: post.commentsCount),
                        ],
                      )
                    else
                      Text(
                        "Pending verification",
                        style: TextStyle(color: Colors.orange.shade700, fontWeight: FontWeight.w700),
                      ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Metric extends StatelessWidget {
  final IconData icon;
  final int value;

  const _Metric({required this.icon, required this.value});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 18, color: Colors.grey.shade700),
        const SizedBox(width: 6),
        Text(
          value.toString(),
          style: TextStyle(fontWeight: FontWeight.w800, color: Colors.grey.shade800),
        ),
      ],
    );
  }
}

class _StatusChip extends StatelessWidget {
  final bool isVerified;
  const _StatusChip({required this.isVerified});

  @override
  Widget build(BuildContext context) {
    final color = isVerified ? Colors.green : Colors.orange;
    final text = isVerified ? "VERIFIED" : "PENDING";

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: color.withOpacity(0.12),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: color.withOpacity(0.25)),
      ),
      child: Text(
        text,
        style: TextStyle(
          color: color,
          fontSize: 11,
          fontWeight: FontWeight.w900,
          letterSpacing: 0.3,
        ),
      ),
    );
  }
}
