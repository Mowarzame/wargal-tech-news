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
  int _seedA = 0;
int _seedB = 0;


  // seeded randomness (changes on refresh/reload)
  int _mixSeed = 0;

  // dedupe across visible lists + pagination
  final Set<String> _seen = {};

  // scroll
  final ScrollController scrollController = ScrollController();
  bool _scrollAttached = false;

  bool get isAllSelected => selectedSourceIds.isEmpty;

  // ✅ show 2–3 quick sources in pinned row
  List<NewsSource> get quickSources {
    final active = sources.where((s) => s.isActive).toList();
    active.sort((a, b) {
      final t = b.trustLevel.compareTo(a.trustLevel);
      if (t != 0) return t;
      return a.name.toLowerCase().compareTo(b.name.toLowerCase());
    });
    return active.take(3).toList();
  }

  Future<void> init() async {
    if (!_scrollAttached) {
      _scrollAttached = true;
      scrollController.addListener(_onScroll);
    }

    await Future.wait([
      fetchSources(),
      fetchNews(force: true),
    ]);
  }

  @override
  void dispose() {
    if (_scrollAttached) {
      scrollController.removeListener(_onScroll);
    }
    scrollController.dispose();
    super.dispose();
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
    // ✅ this matches your backend controller: [Route("api/news-sources")]
    sources = await _api.getNewsSources(); // /api/news-sources

    // Optional: only active
    sources = sources.where((s) => s.isActive).toList();

    sources.sort((a, b) => a.name.toLowerCase().compareTo(b.name.toLowerCase()));

    // ✅ DEBUG (remove later)
    debugPrint("✅ SOURCES LOADED => ${sources.length}");
    for (final s in sources.take(5)) {
      debugPrint(" - ${s.name} (${s.id}) active=${s.isActive}");
    }

    notifyListeners();
  } catch (e) {
    debugPrint("❌ fetchSources failed => $e");
    sources = [];
    notifyListeners();
  }
}





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
    // ✅ Strong seed: microseconds + counter (guarantees different every refresh)
    _refreshCounter++;
    final seed = DateTime.now().microsecondsSinceEpoch ^ (_refreshCounter * 9973);
    final rng = Random(seed);

    // =========================
    // 1) SINGLE SOURCE MODE
    // =========================
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

      // Latest 25 (strict)
      fetched.sort((a, b) => b.publishedAt.compareTo(a.publishedAt));

      // ✅ Carousel RANDOM from latest 25 (changes every refresh)
      final sliderPool = List<NewsItem>.from(fetched);
      sliderPool.shuffle(rng);
      sliderItems = sliderPool.take(5).toList();

      // ✅ Main list must be the remaining latest items (still latest order)
      // Remove carousel ids from list (so no duplicates)
      final sliderIds = sliderItems.map((e) => e.id).toSet();
      final remainingLatest = fetched.where((x) => !sliderIds.contains(x.id)).toList();

      items = remainingLatest;               // show all remaining (up to 20)
      discoverItems = remainingLatest.take(6).toList();

      // paging
      _page = 1;
      _hasMore = fetched.length == 25;
      return;
    }

    // =========================
    // 2) ALL / MULTI-SOURCE MODE
    // =========================
    const int pageSize = 120;
    const int maxPages = 5;      // 120*5=600 max fetch window
    const int maxPool = 600;     // hard cap

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

    // Always keep a newest-first view available
    final latestFirst = List<NewsItem>.from(pool)
      ..sort((a, b) => b.publishedAt.compareTo(a.publishedAt));

    // ✅ Carousel RANDOM from a "latest window"
    // (random but still fresh)
    final latestWindowSize = min(80, latestFirst.length); // top 80 newest
    final sliderWindow = latestFirst.take(latestWindowSize).toList();
    sliderWindow.shuffle(rng);
    sliderItems = sliderWindow.take(5).toList();

    final sliderIds = sliderItems.map((e) => e.id).toSet();

    // ✅ Build diversity anchors: 1 newest per source (excluding slider)
    final onePerSource = _latestOnePerSource(
      latestFirst.where((x) => !sliderIds.contains(x.id)).toList(),
    );

    // ✅ Make the ALL feed random every refresh:
    // - Start with randomized onePerSource (diverse)
    // - Fill with randomized remaining
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

    // First pass: diverse items
    for (final it in diversified) {
      if (finalFeed.length >= 60) break;
      addIfOk(it);
    }

    // Second pass: fill randomly
    for (final it in remaining) {
      if (finalFeed.length >= 160) break;
      addIfOk(it);
    }

    // ✅ assign UI sections
    items = finalFeed.take(40).toList();
    discoverItems = finalFeed.skip(40).take(6).toList();

    _page = 1;
    _hasMore = true;
  } catch (e) {
    error = e.toString();
    _hasMore = false;
  } finally {
    isLoading = false;
    notifyListeners();
  }
}



// ✅ helper: pick the newest item per sourceId (guarantees diversity)
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

    // ✅ Single source mode paging
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

    // ✅ All/multi mode paging
    final seed = DateTime.now().millisecondsSinceEpoch;
    final rng = Random(seed);

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


  // --- pool builders / mixing ---

  List<NewsItem> _balancedLatestPool(List<NewsItem> input, {required int perSource}) {
    final bySource = <String, List<NewsItem>>{};

    for (final it in input) {
      final sid = it.sourceId;
      if (sid == null || sid.isEmpty) continue;
      if (it.id.isEmpty) continue;
      bySource.putIfAbsent(sid, () => []).add(it);
    }

    // newest first per source
    for (final list in bySource.values) {
      list.sort((a, b) => b.publishedAt.compareTo(a.publishedAt));
    }

    // take top N per source
    final pool = <NewsItem>[];
    for (final entry in bySource.entries) {
      pool.addAll(entry.value.take(perSource));
    }

    // also shuffle source contribution order with seed
    return pool;
  }

  List<T> _seededShuffle<T>(List<T> list, int seed) {
    final copy = List<T>.from(list);

    int x = seed & 0x7fffffff;
    int nextInt(int max) {
      x = (1103515245 * x + 12345) & 0x7fffffff;
      return max == 0 ? 0 : x % max;
    }

    for (int i = copy.length - 1; i > 0; i--) {
      final j = nextInt(i + 1);
      final tmp = copy[i];
      copy[i] = copy[j];
      copy[j] = tmp;
    }
    return copy;
  }

  List<T> _rotate<T>(List<T> list, int offset) {
    if (list.isEmpty) return list;
    final o = offset.abs() % list.length;
    return [...list.skip(o), ...list.take(o)];
  }

  // --- filtering ---

  List<NewsItem> _applySelectedSources(List<NewsItem> input) {
    if (selectedSourceIds.isEmpty) return input;

    return input.where((x) {
      final sid = x.sourceId;
      if (sid == null || sid.isEmpty) return false;
      return selectedSourceIds.contains(sid);
    }).toList();
  }

  // --- selection ---

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
