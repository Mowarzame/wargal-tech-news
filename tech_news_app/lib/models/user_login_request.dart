class UserLoginRequest {
  final String email;
  final String name;
  final String profilePictureUrl;
  final String? idToken;

  UserLoginRequest({
    required this.email,
    required this.name,
    required this.profilePictureUrl,
    this.idToken,
  });

  Map<String, dynamic> toJson() {
    return {
      "email": email,
      "name": name,
      "profilePictureUrl": profilePictureUrl,
      "idToken": idToken,
    };
  }
}
