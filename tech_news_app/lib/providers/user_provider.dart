import 'package:flutter/material.dart';
import '../models/user_dto.dart';
import '../services/auth_service.dart';

class UserProvider extends ChangeNotifier {
  UserDto? _user;
  final _auth = AuthService();

  UserDto? get user => _user;
  bool get isLoggedIn => _user != null;

  Future<void> loadUser() async {
    _user = await _auth.getSavedUser();
    notifyListeners();
  }

  /// ✅ NEW: Set user in memory + persist
  Future<void> setUser(UserDto? user) async {
    _user = user;
    await _auth.saveUser(user);
    notifyListeners();
  }

  Future<void> clear() async {
    _user = null;
    // Optional: also clear persisted user
    await _auth.saveUser(null);
    notifyListeners();
  }
}
