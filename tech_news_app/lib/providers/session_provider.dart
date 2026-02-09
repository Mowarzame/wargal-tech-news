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
      me = await _auth.getSavedUser(); // read from local storage
    } finally {
      loading = false;
      notifyListeners();
    }
  }

  Future<void> setMe(UserDto? user) async {
    me = user;
    await _auth.saveUser(user); // persist
    notifyListeners();
  }

  Future<void> logout() async {
    await _auth.logout();
    me = null;
    notifyListeners();
  }

  bool get isLoggedIn => me != null;
}
