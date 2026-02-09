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

  // ✅ NEW (from your response)
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
        return DateTime.parse(v.toString()).toLocal();
      } catch (_) {
        return null;
      }
    }

    return NewsSource(
      id: (json['id'] ?? '').toString(),
      name: (json['name'] ?? '').toString(),
      type: json['type'] ?? 0,
      websiteUrl: json['websiteUrl'],
      rssUrl: json['rssUrl'],
      youTubeChannelId: json['youTubeChannelId'],
      youTubeUploadsPlaylistId: json['youTubeUploadsPlaylistId'],
      iconUrl: json['iconUrl'],
      category: json['category'],
      language: json['language'],
      country: json['country'],
      trustLevel: json['trustLevel'] ?? 0,
      isActive: json['isActive'] ?? true,

      // ✅ NEW
      lastFetchedAt: parseDt(json['lastFetchedAt']),
      nextFetchAt: parseDt(json['nextFetchAt']),
      fetchIntervalMinutes: json['fetchIntervalMinutes'] ?? 0,
      errorCount: json['errorCount'] ?? 0,
      lastError: json['lastError'],
    );
  }
}
