import 'dart:async';
import 'dart:collection';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:cached_network_image/cached_network_image.dart';

import '../providers/news_provider.dart';
import '../models/news_item.dart';
import '../models/news_source.dart';
import '../widgets/news_card.dart';
import 'news_webview_screen.dart';

class BreakingNewsScreen extends StatefulWidget {
  const BreakingNewsScreen({super.key});

  @override
  State<BreakingNewsScreen> createState() => _BreakingNewsScreenState();
}

class _BreakingNewsScreenState extends State<BreakingNewsScreen> {
  bool _inited = false;

  Timer? _timer;

  // Slideshow queue (unique items), and current position
  List<NewsItem> _queue = const [];
  int _pos = 0;

  // Track what has been shown in the current cycle so we don't repeat
  final Set<String> _shownUrls = <String>{};

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!_inited) {
      _inited = true;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) context.read<NewsProvider>().init();
      });
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  void _openItem(BuildContext context, NewsItem item) {
    final raw = item.url.trim();
    final uri = Uri.tryParse(raw);
    final ok = uri != null && (uri.scheme == 'http' || uri.scheme == 'https');

    if (!ok) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text("Invalid link: $raw")),
      );
      return;
    }

    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => NewsWebViewScreen(url: raw, title: item.title),
      ),
    );
  }

  void _openSourcesPicker(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => const _SourcesPickerSheet(),
    );
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

  /// Build a slideshow queue that:
  /// 1) is latest-first
  /// 2) is unique by url
  /// 3) prefers different sources (round-robin) before repeating sources
  List<NewsItem> _buildSlideQueue(List<NewsItem> latestSorted, {int maxSlides = 10}) {
    final byUrl = LinkedHashMap<String, NewsItem>();
    for (final it in latestSorted) {
      final u = it.url.trim();
      if (u.isEmpty) continue;
      byUrl.putIfAbsent(u, () => it);
    }
    final unique = byUrl.values.toList();

    final Map<String, Queue<NewsItem>> bySource = {};
    for (final it in unique) {
      final src = (it.sourceName ?? '').trim().isEmpty ? 'Unknown' : (it.sourceName ?? '').trim();
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

    if (slides.isEmpty) {
      return unique.take(maxSlides).toList();
    }

    return slides;
  }

  void _syncQueue(List<NewsItem> newQueue) {
    final oldUrls = _queue.map((e) => e.url).toList();
    final newUrls = newQueue.map((e) => e.url).toList();

    final same = oldUrls.length == newUrls.length &&
        List.generate(oldUrls.length, (i) => oldUrls[i] == newUrls[i]).every((x) => x);

    if (same) return;

    _queue = newQueue;
    _pos = 0;
    _shownUrls.clear();
    if (_queue.isNotEmpty) _shownUrls.add(_queue[0].url.trim());
  }

  void _startOrStopTimer() {
    if (_queue.length < 2) {
      _timer?.cancel();
      _timer = null;
      return;
    }
    if (_timer != null) return;

    _timer = Timer.periodic(const Duration(seconds: 6), (_) {
      if (!mounted) return;
      _goNext();
    });
  }

  void _goNext() {
    if (_queue.isEmpty) return;

    if (_shownUrls.length >= _queue.length) {
      _shownUrls.clear();
      _shownUrls.add(_queue[_pos].url.trim()); // prevent immediate repeat
    }

    int attempts = 0;
    int next = _pos;

    while (attempts < _queue.length) {
      next = (next + 1) % _queue.length;
      final url = _queue[next].url.trim();
      if (!_shownUrls.contains(url)) {
        setState(() {
          _pos = next;
          _shownUrls.add(url);
        });
        return;
      }
      attempts++;
    }

    setState(() {
      _pos = (_pos + 1) % _queue.length;
      _shownUrls.add(_queue[_pos].url.trim());
    });
  }

  void _goPrev() {
    if (_queue.isEmpty) return;
    setState(() {
      _pos = (_pos - 1 + _queue.length) % _queue.length;
      _shownUrls.add(_queue[_pos].url.trim());
    });
  }

  @override
  Widget build(BuildContext context) {
    final p = context.watch<NewsProvider>();

    // Latest-only feed items (provider already respects source filters)
    final latest = p.items.toList()
      ..sort((a, b) => b.publishedAt.compareTo(a.publishedAt));

    // Build slideshow from latest feed items
    final slideQueue = _buildSlideQueue(latest, maxSlides: 10);
    _syncQueue(slideQueue);
    _startOrStopTimer();

    final current = _queue.isNotEmpty ? _queue[_pos] : null;

    // Exclude slideshow items from grid + list
    final slideUrls = _queue.map((e) => e.url.trim()).toSet();

    // Highlights grid: 6 items preferred with images, fallback to any items
    final highlights = <NewsItem>[];
    final seenGrid = <String>{};

    for (final it in latest) {
      final url = it.url.trim();
      if (url.isEmpty) continue;
      if (slideUrls.contains(url)) continue;
      if (seenGrid.contains(url)) continue;
      if ((it.imageUrl ?? '').trim().isEmpty) continue;
      seenGrid.add(url);
      highlights.add(it);
      if (highlights.length == 6) break;
    }
    if (highlights.length < 6) {
      for (final it in latest) {
        final url = it.url.trim();
        if (url.isEmpty) continue;
        if (slideUrls.contains(url)) continue;
        if (seenGrid.contains(url)) continue;
        seenGrid.add(url);
        highlights.add(it);
        if (highlights.length == 6) break;
      }
    }

    // More news list: latest excluding slideshow + excluding highlights
    final highlightUrls = highlights.map((e) => e.url.trim()).toSet();
    final more = latest
        .where((it) => !slideUrls.contains(it.url.trim()) && !highlightUrls.contains(it.url.trim()))
        .take(30)
        .toList();

    return Scaffold(
      backgroundColor: Colors.grey.shade100,
      body: RefreshIndicator(
        onRefresh: p.refresh,
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            // ✅ Sources filter header (same UX as NewsScreen)
            SliverPersistentHeader(
              pinned: true,
              delegate: _ChipsHeaderDelegate(
                height: 52,
                child: _PinnedChipsRow(
                  onOpenPicker: () => _openSourcesPicker(context),
                ),
              ),
            ),

            // Header row (Breaking label + next button)
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
                      tooltip: "Next",
                      onPressed: _queue.length >= 2 ? _goNext : null,
                      icon: const Icon(Icons.skip_next),
                    ),
                  ],
                ),
              ),
            ),

            // Loading / error / empty
            if (p.isLoading)
              const SliverToBoxAdapter(
                child: Padding(
                  padding: EdgeInsets.only(top: 60),
                  child: Center(child: CircularProgressIndicator()),
                ),
              ),

            if (!p.isLoading && p.error != null)
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.only(top: 60),
                  child: Center(child: Text("Error: ${p.error}")),
                ),
              ),

            if (!p.isLoading && p.error == null && current == null)
              const SliverToBoxAdapter(
                child: Padding(
                  padding: EdgeInsets.only(top: 60),
                  child: Center(child: Text("No breaking items yet")),
                ),
              ),

            // Hero slideshow
            if (!p.isLoading && p.error == null && current != null)
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(12, 4, 12, 14),
                  child: _BreakingHero(
                    key: ValueKey(current.url),
                    item: current,
                    timeAgo: _timeAgo(current.publishedAt.toLocal()),
                    onOpen: () => _openItem(context, current),
                    onPrev: _queue.length >= 2 ? _goPrev : null,
                    onNext: _queue.length >= 2 ? _goNext : null,
                  ),
                ),
              ),

            // Highlights grid (3x2)
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
                    onTap: (it) => _openItem(context, it),
                  ),
                ),
              ),

            // More news list (NewsCard)
            if (!p.isLoading && p.error == null && more.isNotEmpty)
              const SliverToBoxAdapter(
                child: Padding(
                  padding: EdgeInsets.fromLTRB(12, 14, 12, 8),
                  child: Text(
                    "More news",
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900),
                  ),
                ),
              ),

            if (!p.isLoading && p.error == null && more.isNotEmpty)
              SliverList(
                delegate: SliverChildBuilderDelegate(
                  (context, i) {
                    final item = more[i];
                    return NewsCard(
                      item: item,
                      onTap: () => _openItem(context, item),
                      leadingAvatar: _SourceAvatar(
                        iconUrl: item.sourceIconUrl,
                        fallbackText: (item.sourceName ?? "S"),
                      ),
                    );
                  },
                  childCount: more.length,
                ),
              ),

            const SliverToBoxAdapter(child: SizedBox(height: 18)),
          ],
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
        color: Colors.red.withOpacity(0.10),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: Colors.red.withOpacity(0.35)),
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
  final VoidCallback? onPrev;
  final VoidCallback? onNext;

  const _BreakingHero({
    super.key,
    required this.item,
    required this.timeAgo,
    required this.onOpen,
    this.onPrev,
    this.onNext,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final img = (item.imageUrl ?? "").trim();
    final sourceIcon = (item.sourceIconUrl ?? "").trim();
    final sourceName = (item.sourceName ?? "Source").trim();

    return AnimatedSwitcher(
      duration: const Duration(milliseconds: 550),
      switchInCurve: Curves.easeOut,
      switchOutCurve: Curves.easeIn,
      transitionBuilder: (child, anim) => FadeTransition(opacity: anim, child: child),
      child: Container(
        key: ValueKey(item.url),
        height: 320,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(22),
          boxShadow: [
            BoxShadow(
              blurRadius: 18,
              spreadRadius: 0,
              color: Colors.black.withOpacity(0.08),
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
                    color: theme.colorScheme.surfaceContainerHighest.withOpacity(0.6),
                  ),
                  errorWidget: (_, __, ___) => Container(
                    color: theme.colorScheme.surfaceContainerHighest.withOpacity(0.6),
                    alignment: Alignment.center,
                    child: const Icon(Icons.broken_image_outlined),
                  ),
                )
              else
                Container(
                  color: theme.colorScheme.surfaceContainerHighest.withOpacity(0.6),
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

              // Top overlay with arrows (tap-safe)
              Positioned(
                left: 12,
                right: 12,
                top: 12,
                child: Row(
                  children: [
                    Container(
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
                    const Spacer(),
                    if (onPrev != null) _NavCircleButton(icon: Icons.chevron_left, onTap: onPrev!),
                    if (onNext != null) ...[
                      const SizedBox(width: 8),
                      _NavCircleButton(icon: Icons.chevron_right, onTap: onNext!),
                    ],
                  ],
                ),
              ),

              // Bottom overlay (open only here)
              Positioned(
                left: 14,
                right: 14,
                bottom: 14,
                child: GestureDetector(
                  onTap: onOpen,
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
                            Row(
                              children: const [
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
              ),

              Container(
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(22),
                  border: Border.all(color: Colors.white.withOpacity(0.06)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _NavCircleButton extends StatelessWidget {
  final IconData icon;
  final VoidCallback onTap;

  const _NavCircleButton({required this.icon, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.black54,
      shape: const CircleBorder(),
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(6),
          child: Icon(icon, color: Colors.white, size: 22),
        ),
      ),
    );
  }
}

// Small avatar used in More News list (matches your NewsScreen behavior)
class _SourceAvatar extends StatelessWidget {
  final String? iconUrl;
  final String fallbackText;

  const _SourceAvatar({
    required this.iconUrl,
    required this.fallbackText,
  });

  @override
  Widget build(BuildContext context) {
    final url = (iconUrl ?? "").trim();
    final hasIcon = url.isNotEmpty;

    if (hasIcon) {
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

// Hero avatar (white ring)
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

class _NewsGridSection extends StatelessWidget {
  final List<NewsItem> items; // expects <= 6
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

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Container(
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
            ),
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
                      style: const TextStyle(
                        fontSize: 11.5,
                        fontWeight: FontWeight.w400,
                        height: 1.15,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
          Positioned(
            top: -8,
            right: -8,
            child: _GridSourceAvatar(
              iconUrl: iconUrl,
              fallbackText: item.sourceName ?? "S",
            ),
          ),
        ],
      ),
    );
  }
}

class _GridSourceAvatar extends StatelessWidget {
  final String iconUrl;
  final String fallbackText;

  const _GridSourceAvatar({
    required this.iconUrl,
    required this.fallbackText,
  });

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

class _ChipsHeaderDelegate extends SliverPersistentHeaderDelegate {
  final double height;
  final Widget child;

  _ChipsHeaderDelegate({required this.height, required this.child});

  @override
  double get minExtent => height;

  @override
  double get maxExtent => height;

  @override
  Widget build(BuildContext context, double shrinkOffset, bool overlapsContent) {
    return SizedBox(
      height: height,
      child: Container(
        color: Colors.white,
        alignment: Alignment.center,
        child: child,
      ),
    );
  }

  @override
  bool shouldRebuild(covariant _ChipsHeaderDelegate old) {
    return old.height != height || old.child != child;
  }
}

class _PinnedChipsRow extends StatelessWidget {
  final VoidCallback onOpenPicker;
  const _PinnedChipsRow({required this.onOpenPicker});

  @override
  Widget build(BuildContext context) {
    final p = context.watch<NewsProvider>();

    final active = p.sources.where((s) => s.isActive).toList();

    active.sort((a, b) {
      final t = b.trustLevel.compareTo(a.trustLevel);
      if (t != 0) return t;
      return a.name.toLowerCase().compareTo(b.name.toLowerCase());
    });

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12),
      child: LayoutBuilder(
        builder: (context, c) {
          const sourcesBtnWidth = 92.0;
          const gap = 10.0;

          const iconRadius = 16.0;
          const borderPad = 2.0;
          const iconTileWidth = (iconRadius * 2) + (borderPad * 2);

          final available = (c.maxWidth - sourcesBtnWidth - gap).clamp(0, c.maxWidth);
          final maxSlots = (available / (iconTileWidth + gap)).floor().clamp(1, 10);

          final sourceSlots = (maxSlots - 1).clamp(0, 10);
          final shownSources = active.take(sourceSlots).toList();

          return Row(
            children: [
              Expanded(
                child: SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  physics: const BouncingScrollPhysics(),
                  child: Row(
                    children: [
                      _IconOnlyChip(
                        tooltip: "All sources",
                        selected: p.isAllSelected,
                        imageUrl: null,
                        fallbackLetter: "A",
                        onTap: () => p.selectOnlySource(null),
                      ),
                      const SizedBox(width: gap),
                      ...shownSources.map((s) {
                        final selected =
                            p.selectedSourceIds.length == 1 && p.selectedSourceIds.contains(s.id);

                        return Padding(
                          padding: const EdgeInsets.only(right: gap),
                          child: _IconOnlyChip(
                            tooltip: s.name,
                            selected: selected,
                            imageUrl: s.iconUrl,
                            fallbackLetter: (s.name.isNotEmpty ? s.name[0].toUpperCase() : "S"),
                            onTap: () => p.selectOnlySource(s.id),
                          ),
                        );
                      }),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: gap),
              SizedBox(
                width: sourcesBtnWidth,
                height: 36,
                child: OutlinedButton.icon(
                  onPressed: onOpenPicker,
                  icon: const Icon(Icons.tune, size: 18),
                  label: Text(
                    p.selectedSourceIds.isEmpty ? "Sources" : "${p.selectedSourceIds.length}",
                    overflow: TextOverflow.ellipsis,
                  ),
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(horizontal: 10),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
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
                ? Text(
                    fallbackLetter,
                    style: const TextStyle(fontWeight: FontWeight.w900),
                  )
                : null,
          ),
        ),
      ),
    );
  }
}

class _SourcesPickerSheet extends StatefulWidget {
  const _SourcesPickerSheet();

  @override
  State<_SourcesPickerSheet> createState() => _SourcesPickerSheetState();
}

class _SourcesPickerSheetState extends State<_SourcesPickerSheet> {
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
    final filtered = p.sources.where((s) {
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
            TextField(
              controller: _controller,
              decoration: const InputDecoration(
                hintText: "Search sources…",
                prefixIcon: Icon(Icons.search),
              ),
              onChanged: (_) => setState(() {}),
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                TextButton(
                  onPressed: () => p.clearSources(),
                  child: const Text("Clear"),
                ),
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
                itemCount: filtered.length,
                separatorBuilder: (_, __) => const Divider(height: 1),
                itemBuilder: (_, i) {
                  final s = filtered[i];
                  final checked = p.selectedSourceIds.contains(s.id);

                  return CheckboxListTile(
                    value: checked,
                    onChanged: (_) => p.toggleSource(s.id),
                    title: Text(s.name),
                    secondary: _PickerSourceAvatar(iconUrl: s.iconUrl, fallbackText: s.name),
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

class _PickerSourceAvatar extends StatelessWidget {
  final String? iconUrl;
  final String fallbackText;

  const _PickerSourceAvatar({
    required this.iconUrl,
    required this.fallbackText,
  });

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
