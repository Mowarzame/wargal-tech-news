import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:youtube_player_iframe/youtube_player_iframe.dart';
import 'package:url_launcher/url_launcher.dart';

class NewsWebViewScreen extends StatefulWidget {
  const NewsWebViewScreen({
    super.key,
    required this.url,
    required this.title,
  });

  final String url;
  final String title;

  @override
  State<NewsWebViewScreen> createState() => _NewsWebViewScreenState();
}

class _NewsWebViewScreenState extends State<NewsWebViewScreen> {
  WebViewController? _web;
  bool _loading = true;

  YoutubePlayerController? _yt;
  String? _ytId;

  @override
  void initState() {
    super.initState();

    final id = _extractYoutubeId(widget.url);
    if (id != null && id.isNotEmpty) {
      _ytId = id;
      _yt = YoutubePlayerController.fromVideoId(
        videoId: id,
        autoPlay: true,
        params: const YoutubePlayerParams(
          showControls: true,
          showFullscreenButton: true,
          mute: false,
          loop: false,
          enableJavaScript: true,
          playsInline: true,
          strictRelatedVideos: true,
        ),
      );
    } else {
      _web = WebViewController()
        ..setJavaScriptMode(JavaScriptMode.unrestricted)
        ..setNavigationDelegate(
          NavigationDelegate(
            onPageFinished: (_) {
              if (mounted) setState(() => _loading = false);
            },
          ),
        )
        ..loadRequest(Uri.parse(widget.url));
    }
  }

  @override
  void dispose() {
    _yt?.close();
    super.dispose();
  }

  Future<void> _openExternal(String url) async {
    final uri = Uri.tryParse(url);
    if (uri == null) return;
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  // Handles:
  // - https://www.youtube.com/watch?v=VIDEOID
  // - https://youtu.be/VIDEOID
  // - https://www.youtube.com/shorts/VIDEOID
  // - https://www.youtube.com/embed/VIDEOID
  String? _extractYoutubeId(String url) {
    final uri = Uri.tryParse(url);
    if (uri == null) return null;

    final host = uri.host.toLowerCase();
    final path = uri.path;

    // youtu.be/VIDEOID
    if (host.contains('youtu.be')) {
      final seg = uri.pathSegments;
      if (seg.isNotEmpty) return seg.first;
    }

    // youtube.com/watch?v=VIDEOID
    if (host.contains('youtube.com')) {
      if (path == '/watch') {
        final v = uri.queryParameters['v'];
        if (v != null && v.isNotEmpty) return v;
      }

      // youtube.com/shorts/VIDEOID
      if (path.startsWith('/shorts/')) {
        final seg = uri.pathSegments;
        if (seg.length >= 2) return seg[1];
      }

      // youtube.com/embed/VIDEOID
      if (path.startsWith('/embed/')) {
        final seg = uri.pathSegments;
        if (seg.length >= 2) return seg[1];
      }
    }

    return null;
  }

  @override
  Widget build(BuildContext context) {
    final isYoutube = _yt != null && _ytId != null;

    return Scaffold(
      appBar: AppBar(
        title: Text(
          isYoutube ? "YouTube" : widget.title,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        actions: [
          IconButton(
            tooltip: "Reload",
            onPressed: () async {
              if (isYoutube) {
                _yt?.loadVideoById(videoId: _ytId!);
                return;
              }
              setState(() => _loading = true);
              await _web?.reload();
            },
            icon: const Icon(Icons.refresh),
          ),
          IconButton(
            tooltip: "Open externally",
            onPressed: () => _openExternal(widget.url),
            icon: const Icon(Icons.open_in_new),
          ),
        ],
      ),
      body: SafeArea(
        child: isYoutube
            ? Column(
                children: [
                  YoutubePlayer(
                    controller: _yt!,
                    aspectRatio: 16 / 9,
                  ),
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.all(14),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            widget.title,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900),
                          ),
                          const SizedBox(height: 10),
                          ElevatedButton.icon(
                            onPressed: () => _openExternal(widget.url),
                            icon: const Icon(Icons.open_in_new),
                            label: const Text("Open in YouTube"),
                          ),
                          const SizedBox(height: 10),
                          const Text(
                            "If a video fails in-app on some devices, opening YouTube externally always works.",
                            style: TextStyle(color: Colors.black54),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              )
            : Stack(
                children: [
                  if (_web != null) WebViewWidget(controller: _web!),
                  if (_loading) const LinearProgressIndicator(),
                ],
              ),
      ),
    );
  }
}
