import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';

import '../models/news_item.dart';
import '../models/news_source.dart';

class NewsCacheService {
  static const String _kSourcesKey = "wargal_cache_sources_v1";
  static const String _kSourcesUpdatedAtKey = "wargal_cache_sources_updated_at_v1";

  static const String _kNewsKeyPrefix = "wargal_cache_news_v1_";
  static const String _kNewsUpdatedAtPrefix = "wargal_cache_news_updated_at_v1_";

  Future<void> saveSources(List<NewsSource> sources) async {
    final sp = await SharedPreferences.getInstance();
    final jsonList = sources.map((e) => e.toJson()).toList();
    await sp.setString(_kSourcesKey, jsonEncode(jsonList));
    await sp.setInt(_kSourcesUpdatedAtKey, DateTime.now().millisecondsSinceEpoch);
  }

  Future<List<NewsSource>> loadSources() async {
    final sp = await SharedPreferences.getInstance();
    final raw = sp.getString(_kSourcesKey);
    if (raw == null || raw.isEmpty) return <NewsSource>[];

    try {
      final decoded = jsonDecode(raw);
      if (decoded is! List) return <NewsSource>[];
      return decoded
          .whereType<Map>()
          .map((e) => NewsSource.fromJson(Map<String, dynamic>.from(e)))
          .toList();
    } catch (_) {
      return <NewsSource>[];
    }
  }

  String buildNewsKey({
    required String category,
    required List<String> effectiveSourceIdsSorted,
  }) {
    final cat = category.trim().toLowerCase();
    final srcSig = effectiveSourceIdsSorted.join(",");
    final sigHash = srcSig.hashCode.toString();
    return "$_kNewsKeyPrefix${cat}_$sigHash";
  }

  String _updatedAtKeyForNews(String newsKey) => "$_kNewsUpdatedAtPrefix$newsKey";

  Future<void> saveNews({
    required String newsKey,
    required List<NewsItem> items,
  }) async {
    final sp = await SharedPreferences.getInstance();
    final jsonList = items.map((e) => e.toJson()).toList();
    await sp.setString(newsKey, jsonEncode(jsonList));
    await sp.setInt(_updatedAtKeyForNews(newsKey), DateTime.now().millisecondsSinceEpoch);
  }

  Future<List<NewsItem>> loadNews({required String newsKey}) async {
    final sp = await SharedPreferences.getInstance();
    final raw = sp.getString(newsKey);
    if (raw == null || raw.isEmpty) return <NewsItem>[];

    try {
      final decoded = jsonDecode(raw);
      if (decoded is! List) return <NewsItem>[];
      return decoded
          .whereType<Map>()
          .map((e) => NewsItem.fromJson(Map<String, dynamic>.from(e)))
          .toList();
    } catch (_) {
      return <NewsItem>[];
    }
  }

  Future<void> clearAll() async {
    final sp = await SharedPreferences.getInstance();
    await sp.remove(_kSourcesKey);
    await sp.remove(_kSourcesUpdatedAtKey);
  }
}
