import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:http/http.dart' as http;
import 'package:jwt_decoder/jwt_decoder.dart';

import '../config/app_config.dart';
import '../models/session.dart';
import '../models/user_dto.dart';

class AuthService {
  AuthService({http.Client? client}) : _client = client ?? http.Client();

  static const String _tokenKey = 'jwt_token';
  static const String _userKey = 'me_user';

  // WEB client id (OAuth 2.0 Client IDs -> Web application) used for serverClientId
  static const String _webClientId =
      '379189948307-jbn6gnvdcbttph2kkk2g572kavjuqim3.apps.googleusercontent.com';

  final FlutterSecureStorage _storage = const FlutterSecureStorage();
  final http.Client _client;

  late final GoogleSignIn _googleSignIn = GoogleSignIn(
    scopes: const ['email', 'profile'],
    serverClientId: _webClientId,
  );

  bool _googleWarmStarted = false;

  /// ✅ Warm up Google Sign-In platform channel to avoid first-tap channel errors on Android.
  /// Safe to call multiple times.
  Future<void> warmUpGoogle() async {
    if (_googleWarmStarted) return;
    _googleWarmStarted = true;

    try {
      // Triggers plugin/channel init without showing UI.
      await _googleSignIn.signInSilently();
    } catch (_) {
      // Ignore warm-up failures; real sign-in can still succeed.
    }
  }

  Future<GoogleSignInAccount?> _trySilentSignIn() async {
    try {
      return await _googleSignIn.signInSilently();
    } catch (_) {
      // Silent fail: do not surface
      return null;
    }
  }

  bool _looksLikeAndroidChannelInitIssue(PlatformException e) {
    final code = e.code.toLowerCase();
    final msg = (e.message ?? '').toLowerCase();

    return code.contains('channel-error') ||
        msg.contains('unable to establish connection on channel') ||
        msg.contains('google_sign_in_android') ||
        msg.contains('pigeon') ||
        msg.contains('signinapi');
  }

  Future<GoogleSignInAccount?> _interactiveSignInWithOneRetry() async {
    try {
      return await _googleSignIn.signIn().timeout(const Duration(seconds: 25));
    } on PlatformException catch (e) {
      if (!_looksLikeAndroidChannelInitIssue(e)) {
        // Silent fail
        return null;
      }

      // ✅ short delay + retry once (silent)
      await Future.delayed(const Duration(milliseconds: 250));

      try {
        return await _googleSignIn.signIn().timeout(const Duration(seconds: 25));
      } catch (_) {
        return null;
      }
    } catch (_) {
      return null;
    }
  }

  Future<void> saveUser(UserDto? user) async {
    try {
      if (user == null) {
        await _storage.delete(key: _userKey);
        return;
      }
      await _storage.write(key: _userKey, value: jsonEncode(user.toJson()));
    } catch (_) {
      // silent
    }
  }

  Future<UserDto?> getCurrentUser() async {
    try {
      final raw = await _storage.read(key: _userKey);
      if (raw == null || raw.isEmpty) return null;
      return UserDto.fromJson(jsonDecode(raw));
    } catch (_) {
      return null;
    }
  }

  Future<UserDto?> getSavedUser() async {
    try {
      final raw = await _storage.read(key: _userKey);
      if (raw == null || raw.isEmpty) return null;
      return UserDto.fromJson(jsonDecode(raw));
    } catch (_) {
      return null;
    }
  }

  /// Google sign-in -> send idToken to API -> store JWT + user.
  ///
  /// ✅ FINAL behavior:
  /// - Never throws to UI.
  /// - Transient Android channel init issues are handled silently.
  /// - Returns null on any failure (UI can decide what to show).
  Future<UserDto?> loginWithGoogle() async {
    try {
      // ✅ Ensure plugin channel is ready (helps Android)
      await warmUpGoogle();

      GoogleSignInAccount? account = await _trySilentSignIn();
      account ??= await _interactiveSignInWithOneRetry();

      // User cancelled / transient issue / failure
      if (account == null) return null;

      final auth = await account.authentication;
      final idToken = auth.idToken;

      // If idToken is missing, backend will reject.
      if (idToken == null || idToken.isEmpty) return null;

      final payload = <String, dynamic>{
        "email": account.email,
        "name": account.displayName ?? account.email.split('@').first,
        "profilePictureUrl": account.photoUrl ?? "",
        "idToken": idToken,
      };

      final url = Uri.parse("${AppConfig.apiBaseUrl}/users/login-google");

      // ✅ Android release can be flaky on first network call — retry once quietly.
      http.Response? res;
      for (int attempt = 0; attempt < 2; attempt++) {
        try {
          res = await _client
              .post(
                url,
                headers: const {"Content-Type": "application/json"},
                body: jsonEncode(payload),
              )
              .timeout(const Duration(seconds: 25));

          if (res.statusCode == 200) break;
        } catch (_) {
          // silent
        }

        // small backoff
        await Future.delayed(const Duration(milliseconds: 300));
      }

      if (res == null || res.statusCode != 200) return null;

      final body = jsonDecode(res.body);

      // Support both shapes:
      // 1) { token: "...", user: {...} }
      // 2) { data: { token: "...", user: {...} }, success: true, message: "..." }
      Map<String, dynamic>? data;
      if (body is Map<String, dynamic>) {
        if (body["data"] is Map<String, dynamic>) {
          data = (body["data"] as Map).cast<String, dynamic>();
        } else {
          data = body;
        }
      }

      final token = data?["token"]?.toString();
      final userJsonDynamic = data?["user"];

      Map<String, dynamic>? userJson;
      if (userJsonDynamic is Map<String, dynamic>) {
        userJson = userJsonDynamic;
      } else if (userJsonDynamic is Map) {
        userJson = userJsonDynamic.cast<String, dynamic>();
      }

      if (token == null || token.isEmpty || userJson == null) return null;

      // ✅ Persist token first (router depends on this)
      try {
        await _storage.write(key: _tokenKey, value: token);
      } catch (_) {
        return null;
      }

      final user = UserDto.fromJson(userJson);
      await saveUser(user);

      return user;
    } on TimeoutException {
      return null;
    } on PlatformException catch (e) {
      // If this is the transient Android channel init issue, fail silently.
      if (_looksLikeAndroidChannelInitIssue(e)) return null;
      return null;
    } catch (_) {
      return null;
    }
  }

  Future<String?> getToken() => _storage.read(key: _tokenKey);

  Future<Session?> getSession() async {
    try {
      final token = await getToken();
      if (token == null || token.isEmpty) return null;

      // ✅ jwt_decoder can throw if token is malformed / missing exp
      bool expired = false;
      try {
        expired = JwtDecoder.isExpired(token);
      } catch (_) {
        expired = true;
      }
      if (expired) return null;

      Map<String, dynamic> decoded;
      try {
        decoded = JwtDecoder.decode(token);
      } catch (_) {
        return null;
      }

      final role = (decoded["role"] ??
              decoded[
                  "http://schemas.microsoft.com/ws/2008/06/identity/claims/role"] ??
              "User")
          .toString();

      return Session(token: token, role: role);
    } catch (_) {
      return null;
    }
  }

  Future<bool> isLoggedIn() async => (await getSession()) != null;

  /// ✅ FAST logout: clear local session immediately.
  /// Google disconnect/signOut happens in background to avoid blocking UI.
  /// ✅ HARD logout:
  /// - Clears local token + user
  /// - Signs out of Google so next login shows account picker
  Future<void> logout() async {
    // 1) Clear local session first
    await _storage.delete(key: _tokenKey);
    await _storage.delete(key: _userKey);

    // 2) Also clear Google cached account (THIS is what fixes your issue)
    try {
      await _googleSignIn.signOut(); // most important for switching accounts
    } catch (_) {}

    // disconnect is optional; some devices throw if not connected
    try {
      await _googleSignIn.disconnect();
    } catch (_) {}

    // allow warm-up again later if needed
    _googleWarmStarted = false;
  }

  void dispose() {
    _client.close();
  }
}
