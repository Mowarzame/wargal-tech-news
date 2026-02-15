import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../models/news_item.dart';
import '../screens/youtube_watch_screen.dart';

class ContentModal {
  static void open(BuildContext context, NewsItem item) {
    // ✅ Videos: open dedicated screen
    if (item.kind == 2) {
      final id = _extractYoutubeId(item);
      if (id.isNotEmpty) {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => YoutubeWatchScreen(videoId: id, title: item.title),
          ),
        );
        return;
      }
      // fallback: open external
      final raw = item.url.trim();
      final uri = Uri.tryParse(raw);
      if (uri != null) {
        launchUrl(uri, mode: LaunchMode.externalApplication);
      }
      return;
    }

    // ✅ Articles: open modal
    showDialog(
      context: context,
      barrierDismissible: true,
      builder: (_) => _ContentModal(item: item),
    );
  }

  static String _extractYoutubeId(NewsItem item) {
    final id = (item.youtubeVideoId ?? "").trim();
    if (id.isNotEmpty) return id;

    final raw = item.url.trim();
    final uri = Uri.tryParse(raw);
    if (uri == null) return "";

    if (uri.host.contains("youtu.be")) {
      return uri.pathSegments.isNotEmpty ? uri.pathSegments.last : "";
    }
    if (uri.host.contains("youtube.com")) {
      return uri.queryParameters["v"] ?? "";
    }
    return "";
  }
}

class _ContentModal extends StatefulWidget {
  const _ContentModal({required this.item});

  final NewsItem item;

  @override
  State<_ContentModal> createState() => _ContentModalState();
}

class _ContentModalState extends State<_ContentModal> {
  WebViewController? _web;
  bool _loading = true;

  String get _rawUrl => widget.item.url.trim();
  String get _sourceName => widget.item.sourceName;

  @override
  void initState() {
    super.initState();
    _initWeb();
  }

  void _initWeb() {
    final uri = Uri.tryParse(_rawUrl);
    if (uri == null) {
      setState(() => _loading = false);
      return;
    }

    _web = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageFinished: (_) {
            if (!mounted) return;
            setState(() => _loading = false);
          },
        ),
      )
      ..loadRequest(uri);

    setState(() => _loading = true);
  }

  Future<void> _openExternal(Uri uri) async {
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      insetPadding: EdgeInsets.zero,
      backgroundColor: Colors.white,
      child: SafeArea(
        child: Scaffold(
          appBar: AppBar(
            title: Text(
              _sourceName,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            leading: IconButton(
              icon: const Icon(Icons.close),
              onPressed: () => Navigator.pop(context),
            ),
            actions: [
              IconButton(
                tooltip: "Open in browser",
                onPressed: () => _openExternal(Uri.parse(_rawUrl)),
                icon: const Icon(Icons.open_in_new),
              ),
              IconButton(
                tooltip: "Reload",
                onPressed: () async {
                  setState(() => _loading = true);
                  await _web?.reload();
                },
                icon: const Icon(Icons.refresh),
              ),
            ],
          ),
          body: Stack(
            children: [
              (_web == null)
                  ? Center(child: Text("Invalid link: $_rawUrl"))
                  : WebViewWidget(controller: _web!),
              if (_loading) const LinearProgressIndicator(),
            ],
          ),
        ),
      ),
    );
  }
}
