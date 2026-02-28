import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:youtube_player_flutter/youtube_player_flutter.dart';

import '../models/news_item.dart';
import '../providers/news_provider.dart';

class ContentModal {
  static Future<void> open(
    BuildContext context,
    NewsItem item, {
    List<NewsItem>? related,
  }) async {
    await showDialog(
      context: context,
      barrierDismissible: true,
      builder: (_) => _ContentModalDialog(item: item, related: related),
    );
  }
}

class _ContentModalDialog extends StatefulWidget {
  final NewsItem item;
  final List<NewsItem>? related;

  const _ContentModalDialog({
    required this.item,
    this.related,
  });

  @override
  State<_ContentModalDialog> createState() => _ContentModalDialogState();
}

class _ContentModalDialogState extends State<_ContentModalDialog> {
  WebViewController? _web;
  YoutubePlayerController? _yt;

  // ✅ Cache related once (avoid recomputing during rebuilds)
  List<NewsItem> _cachedRelated = const [];

  bool get _isYouTube {
    final url = widget.item.url.trim();
    final id = YoutubePlayer.convertUrlToId(url);
    return id != null && id.isNotEmpty;
  }

  bool get _isShorts {
    final u = widget.item.url.toLowerCase();
    return u.contains("/shorts/") || u.contains("shorts");
  }

  String _timeAgo(DateTime dt) {
    final now = DateTime.now();
    final diff = now.difference(dt);

    if (diff.inSeconds < 60) return 'just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    if (diff.inDays < 7) return '${diff.inDays}d ago';

    final w = (diff.inDays / 7).floor();
    if (w < 4) return '${w}w ago';

    final mo = (diff.inDays / 30).floor();
    return '${mo}mo ago';
  }

  @override
  void initState() {
    super.initState();

    final url = widget.item.url.trim();
    final ytId = YoutubePlayer.convertUrlToId(url);

    // ✅ YouTube
    if (ytId != null && ytId.isNotEmpty) {
      _yt = YoutubePlayerController(
        initialVideoId: ytId,
        flags: const YoutubePlayerFlags(
          autoPlay: true,
          mute: false,
          enableCaption: true,
        ),
      );

      // Related: prefer caller-provided, else compute once after first frame
      if (widget.related != null) {
        _cachedRelated = widget.related!;
      } else {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (!mounted) return;
          _cachedRelated = _relatedFromProvider(context);
          setState(() {});
        });
      }
      return;
    }

    // ✅ Website/RSS -> WebView
    final parsed = Uri.tryParse(url);
    if (parsed != null) {
      _web = WebViewController()
        ..setJavaScriptMode(JavaScriptMode.unrestricted)
        ..setNavigationDelegate(NavigationDelegate())
        ..loadRequest(parsed);
    }
  }

  @override
  void dispose() {
    _yt?.dispose();
    super.dispose();
  }

  Widget _buildSourceAvatar(String iconUrl, String sourceName, {double r = 18}) {
    final url = iconUrl.trim();
    if (url.isNotEmpty) {
      return CircleAvatar(
        radius: r,
        backgroundColor: Colors.grey.shade200,
        backgroundImage: CachedNetworkImageProvider(url),
      );
    }
    final letter = sourceName.isNotEmpty ? sourceName[0].toUpperCase() : "?";
    return CircleAvatar(
      radius: r,
      backgroundColor: Colors.grey.shade200,
      child: Text(letter, style: const TextStyle(fontWeight: FontWeight.w900)),
    );
  }

  List<NewsItem> _relatedFromProvider(BuildContext context) {
    if (!_isYouTube) return const [];

    final p = context.read<NewsProvider>();
    final cur = widget.item;
    final all = p.items;

    final rel = all.where((x) {
      if (x.url.trim().isEmpty) return false;
      if (x.url.trim() == cur.url.trim()) return false;
      if (x.kind != 2) return false;

      if (x.sourceId == cur.sourceId) return true;

      if (x.sourceName.trim().isNotEmpty &&
          x.sourceName.trim().toLowerCase() ==
              cur.sourceName.trim().toLowerCase()) {
        return true;
      }

      return false;
    }).toList();

    rel.sort((a, b) => b.publishedAt.compareTo(a.publishedAt));

    if (rel.isEmpty) {
      final fallback = all
          .where((x) =>
              x.kind == 2 &&
              x.url.trim().isNotEmpty &&
              x.url.trim() != cur.url.trim())
          .toList()
        ..sort((a, b) => b.publishedAt.compareTo(a.publishedAt));
      return fallback.take(10).toList();
    }

    return rel.take(10).toList();
  }

  @override
  Widget build(BuildContext context) {
    final item = widget.item;

    final icon = (item.sourceIconUrl ?? "").trim();
    final sourceName =
        item.sourceName.trim().isEmpty ? "Source" : item.sourceName.trim();
    final ago = _timeAgo(item.publishedAt.toLocal());

    final isYoutube = _isYouTube;
    final related = isYoutube ? _cachedRelated : const <NewsItem>[];

    return Dialog(
      insetPadding: const EdgeInsets.symmetric(horizontal: 0, vertical: 18),
      backgroundColor: Colors.white,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(18),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // ✅ Header (unchanged UI)
            Container(
              color: Colors.white,
              padding: const EdgeInsets.fromLTRB(12, 12, 8, 10),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _buildSourceAvatar(icon, sourceName, r: 18),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                sourceName,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  fontWeight: FontWeight.w900,
                                ),
                              ),
                            ),
                            const SizedBox(width: 10),
                            Text(
                              ago,
                              style: TextStyle(
                                color: Colors.grey.shade700,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Text(
                          item.title,
                          maxLines: 3,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    tooltip: "Close",
                    onPressed: () => Navigator.pop(context),
                    icon: const Icon(Icons.close),
                  ),
                ],
              ),
            ),

            const Divider(height: 1),

            Flexible(
              child: Container(
                color: Colors.white,
                child: isYoutube
                    ? _YoutubeBody(
                        controller: _yt,
                        isShorts: _isShorts,
                        related: related,
                        buildSourceAvatar: _buildSourceAvatar,
                        timeAgo: (dt) => _timeAgo(dt),
                        onOpen: (it) {
                          Navigator.pop(context);
                          ContentModal.open(context, it, related: widget.related);
                        },
                      )
                    : _WebBody(controller: _web),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _YoutubeBody extends StatefulWidget {
  final YoutubePlayerController? controller;
  final bool isShorts;

  final List<NewsItem> related;
  final Widget Function(String iconUrl, String sourceName, {double r})
      buildSourceAvatar;
  final String Function(DateTime dt) timeAgo;
  final void Function(NewsItem it) onOpen;

  const _YoutubeBody({
    required this.controller,
    required this.isShorts,
    required this.related,
    required this.buildSourceAvatar,
    required this.timeAgo,
    required this.onOpen,
  });

  @override
  State<_YoutubeBody> createState() => _YoutubeBodyState();
}

class _YoutubeBodyState extends State<_YoutubeBody> {
  // ✅ Reuse controller (don’t recreate during rebuilds)
  late final PageController _page =
      PageController(viewportFraction: 0.92, initialPage: 0);

  @override
  void dispose() {
    _page.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final controller = widget.controller;
    if (controller == null) {
      return const Center(child: Text("Video not available."));
    }

    // Keep the same layout but avoid ConstrainedBox(maxHeight) churn.
    final ar = widget.isShorts ? (9 / 16) : (16 / 9);

    return SingleChildScrollView(
      padding: const EdgeInsets.all(12),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // ✅ isolate player so PageView animations don’t trigger repaints
          RepaintBoundary(
            child: ClipRRect(
              borderRadius: BorderRadius.circular(14),
              child: AspectRatio(
                aspectRatio: ar,
                child: YoutubePlayer(
                  controller: controller,
                  showVideoProgressIndicator: true,
                  onReady: () => controller.play(),
                ),
              ),
            ),
          ),

          if (widget.related.isNotEmpty) ...[
            const SizedBox(height: 14),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.fromLTRB(12, 12, 12, 12),
              decoration: BoxDecoration(
                color: Colors.grey.shade100,
                borderRadius: BorderRadius.circular(14),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    "Related videos",
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900),
                  ),
                  const SizedBox(height: 10),
                  _RelatedCarousel(
                    pageController: _page,
                    items: widget.related,
                    buildSourceAvatar: widget.buildSourceAvatar,
                    timeAgo: widget.timeAgo,
                    onOpen: widget.onOpen,
                  ),
                ],
              ),
            ),
          ],

          const SizedBox(height: 8),
        ],
      ),
    );
  }
}

class _RelatedCarousel extends StatelessWidget {
  final PageController pageController;

  final List<NewsItem> items;
  final Widget Function(String iconUrl, String sourceName, {double r})
      buildSourceAvatar;
  final String Function(DateTime dt) timeAgo;
  final void Function(NewsItem it) onOpen;

  const _RelatedCarousel({
    required this.pageController,
    required this.items,
    required this.buildSourceAvatar,
    required this.timeAgo,
    required this.onOpen,
  });

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) return const SizedBox.shrink();

    return SizedBox(
      height: 168,
      child: PageView.builder(
        controller: pageController,
        physics: const PageScrollPhysics(),
        allowImplicitScrolling: true,
        itemCount: items.length,
        itemBuilder: (context, i) {
          final it = items[i];
          final img = (it.imageUrl ?? "").trim();
          final sourceName =
              it.sourceName.trim().isEmpty ? "Source" : it.sourceName.trim();
          final icon = (it.sourceIconUrl ?? "").trim();
          final ago = timeAgo(it.publishedAt.toLocal());

          return GestureDetector(
            onTap: () => onOpen(it),
            child: Padding(
              padding: const EdgeInsets.only(right: 10),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(16),
                child: Container(
                  color: Colors.white,
                  child: Row(
                    children: [
                      ClipRRect(
                        borderRadius: const BorderRadius.only(
                          topLeft: Radius.circular(16),
                          bottomLeft: Radius.circular(16),
                        ),
                        child: SizedBox(
                          width: 140,
                          height: double.infinity,
                          child: img.isEmpty
                              ? Container(
                                  color: Colors.grey.shade200,
                                  alignment: Alignment.center,
                                  child: const Icon(
                                      Icons.image_not_supported_outlined),
                                )
                              : CachedNetworkImage(
                                  imageUrl: img,
                                  fit: BoxFit.cover,
                                  // ✅ reduce animation overhead (keeps UI stable)
                                  fadeInDuration:
                                      const Duration(milliseconds: 0),
                                  fadeOutDuration:
                                      const Duration(milliseconds: 0),
                                  errorWidget: (_, __, ___) => Container(
                                    color: Colors.grey.shade200,
                                    alignment: Alignment.center,
                                    child: const Icon(
                                        Icons.broken_image_outlined),
                                  ),
                                ),
                        ),
                      ),
                      Expanded(
                        child: Padding(
                          padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  buildSourceAvatar(icon, sourceName, r: 12),
                                  const SizedBox(width: 8),
                                  Expanded(
                                    child: Text(
                                      sourceName,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: const TextStyle(
                                        fontWeight: FontWeight.w900,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 8),
                              Expanded(
                                child: Text(
                                  it.title,
                                  maxLines: 3,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w900,
                                    height: 1.15,
                                  ),
                                ),
                              ),
                              const SizedBox(height: 6),
                              Text(
                                ago,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  color: Colors.grey.shade700,
                                  fontWeight: FontWeight.w800,
                                  fontSize: 12,
                                ),
                              ),
                              const SizedBox(height: 6),
                              const Row(
                                children: [
                                  Icon(Icons.play_circle_outline, size: 18),
                                  SizedBox(width: 6),
                                  Text(
                                    "Tap to watch",
                                    style: TextStyle(fontWeight: FontWeight.w800),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

class _WebBody extends StatelessWidget {
  final WebViewController? controller;
  const _WebBody({required this.controller});

  @override
  Widget build(BuildContext context) {
    if (controller == null) {
      return const Center(child: Text("Unable to open this link."));
    }

    return Container(
      color: Colors.white,
      child: WebViewWidget(controller: controller!),
    );
  }
}