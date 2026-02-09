import 'package:flutter/foundation.dart';

class NewsItem {
  final String id;
  final String title;
  final String? summary;
  final String url;

  final String? imageUrl;
  final String? youtubeVideoId;
  final String? embedUrl;

  /// 1 = RSS / Article, 2 = YouTube / Video
  final int kind;

  /// Stored as UTC instant
  final DateTime publishedAt;

  final String sourceId;
  final String sourceName;
  final String? sourceIconUrl;

  NewsItem({
    required this.id,
    required this.title,
    this.summary,
    required this.url,
    this.imageUrl,
    this.youtubeVideoId,
    this.embedUrl,
    required this.kind,
    required this.publishedAt,
    required this.sourceId,
    required this.sourceName,
    this.sourceIconUrl,
  });

  factory NewsItem.fromJson(Map<String, dynamic> json) {
    final raw = json['publishedAt'];
    final published = _parseApiDateTimeUtc(raw);

    final kindVal = json['kind'];
    final kind = (kindVal is num)
        ? kindVal.toInt()
        : int.tryParse(kindVal?.toString() ?? '') ?? 0;

    // 🔍 VERY IMPORTANT LOGS
    if (kDebugMode) {
      debugPrint(
        '''
🕒 NEWS ITEM TIME DEBUG
Source      : ${json['sourceName']}
Raw value   : $raw
Parsed UTC  : ${published.toIso8601String()}
Local time  : ${published.toLocal()}
Now (local) : ${DateTime.now()}
Diff (min)  : ${DateTime.now().difference(published.toLocal()).inMinutes}
---------------------------
''',
      );
    }

    return NewsItem(
      id: (json['id'] ?? '').toString(),
      title: (json['title'] ?? '').toString(),
      summary: json['summary']?.toString(),
      url: (json['linkUrl'] ?? '').toString(),
      imageUrl: json['imageUrl']?.toString(),
      youtubeVideoId: json['youTubeVideoId']?.toString(),
      embedUrl: json['embedUrl']?.toString(),
      kind: kind,
      publishedAt: published,
      sourceId: (json['sourceId'] ?? '').toString(),
      sourceName: (json['sourceName'] ?? '').toString(),
      sourceIconUrl: json['sourceIconUrl']?.toString(),
    );
  }

  /// Always use this in UI
  DateTime get publishedLocal => publishedAt.toLocal();

static DateTime _parseApiDateTimeUtc(dynamic raw) {
  if (raw == null) {
    return DateTime.fromMillisecondsSinceEpoch(0, isUtc: true);
  }

  final s = raw.toString().trim();
  if (s.isEmpty) {
    return DateTime.fromMillisecondsSinceEpoch(0, isUtc: true);
  }

  final hasTz =
      s.endsWith('Z') || RegExp(r'[\+\-]\d{2}:\d{2}$').hasMatch(s);

  try {
    if (hasTz) {
      // ✅ Correct instant already (Z or offset)
      return DateTime.parse(s).toUtc();
    }

    // ✅ If server sent NO timezone, treat it as LOCAL time and convert to UTC
    // This prevents “future by 3 hours” in Somalia (+03)
    return DateTime.parse(s).toUtc();

  } catch (_) {
    return DateTime.fromMillisecondsSinceEpoch(0, isUtc: true);
  }
}

}
