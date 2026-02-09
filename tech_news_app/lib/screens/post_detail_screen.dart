import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:tech_news_app/helpers/youtube.dart' show extractYoutubeId;
import 'package:tech_news_app/screens/user_profile_screen.dart';
import '../models/post.dart';
import '../models/comment.dart';
import '../services/api_service.dart';
import 'package:youtube_player_flutter/youtube_player_flutter.dart';
import '../widgets/post_reaction_bar.dart';
import '../models/post_reaction_user.dart';


class PostDetailScreen extends StatefulWidget {
  final String postId;
  const PostDetailScreen({super.key, required this.postId});

  @override
  State<PostDetailScreen> createState() => _PostDetailScreenState();
}

class _PostDetailScreenState extends State<PostDetailScreen> {
  final _api = ApiService();

  Post? _post;
  bool _loading = true;
  String? _error;
  int _likes = 0;
int _dislikes = 0;
bool? _myReaction; // true/false/null
bool _reacting = false;


  YoutubePlayerController? _ytController;

  // Comments state
  List<Comment> _comments = [];
  bool _commentsLoading = false;
  String? _commentsError;

  final _commentCtrl = TextEditingController();
  bool _sendingComment = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _openReactionsSheet() async {
  showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.white,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(18)),
    ),
    builder: (_) => _ReactionsSheet(postId: widget.postId),
  );
}


Future<void> _load() async {
  setState(() {
    _loading = true;
    _error = null;
    _commentsError = null;
  });

  try {
    // Load post
    final post = await _api.getPostById(widget.postId);

    // Setup YouTube controller if needed
    final id = extractYoutubeId(post.videoUrl);
    if (id != null) {
      _ytController?.dispose();
      _ytController = YoutubePlayerController(
        initialVideoId: id,
        flags: const YoutubePlayerFlags(
          autoPlay: false,
          mute: false,
          enableCaption: true,
          controlsVisibleAtStart: true,
        ),
      );
    } else {
      _ytController?.dispose();
      _ytController = null;
    }

    // Load comments
    final comments = await _api.getCommentsByPostId(widget.postId);

    if (!mounted) return;
    setState(() {
      _post = post;

      // ✅ initialize reactions state from Post model
      _likes = post.likes;
      _dislikes = post.dislikes;
      _myReaction = post.myReaction;

      _comments = comments;
    });
  } catch (e) {
    if (!mounted) return;
    setState(() => _error = e.toString());
  } finally {
    if (!mounted) return;
    setState(() => _loading = false);
  }
}


  Future<void> _reloadComments() async {
    setState(() {
      _commentsLoading = true;
      _commentsError = null;
    });

    try {
      final comments = await _api.getCommentsByPostByIdSafe(widget.postId);
      if (!mounted) return;
      setState(() => _comments = comments);
    } catch (e) {
      if (!mounted) return;
      setState(() => _commentsError = e.toString());
    } finally {
      if (!mounted) return;
      setState(() => _commentsLoading = false);
    }
  }

  // If you prefer not adding helper in ApiService, replace _api.getCommentsByPostByIdSafe
  // with _api.getCommentsByPostId in the method above and delete the helper usage.
  // I included this so you don't crash if backend returns non-200 with message.

  Future<void> _sendComment() async {
    final text = _commentCtrl.text.trim();
    if (text.isEmpty || _sendingComment) return;

    setState(() => _sendingComment = true);

    try {
      await _api.addComment(postId: widget.postId, content: text);
      _commentCtrl.clear();

      // Refresh comments after posting
      final comments = await _api.getCommentsByPostId(widget.postId);

      if (!mounted) return;
      setState(() => _comments = comments);
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

  // Optimistic UI
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
    final summary = await _api.reactToPost(postId: widget.postId, isLike: target);
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
    final summary = await _api.reactToPost(postId: widget.postId, isLike: target);
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


  @override
  void dispose() {
    _ytController?.dispose();
    _commentCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF6F7F9), // light grey feed background
      appBar: AppBar(),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? _ErrorView(error: _error!, onRetry: _load)
              : _post == null
                  ? const Center(child: Text("Post not found"))
                  : RefreshIndicator(
                      onRefresh: _load,
                      child: ListView(
                        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                        children: [
                          _buildPostCard(context),
                          const SizedBox(height: 12),
                          _buildCommentsCard(context),
                        ],
                      ),
                    ),
    );
  }

  Widget _buildPostCard(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Author row
          Row(
            children: [
              CircleAvatar(
                radius: 18,
                backgroundColor: Colors.grey.shade200,
                backgroundImage: _post!.user.profilePictureUrl.isNotEmpty
                    ? NetworkImage(_post!.user.profilePictureUrl)
                    : null,
                child: _post!.user.profilePictureUrl.isEmpty
                    ? const Icon(Icons.person, size: 18)
                    : null,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _post!.user.name,
                      style: const TextStyle(
                        fontWeight: FontWeight.w800,
                        fontSize: 13,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 2),
                    Text(
                      _formatDate(_post!.createdAt),
                      style: TextStyle(
                        color: Colors.grey.shade600,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),

          const SizedBox(height: 14),

          // Title
          Text(
            _post!.title,
            style: const TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.w900,
              height: 1.2,
            ),
          ),

          const SizedBox(height: 14),

          // Hero image
          if (_post!.imageUrl.isNotEmpty) ...[
            ClipRRect(
              borderRadius: BorderRadius.circular(18),
              child: AspectRatio(
                aspectRatio: 16 / 9,
                child: CachedNetworkImage(
                  imageUrl: _post!.imageUrl,
                  fit: BoxFit.cover,
                  placeholder: (_, __) =>
                      const Center(child: CircularProgressIndicator()),
                  errorWidget: (_, __, ___) =>
                      const Center(child: Icon(Icons.broken_image)),
                ),
              ),
            ),
            const SizedBox(height: 16),
          ],

          // Content
          if (_post!.content.trim().isNotEmpty)
            Text(
              _post!.content,
              style: TextStyle(
                fontSize: 15.8,
                height: 1.6,
                color: Colors.grey.shade800,
              ),
            ),


          if (_ytController != null) ...[
            const SizedBox(height: 18),
            ClipRRect(
              borderRadius: BorderRadius.circular(18),
              child: YoutubePlayer(
                controller: _ytController!,
                showVideoProgressIndicator: true,
                progressIndicatorColor: Theme.of(context).colorScheme.primary,
              ),
            ),
          ],
        ],
      ),
    );
  }

  

Widget _buildCommentsCard(BuildContext context) {
  return Container(
    padding: const EdgeInsets.all(14),
    decoration: BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(18),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const Text(
              "Comments",
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800),
            ),
            const Spacer(),
            IconButton(
              tooltip: "Refresh comments",
              onPressed: _commentsLoading ? null : _reloadComments,
              icon: _commentsLoading
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.refresh),
            ),
          ],
        ),
        const SizedBox(height: 8),

        // ✅ Reactions section (TOP of comments)
        InkWell(
          borderRadius: BorderRadius.circular(14),
          onTap: _openReactionsSheet,
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 6),
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
                const Icon(Icons.chevron_right_rounded),
              ],
            ),
          ),
        ),
        const Divider(height: 18),

        // ✅ Composer (now clean)
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
                  contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
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

        const SizedBox(height: 12),

        if (_commentsError != null)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Text(
              _commentsError!,
              style: const TextStyle(color: Color(0xFFB00020)),
            ),
          ),

        if (_comments.isEmpty && !_commentsLoading)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 10),
            child: Text("No comments yet. Be the first."),
          )
        else
          ListView.separated(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: _comments.length,
            separatorBuilder: (_, __) => const Divider(height: 18),
            itemBuilder: (_, i) => _CommentTile(comment: _comments[i]),
          ),
      ],
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

class _CommentTile extends StatelessWidget {
  final Comment comment;
  const _CommentTile({required this.comment});

  void _openProfile(BuildContext context) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => UserProfileScreen(userId: comment.userId),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        GestureDetector(
          onTap: () => _openProfile(context),
          child: CircleAvatar(
            radius: 16,
            backgroundColor: Colors.grey.shade200,
            backgroundImage:
                (comment.userPhotoUrl != null && comment.userPhotoUrl!.isNotEmpty)
                    ? NetworkImage(comment.userPhotoUrl!)
                    : null,
            child: (comment.userPhotoUrl == null || comment.userPhotoUrl!.isEmpty)
                ? const Icon(Icons.person, size: 16)
                : null,
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              GestureDetector(
                onTap: () => _openProfile(context),
                child: Text(
                  comment.userName,
                  style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                comment.content,
                style: TextStyle(
                  fontSize: 14.5,
                  height: 1.45,
                  color: Colors.grey.shade800,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                _formatTinyDate(comment.createdAt),
                style: TextStyle(fontSize: 11.5, color: Colors.grey.shade600),
              ),
            ],
          ),
        ),
      ],
    );
  }

  static String _formatTinyDate(DateTime dt) {
    final y = dt.year.toString();
    final m = dt.month.toString().padLeft(2, '0');
    final d = dt.day.toString().padLeft(2, '0');
    final hh = dt.hour.toString().padLeft(2, '0');
    final mm = dt.minute.toString().padLeft(2, '0');
    return "$y-$m-$d $hh:$mm";
  }
}


class _ErrorView extends StatelessWidget {
  final String error;
  final VoidCallback onRetry;

  const _ErrorView({required this.error, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(error, textAlign: TextAlign.center),
            const SizedBox(height: 12),
            ElevatedButton(onPressed: onRetry, child: const Text("Retry")),
          ],
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
  int _tab = 0; // 0=All, 1=Likes, 2=Dislikes

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
                                separatorBuilder: (_, __) => const Divider(height: 1),
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
                                      backgroundImage: (u.userPhotoUrl != null && u.userPhotoUrl!.isNotEmpty)
                                          ? NetworkImage(u.userPhotoUrl!)
                                          : null,
                                      child: (u.userPhotoUrl == null || u.userPhotoUrl!.isEmpty)
                                          ? const Icon(Icons.person, size: 18)
                                          : null,
                                    ),
                                    title: Text(u.userName, maxLines: 1, overflow: TextOverflow.ellipsis),
                                    subtitle: Text(u.isLike ? "Liked" : "Disliked"),
                                    trailing: Icon(
                                      u.isLike ? Icons.thumb_up_alt_rounded : Icons.thumb_down_alt_rounded,
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
