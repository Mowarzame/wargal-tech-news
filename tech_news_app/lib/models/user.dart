class User {
  final String id;
  final String name;
  final String email;
  final String profilePictureUrl;
  final String role; // ⭐ NEW

  User({
    required this.id,
    required this.name,
    required this.email,
    required this.profilePictureUrl,
    required this.role,
  });

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id'],
      name: json['name'],
      email: json['email'],
      profilePictureUrl: json['profilePictureUrl'] ?? '',
      role: json['role'] ?? 'User', // default fallback
    );
  }
}
