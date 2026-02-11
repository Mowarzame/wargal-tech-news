import 'dart:async';
import 'dart:math';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';

import '../models/news_item.dart';
import '../models/news_source.dart';
import '../services/api_service.dart';

class NewsProvider extends ChangeNotifier {
  NewsProvider(this._api);

  final ApiService _api;

  bool isLoading = false;
  bool isLoadingMore = false;
  String? error;

  List<NewsItem> items = [];
  List<NewsItem> discoverItems = [];
  List<NewsSource> sources = [];
  List<NewsItem> sliderItems = [];

  int _refreshCounter = 0;

  // multi-select sources (empty = All)
  final Set<String> selectedSourceIds = {};

  // paging
  int _page = 1;
  final int _pageSize = 120;
  bool _hasMore = true;

  // dedupe across visible lists + pagination
  final Set<String> _seen = {};

  // scroll
  final ScrollController scrollController = ScrollController();
  bool _scrollAttached = false;

  bool get isAllSelected => selectedSourceIds.isEmpty;

  // ==========================
  // ✅ AUTO REFRESH STATE
  // ==========================
  Timer? _autoRefreshTimer;
  bool _autoRefreshing = false;
  DateTime? _lastAutoRefreshAt;

  // Configure refresh interval here
  static const Duration _autoRefreshInterval = Duration(seconds: 30);

  Future<void> init() async {
    if (!_scrollAttached) {
      _scrollAttached = true;
      scrollController.addListener(_onScroll);
    }

    await Future.wait([
      fetchSources(),
      fetchNews(force: true),
    ]);

    // ✅ start auto refresh after initial load
    _startAutoRefresh();
  }

  @override
  void dispose() {
    _stopAutoRefresh();

    if (_scrollAttached) {
      scrollController.removeListener(_onScroll);
    }
    scrollController.dispose();
    super.dispose();
  }

  void _startAutoRefresh() {
    _autoRefreshTimer?.cancel();
    _autoRefreshTimer = Timer.periodic(_autoRefreshInterval, (_) async {
      await autoRefreshTop();
    });
  }

  void _stopAutoRefresh() {
    _autoRefreshTimer?.cancel();
    _autoRefreshTimer = null;
  }

  /// Call this from AppLifecycleState changes if you want (see section 2)
  void setAutoRefreshEnabled(bool enabled) {
    if (enabled) {
      _startAutoRefresh();
    } else {
      _stopAutoRefresh();
    }
  }

  void _onScroll() {
    if (!_hasMore || isLoadingMore || isLoading) return;

    final pos = scrollController.position;
    if (!pos.hasPixels) return;

    if (pos.pixels >= (pos.maxScrollExtent - 600)) {
      loadMore();
    }
  }

  Future<void> fetchSources() async {
    try {
      sources = await _api.getNewsSources();
      sources = sources.where((s) => s.isActive).toList();
      sources.sort((a, b) => a.name.toLowerCase().compareTo(b.name.toLowerCase()));
      notifyListeners();
    } catch (e) {
      sources = [];
      notifyListeners();
    }
  }

  // =========================================================
  // ✅ NEW: AUTO REFRESH (fetch page 1 only, merge in place)
  // =========================================================
  Future<void> autoRefreshTop() async {
    // Don’t overlap / don’t refresh while manual loading more or full loading
    if (_autoRefreshing || isLoading || isLoadingMore) return;

    // If user just refreshed manually, avoid double hits for a moment
    final now = DateTime.now();
    if (_lastAutoRefreshAt != null &&
        now.difference(_lastAutoRefreshAt!) < const Duration(seconds: 10)) {
      return;
    }

    _autoRefreshing = true;

    try {
      // Fetch only the newest window (page 1)
      // Single-source mode: pageSize 25 (matches your logic)
      // All/multi mode: fetch a modest top window (e.g., 120)
      final bool singleSource = selectedSourceIds.length == 1;
      final String? sid = singleSource ? selectedSourceIds.first : null;

      final fetched = await _api.getFeedItems(
        page: 1,
        pageSize: singleSource ? 25 : 120,
        sourceId: sid,
      );

      // Apply multi-select filter client-side for multi mode
      final filtered = _applySelectedSources(fetched);

      if (filtered.isEmpty) return;

      // Sort newest-first for merge
      filtered.sort((a, b) => b.publishedAt.compareTo(a.publishedAt));

      // Merge into current list WITHOUT clearing (no UI jump)
      final changed = _mergeTopItems(filtered);

      if (changed) {
        // Optionally refresh slider + discover from updated items
        _rebuildSectionsAfterMerge();
        notifyListeners();
      }

      _lastAutoRefreshAt = DateTime.now();
    } catch (_) {
      // Silent fail (network hiccup). You can log if you want.
    } finally {
      _autoRefreshing = false;
    }
  }

  /// Merge new top items into `items` (prepend new ones, keep old),
  /// de-dupe by id + url, keep max length for performance.
  bool _mergeTopItems(List<NewsItem> newestSorted) {
    bool changed = false;

    // Build a quick lookup of existing ids + urls
    final existingIds = items.map((e) => e.id).where((x) => x.isNotEmpty).toSet();
    final existingUrls = items.map((e) => e.url.trim()).where((x) => x.isNotEmpty).toSet();

    // Find truly new items (not seen by id or url)
    final toPrepend = <NewsItem>[];
    for (final it in newestSorted) {
      final idOk = it.id.isNotEmpty && !existingIds.contains(it.id);
      final urlOk = it.url.trim().isNotEmpty && !existingUrls.contains(it.url.trim());

      // accept if either id or url indicates it's new (handles backend differences)
      if (idOk || urlOk) {
        toPrepend.add(it);
      }
    }

    if (toPrepend.isEmpty) return false;

    // Prepend
    items = [...toPrepend, ...items];
    changed = true;

    // Keep list bounded (avoid memory growth)
    if (items.length > 200) {
      items = items.take(200).toList();
    }

    // Update _seen so loadMore won’t re-add
    for (final it in toPrepend) {
      if (it.id.isNotEmpty) _seen.add(it.id);
    }

    return changed;
  }

  /// Keep your UI sections consistent after a merge:
  /// - sliderItems stay “fresh random”
  /// - discoverItems filled from the feed
  void _rebuildSectionsAfterMerge() {
    _refreshCounter++;
    final seed = DateTime.now().microsecondsSinceEpoch ^ (_refreshCounter * 9973);
    final rng = Random(seed);

    // slider from latest window
    final latest = items.toList()
      ..sort((a, b) => b.publishedAt.compareTo(a.publishedAt));

    final window = latest.take(min(80, latest.length)).toList();
    window.shuffle(rng);
    sliderItems = window.take(5).toList();

    final sliderIds = sliderItems.map((e) => e.id).toSet();
    final remaining = latest.where((x) => !sliderIds.contains(x.id)).toList();

    discoverItems = remaining.take(6).toList();
  }

  // ==========================
  // Your existing fetchNews/loadMore logic remains.
  // Keep it as-is, but add ONE LINE at end to mark lastAutoRefresh time.
  // ==========================
  Future<void> fetchNews({bool force = false}) async {
    if (isLoading && !force) return;

    isLoading = true;
    error = null;
    notifyListeners();

    _page = 1;
    _hasMore = true;

    sliderItems = [];
    items = [];
    discoverItems = [];
    _seen.clear();

    try {
      _refreshCounter++;
      final seed = DateTime.now().microsecondsSinceEpoch ^ (_refreshCounter * 9973);
      final rng = Random(seed);

      if (selectedSourceIds.length == 1) {
        final sid = selectedSourceIds.first;

        final fetched = await _api.getFeedItems(
          page: 1,
          pageSize: 25,
          sourceId: sid,
        );

        if (fetched.isEmpty) {
          _hasMore = false;
          return;
        }

        fetched.sort((a, b) => b.publishedAt.compareTo(a.publishedAt));

        final sliderPool = List<NewsItem>.from(fetched);
        sliderPool.shuffle(rng);
        sliderItems = sliderPool.take(5).toList();

        final sliderIds = sliderItems.map((e) => e.id).toSet();
        final remainingLatest = fetched.where((x) => !sliderIds.contains(x.id)).toList();

        items = remainingLatest;
        discoverItems = remainingLatest.take(6).toList();

        _page = 1;
        _hasMore = fetched.length == 25;
        return;
      }

      const int pageSize = 120;
      const int maxPages = 5;
      const int maxPool = 600;

      final pool = <NewsItem>[];

      for (int pnum = 1; pnum <= maxPages; pnum++) {
        final pageItems = await _api.getFeedItems(
          page: pnum,
          pageSize: pageSize,
          sourceId: null,
        );

        if (pageItems.isEmpty) break;

        final filtered = _applySelectedSources(pageItems);
        pool.addAll(filtered);

        if (pool.length >= maxPool) break;
        if (pageItems.length < pageSize) break;
      }

      if (pool.isEmpty) {
        _hasMore = false;
        return;
      }

      final latestFirst = List<NewsItem>.from(pool)
        ..sort((a, b) => b.publishedAt.compareTo(a.publishedAt));

      final latestWindowSize = min(80, latestFirst.length);
      final sliderWindow = latestFirst.take(latestWindowSize).toList();
      sliderWindow.shuffle(rng);
      sliderItems = sliderWindow.take(5).toList();

      final sliderIds = sliderItems.map((e) => e.id).toSet();

      final onePerSource = _latestOnePerSource(
        latestFirst.where((x) => !sliderIds.contains(x.id)).toList(),
      );

      final diversified = List<NewsItem>.from(onePerSource)..shuffle(rng);
      final remaining = latestFirst.where((x) => !sliderIds.contains(x.id)).toList()..shuffle(rng);

      final finalFeed = <NewsItem>[];
      final used = <String>{...sliderIds};

      void addIfOk(NewsItem it) {
        if (it.id.isEmpty) return;
        if (used.contains(it.id)) return;
        used.add(it.id);
        finalFeed.add(it);
      }

      for (final it in diversified) {
        if (finalFeed.length >= 60) break;
        addIfOk(it);
      }

      for (final it in remaining) {
        if (finalFeed.length >= 160) break;
        addIfOk(it);
      }

      items = finalFeed.take(40).toList();
      discoverItems = finalFeed.skip(40).take(6).toList();

      _page = 1;
      _hasMore = true;
    } catch (e) {
      error = e.toString();
      _hasMore = false;
    } finally {
      isLoading = false;
      _lastAutoRefreshAt = DateTime.now(); // ✅ prevents immediate timer double-hit
      notifyListeners();
    }
  }

  List<NewsItem> _latestOnePerSource(List<NewsItem> input) {
    final map = <String, NewsItem>{};

    for (final it in input) {
      final sid = it.sourceId;
      if (sid.isEmpty) continue;

      final existing = map[sid];
      if (existing == null || it.publishedAt.isAfter(existing.publishedAt)) {
        map[sid] = it;
      }
    }

    final list = map.values.toList();
    list.sort((a, b) => b.publishedAt.compareTo(a.publishedAt));
    return list;
  }

  Future<void> loadMore() async {
    if (!_hasMore || isLoadingMore || isLoading) return;

    isLoadingMore = true;
    notifyListeners();

    try {
      _page += 1;

      if (selectedSourceIds.length == 1) {
        final sid = selectedSourceIds.first;

        final fetched = await _api.getFeedItems(
          page: _page,
          pageSize: 25,
          sourceId: sid,
        );

        if (fetched.isEmpty) {
          _hasMore = false;
          return;
        }

        fetched.sort((a, b) => b.publishedAt.compareTo(a.publishedAt));

        final toAdd = <NewsItem>[];
        for (final it in fetched) {
          if (toAdd.length >= 25) break;
          if (it.id.isEmpty) continue;
          if (_seen.contains(it.id)) continue;
          _seen.add(it.id);
          toAdd.add(it);
        }

        items.addAll(toAdd);
        _hasMore = fetched.length == 25;
        return;
      }

      final rng = Random(DateTime.now().millisecondsSinceEpoch);

      final fetched = await _api.getFeedItems(
        page: _page,
        pageSize: 120,
        sourceId: null,
      );

      if (fetched.isEmpty) {
        _hasMore = false;
        return;
      }

      final filtered = _applySelectedSources(fetched);
      filtered.shuffle(rng);

      final toAdd = <NewsItem>[];
      for (final it in filtered) {
        if (toAdd.length >= 20) break;
        if (it.id.isEmpty) continue;
        if (_seen.contains(it.id)) continue;
        _seen.add(it.id);
        toAdd.add(it);
      }

      items.addAll(toAdd);
      _hasMore = fetched.length >= 120;
    } catch (e) {
      error = e.toString();
      _hasMore = false;
    } finally {
      isLoadingMore = false;
      notifyListeners();
    }
  }

  List<NewsItem> _applySelectedSources(List<NewsItem> input) {
    if (selectedSourceIds.isEmpty) return input;

    return input.where((x) {
      final sid = x.sourceId;
      if (sid.isEmpty) return false;
      return selectedSourceIds.contains(sid);
    }).toList();
  }

  void clearSources() {
    selectedSourceIds.clear();
    notifyListeners();
  }

  void toggleSource(String id) {
    if (selectedSourceIds.contains(id)) {
      selectedSourceIds.remove(id);
    } else {
      selectedSourceIds.add(id);
    }
    notifyListeners();
  }

  Future<void> applySourceSelection() async => fetchNews(force: true);

  Future<void> selectOnlySource(String? id) async {
    selectedSourceIds.clear();
    if (id != null) selectedSourceIds.add(id);
    notifyListeners();
    await fetchNews(force: true);
  }

  Future<void> refresh() => fetchNews(force: true);
}
