import 'package:tech_news_app/models/user.dart';

class Post {
  final String id;
  final String title;
  final String content;
  final String imageUrl;
  final String videoUrl;
  final DateTime createdAt;
  final int likes;
final int dislikes;
final bool? myReaction; 
final int commentsCount;


  final bool isVerified; // ⭐ NEW FIELD
  final User user;
  
  

  Post({
    required this.id,
    required this.title,
    required this.content,
    required this.imageUrl,
    required this.videoUrl,
        required this.commentsCount,
    required this.createdAt,
    required this.isVerified,
    required this.user,
    required this.likes,
    required this.dislikes,
    required this.myReaction
  });

  factory Post.fromJson(Map<String, dynamic> json) {
    return Post(
      id: json['id'],
      title: json['title'],
      content: json['content'],
      imageUrl: json['imageUrl'] ?? '',
      videoUrl: json['videoUrl'] ?? '',
      createdAt: DateTime.parse(json['createdAt']),
      isVerified: json['isVerified'] ?? false, // ⭐ SAFE PARSE
      user: User.fromJson(json['user']),
      likes: (json['likes'] ?? 0) as int,
dislikes: (json['dislikes'] ?? 0) as int,
commentsCount: (json['commentsCount'] ?? 0) as int,

myReaction: json['myReaction'], // can be true/false/null

    );
  }
Post copyWith({
  int? likes,
  int? dislikes,
  bool? myReaction,
  bool? isVerified,
}) {
  return Post(
    id: id,
    title: title,
    content: content,
    imageUrl: imageUrl,
     commentsCount: commentsCount,
    videoUrl: videoUrl,
    createdAt: createdAt,
    user: user,
    isVerified: isVerified ?? this.isVerified,
    likes: likes ?? this.likes,
    dislikes: dislikes ?? this.dislikes,
    myReaction: myReaction ?? this.myReaction,
  );
}


}
