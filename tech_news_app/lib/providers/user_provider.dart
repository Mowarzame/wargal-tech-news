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

  Future<void> clear() async {
    _user = null;
    notifyListeners();
  }
}
