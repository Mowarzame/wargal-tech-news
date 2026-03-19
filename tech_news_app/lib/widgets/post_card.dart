import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../models/comment.dart';
import '../models/post.dart';
import '../models/post_reaction_user.dart';
import '../screens/post_detail_screen.dart';
import '../screens/user_profile_screen.dart';
import '../services/api_service.dart';
import 'post_image_gallery_viewer.dart';
import 'post_reaction_bar.dart';

class PostCard extends StatefulWidget {
  final Post post;
  final bool showAdminVerify;
  final VoidCallback? onVerified;

  const PostCard({
    super.key,
    required this.post,
    required this.showAdminVerify,
    this.onVerified,
  });

  @override
  State<PostCard> createState() => _PostCardState();
}

class _PostCardState extends State<PostCard> {
  final ApiService _api = ApiService();
  final TextEditingController _commentCtrl = TextEditingController();

  // ✅ lightweight in-memory cache per post
  static final Map<String, List<Comment>> _commentsCache = {};
  static final Map<String, DateTime> _commentsCacheTime = {};

  late int _likes;
  late int _dislikes;
  late bool? _myReaction;

  bool _reacting = false;
  bool _commentsLoading = false;
  bool _sendingComment = false;
  String? _commentsError;

  List<Comment> _comments = [];

  Post get post => widget.post;

  @override
  void initState() {
    super.initState();
    _likes = post.likes;
    _dislikes = post.dislikes;
    _myReaction = post.myReaction;
    _bootstrapComments();
  }

  void _bootstrapComments() {
    final cached = _commentsCache[post.id];
    if (cached != null) {
      _comments = cached;
      return;
    }
    _loadComments();
  }

  @override
  void dispose() {
    _commentCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadComments({bool forceRefresh = false}) async {
    if (!forceRefresh && _commentsCache.containsKey(post.id)) {
      final cached = _commentsCache[post.id]!;
      if (mounted) {
        setState(() {
          _comments = cached;
          _commentsLoading = false;
          _commentsError = null;
        });
      }
      return;
    }

    setState(() {
      _commentsLoading = true;
      _commentsError = null;
    });

    try {
      final comments = await _api.getCommentsByPostId(post.id);
      if (!mounted) return;

      _commentsCache[post.id] = comments;
      _commentsCacheTime[post.id] = DateTime.now();

      setState(() {
        _comments = comments;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _commentsError = e.toString();
      });
    } finally {
      if (!mounted) return;
      setState(() {
        _commentsLoading = false;
      });
    }
  }

  Future<void> _sendComment() async {
    final text = _commentCtrl.text.trim();
    if (text.isEmpty || _sendingComment) return;

    setState(() => _sendingComment = true);

    try {
      await _api.addComment(postId: post.id, content: text);
      _commentCtrl.clear();

      final comments = await _api.getCommentsByPostId(post.id);
      if (!mounted) return;

      _commentsCache[post.id] = comments;
      _commentsCacheTime[post.id] = DateTime.now();

      setState(() {
        _comments = comments;
      });
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString())),
      );
    } finally {
      if (!mounted) return;
      setState(() => _sendingComment = false);
    }
  }

  Future<void> _onLike() async {
    if (_reacting) return;

    final prevLikes = _likes;
    final prevDislikes = _dislikes;
    final prevReaction = _myReaction;

    final bool? target = (_myReaction == true) ? null : true;

    setState(() {
      _reacting = true;

      if (target == null) {
        _likes = (_likes > 0) ? _likes - 1 : 0;
        _myReaction = null;
      } else {
        if (_myReaction == false) {
          _dislikes = (_dislikes > 0) ? _dislikes - 1 : 0;
        }
        if (_myReaction != true) _likes += 1;
        _myReaction = true;
      }
    });

    try {
      final summary = await _api.reactToPost(postId: post.id, isLike: target);
      if (!mounted) return;
      setState(() {
        _likes = (summary['likes'] ?? _likes) as int;
        _dislikes = (summary['dislikes'] ?? _dislikes) as int;
        _myReaction = summary['myReaction'];
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _likes = prevLikes;
        _dislikes = prevDislikes;
        _myReaction = prevReaction;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString())),
      );
    } finally {
      if (!mounted) return;
      setState(() => _reacting = false);
    }
  }

  Future<void> _onDislike() async {
    if (_reacting) return;

    final prevLikes = _likes;
    final prevDislikes = _dislikes;
    final prevReaction = _myReaction;

    final bool? target = (_myReaction == false) ? null : false;

    setState(() {
      _reacting = true;

      if (target == null) {
        _dislikes = (_dislikes > 0) ? _dislikes - 1 : 0;
        _myReaction = null;
      } else {
        if (_myReaction == true) {
          _likes = (_likes > 0) ? _likes - 1 : 0;
        }
        if (_myReaction != false) _dislikes += 1;
        _myReaction = false;
      }
    });

    try {
      final summary = await _api.reactToPost(postId: post.id, isLike: target);
      if (!mounted) return;
      setState(() {
        _likes = (summary['likes'] ?? _likes) as int;
        _dislikes = (summary['dislikes'] ?? _dislikes) as int;
        _myReaction = summary['myReaction'];
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _likes = prevLikes;
        _dislikes = prevDislikes;
        _myReaction = prevReaction;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString())),
      );
    } finally {
      if (!mounted) return;
      setState(() => _reacting = false);
    }
  }

  void _openPost(BuildContext context) {
    Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => PostDetailScreen(postId: post.id)),
    );
  }

  void _openGallery(BuildContext context, int initialIndex) {
    final images = post.allImages;
    if (images.isEmpty) return;

    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => PostImageGalleryViewer(
          imageUrls: images,
          initialIndex: initialIndex,
        ),
      ),
    );
  }

  Future<void> _openReactionsSheet() async {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(18)),
      ),
      builder: (_) => _ReactionsSheet(postId: post.id),
    );
  }

  Widget _buildImageTile(
    BuildContext context, {
    required String imageUrl,
    required VoidCallback onTap,
    Widget? overlay,
  }) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(14),
      child: Material(
        color: Colors.grey.shade200,
        child: InkWell(
          onTap: onTap,
          child: Stack(
            fit: StackFit.expand,
            children: [
              CachedNetworkImage(
                imageUrl: imageUrl,
                fit: BoxFit.cover,
                placeholder: (_, __) => const Center(
                  child: CircularProgressIndicator(),
                ),
                errorWidget: (_, __, ___) => const Center(
                  child: Icon(Icons.broken_image),
                ),
              ),
              if (overlay != null) overlay,
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildImages(BuildContext context) {
    final images = post.allImages;
    if (images.isEmpty) return const SizedBox.shrink();

    if (images.length == 1) {
      return AspectRatio(
        aspectRatio: 16 / 9,
        child: _buildImageTile(
          context,
          imageUrl: images[0],
          onTap: () => _openGallery(context, 0),
        ),
      );
    }

    if (images.length == 2) {
      return SizedBox(
        height: 230,
        child: Row(
          children: [
            Expanded(
              child: _buildImageTile(
                context,
                imageUrl: images[0],
                onTap: () => _openGallery(context, 0),
              ),
            ),
            const SizedBox(width: 6),
            Expanded(
              child: _buildImageTile(
                context,
                imageUrl: images[1],
                onTap: () => _openGallery(context, 1),
              ),
            ),
          ],
        ),
      );
    }

    return SizedBox(
      height: 260,
      child: Row(
        children: [
          Expanded(
            flex: 6,
            child: _buildImageTile(
              context,
              imageUrl: images[0],
              onTap: () => _openGallery(context, 0),
            ),
          ),
          const SizedBox(width: 6),
          Expanded(
            flex: 4,
            child: Column(
              children: [
                Expanded(
                  child: _buildImageTile(
                    context,
                    imageUrl: images[1],
                    onTap: () => _openGallery(context, 1),
                  ),
                ),
                const SizedBox(height: 6),
                Expanded(
                  child: _buildImageTile(
                    context,
                    imageUrl: images[2],
                    onTap: () => _openGallery(context, 2),
                    overlay: images.length > 3
                        ? Container(
                            color: Colors.black45,
                            alignment: Alignment.center,
                            child: Text(
                              "+${images.length - 3}",
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 28,
                                fontWeight: FontWeight.w900,
                              ),
                            ),
                          )
                        : null,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCommentTile(Comment comment) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        GestureDetector(
          onTap: () {
            Navigator.push(
              context,
              MaterialPageRoute(
                builder: (_) => UserProfileScreen(userId: comment.userId),
              ),
            );
          },
          child: CircleAvatar(
            radius: 14,
            backgroundColor: Colors.grey.shade200,
            backgroundImage:
                (comment.userPhotoUrl != null && comment.userPhotoUrl!.isNotEmpty)
                    ? NetworkImage(comment.userPhotoUrl!)
                    : null,
            child: (comment.userPhotoUrl == null || comment.userPhotoUrl!.isEmpty)
                ? const Icon(Icons.person, size: 14)
                : null,
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
            decoration: BoxDecoration(
              color: const Color(0xFFF4F5F7),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  comment.userName,
                  style: const TextStyle(
                    fontWeight: FontWeight.w800,
                    fontSize: 12.5,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  comment.content,
                  style: TextStyle(
                    fontSize: 13.3,
                    height: 1.35,
                    color: Colors.grey.shade800,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  _timeAgo(comment.createdAt),
                  style: TextStyle(
                    fontSize: 11,
                    color: Colors.grey.shade600,
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final hasPreview = post.content.trim().isNotEmpty;
    final previewComments = _comments.take(2).toList();

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            InkWell(
              borderRadius: BorderRadius.circular(18),
              onTap: () => _openPost(context),
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
                                fontWeight: FontWeight.w700,
                                fontSize: 13,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                            const SizedBox(height: 2),
                            Text(
                              _timeAgo(post.createdAt),
                              style: TextStyle(
                                color: Colors.grey.shade600,
                                fontSize: 12,
                              ),
                            ),
                          ],
                        ),
                      ),
                      if (widget.showAdminVerify)
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
                  const SizedBox(height: 8),
                      if (hasPreview) ...[
                    Text(
                      post.content,
                      maxLines: 3,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: Colors.grey.shade700,
                        height: 1.35,
                        fontSize: 13.5,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Align(
                      alignment: Alignment.centerLeft,
                      child: TextButton(
                        onPressed: () => _openPost(context),
                        style: TextButton.styleFrom(
                          padding: EdgeInsets.zero,
                          minimumSize: Size.zero,
                          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                        ),
                        child: const Text("Read more"),
                      ),
                    ),
                  ],
                  if (post.hasImages) ...[
                    const SizedBox(height: 12),
                    _buildImages(context),
                  ],
                  const SizedBox(height: 10),
                ],
              ),
            ),

            Divider(color: Colors.grey.shade200),
            const SizedBox(height: 8),

            InkWell(
              borderRadius: BorderRadius.circular(14),
              onTap: _openReactionsSheet,
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Row(
                  children: [
                    Expanded(
                      child: PostReactionBar(
                        likes: _likes,
                        dislikes: _dislikes,
                        myReaction: _myReaction,
                        onLike: _onLike,
                        onDislike: _onDislike,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      "${_comments.length} comments",
                      style: TextStyle(
                        color: Colors.grey.shade700,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(width: 4),
                    const Icon(Icons.chevron_right_rounded),
                  ],
                ),
              ),
            ),

            const SizedBox(height: 12),

            if (_commentsError != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Text(
                  _commentsError!,
                  style: const TextStyle(color: Color(0xFFB00020)),
                ),
              ),

            if (_commentsLoading)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 12),
                child: Center(child: CircularProgressIndicator()),
              )
            else if (previewComments.isEmpty)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 6),
                child: Text("No comments yet. Be the first."),
              )
            else
              Column(
                children: [
                  for (int i = 0; i < previewComments.length; i++) ...[
                    _buildCommentTile(previewComments[i]),
                    if (i != previewComments.length - 1)
                      const SizedBox(height: 10),
                  ],
                  if (_comments.length > 2) ...[
                    const SizedBox(height: 10),
                    Align(
                      alignment: Alignment.centerLeft,
                      child: TextButton(
                        onPressed: () => _openPost(context),
                        child: const Text("View all comments"),
                      ),
                    ),
                  ],
                ],
              ),

            const SizedBox(height: 12),

            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _commentCtrl,
                    minLines: 1,
                    maxLines: 3,
                    decoration: InputDecoration(
                      hintText: "Write a comment…",
                      filled: true,
                      fillColor: const Color(0xFFF4F5F7),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: BorderSide.none,
                      ),
                      contentPadding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 10,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                IconButton(
                  onPressed: _sendingComment ? null : _sendComment,
                  icon: _sendingComment
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.send_rounded),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  static String _timeAgo(DateTime dt) {
    final now = DateTime.now().toUtc();
    final value = dt.toUtc();
    final diff = now.difference(value);

    if (diff.inSeconds < 60) return "Just now";
    if (diff.inMinutes < 60) return "${diff.inMinutes}m ago";
    if (diff.inHours < 24) return "${diff.inHours}h ago";
    if (diff.inDays < 7) return "${diff.inDays}d ago";
    if (diff.inDays < 30) return "${(diff.inDays / 7).floor()}w ago";
    if (diff.inDays < 365) return "${(diff.inDays / 30).floor()}mo ago";
    return "${(diff.inDays / 365).floor()}y ago";
  }
}

class _StatusChip extends StatelessWidget {
  final bool isVerified;

  const _StatusChip({required this.isVerified});

  @override
  Widget build(BuildContext context) {
    final bg = isVerified ? Colors.green : Colors.orange;
    final text = isVerified ? "VERIFIED" : "PENDING";

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: bg.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: bg.withValues(alpha: 0.25)),
      ),
      child: Text(
        text,
        style: TextStyle(
          color: bg,
          fontSize: 11,
          fontWeight: FontWeight.w800,
          letterSpacing: 0.3,
        ),
      ),
    );
  }
}

class _ReactionsSheet extends StatefulWidget {
  final String postId;
  const _ReactionsSheet({required this.postId});

  @override
  State<_ReactionsSheet> createState() => _ReactionsSheetState();
}

class _ReactionsSheetState extends State<_ReactionsSheet> {
  final _api = ApiService();
  bool _loading = true;
  String? _error;
  List<PostReactionUser> _items = [];
  int _tab = 0;

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
      final data = await _api.getPostReactionsUsers(widget.postId);
      if (!mounted) return;
      setState(() => _items = data);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    } finally {
      if (!mounted) return;
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final likesCount = _items.where((x) => x.isLike).length;
    final dislikesCount = _items.where((x) => !x.isLike).length;

    final filtered = _tab == 1
        ? _items.where((x) => x.isLike).toList()
        : _tab == 2
            ? _items.where((x) => !x.isLike).toList()
            : _items;

    return SafeArea(
      child: Padding(
        padding: EdgeInsets.only(
          left: 16,
          right: 16,
          top: 10,
          bottom: MediaQuery.of(context).viewInsets.bottom + 16,
        ),
        child: SizedBox(
          height: MediaQuery.of(context).size.height * 0.75,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 44,
                  height: 5,
                  margin: const EdgeInsets.only(bottom: 10),
                  decoration: BoxDecoration(
                    color: Colors.black12,
                    borderRadius: BorderRadius.circular(99),
                  ),
                ),
              ),
              Row(
                children: [
                  const Text(
                    "Reactions",
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900),
                  ),
                  const Spacer(),
                  IconButton(onPressed: _load, icon: const Icon(Icons.refresh)),
                ],
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  _TabChip(
                    label: "All",
                    count: _items.length,
                    active: _tab == 0,
                    onTap: () => setState(() => _tab = 0),
                  ),
                  const SizedBox(width: 8),
                  _TabChip(
                    label: "Likes",
                    count: likesCount,
                    active: _tab == 1,
                    onTap: () => setState(() => _tab = 1),
                  ),
                  const SizedBox(width: 8),
                  _TabChip(
                    label: "Dislikes",
                    count: dislikesCount,
                    active: _tab == 2,
                    onTap: () => setState(() => _tab = 2),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Expanded(
                child: _loading
                    ? const Center(child: CircularProgressIndicator())
                    : _error != null
                        ? Center(child: Text(_error!, textAlign: TextAlign.center))
                        : filtered.isEmpty
                            ? const Center(child: Text("No reactions yet."))
                            : ListView.separated(
                                itemCount: filtered.length,
                                separatorBuilder: (_, _) => const Divider(height: 1),
                                itemBuilder: (_, i) {
                                  final u = filtered[i];
                                  return ListTile(
                                    onTap: () {
                                      Navigator.push(
                                        context,
                                        MaterialPageRoute(
                                          builder: (_) => UserProfileScreen(userId: u.userId),
                                        ),
                                      );
                                    },
                                    leading: CircleAvatar(
                                      backgroundColor: Colors.grey.shade200,
                                      backgroundImage:
                                          (u.userPhotoUrl != null && u.userPhotoUrl!.isNotEmpty)
                                              ? NetworkImage(u.userPhotoUrl!)
                                              : null,
                                      child: (u.userPhotoUrl == null || u.userPhotoUrl!.isEmpty)
                                          ? const Icon(Icons.person, size: 18)
                                          : null,
                                    ),
                                    title: Text(
                                      u.userName,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                    subtitle: Text(u.isLike ? "Liked" : "Disliked"),
                                    trailing: Icon(
                                      u.isLike
                                          ? Icons.thumb_up_alt_rounded
                                          : Icons.thumb_down_alt_rounded,
                                      size: 18,
                                    ),
                                  );
                                },
                              ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _TabChip extends StatelessWidget {
  final String label;
  final int count;
  final bool active;
  final VoidCallback onTap;

  const _TabChip({
    required this.label,
    required this.count,
    required this.active,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(999),
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: active ? Colors.black : const Color(0xFFF2F3F5),
          borderRadius: BorderRadius.circular(999),
        ),
        child: Text(
          "$label $count",
          style: TextStyle(
            fontWeight: FontWeight.w800,
            color: active ? Colors.white : Colors.black87,
          ),
        ),
      ),
    );
  }
}