class NewsSource {
  final String id;
  final String name;
  final int type;
  final String? websiteUrl;
  final String? rssUrl;
  final String? youTubeChannelId;
  final String? youTubeUploadsPlaylistId;
  final String? iconUrl;
  final String? category;
  final String? language;
  final String? country;
  final int trustLevel;
  final bool isActive;

  // NEW
  final DateTime? lastFetchedAt;
  final DateTime? nextFetchAt;
  final int fetchIntervalMinutes;
  final int errorCount;
  final String? lastError;

  NewsSource({
    required this.id,
    required this.name,
    required this.type,
    this.websiteUrl,
    this.rssUrl,
    this.youTubeChannelId,
    this.youTubeUploadsPlaylistId,
    this.iconUrl,
    this.category,
    this.language,
    this.country,
    required this.trustLevel,
    required this.isActive,
    this.lastFetchedAt,
    this.nextFetchAt,
    required this.fetchIntervalMinutes,
    required this.errorCount,
    this.lastError,
  });

  factory NewsSource.fromJson(Map<String, dynamic> json) {
    DateTime? parseDt(dynamic v) {
      if (v == null) return null;
      try {
        // store/receive as ISO; keep as local for UI if you want
        return DateTime.parse(v.toString()).toLocal();
      } catch (_) {
        return null;
      }
    }

    int parseInt(dynamic v, {int fallback = 0}) {
      if (v == null) return fallback;
      if (v is num) return v.toInt();
      return int.tryParse(v.toString()) ?? fallback;
    }

    bool parseBool(dynamic v, {bool fallback = true}) {
      if (v == null) return fallback;
      if (v is bool) return v;
      final s = v.toString().toLowerCase().trim();
      if (s == "true" || s == "1") return true;
      if (s == "false" || s == "0") return false;
      return fallback;
    }

    return NewsSource(
      id: (json['id'] ?? '').toString(),
      name: (json['name'] ?? '').toString(),
      type: parseInt(json['type']),
      websiteUrl: json['websiteUrl']?.toString(),
      rssUrl: json['rssUrl']?.toString(),
      youTubeChannelId: json['youTubeChannelId']?.toString(),
      youTubeUploadsPlaylistId: json['youTubeUploadsPlaylistId']?.toString(),
      iconUrl: json['iconUrl']?.toString(),
      category: json['category']?.toString(),
      language: json['language']?.toString(),
      country: json['country']?.toString(),
      trustLevel: parseInt(json['trustLevel']),
      isActive: parseBool(json['isActive'], fallback: true),

      lastFetchedAt: parseDt(json['lastFetchedAt']),
      nextFetchAt: parseDt(json['nextFetchAt']),
      fetchIntervalMinutes: parseInt(json['fetchIntervalMinutes']),
      errorCount: parseInt(json['errorCount']),
      lastError: json['lastError']?.toString(),
    );
  }

  // ✅ REQUIRED FOR CACHE
  Map<String, dynamic> toJson() {
    String? dt(DateTime? v) => v == null ? null : v.toUtc().toIso8601String();

    return <String, dynamic>{
      "id": id,
      "name": name,
      "type": type,
      "websiteUrl": websiteUrl,
      "rssUrl": rssUrl,
      "youTubeChannelId": youTubeChannelId,
      "youTubeUploadsPlaylistId": youTubeUploadsPlaylistId,
      "iconUrl": iconUrl,
      "category": category,
      "language": language,
      "country": country,
      "trustLevel": trustLevel,
      "isActive": isActive,
      "lastFetchedAt": dt(lastFetchedAt),
      "nextFetchAt": dt(nextFetchAt),
      "fetchIntervalMinutes": fetchIntervalMinutes,
      "errorCount": errorCount,
      "lastError": lastError,
    };
  }
}
