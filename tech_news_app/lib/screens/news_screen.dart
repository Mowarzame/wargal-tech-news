import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:cached_network_image/cached_network_image.dart';

import '../providers/news_provider.dart';
import '../models/news_item.dart';
import '../widgets/news_card.dart';
import '../widgets/content_modal.dart';

class NewsScreen extends StatefulWidget {
  const NewsScreen({super.key});

  @override
  NewsScreenState createState() => NewsScreenState();
}

class NewsScreenState extends State<NewsScreen> with WidgetsBindingObserver {
  bool _inited = false;

  Timer? _autoRefreshTimer;

  final ScrollController _scrollController = ScrollController();
  final PageController _pageController = PageController(viewportFraction: 0.92);

  int _lastTick = -1;
  int _lastSliderSig = 0;

  void scrollToTop({bool animated = true}) {
    if (!_scrollController.hasClients) return;
    if (!animated) {
      _scrollController.jumpTo(0);
      return;
    }
    _scrollController.animateTo(
      0,
      duration: const Duration(milliseconds: 280),
      curve: Curves.easeOutCubic,
    );
  }

  void onTabActivated({
    required bool scrollTop,
    required bool forceRefresh,
    required bool resetSlider,
  }) {
    if (scrollTop) scrollToTop(animated: true);
    if (resetSlider) _resetSliderToLatest();
    if (forceRefresh) {
      context.read<NewsProvider>().refresh(silent: false);
    }
  }

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
      });
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (!mounted) return;

    if (state == AppLifecycleState.resumed) {
      _startAutoRefresh();
      context.read<NewsProvider>().refreshOnResume();

    } else if (state == AppLifecycleState.paused ||
        state == AppLifecycleState.inactive ||
        state == AppLifecycleState.detached) {
      _stopAutoRefresh();
    }
  }

  void _startAutoRefresh() {
    _autoRefreshTimer?.cancel();
    _autoRefreshTimer = Timer.periodic(const Duration(seconds: 30), (_) async {
      if (!mounted) return;
      await context.read<NewsProvider>().refresh(silent: true);
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
    _pageController.dispose();
    _scrollController.dispose();
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

 void _openModal(BuildContext context, NewsItem item) {
  final p = context.read<NewsProvider>();
  final related = p.items.where((x) => x.kind == 2).toList();

  ContentModal.open(context, item, related: related);
}
  int _sliderSignature(List<NewsItem> slider) {
    int h = 17;
    for (final it in slider) {
      h = 37 * h + it.url.hashCode;
    }
    return h;
  }

  void _resetSliderToLatest() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      if (!_pageController.hasClients) return;
      _pageController.jumpToPage(0);
    });
  }

  String _timeAgo(DateTime dt) {
    final now = DateTime.now();
    final diff = now.difference(dt);

    if (diff.inSeconds < 60) return 'just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    if (diff.inDays < 7) return '${diff.inDays}d ago';

    final w = (diff.inDays / 7).floor();
    if (w < 4) return '${w}w ago';

    final mo = (diff.inDays / 30).floor();
    return '${mo}mo ago';
  }

  @override
  Widget build(BuildContext context) {
    final p = context.watch<NewsProvider>();

    final items = p.items.toList()..sort((a, b) => b.publishedAt.compareTo(a.publishedAt));
    final slider = p.sliderItems.toList()..sort((a, b) => b.publishedAt.compareTo(a.publishedAt));
    final discover = p.discoverItems.toList()..sort((a, b) => b.publishedAt.compareTo(a.publishedAt));

    if (_lastTick != p.refreshTick) {
      _lastTick = p.refreshTick;
      _resetSliderToLatest();
    }

    final sig = _sliderSignature(slider);
    if (_lastSliderSig != sig) {
      _lastSliderSig = sig;
      _resetSliderToLatest();
    }

    // Highlights fixed latest items
    final seenGrid = <String>{};
    final grid = <NewsItem>[];

    for (final it in discover) {
      final u = it.url.trim();
      if (u.isEmpty) continue;
      if (seenGrid.add(u)) {
        grid.add(it);
        if (grid.length == 6) break;
      }
    }
    if (grid.length < 6) {
      for (final it in items) {
        final u = it.url.trim();
        if (u.isEmpty) continue;
        if (seenGrid.add(u)) {
          grid.add(it);
          if (grid.length == 6) break;
        }
      }
    }

    final showSkeleton = p.isLoading && items.isEmpty;

    return Scaffold(
      backgroundColor: Colors.grey.shade100,
      body: RefreshIndicator(
        onRefresh: () => p.refresh(silent: false),
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          controller: _scrollController,
          slivers: [
            SliverPersistentHeader(
              pinned: true,
              delegate: _HeaderDelegate(
                height: 56,
                child: _PinnedTopBar(onOpenMenu: () => _openFiltersMenu(context)),
              ),
            ),

            if (showSkeleton)
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(12, 10, 12, 14),
                  child: const _SkeletonHeroSmall(),
                ),
              ),

            if (showSkeleton)
              const SliverToBoxAdapter(
                child: Padding(
                  padding: EdgeInsets.fromLTRB(12, 2, 12, 8),
                  child: Text(
                    "Highlights",
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900),
                  ),
                ),
              ),

            if (showSkeleton)
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  child: const _SkeletonGrid(),
                ),
              ),

            if (showSkeleton)
              const SliverToBoxAdapter(
                child: Padding(
                  padding: EdgeInsets.fromLTRB(12, 14, 12, 8),
                  child: Text(
                    "More news",
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900),
                  ),
                ),
              ),

            if (showSkeleton)
              SliverList(
                delegate: SliverChildBuilderDelegate(
                  (context, i) => const _SkeletonListItem(),
                  childCount: 8,
                ),
              ),

            // Normal slider
            if (!showSkeleton && slider.isNotEmpty)
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.only(top: 10),
                  child: _TopSlider(
                    pageController: _pageController,
                    items: slider.take(5).toList(),
                    onTap: (it) => _openModal(context, it),
                    timeAgo: (dt) => _timeAgo(dt),
                  ),
                ),
              ),

            if (!showSkeleton && p.error != null)
              const SliverToBoxAdapter(
                child: Padding(
                  padding: EdgeInsets.only(top: 80),
                  child: Center(child: Text("Failed to load news.")),
                ),
              ),

            if (!showSkeleton && p.error == null && items.isEmpty)
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.only(top: 80),
                  child: Center(
                    child: Text("No news yet"),
                  ),
                ),
              ),

            if (!showSkeleton && p.error == null && grid.isNotEmpty)
              const SliverToBoxAdapter(
                child: Padding(
                  padding: EdgeInsets.fromLTRB(12, 14, 12, 8),
                  child: Text(
                    "Highlights",
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900),
                  ),
                ),
              ),

            if (!showSkeleton && p.error == null && grid.isNotEmpty)
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  child: _NewsGridSection(items: grid, onTap: (it) => _openModal(context, it)),
                ),
              ),

            if (!showSkeleton && p.error == null && items.isNotEmpty)
              const SliverToBoxAdapter(
                child: Padding(
                  padding: EdgeInsets.fromLTRB(12, 14, 12, 8),
                  child: Text(
                    "More news",
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900),
                  ),
                ),
              ),

            if (!showSkeleton && p.error == null && items.isNotEmpty)
              SliverList(
                delegate: SliverChildBuilderDelegate(
                  (context, i) {
                    final item = items[i];
                    return NewsCard(
                      item: item,
                      onTap: () => _openModal(context, item),
                      leadingAvatar: _SourceAvatar(
                        iconUrl: item.sourceIconUrl,
                        fallbackText: item.sourceName.isNotEmpty ? item.sourceName : "S",
                      ),
                    );
                  },
                  childCount: items.length,
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
// Skeleton UI (local)
// ------------------------------

class _SkeletonBlock extends StatelessWidget {
  final double height;
  final double? width;
  final BorderRadius borderRadius;

  const _SkeletonBlock({
    required this.height,
    this.width,
    this.borderRadius = const BorderRadius.all(Radius.circular(14)),
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      height: height,
      width: width,
      decoration: BoxDecoration(
        color: Colors.grey.shade300,
        borderRadius: borderRadius,
      ),
    );
  }
}

class _SkeletonHeroSmall extends StatelessWidget {
  const _SkeletonHeroSmall();

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(18),
      child: Container(
        height: 210,
        color: Colors.grey.shade300,
        child: Stack(
          children: [
            Positioned(
              left: 14,
              right: 14,
              bottom: 14,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: const [
                  _SkeletonBlock(height: 14, width: 120),
                  SizedBox(height: 10),
                  _SkeletonBlock(height: 16),
                  SizedBox(height: 8),
                  _SkeletonBlock(height: 16, width: 220),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SkeletonGrid extends StatelessWidget {
  const _SkeletonGrid();

  @override
  Widget build(BuildContext context) {
    return GridView.builder(
      itemCount: 6,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 3,
        mainAxisSpacing: 10,
        crossAxisSpacing: 10,
        childAspectRatio: 0.95,
      ),
      itemBuilder: (_, __) {
        return ClipRRect(
          borderRadius: BorderRadius.circular(16),
          child: Container(
            color: Colors.white,
            child: Column(
              children: const [
                _SkeletonBlock(height: 62, borderRadius: BorderRadius.zero),
                SizedBox(height: 10),
                Padding(
                  padding: EdgeInsets.symmetric(horizontal: 10),
                  child: _SkeletonBlock(height: 12),
                ),
                SizedBox(height: 8),
                Padding(
                  padding: EdgeInsets.symmetric(horizontal: 10),
                  child: _SkeletonBlock(height: 12),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _SkeletonListItem extends StatelessWidget {
  const _SkeletonListItem();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
      child: Row(
        children: const [
          _SkeletonBlock(
            height: 44,
            width: 44,
            borderRadius: BorderRadius.all(Radius.circular(999)),
          ),
          SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _SkeletonBlock(height: 12),
                SizedBox(height: 8),
                _SkeletonBlock(height: 12, width: 220),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ------------------------------
// Existing UI helpers (kept)
// ------------------------------

class _PinnedTopBar extends StatelessWidget {
  final VoidCallback onOpenMenu;
  const _PinnedTopBar({required this.onOpenMenu});

  @override
  Widget build(BuildContext context) {
    final p = context.watch<NewsProvider>();
    final catLabel = p.selectedCategory;
    final srcLabel = p.isAllSelected ? "All sources" : "${p.selectedSourceIds.length} sources";

    return Container(
      color: Colors.white,
      padding: const EdgeInsets.symmetric(horizontal: 12),
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
          Expanded(
            child: Text(
              "$catLabel • $srcLabel",
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontWeight: FontWeight.w900),
            ),
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
                const Text("Filters", style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900)),
                const Spacer(),
                IconButton(onPressed: () => Navigator.pop(context), icon: const Icon(Icons.close)),
              ],
            ),
            const SizedBox(height: 8),
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
  bool shouldRebuild(covariant _HeaderDelegate old) => old.height != height || old.child != child;
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
    return CircleAvatar(
      child: Text(letter, style: const TextStyle(fontWeight: FontWeight.w800)),
    );
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

class _TopSlider extends StatelessWidget {
  const _TopSlider({
    required this.pageController,
    required this.items,
    required this.onTap,
    required this.timeAgo,
  });

  final PageController pageController;
  final List<NewsItem> items;
  final void Function(NewsItem item) onTap;
  final String Function(DateTime dt) timeAgo;

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) return const SizedBox.shrink();

    return SizedBox(
      height: 210,
      child: PageView.builder(
        controller: pageController,
        itemCount: items.length,
        itemBuilder: (context, i) {
          final it = items[i];
          final img = (it.imageUrl ?? "").trim();
          final ago = timeAgo(it.publishedAt.toLocal());

          return GestureDetector(
            onTap: () => onTap(it),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 6),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(18),
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    if (img.isNotEmpty)
                      CachedNetworkImage(imageUrl: img, fit: BoxFit.cover)
                    else
                      Container(color: Colors.grey.shade300),
                    Container(
                      decoration: const BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          colors: [Colors.transparent, Colors.black54],
                        ),
                      ),
                    ),
                    Positioned(
                      top: 12,
                      right: 12,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                        decoration: BoxDecoration(
                          color: Colors.black.withAlpha(120),
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: Text(
                          ago,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 12,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                    ),
                    Positioned(
                      left: 14,
                      right: 14,
                      bottom: 14,
                      child: Text(
                        it.title,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 16,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}
