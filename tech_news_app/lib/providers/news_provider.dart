import 'dart:async';

import 'package:flutter/material.dart';

import '../models/news_item.dart';
import '../models/news_source.dart';
import '../services/api_service.dart';

class NewsProvider extends ChangeNotifier {
  NewsProvider(this._api);

  final ApiService _api;

  bool _inited = false;
  bool _warming = false;

  // UI state
  bool isLoading = false;
  bool isLoadingMore = false;

  // ✅ silent refresh state (no spinners)
  bool isSilentRefreshing = false;

  String? error;

  // Data
  List<NewsItem> items = [];
  List<NewsItem> sliderItems = [];
  List<NewsItem> discoverItems = [];
  List<NewsSource> sources = [];

  // ✅ increments every time refresh completes (manual or auto)
  int refreshTick = 0;

  // -----------------------------
  // Categories
  // -----------------------------
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

  // -----------------------------
  // Sources selection (multi-select)
  // -----------------------------
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

  // -----------------------------
  // Boot warmup: run once early to reduce “empty then load”
  // -----------------------------
  Future<void> warmup() async {
    if (_warming) return;
    _warming = true;

    try {
      // Best-effort warmup: small, fast call
      await _api.getFeedItems(page: 1, pageSize: 5);
    } catch (_) {
      // ignore warmup failures
    } finally {
      _warming = false;
    }
  }

  // -----------------------------
  // Init
  // -----------------------------
  Future<void> init() async {
    if (_inited) return;
    _inited = true;

    // ✅ Start loading immediately (so screens show skeleton instead of “no items”)
    if (!isLoading && items.isEmpty) {
      isLoading = true;
      notifyListeners();
    }

    // ✅ Parallel: sources + first fetch
    await Future.wait([
      _loadSources(),
      _fetchFirstFast(),
    ]);

    // ✅ Background: load larger list silently (don’t block UI)
    unawaited(_fetchBiggerSilent());

    isLoading = false;
    notifyListeners();
  }

  // -----------------------------
  // Sources loader
  // -----------------------------
  Future<void> _loadSources() async {
    try {
      try {
        sources = await _api.getFeedSourcesForUi();
      } catch (_) {
        sources = await _api.getNewsSources();
      }

      sources.sort((a, b) {
        final t = b.trustLevel.compareTo(a.trustLevel);
        if (t != 0) return t;
        return a.name.toLowerCase().compareTo(b.name.toLowerCase());
      });

      notifyListeners();
    } catch (e) {
      error = e.toString();
      notifyListeners();
    }
  }

  // -----------------------------
  // Filters
  // -----------------------------
  Future<void> setCategory(String category) async {
    final c = category.trim();
    if (c.isEmpty) return;

    _selectedCategory = c;

    final catIds = filteredSources.map((s) => s.id).toSet();
    selectedSourceIds.removeWhere((id) => !catIds.contains(id));

    notifyListeners();
    await refresh(silent: false);
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
    notifyListeners();
    await refresh(silent: false);
  }

  void clearSources() {
    selectedSourceIds.clear();
    notifyListeners();
  }

  Future<void> applySourceSelection() async {
    await refresh(silent: false);
  }

  // -----------------------------
  // Fetching
  // -----------------------------
  Future<void> refresh({required bool silent}) async {
    await fetchNews(force: true, silent: silent);
  }

  Future<void> _fetchFirstFast() async {
    try {
      final ids = effectiveSourceIds.toList();

      final list = await _api.getFeedItems(
        page: 1,
        pageSize: 12, // ✅ fast first paint
        sourceId: (ids.length == 1) ? ids.first : null,
        category: isAllCategories ? null : _selectedCategory,
      );

      final filtered = (ids.isEmpty)
          ? list
          : list.where((it) => ids.contains(it.sourceId)).toList();

      filtered.sort((a, b) => b.publishedAt.compareTo(a.publishedAt));

      items = _dedupeByUrlKeepOrder(filtered);

      sliderItems = items.take(5).toList();

      final withImg = items.where((x) => (x.imageUrl ?? "").trim().isNotEmpty).toList();
      discoverItems = (withImg.isNotEmpty ? withImg : items).take(18).toList();

      refreshTick += 1;
      error = null;
      notifyListeners();
    } catch (e) {
      // Keep skeleton visible if first fetch fails
      error = e.toString();
      notifyListeners();
    }
  }

  Future<void> _fetchBiggerSilent() async {
    try {
      final ids = effectiveSourceIds.toList();

      final list = await _api.getFeedItems(
        page: 1,
        pageSize: 60, // ✅ full list after first paint
        sourceId: (ids.length == 1) ? ids.first : null,
        category: isAllCategories ? null : _selectedCategory,
      );

      final filtered = (ids.isEmpty)
          ? list
          : list.where((it) => ids.contains(it.sourceId)).toList();

      filtered.sort((a, b) => b.publishedAt.compareTo(a.publishedAt));

      final merged = _dedupeByUrlKeepOrder(filtered);

      // Only update if it’s actually better/newer
      if (merged.isNotEmpty && merged.length >= items.length) {
        items = merged;
        sliderItems = items.take(5).toList();

        final withImg = items.where((x) => (x.imageUrl ?? "").trim().isNotEmpty).toList();
        discoverItems = (withImg.isNotEmpty ? withImg : items).take(18).toList();

        refreshTick += 1;
        error = null;
        notifyListeners();
      }
    } catch (_) {
      // ignore background failures
    }
  }

  Future<void> fetchNews({bool force = false, required bool silent}) async {
    if (isLoading || isSilentRefreshing) return;

    error = null;

    if (!silent) {
      isLoading = true;
      notifyListeners();
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

      items = _dedupeByUrlKeepOrder(filtered);

      sliderItems = items.take(5).toList();

      final withImg = items.where((x) => (x.imageUrl ?? "").trim().isNotEmpty).toList();
      discoverItems = (withImg.isNotEmpty ? withImg : items).take(18).toList();

      refreshTick += 1;

      isLoading = false;
      isSilentRefreshing = false;
      notifyListeners();
    } catch (e) {
      isLoading = false;
      isSilentRefreshing = false;
      error = e.toString();
      notifyListeners();
    }
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

  // Pagination (optional)
  Future<void> fetchMore() async {
    if (isLoadingMore || isLoading || isSilentRefreshing) return;
    isLoadingMore = true;
    notifyListeners();

    await Future<void>.delayed(const Duration(milliseconds: 250));

    isLoadingMore = false;
    notifyListeners();
  }

  @override
  void dispose() {
    super.dispose();
  }
}
