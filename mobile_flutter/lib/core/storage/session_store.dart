import 'dart:convert';

import 'package:noona_mobile_flutter/domain/entities/auth_tokens.dart';
import 'package:shared_preferences/shared_preferences.dart';

class SessionStore {
  static const _tokensKey = 'tokens';

  Future<AuthTokens?> load() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_tokensKey);
    if (raw == null) return null;
    return AuthTokens.fromJson(jsonDecode(raw) as Map<String, dynamic>);
  }

  Future<void> save(AuthTokens tokens) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_tokensKey, jsonEncode(tokens.toJson()));
  }

  Future<void> clear() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_tokensKey);
  }
}
