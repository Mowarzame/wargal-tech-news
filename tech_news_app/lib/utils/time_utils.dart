String timeAgo(DateTime date) {
  final now = DateTime.now();
  final local = date.toLocal(); // always compare in local
  final diff = now.difference(local);

  // ✅ If the date is in the future, show "in X"
  if (diff.isNegative) {
    final ahead = local.difference(now);

    if (ahead.inSeconds < 60) return 'in a moment';
    if (ahead.inMinutes < 60) return 'in ${ahead.inMinutes}m';
    if (ahead.inHours < 24) return 'in ${ahead.inHours}h';
    return 'in ${ahead.inDays}d';
  }

  // ✅ Normal past logic
  if (diff.inSeconds < 60) return 'just now';
  if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
  if (diff.inHours < 24) return '${diff.inHours}h ago';
  if (diff.inDays < 7) return '${diff.inDays}d ago';

  final weeks = (diff.inDays / 7).floor();
  if (weeks < 4) return '${weeks}w ago';

  final months = (diff.inDays / 30).floor();
  return '${months}mo ago';
}


String formatDateTime(DateTime date) {
  // ✅ Always show local time
  final d = date.isUtc ? date.toLocal() : date;

  return '${_two(d.day)} ${_month(d.month)} ${d.year}, '
         '${_two(d.hour)}:${_two(d.minute)}';
}

String _two(int n) => n.toString().padLeft(2, '0');

String _month(int m) {
  const months = [
    'Jan','Feb','Mar','Apr','May','Jun',
    'Jul','Aug','Sep','Oct','Nov','Dec'
  ];
  return months[m - 1];
}
