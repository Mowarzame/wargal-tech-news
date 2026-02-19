import 'dart:async';
import 'package:flutter/material.dart';

import '../models/news_item.dart';
import '../models/news_source.dart';
import '../services/api_service.dart';
import '../services/news_cache_service.dart';

class NewsProvider extends ChangeNotifier {
  NewsProvider(this._api);

  final ApiService _api;
  final NewsCacheService _cache = NewsCacheService();

  bool _inited = false;
  bool _warming = false;

  bool _fetching = false;

  bool isLoading = false;
  bool isSilentRefreshing = false;
  String? error;

  List<NewsItem> items = [];
  List<NewsItem> sliderItems = [];
  List<NewsItem> discoverItems = [];
  List<NewsSource> sources = [];

  int refreshTick = 0;

  final List<String> categories = const <String>[
    "All",
    "News",
    "Podcasts",
    "Politics",
    "Business",
    "Sports",
    "Tech",
  ];

  String _selectedCategory = "News";
  String get selectedCategory => _selectedCategory;
  bool get isAllCategories => _selectedCategory.toLowerCase() == "all";

  final Set<String> selectedSourceIds = <String>{};
  bool get isAllSelected => selectedSourceIds.isEmpty;

  List<NewsSource> get filteredSources {
    final cat = _selectedCategory.trim().toLowerCase();
    if (cat.isEmpty || cat == "all") return sources;
    return sources
        .where((s) => (s.category ?? "").trim().toLowerCase() == cat)
        .toList();
  }

  Set<String> get effectiveSourceIds {
    final inCategory = filteredSources.map((s) => s.id).toSet();
    if (selectedSourceIds.isEmpty) return inCategory;

    final intersect = selectedSourceIds.intersection(inCategory);
    if (intersect.isEmpty) return inCategory;
    return intersect;
  }

  Future<void> warmup() async {
    if (_warming) return;
    _warming = true;
    try {
      await _api.getFeedItems(page: 1, pageSize: 5);
    } catch (_) {
      // ignore
    } finally {
      _warming = false;
    }
  }

  Future<void> init() async {
    if (_inited) return;
    _inited = true;

    await _hydrateCacheFirstPaint();
    unawaited(_loadSourcesAndCache());

    await fetchNews(force: true, silent: items.isNotEmpty);
  }

  /// ✅ Fresh data whenever user re-opens the app (resume)
  Future<void> refreshOnResume() async {
    // Always silent, always forced
    await fetchNews(force: true, silent: true);
  }

  String _currentNewsCacheKey() {
    final ids = effectiveSourceIds.toList()..sort();
    final cat = isAllCategories ? "all" : _selectedCategory;
    return _cache.buildNewsKey(category: cat, effectiveSourceIdsSorted: ids);
  }

  Future<void> _hydrateCacheFirstPaint() async {
    try {
      final cachedSources = await _cache.loadSources();
      if (cachedSources.isNotEmpty) {
        sources = cachedSources;
      }

      final cachedNews = await _cache.loadNews(newsKey: _currentNewsCacheKey());
      if (cachedNews.isNotEmpty) {
        cachedNews.sort((a, b) => b.publishedAt.compareTo(a.publishedAt));
        items = _dedupeByUrlKeepOrder(cachedNews);
        _rebuildDerivedLists();

        isLoading = false;
        error = null;
        notifyListeners();
        return;
      }

      isLoading = true;
      notifyListeners();
    } catch (_) {
      isLoading = true;
      notifyListeners();
    }
  }

  Future<void> _loadSourcesAndCache() async {
    try {
      final fresh =
          await _api.getFeedSourcesForUi().catchError((_) => _api.getNewsSources());

      fresh.sort((a, b) {
        final t = b.trustLevel.compareTo(a.trustLevel);
        if (t != 0) return t;
        return a.name.toLowerCase().compareTo(b.name.toLowerCase());
      });

      sources = fresh;
      unawaited(_cache.saveSources(sources));
      notifyListeners();
    } catch (e) {
      error ??= e.toString();
      notifyListeners();
    }
  }

  Future<void> setCategory(String category) async {
    final c = category.trim();
    if (c.isEmpty) return;

    _selectedCategory = c;

    final catIds = filteredSources.map((s) => s.id).toSet();
    selectedSourceIds.removeWhere((id) => !catIds.contains(id));

    await _hydrateCacheFirstPaint();
    await refresh(silent: items.isNotEmpty);
  }

  void toggleSource(String sourceId) {
    if (selectedSourceIds.contains(sourceId)) {
      selectedSourceIds.remove(sourceId);
    } else {
      selectedSourceIds.add(sourceId);
    }
    notifyListeners();
  }

  Future<void> selectOnlySource(String? sourceId) async {
    selectedSourceIds.clear();
    if (sourceId != null) selectedSourceIds.add(sourceId);

    await _hydrateCacheFirstPaint();
    await refresh(silent: items.isNotEmpty);
  }

  void clearSources() {
    selectedSourceIds.clear();
    notifyListeners();
  }

  Future<void> applySourceSelection() async {
    await _hydrateCacheFirstPaint();
    await refresh(silent: items.isNotEmpty);
  }

  Future<void> refresh({required bool silent}) async {
    await fetchNews(force: true, silent: silent);
  }

  Future<void> fetchNews({bool force = false, required bool silent}) async {
    if (_fetching) return;
    _fetching = true;

    error = null;

    if (!silent) {
      if (items.isEmpty) {
        isLoading = true;
        notifyListeners();
      }
    } else {
      isSilentRefreshing = true;
      notifyListeners();
    }

    try {
      final ids = effectiveSourceIds.toList();

      final list = await _api.getFeedItems(
        page: 1,
        pageSize: 60,
        sourceId: (ids.length == 1) ? ids.first : null,
        category: isAllCategories ? null : _selectedCategory,
      );

      final filtered = (ids.isEmpty)
          ? list
          : list.where((it) => ids.contains(it.sourceId)).toList();

      filtered.sort((a, b) => b.publishedAt.compareTo(a.publishedAt));

      final next = _dedupeByUrlKeepOrder(filtered);

      // Even on force refresh, we still avoid heavy rebuild if top URLs are same.
      if (force || !_sameTopUrls(items, next)) {
        items = next;
        _rebuildDerivedLists();
        refreshTick += 1;

        unawaited(
          _cache.saveNews(newsKey: _currentNewsCacheKey(), items: items),
        );
      }

      isLoading = false;
      isSilentRefreshing = false;
      error = null;
      notifyListeners();
    } catch (e) {
      isLoading = false;
      isSilentRefreshing = false;
      error = e.toString();
      notifyListeners();
    } finally {
      _fetching = false;
    }
  }

  void _rebuildDerivedLists() {
    sliderItems = items.take(5).toList();

    final withImg =
        items.where((x) => (x.imageUrl ?? "").trim().isNotEmpty).toList();
    discoverItems = (withImg.isNotEmpty ? withImg : items).take(18).toList();
  }

  bool _sameTopUrls(List<NewsItem> a, List<NewsItem> b, {int topN = 20}) {
    if (identical(a, b)) return true;
    final al = a.length < topN ? a.length : topN;
    final bl = b.length < topN ? b.length : topN;
    if (al != bl) return false;

    for (int i = 0; i < al; i++) {
      if (a[i].url.trim() != b[i].url.trim()) return false;
    }
    return true;
  }

  List<NewsItem> _dedupeByUrlKeepOrder(List<NewsItem> list) {
    final seen = <String>{};
    final out = <NewsItem>[];
    for (final it in list) {
      final u = it.url.trim();
      if (u.isEmpty) continue;
      if (seen.add(u)) out.add(it);
    }
    return out;
  }
}
