import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:tech_news_app/widgets/app_user_app_bar.dart';
import 'package:tech_news_app/widgets/user_avatar_menu_action.dart';

import '../providers/news_provider.dart';
import '../models/news_item.dart';
import '../models/news_source.dart';
import '../widgets/news_card.dart';
import 'news_webview_screen.dart';

class NewsScreen extends StatefulWidget {
  const NewsScreen({super.key});

  @override
  State<NewsScreen> createState() => _NewsScreenState();
}

class _NewsScreenState extends State<NewsScreen> {
  bool _inited = false;

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

  @override
  Widget build(BuildContext context) {
    final p = context.watch<NewsProvider>();
// ✅ Ensure News grid is always 3x2 (6 items max)
// ✅ Ensure grid always has 6 items when possible:
// Start with discoverItems, then top-up from latest p.items (unique by url).
final seenUrls = <String>{};
final gridItems = <NewsItem>[];

// 1) take from discoverItems first
for (final it in p.discoverItems) {
  final url = it.url.trim();
  if (url.isEmpty) continue;
  if (seenUrls.add(url)) {
    gridItems.add(it);
    if (gridItems.length == 6) break;
  }
}

// 2) top-up from latest items if still < 6
if (gridItems.length < 6) {
  final latest = p.items.toList()
    ..sort((a, b) => b.publishedAt.compareTo(a.publishedAt));

  for (final it in latest) {
    final url = it.url.trim();
    if (url.isEmpty) continue;
    if (seenUrls.add(url)) {
      gridItems.add(it);
      if (gridItems.length == 6) break;
    }
  }
}


    return Scaffold(

      backgroundColor: Colors.grey.shade100,
      body: RefreshIndicator(
        onRefresh: p.refresh,
     child: CustomScrollView(
  physics: const AlwaysScrollableScrollPhysics(),
  controller: p.scrollController,
  slivers: [


 

  SliverPersistentHeader(
    pinned: true,
delegate: _ChipsHeaderDelegate(
  height: 52, // ✅ matches 36 + 12 padding + ~4
      child: _PinnedChipsRow(onOpenPicker: () => _openSourcesPicker(context)),
    ),
  ),

  // Slider
// Slider
if (p.sliderItems.isNotEmpty)
  SliverToBoxAdapter(

      child: Padding(
        padding: const EdgeInsets.only(top: 10),
        child: _TopSlider(
    items: p.sliderItems.take(5).toList(),

          onTap: (it) => _openItem(context, it),
        ),
      ),
    ),

  // Loading / error / empty states
// Loading
if (p.isLoading)
  const SliverToBoxAdapter(
    child: Padding(
      padding: EdgeInsets.only(top: 80),
      child: Center(child: CircularProgressIndicator()),
    ),
  ),

// Error
if (!p.isLoading && p.error != null)
  SliverToBoxAdapter(
    child: Padding(
      padding: const EdgeInsets.only(top: 80),
      child: Center(child: Text("Error: ${p.error}")),
    ),
  ),

// Empty
if (!p.isLoading && p.error == null && p.items.isEmpty)
  const SliverToBoxAdapter(
    child: Padding(
      padding: EdgeInsets.only(top: 80),
      child: Center(child: Text("No aggregated news yet")),
    ),
  ),


// Grid (only when we have data)
if (!p.isLoading && p.error == null && p.items.isNotEmpty && gridItems.isNotEmpty)

  SliverToBoxAdapter(
    child: Padding(
      padding: const EdgeInsets.fromLTRB(12, 14, 12, 8),
      child: Row(
        children: const [
          Text("More news", style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900)),
        ],
      ),
    ),
  ),

if (!p.isLoading && p.error == null && p.items.isNotEmpty && p.discoverItems.isNotEmpty)
  SliverToBoxAdapter(
    child: Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12),
      child: _NewsGridSection(
  items: gridItems, // ✅ always max 6
  onTap: (it) => _openItem(context, it),
),

    ),
  ),

// Main feed list (only when we have data)
if (!p.isLoading && p.error == null && p.items.isNotEmpty)
  SliverList(
    delegate: SliverChildBuilderDelegate(
      (context, i) {
        final item = p.items[i];
        return NewsCard(
          item: item,
          onTap: () => _openItem(context, item),
          leadingAvatar: _SourceAvatar(
            iconUrl: item.sourceIconUrl,
            fallbackText: (item.sourceName ?? "S"),
          ),
        );
      },
      childCount: p.items.length,
    ),
  ),

  // Loading more indicator
  if (p.isLoadingMore)
    const SliverToBoxAdapter(
      child: Padding(
        padding: EdgeInsets.symmetric(vertical: 18),
        child: Center(child: CircularProgressIndicator()),
      ),
    ),

  // ✅ Grid section AFTER main list (so it appears at the bottom)

  const SliverToBoxAdapter(child: SizedBox(height: 18)),
],

        ),
      ),
    );
  }
}
class _NewsGridSection extends StatelessWidget {
  final List<NewsItem> items; // expect 6
  final void Function(NewsItem item) onTap;

  const _NewsGridSection({required this.items, required this.onTap});

  @override
  Widget build(BuildContext context) {
    // 2 rows x 3 columns => 6 items
    final list = items.length > 6 ? items.take(6).toList() : items;

    return GridView.builder(
      itemCount: list.length,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
  crossAxisCount: 3,
  mainAxisSpacing: 10,
  crossAxisSpacing: 10,
  childAspectRatio: 0.95, // ✅ taller tiles (fix overflow)
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
          // Card
          Container(
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // ✅ Use AspectRatio instead of fixed height (more flexible)
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

                // ✅ Title takes remaining space safely
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

          // Floating source icon (top-right)
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


class _MiniNewsCard extends StatelessWidget {
  final NewsItem item;
  final VoidCallback onTap;

  const _MiniNewsCard({required this.item, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final img = (item.imageUrl ?? '').trim();
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        width: 240,
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Row(
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: img.isEmpty
                  ? Container(
                      width: 70,
                      height: 70,
                      color: Colors.grey.shade200,
                      child: const Icon(Icons.image_not_supported_outlined),
                    )
                  : CachedNetworkImage(
                      imageUrl: img,
                      width: 70,
                      height: 70,
                      fit: BoxFit.cover,
                      errorWidget: (_, __, ___) => Container(
                        width: 70,
                        height: 70,
                        color: Colors.grey.shade200,
                        child: const Icon(Icons.broken_image_outlined),
                      ),
                    ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      _SourceAvatar(
                        iconUrl: item.sourceIconUrl,
                        fallbackText: item.sourceName ?? "S",
                      ),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          item.sourceName ?? "Source",
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontWeight: FontWeight.w900),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(
                    item.title,
                    maxLines: 3,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                ],
              ),
            ),
          ],
        ),
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
// ✅ Grid highlights: always 6 items when possible (3x2), prefer items with images
final latest = p.items.toList()
  ..sort((a, b) => b.publishedAt.compareTo(a.publishedAt));

final seen = <String>{};
final highlights = <NewsItem>[];
// ✅ Ensure News grid is always 3x2 (6 items max)
final gridItems = p.discoverItems.length >= 6
    ? p.discoverItems.take(6).toList()
    : p.discoverItems;

for (final it in latest) {
  final url = it.url.trim();
  if (url.isEmpty) continue;
  if (seen.contains(url)) continue;
  if ((it.imageUrl ?? '').trim().isEmpty) continue; // grid needs images
  seen.add(url);
  highlights.add(it);
  if (highlights.length == 6) break;
}

    // Active sources only
    final active = p.sources.where((s) => s.isActive).toList();

    // Sort by trust desc then name
    active.sort((a, b) {
      final t = b.trustLevel.compareTo(a.trustLevel);
      if (t != 0) return t;
      return a.name.toLowerCase().compareTo(b.name.toLowerCase());
    });

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12),
      child: LayoutBuilder(
        builder: (context, c) {
          // Always show Sources button at end (no scroll)
          const sourcesBtnWidth = 92.0;
          const gap = 10.0;

          // icon chip size
          const iconRadius = 16.0;         // circle avatar radius
          const borderPad = 2.0;           // border padding
          const iconTileWidth = (iconRadius * 2) + (borderPad * 2); // ~36

          final available = (c.maxWidth - sourcesBtnWidth - gap).clamp(0, c.maxWidth);

          // slots for: All + N source icons
          final maxSlots = (available / (iconTileWidth + gap)).floor().clamp(1, 10);

          // reserve 1 slot for All
          final sourceSlots = (maxSlots - 1).clamp(0, 10);
          final shownSources = active.take(sourceSlots).toList();

return Row(
  children: [
    // ✅ Left area scrolls, right button stays fixed
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
                    secondary: _SourceAvatar(
                      iconUrl: s.iconUrl,
                      fallbackText: s.name,
                    ),
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

// ✅ Avatar widget used by cards + picker
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

// Slider (same concept as before, but expects NewsItem fields)
class _TopSlider extends StatefulWidget {
  const _TopSlider({required this.items, required this.onTap});

  final List<NewsItem> items;
  final void Function(NewsItem item) onTap;

  @override
  State<_TopSlider> createState() => _TopSliderState();
}

class _TopSliderState extends State<_TopSlider> {
  late final PageController _controller;
  int _page = 0;

  @override
  void initState() {
    super.initState();
    _controller = PageController(viewportFraction: 0.92);
  }

  @override
  void didUpdateWidget(covariant _TopSlider oldWidget) {
    super.didUpdateWidget(oldWidget);

    // ✅ When refresh happens, sliderItems list changes -> reset safely
    if (oldWidget.items != widget.items) {
      _page = 0;

      // Jump to page 0 only when controller is attached
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        if (_controller.hasClients) {
          _controller.jumpToPage(0);
        }
      });
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  String _formatDate(DateTime dt) {
    String two(int v) => v.toString().padLeft(2, '0');
    return '${dt.year}-${two(dt.month)}-${two(dt.day)} ${two(dt.hour)}:${two(dt.minute)}';
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

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    if (widget.items.isEmpty) return const SizedBox.shrink();

    return Column(
      children: [
        SizedBox(
          height: 210,
          child: PageView.builder(
            controller: _controller,
            itemCount: widget.items.length,
            onPageChanged: (i) => setState(() => _page = i),
            itemBuilder: (context, i) {
              final it = widget.items[i];
              final img = (it.imageUrl ?? "").trim();
              final published = it.publishedAt.toLocal();

              final isVideo = it.kind == 2; // 2 = Video (YouTube)

              return GestureDetector(
                onTap: () => widget.onTap(it),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 6),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(18),
                    child: Stack(
                      fit: StackFit.expand,
                      children: [
                        // background image
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
                          ),

                        // gradient overlay
                        Container(
                          decoration: const BoxDecoration(
                            gradient: LinearGradient(
                              begin: Alignment.topCenter,
                              end: Alignment.bottomCenter,
                              colors: [Colors.transparent, Colors.black54],
                            ),
                          ),
                        ),

                        // ✅ video badge
                        if (isVideo)
                          Positioned(
                            top: 12,
                            left: 12,
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                              decoration: BoxDecoration(
                                color: Colors.black87,
                                borderRadius: BorderRadius.circular(999),
                              ),
                              child: const Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(Icons.play_arrow_rounded, color: Colors.white, size: 18),
                                  SizedBox(width: 4),
                                  Text(
                                    "YouTube",
                                    style: TextStyle(
                                      color: Colors.white,
                                      fontWeight: FontWeight.w800,
                                      fontSize: 12,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),

                        // content overlay
                        Positioned(
                          left: 14,
                          right: 14,
                          bottom: 14,
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              _SourceAvatar(
                                iconUrl: it.sourceIconUrl,
                                fallbackText: it.sourceName.isNotEmpty ? it.sourceName : "S",
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Text(
                                      it.sourceName,
                                      style: const TextStyle(
                                        color: Colors.white70,
                                        fontWeight: FontWeight.w800,
                                      ),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      '${_formatDate(published)} • ${_timeAgo(published)}',
                                      style: const TextStyle(
                                        color: Colors.white70,
                                        fontSize: 12,
                                        fontWeight: FontWeight.w600,
                                      ),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                    const SizedBox(height: 6),
                                    Text(
                                      it.title,
                                      style: const TextStyle(
                                        color: Colors.white,
                                        fontSize: 16,
                                        fontWeight: FontWeight.w900,
                                      ),
                                      maxLines: 2,
                                      overflow: TextOverflow.ellipsis,
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
              );
            },
          ),
        ),

        const SizedBox(height: 10),

        // dots indicator
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: List.generate(widget.items.length, (i) {
            final active = i == _page;
            return AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              margin: const EdgeInsets.symmetric(horizontal: 4),
              height: 6,
              width: active ? 18 : 6,
              decoration: BoxDecoration(
                color: active ? Colors.black87 : Colors.black26,
                borderRadius: BorderRadius.circular(999),
              ),
            );
          }),
        ),
      ],
    );
  }
}

