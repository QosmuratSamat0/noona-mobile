import 'dart:io';

import 'package:noona_mobile_flutter/domain/entities/activity_summary.dart';
import 'package:noona_mobile_flutter/domain/entities/app_user.dart';
import 'package:noona_mobile_flutter/domain/entities/auth_tokens.dart';
import 'package:noona_mobile_flutter/domain/entities/chat_message.dart';
import 'package:noona_mobile_flutter/domain/entities/mistake.dart';

abstract class NoonaRepository {
  Uri wsUri(String token);
  void setSessionExpiredHandler(Future<void> Function() handler);
  Future<AuthTokens> login(String email, String password);
  Future<AppUser> me(String token);
  Future<void> logout(AuthTokens tokens);
  Future<ActivitySummary> activity(String token);
  Future<List<Mistake>> mistakes(String token);
  Future<List<Map<String, dynamic>>> sessions(String token);
  Future<String> createSession(String token);
  Future<List<ChatMessage>> messages(String sessionId, String token);
  Future<ChatMessage> sendMessage(String sessionId, String content, String token);
  Future<void> uploadAudio(File file, String token);
}
