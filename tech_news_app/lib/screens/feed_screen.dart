import 'package:flutter/material.dart';
import '../models/post.dart';
import '../services/api_service.dart';
import '../widgets/post_card.dart';

class FeedScreen extends StatefulWidget {
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
  State<FeedScreen> createState() => FeedScreenState();
}

class FeedScreenState extends State<FeedScreen> {
  final _api = ApiService();
  final ScrollController _scrollController = ScrollController();

  List<Post> _posts = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadPosts();
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  void onTabActivated({
    bool scrollTop = false,
    bool forceRefresh = false,
  }) {
    FocusManager.instance.primaryFocus?.unfocus();

    if (scrollTop && _scrollController.hasClients) {
      _scrollController.animateTo(
        0,
        duration: const Duration(milliseconds: 260),
        curve: Curves.easeOut,
      );
    }

    if (forceRefresh) {
      _loadPosts();
    }
  }

  Future<void> _loadPosts() async {
    FocusManager.instance.primaryFocus?.unfocus();

    setState(() {
      _loading = true;
      _error = null;
    });

    try {
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

  void _dismissKeyboard() {
    final currentFocus = FocusScope.of(context);
    if (!currentFocus.hasPrimaryFocus && currentFocus.focusedChild != null) {
      currentFocus.unfocus();
    } else {
      FocusManager.instance.primaryFocus?.unfocus();
    }
  }

  Widget _buildLoading() {
    return ListView(
      controller: _scrollController,
      keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
      physics: const AlwaysScrollableScrollPhysics(),
      children: const [
        SizedBox(height: 220),
        Center(child: CircularProgressIndicator()),
      ],
    );
  }

  Widget _buildError() {
    return ListView(
      controller: _scrollController,
      keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
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

  Widget _buildEmpty() {
    return ListView(
      controller: _scrollController,
      keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
      physics: const AlwaysScrollableScrollPhysics(),
      children: const [
        SizedBox(height: 140),
        Center(child: Text("No posts yet")),
      ],
    );
  }

  Widget _buildList() {
    return ListView.separated(
      controller: _scrollController,
      keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.only(top: 8, bottom: 20),
      itemCount: _posts.length,
      separatorBuilder: (_, _) => const SizedBox(height: 2),
      itemBuilder: (context, index) {
        final post = _posts[index];
        return PostCard(
          key: ValueKey(post.id),
          post: post,
          showAdminVerify: false,
          onVerified: null,
        );
      },
    );
  }

  Widget _buildBody() {
    if (_loading) return _buildLoading();
    if (_error != null) return _buildError();
    if (_posts.isEmpty) return _buildEmpty();
    return _buildList();
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.translucent,
      onTap: _dismissKeyboard,
      child: RefreshIndicator(
        onRefresh: _loadPosts,
        child: _buildBody(),
      ),
    );
  }
}