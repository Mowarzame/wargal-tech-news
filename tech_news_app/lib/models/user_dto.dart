class UserDto {
  final String id;
  final String name;
  final String email;
  final String? profilePictureUrl;
  final String role;

  UserDto({
    required this.id,
    required this.name,
    required this.email,
    this.profilePictureUrl,
    required this.role,
  });

  factory UserDto.fromJson(Map<String, dynamic> json) {
    return UserDto(
      id: (json['id'] ?? '').toString(),
      name: (json['name'] ?? '').toString(),
      email: (json['email'] ?? '').toString(),
      profilePictureUrl: json['profilePictureUrl']?.toString(),
      role: (json['role'] ?? 'User').toString(),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'email': email,
        'profilePictureUrl': profilePictureUrl,
        'role': role,
      };
}
