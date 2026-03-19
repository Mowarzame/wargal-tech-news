import 'package:flutter/material.dart';
import '../models/post.dart';
import '../services/api_service.dart';

class ModerationScreen extends StatefulWidget {
  const ModerationScreen({super.key});

  @override
  State<ModerationScreen> createState() => _ModerationScreenState();
}

class _ModerationScreenState extends State<ModerationScreen> {
  final _api = ApiService();
  final Map<String, bool> _expanded = {};

  List<Post> _posts = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadAll();
  }

  Future<void> _loadAll() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final posts = await _api.getAllPostsAdmin();

      posts.sort((a, b) {
        final aPending = a.isVerified ? 1 : 0;
        final bPending = b.isVerified ? 1 : 0;
        return aPending.compareTo(bPending);
      });

      if (!mounted) return;
      setState(() => _posts = posts);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    } finally {
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }

  Future<void> _verify(String id) async {
    try {
      await _api.verifyPost(id);

      if (!mounted) return;

      setState(() {
        _posts = _posts.map((p) {
          if (p.id == id) {
            return p.copyWith(isVerified: true);
          }
          return p;
        }).toList();
      });

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text("Post verified ✅")),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text("Verify failed: $e")),
      );
    }
  }

  Future<void> _unverify(String id) async {
    try {
      await _api.unverifyPost(id);

      if (!mounted) return;

      setState(() {
        _posts = _posts.map((p) {
          if (p.id == id) {
            return p.copyWith(isVerified: false);
          }
          return p;
        }).toList();
      });

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text("Post set to Pending")),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text("Unverify failed: $e")),
      );
    }
  }

  Future<void> _delete(String id) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text("Delete post?"),
        content: const Text("This will permanently remove the post."),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text("Cancel"),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text("Delete"),
          ),
        ],
      ),
    );

    if (ok != true) return;

    try {
      await _api.deletePost(id);

      if (!mounted) return;

      setState(() => _posts.removeWhere((p) => p.id == id));

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text("Post deleted")),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text("Delete failed: $e")),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: _loadAll,
      child: _loading
          ? ListView(
              children: const [
                SizedBox(height: 250),
                Center(child: CircularProgressIndicator()),
              ],
            )
          : _error != null
              ? ListView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  children: [
                    const SizedBox(height: 120),
                    Center(child: Text(_error!, textAlign: TextAlign.center)),
                    const SizedBox(height: 12),
                    Center(
                      child: ElevatedButton(
                        onPressed: _loadAll,
                        child: const Text("Retry"),
                      ),
                    ),
                  ],
                )
              : _posts.isEmpty
                  ? ListView(
                      physics: const AlwaysScrollableScrollPhysics(),
                      children: const [
                        SizedBox(height: 160),
                        Center(child: Text("No posts available.")),
                      ],
                    )
                  : ListView.separated(
                      physics: const AlwaysScrollableScrollPhysics(),
                      padding: const EdgeInsets.only(top: 8, bottom: 20),
                      itemCount: _posts.length,
                      separatorBuilder: (_, _) => const SizedBox(height: 2),
                      itemBuilder: (context, index) {
                        final post = _posts[index];
                        final isExpanded = _expanded[post.id] ?? false;

                        return _ModerationCard(
                          post: post,
                          isExpanded: isExpanded,
                          onToggleExpanded: () {
                            setState(() => _expanded[post.id] = !isExpanded);
                          },
                          onVerify: () => _verify(post.id),
                          onUnverify: () => _unverify(post.id),
                          onDelete: () => _delete(post.id),
                        );
                      },
                    ),
    );
  }
}

class _ModerationCard extends StatelessWidget {
  final Post post;
  final bool isExpanded;
  final VoidCallback onToggleExpanded;
  final VoidCallback onVerify;
  final VoidCallback onUnverify;
  final VoidCallback onDelete;

  const _ModerationCard({
    required this.post,
    required this.isExpanded,
    required this.onToggleExpanded,
    required this.onVerify,
    required this.onUnverify,
    required this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    final hasImage = post.imageUrl.isNotEmpty;
    final content = post.content.trim();
    final hasContent = content.isNotEmpty;

    const previewLines = 3;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                CircleAvatar(
                  radius: 16,
                  backgroundColor: Colors.grey.shade200,
                  backgroundImage: post.user.profilePictureUrl.isNotEmpty
                      ? NetworkImage(post.user.profilePictureUrl)
                      : null,
                  child: post.user.profilePictureUrl.isEmpty
                      ? const Icon(Icons.person, size: 18)
                      : null,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        post.user.name,
                        style: const TextStyle(
                          fontWeight: FontWeight.w800,
                          fontSize: 13,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 2),
                      Text(
                        _formatDate(post.createdAt),
                        style: TextStyle(
                          color: Colors.grey.shade600,
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ),
                ),
                _StatusChip(isVerified: post.isVerified),
              ],
            ),
            const SizedBox(height: 12),
            Text(
              post.title,
              style: const TextStyle(
                fontSize: 17,
                fontWeight: FontWeight.w900,
                height: 1.25,
              ),
            ),
            const SizedBox(height: 10),
            if (hasContent) ...[
              Text(
                content,
                maxLines: isExpanded ? null : previewLines,
                overflow:
                    isExpanded ? TextOverflow.visible : TextOverflow.ellipsis,
                style: TextStyle(
                  color: Colors.grey.shade800,
                  height: 1.55,
                  fontSize: 14.2,
                ),
              ),
              const SizedBox(height: 8),
              Align(
                alignment: Alignment.centerRight,
                child: TextButton(
                  onPressed: onToggleExpanded,
                  child: Text(isExpanded ? "Read less" : "Read more"),
                ),
              ),
            ],
            if (hasImage) ...[
              const SizedBox(height: 8),
              ClipRRect(
                borderRadius: BorderRadius.circular(14),
                child: AspectRatio(
                  aspectRatio: 16 / 9,
                  child: Image.network(
                    post.imageUrl,
                    fit: BoxFit.cover,
                    errorBuilder: (_, _, _) =>
                        const Center(child: Icon(Icons.broken_image)),
                    loadingBuilder: (context, child, progress) {
                      if (progress == null) return child;
                      return const Center(child: CircularProgressIndicator());
                    },
                  ),
                ),
              ),
            ],
            const SizedBox(height: 14),
            Row(
              children: [
                Expanded(
                  child: post.isVerified
                      ? OutlinedButton.icon(
                          onPressed: onUnverify,
                          icon: const Icon(Icons.undo),
                          label: const Text("Unverify"),
                        )
                      : ElevatedButton.icon(
                          onPressed: onVerify,
                          icon: const Icon(Icons.check_circle),
                          label: const Text("Verify"),
                        ),
                ),
                const SizedBox(width: 10),
                IconButton(
                  tooltip: "Delete",
                  onPressed: onDelete,
                  icon: const Icon(Icons.delete_outline),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  static String _formatDate(DateTime dt) {
    final y = dt.year.toString();
    final m = dt.month.toString().padLeft(2, '0');
    final d = dt.day.toString().padLeft(2, '0');
    return "$y-$m-$d";
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
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: color.withValues(alpha: 0.25)),
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