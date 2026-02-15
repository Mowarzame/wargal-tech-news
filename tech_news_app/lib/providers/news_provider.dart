import 'dart:async';

import 'package:flutter/material.dart';

import '../models/news_item.dart';
import '../models/news_source.dart';
import '../services/api_service.dart';

class NewsProvider extends ChangeNotifier {
  NewsProvider(this._api);

  final ApiService _api;

  bool _inited = false;

  // UI state
  bool isLoading = false;
  bool isLoadingMore = false;

  // ✅ silent refresh state (no spinners)
  bool isSilentRefreshing = false;

  String? error;

  final ScrollController scrollController = ScrollController();

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
  // ✅ Default is "News"
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
  // Empty selection means "All sources" (within the category)
  // -----------------------------
  final Set<String> selectedSourceIds = <String>{};
  bool get isAllSelected => selectedSourceIds.isEmpty;

  // Sources filtered by selected category
  List<NewsSource> get filteredSources {
    final cat = _selectedCategory.trim().toLowerCase();
    if (cat.isEmpty || cat == "all") return sources;
    return sources
        .where((s) => (s.category ?? "").trim().toLowerCase() == cat)
        .toList();
  }

  // Effective sources to apply to fetching/content
  Set<String> get effectiveSourceIds {
    final inCategory = filteredSources.map((s) => s.id).toSet();

    // If "All sources" is selected => all sources inside category
    if (selectedSourceIds.isEmpty) return inCategory;

    // If user selected some sources => intersect with category sources
    final intersect = selectedSourceIds.intersection(inCategory);

    // If none match (category changed), fall back to all sources in category
    if (intersect.isEmpty) return inCategory;

    return intersect;
  }

  // -----------------------------
  // Init
  // -----------------------------
  Future<void> init() async {
    if (_inited) return;
    _inited = true;

    scrollController.addListener(_onScroll);

    await _loadSources();
    await refresh(silent: false);
  }

  // -----------------------------
  // Sources loader
  // -----------------------------
  Future<void> _loadSources() async {
    try {
      // Use feed-items/sources endpoint if you have it (best for UI chips),
      // otherwise fall back to news-sources.
      try {
        sources = await _api.getFeedSourcesForUi();
      } catch (_) {
        sources = await _api.getNewsSources();
      }

      // Keep stable ordering (trustLevel desc then name)
      sources.sort((a, b) {
        final t = b.trustLevel.compareTo(a.trustLevel);
        if (t != 0) return t;
        return a.name.toLowerCase().compareTo(b.name.toLowerCase());
      });

      notifyListeners();
    } catch (e) {
      // Don’t block screen if sources fail; still allow news loading
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

    // Remove any selected source IDs that do not exist in this category
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

      // ✅ Your ApiService supports category + sourceId
      // We fetch ONE page big enough for UI (adjust pageSize if needed)
      final list = await _api.getFeedItems(
        page: 1,
        pageSize: 60,
        sourceId: (ids.length == 1) ? ids.first : null, // only if single-source
        category: isAllCategories ? null : _selectedCategory,
      );

      // If multi-source is selected, filter client-side too
      // (since API supports only one sourceId param here)
      final filtered = (ids.isEmpty)
          ? list
          : list.where((it) => ids.contains(it.sourceId)).toList();

      // ✅ ALWAYS newest-first
      filtered.sort((a, b) => b.publishedAt.compareTo(a.publishedAt));

      items = _dedupeByUrlKeepOrder(filtered);

      // ✅ Slideshow must be latest -> next latest...
      sliderItems = items.take(5).toList();

      // Discover: prefer items with images, still newest-first
      final withImg = items.where((x) => (x.imageUrl ?? "").trim().isNotEmpty).toList();
      discoverItems = (withImg.isNotEmpty ? withImg : items).take(18).toList();

      // ✅ tick increments after refresh completes
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

  void _onScroll() {
    if (!scrollController.hasClients) return;
    final pos = scrollController.position;
    if (pos.pixels >= pos.maxScrollExtent - 300) {
      fetchMore();
    }
  }

  @override
  void dispose() {
    scrollController.removeListener(_onScroll);
    scrollController.dispose();
    super.dispose();
  }
}
