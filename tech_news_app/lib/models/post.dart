import 'package:tech_news_app/models/user.dart';

class Post {
  final String id;
  final String title;
  final String content;
  final String imageUrl;
  final List<String> imageUrls;
  final String videoUrl;
  final DateTime createdAt;
  final int likes;
  final int dislikes;
  final bool? myReaction;
  final int commentsCount;
  final bool isVerified;
  final User user;

  const Post({
    required this.id,
    required this.title,
    required this.content,
    required this.imageUrl,
    required this.imageUrls,
    required this.videoUrl,
    required this.createdAt,
    required this.likes,
    required this.dislikes,
    required this.myReaction,
    required this.commentsCount,
    required this.isVerified,
    required this.user,
  });

  List<String> get allImages {
    final images = <String>[];

    for (final url in imageUrls) {
      final clean = url.trim();
      if (clean.isNotEmpty && !images.contains(clean)) {
        images.add(clean);
      }
    }

    final single = imageUrl.trim();
    if (single.isNotEmpty && !images.contains(single)) {
      images.insert(0, single);
    }

    return images;
  }

  bool get hasImages => allImages.isNotEmpty;

  factory Post.fromJson(Map<String, dynamic> json) {
    final rawImageUrls = (json['imageUrls'] as List?) ?? const [];

    return Post(
      id: json['id'],
      title: json['title'] ?? '',
      content: json['content'] ?? '',
      imageUrl: json['imageUrl'] ?? '',
      imageUrls: rawImageUrls.map((e) => e.toString()).toList(),
      videoUrl: json['videoUrl'] ?? '',
      createdAt: DateTime.parse(json['createdAt']),
      isVerified: json['isVerified'] ?? false,
      user: User.fromJson(json['user']),
      likes: (json['likes'] ?? 0) as int,
      dislikes: (json['dislikes'] ?? 0) as int,
      commentsCount: (json['commentsCount'] ?? 0) as int,
      myReaction: json['myReaction'],
    );
  }

  Post copyWith({
    int? likes,
    int? dislikes,
    bool? myReaction,
    bool? isVerified,
    int? commentsCount,
    String? imageUrl,
    List<String>? imageUrls,
  }) {
    return Post(
      id: id,
      title: title,
      content: content,
      imageUrl: imageUrl ?? this.imageUrl,
      imageUrls: imageUrls ?? this.imageUrls,
      videoUrl: videoUrl,
      createdAt: createdAt,
      user: user,
      isVerified: isVerified ?? this.isVerified,
      likes: likes ?? this.likes,
      dislikes: dislikes ?? this.dislikes,
      myReaction: myReaction ?? this.myReaction,
      commentsCount: commentsCount ?? this.commentsCount,
    );
  }
}