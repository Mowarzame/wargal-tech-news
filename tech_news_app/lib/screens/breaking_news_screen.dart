import 'dart:async';
import 'dart:collection';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:cached_network_image/cached_network_image.dart';

import '../providers/news_provider.dart';
import '../models/news_item.dart';
import '../widgets/news_card.dart';
import '../widgets/content_modal.dart';

class BreakingNewsScreen extends StatefulWidget {
  const BreakingNewsScreen({super.key});

  @override
  State<BreakingNewsScreen> createState() => _BreakingNewsScreenState();
}

class _BreakingNewsScreenState extends State<BreakingNewsScreen>
    with WidgetsBindingObserver {
  bool _inited = false;

  Timer? _slideshowTimer;
  Timer? _autoRefreshTimer;

  List<NewsItem> _queue = const [];
  int _pos = 0;

  int _lastTick = -1;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();

    if (!_inited) {
      _inited = true;
      WidgetsBinding.instance.addPostFrameCallback((_) async {
        if (!mounted) return;
        await context.read<NewsProvider>().init();
        _startAutoRefresh();
        _startOrStopSlideshow();
      });
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (!mounted) return;

    if (state == AppLifecycleState.resumed) {
      _startAutoRefresh();
      _startOrStopSlideshow();
    } else if (state == AppLifecycleState.paused ||
        state == AppLifecycleState.inactive ||
        state == AppLifecycleState.detached) {
      _stopAutoRefresh();
      _slideshowTimer?.cancel();
      _slideshowTimer = null;
    }
  }

  void _startAutoRefresh() {
    _autoRefreshTimer?.cancel();
    _autoRefreshTimer = Timer.periodic(const Duration(minutes: 2), (_) async {
      if (!mounted) return;
      await context.read<NewsProvider>().refresh(silent: true);
      // slideshow reset is handled via refreshTick check in build()
    });
  }

  void _stopAutoRefresh() {
    _autoRefreshTimer?.cancel();
    _autoRefreshTimer = null;
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _stopAutoRefresh();
    _slideshowTimer?.cancel();
    _slideshowTimer = null;
    super.dispose();
  }

  void _openFiltersMenu(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => const _CombinedFiltersSheet(),
    );
  }

  void _openContent(BuildContext context, NewsItem item) {
    ContentModal.open(context, item);
  }

  void _startOrStopSlideshow() {
    if (_queue.length < 2) {
      _slideshowTimer?.cancel();
      _slideshowTimer = null;
      return;
    }
    if (_slideshowTimer != null) return;

    _slideshowTimer = Timer.periodic(const Duration(seconds: 6), (_) {
      if (!mounted) return;
      _goNext();
    });
  }

  void _goNext() {
    if (_queue.isEmpty) return;
    setState(() {
      _pos = (_pos + 1) % _queue.length;
    });
  }

  void _goPrev() {
    if (_queue.isEmpty) return;
    setState(() {
      _pos = (_pos - 1 + _queue.length) % _queue.length;
    });
  }

  String _timeAgo(DateTime dt) {
    final now = DateTime.now();
    final diff = now.difference(dt);

    if (diff.inSeconds < 0) return 'just now';
    if (diff.inSeconds < 60) return 'just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    if (diff.inDays < 7) return '${diff.inDays}d ago';

    final w = (diff.inDays / 7).floor();
    if (w < 4) return '${w}w ago';

    final mo = (diff.inDays / 30).floor();
    return '${mo}mo ago';
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

  List<NewsItem> _buildSlideQueue(List<NewsItem> latestSorted,
      {int maxSlides = 10}) {
    // Must be newest-first already
    final unique = _dedupeByUrlKeepOrder(latestSorted);

    // Optional: source mixing (keeps latest-first preference)
    final Map<String, Queue<NewsItem>> bySource = {};
    for (final it in unique) {
      final src =
          it.sourceName.trim().isEmpty ? 'Unknown' : it.sourceName.trim();
      (bySource[src] ??= Queue<NewsItem>()).add(it);
    }

    final sources = bySource.keys.toList();
    final slides = <NewsItem>[];

    while (slides.length < maxSlides && sources.isNotEmpty) {
      bool progressed = false;

      for (final s in List<String>.from(sources)) {
        final q = bySource[s];
        if (q == null || q.isEmpty) {
          sources.remove(s);
          continue;
        }
        slides.add(q.removeFirst());
        progressed = true;
        if (slides.length >= maxSlides) break;
      }

      if (!progressed) break;
    }

    if (slides.isEmpty) return unique.take(maxSlides).toList();
    return slides;
  }

  void _setQueueAndResetToLatest(List<NewsItem> newQueue) {
    _queue = newQueue;
    _pos = 0; // ✅ ALWAYS start from latest
    // restart slideshow timer safely
    _slideshowTimer?.cancel();
    _slideshowTimer = null;
    _startOrStopSlideshow();
  }

  @override
  Widget build(BuildContext context) {
    final p = context.watch<NewsProvider>();

    // ✅ Always newest-first (provider already sorted)
    final latest = p.items.toList()
      ..sort((a, b) => b.publishedAt.compareTo(a.publishedAt));

    final slideQueue = _buildSlideQueue(latest, maxSlides: 10);

    // ✅ If refresh happened (manual or auto), reset slideshow to latest
    if (_lastTick != p.refreshTick) {
      _lastTick = p.refreshTick;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        _setQueueAndResetToLatest(slideQueue);
      });
    } else {
      // If queue length/content changed (filters), still keep slideshow stable but start at latest
      final oldSig = _queue.map((e) => e.url).join('|');
      final newSig = slideQueue.map((e) => e.url).join('|');
      if (oldSig != newSig) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (!mounted) return;
          _setQueueAndResetToLatest(slideQueue);
        });
      } else {
        _queue = slideQueue;
        _startOrStopSlideshow();
      }
    }

    final current = _queue.isNotEmpty ? _queue[_pos] : null;

    // ✅ Highlights: FIXED latest items (not linked to _pos)
    final highlights = latest.take(6).toList();

    // ✅ More news: FIXED latest items (not linked to _pos)
    final moreList = latest;

    return Scaffold(
      backgroundColor: Colors.grey.shade100,
      body: RefreshIndicator(
        onRefresh: () => p.refresh(silent: false),
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            SliverPersistentHeader(
              pinned: true,
              delegate: _HeaderDelegate(
                height: 64,
                child: _PinnedFiltersBar(
                  title: "Breaking",
                  onOpenMenu: () => _openFiltersMenu(context),
                ),
              ),
            ),

            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(12, 14, 12, 10),
                child: Row(
                  children: [
                    const _BreakingPill(),
                    const SizedBox(width: 10),
                    const Expanded(
                      child: Text(
                        "Latest updates",
                        style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    IconButton(
                      tooltip: "Previous",
                      onPressed: _queue.length >= 2 ? _goPrev : null,
                      icon: const Icon(Icons.chevron_left),
                    ),
                    IconButton(
                      tooltip: "Next",
                      onPressed: _queue.length >= 2 ? _goNext : null,
                      icon: const Icon(Icons.chevron_right),
                    ),
                  ],
                ),
              ),
            ),

            if (p.isLoading)
              const SliverToBoxAdapter(
                child: Padding(
                  padding: EdgeInsets.only(top: 60),
                  child: Center(child: CircularProgressIndicator()),
                ),
              ),

            if (!p.isLoading && p.error != null)
              const SliverToBoxAdapter(
                child: Padding(
                  padding: EdgeInsets.only(top: 60),
                  child: Center(child: Text("Failed to load breaking news.")),
                ),
              ),

            if (!p.isLoading && p.error == null && current == null)
              const SliverToBoxAdapter(
                child: Padding(
                  padding: EdgeInsets.only(top: 60),
                  child: Center(child: Text("No breaking items yet")),
                ),
              ),

            if (!p.isLoading && p.error == null && current != null)
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(12, 4, 12, 14),
                  child: _BreakingHero(
                    key: ValueKey(current.url),
                    item: current,
                    timeAgo: _timeAgo(current.publishedAt.toLocal()),
                    onOpen: () => _openContent(context, current),
                  ),
                ),
              ),

            if (!p.isLoading && p.error == null && highlights.isNotEmpty)
              const SliverToBoxAdapter(
                child: Padding(
                  padding: EdgeInsets.fromLTRB(12, 2, 12, 8),
                  child: Text(
                    "Highlights",
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900),
                  ),
                ),
              ),

            if (!p.isLoading && p.error == null && highlights.isNotEmpty)
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  child: _NewsGridSection(
                    items: highlights,
                    onTap: (it) => _openContent(context, it),
                  ),
                ),
              ),

            if (!p.isLoading && p.error == null && moreList.isNotEmpty)
              const SliverToBoxAdapter(
                child: Padding(
                  padding: EdgeInsets.fromLTRB(12, 14, 12, 8),
                  child: Text(
                    "More news",
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900),
                  ),
                ),
              ),

            if (!p.isLoading && p.error == null && moreList.isNotEmpty)
              SliverList(
                delegate: SliverChildBuilderDelegate(
                  (context, i) {
                    final item = moreList[i];
                    return NewsCard(
                      item: item,
                      onTap: () => _openContent(context, item),
                      leadingAvatar: _SourceAvatar(
                        iconUrl: item.sourceIconUrl,
                        fallbackText: item.sourceName.isNotEmpty ? item.sourceName : "S",
                      ),
                    );
                  },
                  childCount: moreList.length,
                ),
              ),

            const SliverToBoxAdapter(child: SizedBox(height: 18)),
          ],
        ),
      ),
    );
  }
}

// ------------------------------
// UI helpers
// ------------------------------

class _PinnedFiltersBar extends StatelessWidget {
  final String title;
  final VoidCallback onOpenMenu;

  const _PinnedFiltersBar({
    required this.title,
    required this.onOpenMenu,
  });

  @override
  Widget build(BuildContext context) {
    final p = context.watch<NewsProvider>();

    final cat = p.selectedCategory;

    final active = p.filteredSources.where((s) => s.isActive).toList()
      ..sort((a, b) {
        final t = b.trustLevel.compareTo(a.trustLevel);
        if (t != 0) return t;
        return a.name.toLowerCase().compareTo(b.name.toLowerCase());
      });

    final singleSelectedId =
        (p.selectedSourceIds.length == 1) ? p.selectedSourceIds.first : null;

    return Container(
      color: Colors.white,
      padding: const EdgeInsets.symmetric(horizontal: 10),
      alignment: Alignment.center,
      child: Row(
        children: [
          SizedBox(
            height: 36,
            child: OutlinedButton.icon(
              onPressed: onOpenMenu,
              icon: const Icon(Icons.filter_alt_outlined, size: 18),
              label: const Text("Filter"),
              style: OutlinedButton.styleFrom(
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
          ),
          const SizedBox(width: 10),
          Flexible(
            flex: 0,
            child: Text(
              cat,
              style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16),
              overflow: TextOverflow.ellipsis,
            ),
          ),
          const SizedBox(width: 10),

          Expanded(
            child: SizedBox(
              height: 40,
              child: ListView.builder(
                scrollDirection: Axis.horizontal,
                physics: const BouncingScrollPhysics(),
                itemCount: 1 + active.length,
                itemBuilder: (context, index) {
                  if (index == 0) {
                    return Padding(
                      padding: const EdgeInsets.only(right: 10),
                      child: _IconOnlyChip(
                        tooltip: "All sources",
                        selected: p.isAllSelected,
                        imageUrl: null,
                        fallbackLetter: "A",
                        onTap: () => p.selectOnlySource(null),
                      ),
                    );
                  }

                  final s = active[index - 1];
                  final selected =
                      (singleSelectedId != null && singleSelectedId == s.id);

                  return Padding(
                    padding: const EdgeInsets.only(right: 10),
                    child: _IconOnlyChip(
                      tooltip: s.name,
                      selected: selected,
                      imageUrl: s.iconUrl,
                      fallbackLetter: (s.name.isNotEmpty ? s.name[0].toUpperCase() : "S"),
                      onTap: () => p.selectOnlySource(s.id),
                    ),
                  );
                },
              ),
            ),
          ),

          if (p.isSilentRefreshing)
            const Padding(
              padding: EdgeInsets.only(left: 8),
              child: Icon(Icons.sync, size: 18),
            ),
        ],
      ),
    );
  }
}

class _CombinedFiltersSheet extends StatefulWidget {
  const _CombinedFiltersSheet();

  @override
  State<_CombinedFiltersSheet> createState() => _CombinedFiltersSheetState();
}

class _CombinedFiltersSheetState extends State<_CombinedFiltersSheet> {
  final _controller = TextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final p = context.watch<NewsProvider>();
    final q = _controller.text.trim().toLowerCase();

    final sources = p.filteredSources.where((s) {
      if (!s.isActive) return false;
      if (q.isEmpty) return true;
      return s.name.toLowerCase().contains(q);
    }).toList();

    return SafeArea(
      child: Padding(
        padding: EdgeInsets.only(
          left: 14,
          right: 14,
          top: 10,
          bottom: MediaQuery.of(context).viewInsets.bottom + 12,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              children: [
                const Text(
                  "Category & Sources",
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900),
                ),
                const Spacer(),
                IconButton(onPressed: () => Navigator.pop(context), icon: const Icon(Icons.close)),
              ],
            ),
            const SizedBox(height: 10),

            Align(
              alignment: Alignment.centerLeft,
              child: Text(
                "Categories",
                style: TextStyle(color: Colors.grey.shade700, fontWeight: FontWeight.w800),
              ),
            ),
            const SizedBox(height: 8),

            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: p.categories.map((c) {
                final isSel = p.selectedCategory.toLowerCase() == c.toLowerCase();
                return ChoiceChip(
                  label: Text(c),
                  selected: isSel,
                  onSelected: (_) async {
                    await p.setCategory(c);
                    setState(() {});
                  },
                  selectedColor: const Color(0xFF1565C0).withAlpha(26),
                  labelStyle: TextStyle(
                    fontWeight: FontWeight.w900,
                    color: isSel ? const Color(0xFF1565C0) : Colors.black87,
                  ),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
                );
              }).toList(),
            ),

            const SizedBox(height: 14),

            TextField(
              controller: _controller,
              decoration: const InputDecoration(hintText: "Search sources…", prefixIcon: Icon(Icons.search)),
              onChanged: (_) => setState(() {}),
            ),
            const SizedBox(height: 10),

            Row(
              children: [
                TextButton(onPressed: () => p.clearSources(), child: const Text("Clear sources")),
                const Spacer(),
                ElevatedButton(
                  onPressed: () async {
                    Navigator.pop(context);
                    await p.applySourceSelection();
                  },
                  child: const Text("Apply"),
                ),
              ],
            ),

            const SizedBox(height: 6),

            Flexible(
              child: ListView.separated(
                shrinkWrap: true,
                itemCount: sources.length,
                separatorBuilder: (_, __) => const Divider(height: 1),
                itemBuilder: (_, i) {
                  final s = sources[i];
                  final checked = p.selectedSourceIds.contains(s.id);

                  return CheckboxListTile(
                    value: checked,
                    onChanged: (_) => p.toggleSource(s.id),
                    title: Text(s.name),
                    secondary: _SourceAvatar(iconUrl: s.iconUrl, fallbackText: s.name),
                    controlAffinity: ListTileControlAffinity.trailing,
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _HeaderDelegate extends SliverPersistentHeaderDelegate {
  final double height;
  final Widget child;

  _HeaderDelegate({required this.height, required this.child});

  @override
  double get minExtent => height;

  @override
  double get maxExtent => height;

  @override
  Widget build(BuildContext context, double shrinkOffset, bool overlapsContent) =>
      SizedBox(height: height, child: child);

  @override
  bool shouldRebuild(covariant _HeaderDelegate old) =>
      old.height != height || old.child != child;
}

class _IconOnlyChip extends StatelessWidget {
  final bool selected;
  final String? imageUrl;
  final String fallbackLetter;
  final VoidCallback onTap;
  final String tooltip;

  const _IconOnlyChip({
    required this.selected,
    required this.imageUrl,
    required this.fallbackLetter,
    required this.onTap,
    required this.tooltip,
  });

  @override
  Widget build(BuildContext context) {
    final url = (imageUrl ?? "").trim();

    return Tooltip(
      message: tooltip,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(999),
        child: Container(
          padding: const EdgeInsets.all(2),
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            border: Border.all(
              color: selected ? const Color(0xFF1565C0) : Colors.transparent,
              width: 2,
            ),
          ),
          child: CircleAvatar(
            radius: 16,
            backgroundColor: Colors.grey.shade200,
            backgroundImage: url.isNotEmpty ? CachedNetworkImageProvider(url) : null,
            child: url.isEmpty
                ? Text(fallbackLetter, style: const TextStyle(fontWeight: FontWeight.w900))
                : null,
          ),
        ),
      ),
    );
  }
}

class _BreakingPill extends StatelessWidget {
  const _BreakingPill();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: Colors.red.withAlpha(25),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: Colors.red.withAlpha(90)),
      ),
      child: const Text(
        "BREAKING",
        style: TextStyle(
          color: Colors.red,
          fontWeight: FontWeight.w900,
          letterSpacing: 0.6,
        ),
      ),
    );
  }
}

class _BreakingHero extends StatelessWidget {
  final NewsItem item;
  final String timeAgo;
  final VoidCallback onOpen;

  const _BreakingHero({
    super.key,
    required this.item,
    required this.timeAgo,
    required this.onOpen,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final img = (item.imageUrl ?? "").trim();
    final sourceIcon = (item.sourceIconUrl ?? "").trim();
    final sourceName = (item.sourceName).trim().isEmpty ? "Source" : item.sourceName.trim();

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onOpen,
        borderRadius: BorderRadius.circular(22),
        child: Container(
          height: 320,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(22),
            boxShadow: [
              BoxShadow(
                blurRadius: 18,
                color: Colors.black.withAlpha(20),
                offset: const Offset(0, 10),
              ),
            ],
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(22),
            child: Stack(
              fit: StackFit.expand,
              children: [
                if (img.isNotEmpty)
                  CachedNetworkImage(
                    imageUrl: img,
                    fit: BoxFit.cover,
                    placeholder: (_, __) => Container(
                      color: theme.colorScheme.surfaceContainerHighest.withAlpha(150),
                    ),
                    errorWidget: (_, __, ___) => Container(
                      color: theme.colorScheme.surfaceContainerHighest.withAlpha(150),
                      alignment: Alignment.center,
                      child: const Icon(Icons.broken_image_outlined),
                    ),
                  )
                else
                  Container(
                    color: theme.colorScheme.surfaceContainerHighest.withAlpha(150),
                    alignment: Alignment.center,
                    child: const Icon(Icons.image_not_supported_outlined),
                  ),
                Container(
                  decoration: const BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [Colors.black12, Colors.black54, Colors.black87],
                    ),
                  ),
                ),
                Positioned(
                  left: 12,
                  top: 12,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    decoration: BoxDecoration(
                      color: Colors.red,
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: const Text(
                      "BREAKING",
                      style: TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w900,
                        letterSpacing: 0.6,
                        fontSize: 12,
                      ),
                    ),
                  ),
                ),
                Positioned(
                  left: 14,
                  right: 14,
                  bottom: 14,
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      _HeroSourceAvatar(iconUrl: sourceIcon, fallbackText: sourceName),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Row(
                              children: [
                                Expanded(
                                  child: Text(
                                    sourceName,
                                    style: const TextStyle(
                                      color: Colors.white70,
                                      fontWeight: FontWeight.w900,
                                    ),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                                const SizedBox(width: 10),
                                Text(
                                  timeAgo,
                                  style: const TextStyle(
                                    color: Colors.white70,
                                    fontSize: 12,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 8),
                            Text(
                              item.title,
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 18,
                                fontWeight: FontWeight.w900,
                                height: 1.15,
                              ),
                              maxLines: 3,
                              overflow: TextOverflow.ellipsis,
                            ),
                            const SizedBox(height: 10),
                            const Row(
                              children: [
                                Icon(Icons.open_in_new, color: Colors.white70, size: 16),
                                SizedBox(width: 6),
                                Text(
                                  "Tap to read",
                                  style: TextStyle(
                                    color: Colors.white70,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _HeroSourceAvatar extends StatelessWidget {
  final String iconUrl;
  final String fallbackText;

  const _HeroSourceAvatar({required this.iconUrl, required this.fallbackText});

  @override
  Widget build(BuildContext context) {
    if (iconUrl.isNotEmpty) {
      return CircleAvatar(
        radius: 16,
        backgroundColor: Colors.white,
        child: CircleAvatar(
          radius: 14,
          backgroundImage: CachedNetworkImageProvider(iconUrl),
        ),
      );
    }
    final letter = fallbackText.isNotEmpty ? fallbackText[0].toUpperCase() : "?";
    return CircleAvatar(
      radius: 16,
      backgroundColor: Colors.white,
      child: CircleAvatar(
        radius: 14,
        child: Text(letter, style: const TextStyle(fontWeight: FontWeight.w900)),
      ),
    );
  }
}

class _SourceAvatar extends StatelessWidget {
  final String? iconUrl;
  final String fallbackText;

  const _SourceAvatar({required this.iconUrl, required this.fallbackText});

  @override
  Widget build(BuildContext context) {
    final url = (iconUrl ?? "").trim();
    if (url.isNotEmpty) {
      return CircleAvatar(
        backgroundColor: Colors.transparent,
        backgroundImage: CachedNetworkImageProvider(url),
      );
    }
    final letter = fallbackText.isNotEmpty ? fallbackText[0].toUpperCase() : "?";
    return CircleAvatar(child: Text(letter, style: const TextStyle(fontWeight: FontWeight.w800)));
  }
}

class _NewsGridSection extends StatelessWidget {
  final List<NewsItem> items;
  final void Function(NewsItem item) onTap;

  const _NewsGridSection({required this.items, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final list = items.length > 6 ? items.take(6).toList() : items;

    return GridView.builder(
      itemCount: list.length,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 3,
        mainAxisSpacing: 10,
        crossAxisSpacing: 10,
        childAspectRatio: 0.95,
      ),
      itemBuilder: (context, i) {
        final it = list[i];
        return _MiniGridCard(item: it, onTap: () => onTap(it));
      },
    );
  }
}

class _MiniGridCard extends StatelessWidget {
  final NewsItem item;
  final VoidCallback onTap;

  const _MiniGridCard({required this.item, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final img = (item.imageUrl ?? "").trim();
    final iconUrl = (item.sourceIconUrl ?? "").trim();
    final srcName = item.sourceName.trim().isEmpty ? "S" : item.sourceName.trim();

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Container(
            decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16)),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                ClipRRect(
                  borderRadius: const BorderRadius.only(
                    topLeft: Radius.circular(16),
                    topRight: Radius.circular(16),
                  ),
                  child: AspectRatio(
                    aspectRatio: 16 / 9,
                    child: img.isEmpty
                        ? Container(
                            color: Colors.grey.shade200,
                            alignment: Alignment.center,
                            child: const Icon(Icons.image_not_supported_outlined),
                          )
                        : CachedNetworkImage(
                            imageUrl: img,
                            fit: BoxFit.cover,
                            errorWidget: (_, __, ___) => Container(
                              color: Colors.grey.shade200,
                              alignment: Alignment.center,
                              child: const Icon(Icons.broken_image_outlined),
                            ),
                          ),
                  ),
                ),
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(8, 6, 8, 8),
                    child: Text(
                      item.title,
                      maxLines: 3,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 11.5, height: 1.15),
                    ),
                  ),
                ),
              ],
            ),
          ),
          Positioned(
            top: -8,
            right: -8,
            child: _GridSourceAvatar(iconUrl: iconUrl, fallbackText: srcName),
          ),
        ],
      ),
    );
  }
}

class _GridSourceAvatar extends StatelessWidget {
  final String iconUrl;
  final String fallbackText;

  const _GridSourceAvatar({required this.iconUrl, required this.fallbackText});

  @override
  Widget build(BuildContext context) {
    if (iconUrl.isNotEmpty) {
      return CircleAvatar(
        radius: 14,
        backgroundColor: Colors.white,
        child: CircleAvatar(
          radius: 12,
          backgroundImage: CachedNetworkImageProvider(iconUrl),
        ),
      );
    }
    final letter = fallbackText.isNotEmpty ? fallbackText[0].toUpperCase() : "?";
    return CircleAvatar(
      radius: 14,
      backgroundColor: Colors.white,
      child: CircleAvatar(
        radius: 12,
        child: Text(letter, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
      ),
    );
  }
}
