import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:webview_flutter/webview_flutter.dart';

class YoutubeWatchScreen extends StatefulWidget {
  final String videoId;
  final String title;

  const YoutubeWatchScreen({
    super.key,
    required this.videoId,
    required this.title,
  });

  @override
  State<YoutubeWatchScreen> createState() => _YoutubeWatchScreenState();
}

class _YoutubeWatchScreenState extends State<YoutubeWatchScreen> {
  late final WebViewController _web;
  bool _loading = true;

  Uri get _watchUri => Uri.parse("https://www.youtube.com/watch?v=${widget.videoId}");

  @override
  void initState() {
    super.initState();

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
      ..loadRequest(_watchUri);
  }

  Future<void> _openExternal() async {
    await launchUrl(_watchUri, mode: LaunchMode.externalApplication);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(
          widget.title.isNotEmpty ? widget.title : "YouTube",
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        actions: [
          IconButton(
            tooltip: "Open in YouTube",
            onPressed: _openExternal,
            icon: const Icon(Icons.open_in_new),
          ),
        ],
      ),
      body: Stack(
        children: [
          WebViewWidget(controller: _web),
          if (_loading) const LinearProgressIndicator(),
        ],
      ),
    );
  }
}
