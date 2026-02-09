String? extractYoutubeId(String url) {
  final uri = Uri.tryParse(url.trim());
  if (uri == null) return null;

  // https://youtu.be/VIDEO_ID
  if (uri.host.contains("youtu.be")) {
    final id = uri.pathSegments.isNotEmpty ? uri.pathSegments.last : null;
    return (id != null && id.isNotEmpty) ? id : null;
  }

  // https://www.youtube.com/watch?v=VIDEO_ID
  if (uri.host.contains("youtube.com")) {
    final v = uri.queryParameters["v"];
    if (v != null && v.isNotEmpty) return v;

    // https://www.youtube.com/embed/VIDEO_ID
    final segments = uri.pathSegments;
    final embedIndex = segments.indexOf("embed");
    if (embedIndex != -1 && segments.length > embedIndex + 1) {
      final id = segments[embedIndex + 1];
      return id.isNotEmpty ? id : null;
    }

    // https://www.youtube.com/shorts/VIDEO_ID
    final shortsIndex = segments.indexOf("shorts");
    if (shortsIndex != -1 && segments.length > shortsIndex + 1) {
      final id = segments[shortsIndex + 1];
      return id.isNotEmpty ? id : null;
    }
  }

  return null;
}
