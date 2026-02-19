import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:http/http.dart' as http;
import 'package:jwt_decoder/jwt_decoder.dart';

import '../config/app_config.dart';
import '../models/session.dart';
import '../models/user_dto.dart';

class AuthService {
  AuthService();

  static const String _tokenKey = 'jwt_token';
  static const String _userKey = 'me_user';

  static const String _webClientId =
      '379189948307-jbn6gnvdcbttph2kkk2g572kavjuqim3.apps.googleusercontent.com';

  final FlutterSecureStorage _storage = const FlutterSecureStorage();

  late final GoogleSignIn _googleSignIn = GoogleSignIn(
    scopes: const ['email', 'profile'],
    serverClientId: _webClientId,
  );

  Future<GoogleSignInAccount?> _trySilentSignIn() async {
    try {
      return await _googleSignIn.signInSilently();
    } catch (e) {
      debugPrint("Silent sign-in failed: $e");
      return null;
    }
  }

  Future<void> saveUser(UserDto? user) async {
    if (user == null) {
      await _storage.delete(key: _userKey);
      return;
    }
    await _storage.write(key: _userKey, value: jsonEncode(user.toJson()));
  }

  Future<UserDto?> getCurrentUser() async {
    final raw = await _storage.read(key: _userKey);
    if (raw == null || raw.isEmpty) return null;
    try {
      return UserDto.fromJson(jsonDecode(raw));
    } catch (_) {
      return null;
    }
  }

  Future<UserDto?> getSavedUser() async {
    final raw = await _storage.read(key: _userKey);
    if (raw == null || raw.isEmpty) return null;
    return UserDto.fromJson(jsonDecode(raw));
  }

  Future<UserDto?> loginWithGoogle() async {
    try {
      GoogleSignInAccount? account = await _trySilentSignIn();
      account ??= await _googleSignIn
          .signIn()
          .timeout(const Duration(seconds: 25));
      if (account == null) return null;

      final auth = await account.authentication;

      final payload = {
        "email": account.email,
        "name": account.displayName ?? account.email.split('@').first,
        "profilePictureUrl": account.photoUrl ?? "",
        "idToken": auth.idToken,
      };

      final res = await http.post(
        Uri.parse("${AppConfig.apiBaseUrl}/users/login-google"),
        headers: const {"Content-Type": "application/json"},
        body: jsonEncode(payload),
      );

      if (res.statusCode != 200) return null;

      final body = jsonDecode(res.body);

      final token = body["token"]?.toString();
      final userJson = body["user"] as Map<String, dynamic>?;

      if (token == null || token.isEmpty || userJson == null) return null;

      await _storage.write(key: _tokenKey, value: token);

      final user = UserDto.fromJson(userJson);
      await saveUser(user);

      return user;
    } catch (_) {
      return null;
    }
  }

  Future<String?> getToken() => _storage.read(key: _tokenKey);

  Future<Session?> getSession() async {
    final token = await getToken();
    if (token == null) return null;

    if (JwtDecoder.isExpired(token)) return null;

    final decoded = JwtDecoder.decode(token);

    final role = (decoded["role"] ??
            decoded["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"] ??
            "User")
        .toString();

    return Session(token: token, role: role);
  }

  Future<bool> isLoggedIn() async => (await getSession()) != null;

  /// ✅ FAST logout: clear local session immediately.
  /// Google disconnect/signOut happens in background to avoid blocking UI.
  Future<void> logout() async {
    // 1) Clear local auth FIRST (instant UX)
    await _storage.delete(key: _tokenKey);
    await _storage.delete(key: _userKey);

    // 2) Best-effort Google signout in background (do not block UX)
    Future.microtask(() async {
      try {
        await _googleSignIn.disconnect();
      } catch (e) {
        debugPrint("Logout disconnect error: $e");
        try {
          await _googleSignIn.signOut();
        } catch (_) {}
      }
    });
  }
}
