import 'dart:io';

import 'package:http/http.dart' as http;
import 'package:noona_mobile_flutter/core/network/api_client.dart';
import 'package:noona_mobile_flutter/core/storage/session_store.dart';
import 'package:noona_mobile_flutter/domain/entities/activity_summary.dart';
import 'package:noona_mobile_flutter/domain/entities/app_user.dart';
import 'package:noona_mobile_flutter/domain/entities/auth_tokens.dart';
import 'package:noona_mobile_flutter/domain/entities/chat_message.dart';
import 'package:noona_mobile_flutter/domain/entities/mistake.dart';
import 'package:noona_mobile_flutter/domain/repositories/noona_repository.dart';

class BackendNoonaRepository implements NoonaRepository {
  BackendNoonaRepository(this._api, this._sessionStore);

  final ApiClient _api;
  final SessionStore _sessionStore;
  Future<void> Function()? _onSessionExpired;
  Future<AuthTokens?>? _refreshInFlight;
  AuthTokens? _latestTokens;

  @override
  void setSessionExpiredHandler(Future<void> Function() handler) {
    _onSessionExpired = handler;
  }

  @override
  Uri wsUri(String token) => _api.wsUri(_latestTokens?.accessToken ?? token);

  @override
  Future<AuthTokens> login(String email, String password) async {
    final json =
        await _api.post('/auth/login', {'email': email, 'password': password});
    final tokens = AuthTokens.fromJson(json);
    _latestTokens = tokens;
    return tokens;
  }

  @override
  Future<AppUser> me(String token) async {
    final json =
        await _authorizedGet('/users/me', token) as Map<String, dynamic>;
    _latestTokens ??= await _sessionStore.load();
    return AppUser.fromJson(json);
  }

  @override
  Future<AppUser> updateCEFRLevel(
      String userId, String level, String token) async {
    await _authorizedPut('/users/$userId', {'cefr_level': level}, token);
    return me(token);
  }

  @override
  Future<AppUser> updateNativeLanguage(
      String userId, String language, String token) async {
    await _authorizedPut(
        '/users/$userId', {'native_language': language}, token);
    return me(token);
  }

  @override
  Future<String> translate(String text, String targetLang, String token) async {
    final json = await _authorizedPost(
      '/linguistic/translate',
      {'text': text, 'target_lang': targetLang},
      token,
    );
    return '${json['translation'] ?? ''}'.trim();
  }

  @override
  Future<void> logout(AuthTokens tokens) {
    return _api.post('/auth/logout', {'refresh_token': tokens.refreshToken},
        tokens.accessToken);
  }

  @override
  Future<ActivitySummary> activity(String token) async {
    final json = await _authorizedGet('/activity/me', token);
    return ActivitySummary.fromJson(json as Map<String, dynamic>?);
  }

  @override
  Future<List<Mistake>> mistakes(String token) async {
    final json = await _authorizedGet('/linguistic/mistakes', token);
    final items = json is List ? json : const [];
    return items
        .map((item) => Mistake.fromJson(item as Map<String, dynamic>))
        .toList();
  }

  @override
  Future<List<Map<String, dynamic>>> sessions(String token) async {
    final json = await _authorizedGet('/sessions/', token);
    return json is List ? json.cast<Map<String, dynamic>>() : [];
  }

  @override
  Future<String> createSession(String token) async {
    final json = await _authorizedPost('/sessions/', {}, token);
    return '${json['id']}';
  }

  @override
  Future<List<ChatMessage>> messages(String sessionId, String token) async {
    final json = await _authorizedGet('/sessions/$sessionId/messages', token);
    final items = json is List ? json : const [];
    return items
        .map((item) => ChatMessage.fromJson(item as Map<String, dynamic>))
        .toList();
  }

  @override
  Future<ChatMessage> sendMessage(
      String sessionId, String content, String token) async {
    final json = await _authorizedPost(
        '/sessions/$sessionId/messages', {'content': content}, token);
    return ChatMessage.fromJson(json);
  }

  @override
  Future<void> uploadAudio(File file, String token, {String? sessionId}) async {
    final fields = {
      if (sessionId != null && sessionId.trim().isNotEmpty)
        'session_id': sessionId.trim(),
    };
    var response =
        await _api.rawUpload('/audio/upload', file, token, fields: fields);
    if (response.statusCode == 401) {
      final refreshed = await _refreshOrExpire();
      if (refreshed == null) throw ApiException('Session expired');
      response = await _api.rawUpload(
          '/audio/upload', file, refreshed.accessToken,
          fields: fields);
    }
    _decode(response, '/audio/upload');
  }

  Future<dynamic> _authorizedGet(String path, String token) async {
    var response = await _api.rawGet(path, token);
    if (response.statusCode == 401) {
      final refreshed = await _refreshOrExpire();
      if (refreshed == null) throw ApiException('Session expired');
      response = await _api.rawGet(path, refreshed.accessToken);
    }
    return _decode(response, path);
  }

  Future<Map<String, dynamic>> _authorizedPost(
    String path,
    Map<String, dynamic> body,
    String token,
  ) async {
    var response = await _api.rawPost(path, body, token);
    if (response.statusCode == 401) {
      final refreshed = await _refreshOrExpire();
      if (refreshed == null) throw ApiException('Session expired');
      response = await _api.rawPost(path, body, refreshed.accessToken);
    }
    return _decode(response, path) as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> _authorizedPut(
    String path,
    Map<String, dynamic> body,
    String token,
  ) async {
    var response = await _api.rawPut(path, body, token);
    if (response.statusCode == 401) {
      final refreshed = await _refreshOrExpire();
      if (refreshed == null) throw ApiException('Session expired');
      response = await _api.rawPut(path, body, refreshed.accessToken);
    }
    return _decode(response, path) as Map<String, dynamic>;
  }

  Future<AuthTokens?> _refreshOrExpire() async {
    final inFlight = _refreshInFlight;
    if (inFlight != null) return inFlight;

    final future = _refreshOrExpireLocked();
    _refreshInFlight = future;
    try {
      return await future;
    } finally {
      _refreshInFlight = null;
    }
  }

  Future<AuthTokens?> _refreshOrExpireLocked() async {
    final current = await _sessionStore.load();
    if (current == null) return null;
    try {
      final response = await _api.rawPost(
        '/auth/refresh',
        {'refresh_token': current.refreshToken},
      );
      if (response.statusCode == 401) {
        await _expireSession();
        return null;
      }
      final json =
          _api.decode(response, '/auth/refresh') as Map<String, dynamic>;
      final refreshed = AuthTokens.fromJson(json);
      await _sessionStore.save(refreshed);
      _latestTokens = refreshed;
      return refreshed;
    } catch (_) {
      await _expireSession();
      return null;
    }
  }

  Future<void> _expireSession() async {
    await _sessionStore.clear();
    _latestTokens = null;
    await _onSessionExpired?.call();
  }

  dynamic _decode(http.Response response, String path) {
    if (response.statusCode == 401) {
      throw ApiException('Session expired');
    }
    return _api.decode(response, path);
  }
}
