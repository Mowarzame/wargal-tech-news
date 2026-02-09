class PostReactionUser {
  final String userId;
  final String userName;
  final String? userPhotoUrl;
  final bool isLike;
  final DateTime createdAt;

  PostReactionUser({
    required this.userId,
    required this.userName,
    this.userPhotoUrl,
    required this.isLike,
    required this.createdAt,
  });

  factory PostReactionUser.fromJson(Map<String, dynamic> json) {
    return PostReactionUser(
      userId: json['userId'],
      userName: json['userName'] ?? '',
      userPhotoUrl: json['userPhotoUrl'],
      isLike: json['isLike'] as bool,
      createdAt: DateTime.parse(json['createdAt']),
    );
  }
}
