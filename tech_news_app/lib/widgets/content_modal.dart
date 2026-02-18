import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:youtube_player_flutter/youtube_player_flutter.dart';

import '../models/news_item.dart';

class ContentModal {
  static Future<void> open(BuildContext context, NewsItem item) async {
    await showDialog(
      context: context,
      barrierDismissible: true,
      builder: (_) => _ContentModalDialog(item: item),
    );
  }
}

class _ContentModalDialog extends StatefulWidget {
  final NewsItem item;
  const _ContentModalDialog({required this.item});

  @override
  State<_ContentModalDialog> createState() => _ContentModalDialogState();
}

class _ContentModalDialogState extends State<_ContentModalDialog> {
  WebViewController? _web;
  YoutubePlayerController? _yt;

  bool _webLoading = true;

  bool get _isYouTube {
    final url = widget.item.url.trim();
    final id = YoutubePlayer.convertUrlToId(url);
    return id != null && id.isNotEmpty;
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

    // ✅ If YouTube: show ONLY the embedded player (no WebView)
    final ytId = YoutubePlayer.convertUrlToId(url);
    if (ytId != null && ytId.isNotEmpty) {
      _yt = YoutubePlayerController(
        initialVideoId: ytId,
        flags: const YoutubePlayerFlags(
          autoPlay: true,
          mute: false,
          disableDragSeek: false,
          loop: false,
          enableCaption: true,
          forceHD: false,
        ),
      );
      return;
    }

    // ✅ Non-YouTube: show publisher page in WebView
    final parsed = Uri.tryParse(url);
    if (parsed != null) {
      _web = WebViewController()
        ..setJavaScriptMode(JavaScriptMode.unrestricted)
        ..setNavigationDelegate(
          NavigationDelegate(
            onPageStarted: (_) {
              if (!mounted) return;
              setState(() => _webLoading = true);
            },
            onPageFinished: (_) {
              if (!mounted) return;
              setState(() => _webLoading = false);
            },
          ),
        )
        ..loadRequest(parsed);
    }
  }

  @override
  void dispose() {
    _yt?.dispose();
    super.dispose();
  }

  Widget _buildSourceAvatar(String iconUrl, String sourceName) {
    final url = iconUrl.trim();
    if (url.isNotEmpty) {
      return CircleAvatar(
        radius: 18,
        backgroundColor: Colors.grey.shade200,
        backgroundImage: CachedNetworkImageProvider(url),
      );
    }

    final letter = sourceName.isNotEmpty ? sourceName[0].toUpperCase() : "?";
    return CircleAvatar(
      radius: 18,
      backgroundColor: Colors.grey.shade200,
      child: Text(letter, style: const TextStyle(fontWeight: FontWeight.w900)),
    );
  }

  @override
  Widget build(BuildContext context) {
    final item = widget.item;

    final img = (item.imageUrl ?? "").trim();
    final icon = (item.sourceIconUrl ?? "").trim();
    final sourceName =
        item.sourceName.trim().isEmpty ? "Source" : item.sourceName.trim();
    final ago = _timeAgo(item.publishedAt.toLocal());

    final isYoutube = _isYouTube;

    return Dialog(
      insetPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 18),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(18),
        child: Column(
          children: [
            // ✅ Header: source + time ago + title
            Container(
              color: Colors.white,
              padding: const EdgeInsets.fromLTRB(12, 12, 8, 10),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _buildSourceAvatar(icon, sourceName),
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
                                style: const TextStyle(fontWeight: FontWeight.w900),
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
                          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900),
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

            // ✅ Thumbnail (optional): keep it for non-youtube
            if (img.isNotEmpty && !isYoutube)
              AspectRatio(
                aspectRatio: 16 / 9,
                child: CachedNetworkImage(
                  imageUrl: img,
                  fit: BoxFit.cover,
                  errorWidget: (_, __, ___) => Container(color: Colors.grey.shade200),
                ),
              ),

            const Divider(height: 1),

            // ✅ Body: YouTube -> ONLY player. Non-YouTube -> WebView
            Expanded(
              child: isYoutube
                  ? _YoutubeOnlyBody(controller: _yt)
                  : _WebBody(controller: _web, loading: _webLoading),
            ),
          ],
        ),
      ),
    );
  }
}

class _YoutubeOnlyBody extends StatelessWidget {
  final YoutubePlayerController? controller;
  const _YoutubeOnlyBody({required this.controller});

  @override
  Widget build(BuildContext context) {
    if (controller == null) {
      return const Center(child: Text("Video not available."));
    }

    return Padding(
      padding: const EdgeInsets.all(12),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(14),
        child: YoutubePlayer(
          controller: controller!,
          showVideoProgressIndicator: true,
          onReady: () {
            controller!.play();
          },
        ),
      ),
    );
  }
}

class _WebBody extends StatelessWidget {
  final WebViewController? controller;
  final bool loading;
  const _WebBody({required this.controller, required this.loading});

  @override
  Widget build(BuildContext context) {
    if (controller == null) {
      return const Center(child: Text("Unable to open this link."));
    }

    return Stack(
      children: [
        WebViewWidget(controller: controller!),
        if (loading)
          Positioned.fill(
            child: IgnorePointer(
              ignoring: true,
              child: Container(
                color: Colors.white.withAlpha(160),
                alignment: Alignment.center,
                child: const SizedBox(
                  width: 22,
                  height: 22,
                  child: CircularProgressIndicator(strokeWidth: 2.2),
                ),
              ),
            ),
          ),
      ],
    );
  }
}
