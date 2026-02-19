import 'package:flutter/foundation.dart';
import '../models/user_dto.dart';
import '../services/auth_service.dart';

class SessionProvider extends ChangeNotifier {
  final AuthService _auth;
  SessionProvider(this._auth);

  UserDto? me;
  bool loading = false;

  Future<void> loadMe() async {
    loading = true;
    notifyListeners();
    try {
      me = await _auth.getSavedUser();
    } finally {
      loading = false;
      notifyListeners();
    }
  }

  Future<void> setMe(UserDto? user) async {
    me = user;
    await _auth.saveUser(user);
    notifyListeners();
  }

  /// ✅ Instant UX: clear state & notify first, then background logout
  Future<void> logout() async {
    me = null;
    notifyListeners();
    // Fire-and-forget: do not block UI/navigation
    await _auth.logout();
  }

  bool get isLoggedIn => me != null;
}
