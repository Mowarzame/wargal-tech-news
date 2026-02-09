class Session {
  final String token;
  final String role;
  final String? email;
  final String? name;
  final String? photoUrl;

  Session({
    required this.token,
    required this.role,
    this.email,
    this.name,
    this.photoUrl,
  });

  /// Normalized role (prevents "admin" vs "Admin" bugs)
  String get normalizedRole => role.trim().toLowerCase();
}

