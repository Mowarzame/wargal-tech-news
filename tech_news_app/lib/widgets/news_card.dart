import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../models/news_item.dart';

class NewsCard extends StatelessWidget {
  const NewsCard({
    super.key,
    required this.item,
    required this.onTap,
    this.leadingAvatar,
  });

  final NewsItem item;
  final VoidCallback onTap;
  final Widget? leadingAvatar;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final publishedLocal = item.publishedAt.toLocal();

    return Card(
      elevation: 0,
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: onTap, // ✅ ONLY callback, no navigation here
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if ((item.imageUrl ?? '').trim().isNotEmpty) ...[
                ClipRRect(
                  borderRadius: BorderRadius.circular(12),
                  child: CachedNetworkImage(
                    imageUrl: item.imageUrl!.trim(),
                    height: 180,
                    width: double.infinity,
                    fit: BoxFit.cover,
                    placeholder: (_, __) => Container(
                      height: 180,
                      color: theme.colorScheme.surfaceContainerHighest.withOpacity(0.6),
                    ),
                    errorWidget: (_, __, ___) => Container(
                      height: 180,
                      color: theme.colorScheme.surfaceContainerHighest.withOpacity(0.6),
                      alignment: Alignment.center,
                      child: const Icon(Icons.broken_image_outlined),
                    ),
                  ),
                ),
                const SizedBox(height: 10),
              ],
              Text(
                item.title,
                style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
                maxLines: 3,
                overflow: TextOverflow.ellipsis,
              ),
              if ((item.summary ?? '').trim().isNotEmpty) ...[
                const SizedBox(height: 8),
                Text(
                  item.summary!.trim(),
                  style: theme.textTheme.bodyMedium,
                  maxLines: 3,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
              const SizedBox(height: 10),
              Row(
                children: [
                  if (leadingAvatar != null) ...[
                    leadingAvatar!,
                    const SizedBox(width: 8),
                  ],
                  Expanded(
                    child: Text(
                      item.sourceName.trim(),
                      style: const TextStyle(fontWeight: FontWeight.w800),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Text(
                    '${_formatDate(publishedLocal)} • ${_timeAgo(publishedLocal)}',
                    style: TextStyle(
                      color: Colors.grey.shade600,
                      fontSize: 12,
                      fontWeight: FontWeight.w500,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              )
            ],
          ),
        ),
      ),
    );
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
}
