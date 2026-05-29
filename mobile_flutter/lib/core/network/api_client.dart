import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;
import 'package:noona_mobile_flutter/core/config/app_config.dart';

class ApiClient {
  ApiClient({http.Client? client}) : _client = client ?? http.Client();

  static const timeout = Duration(seconds: 12);
  final http.Client _client;

  Uri wsUri(String token) {
    final base = Uri.parse(AppConfig.apiUrl);
    return base.replace(
      scheme: base.scheme == 'https' ? 'wss' : 'ws',
      path: '${base.path.replaceAll(RegExp(r'/$'), '')}/ws/chat',
      queryParameters: {'token': token},
    );
  }

  Future<dynamic> get(String path, String token) async {
    return decode(await rawGet(path, token), path);
  }

  Future<http.Response> rawGet(String path, String token) {
    return _client.get(
      Uri.parse('${AppConfig.apiUrl}$path'),
      headers: {'Authorization': 'Bearer $token'},
    ).timeout(timeout);
  }

  Future<Map<String, dynamic>> post(
    String path,
    Map<String, dynamic> body, [
    String? token,
  ]) async {
    return decode(await rawPost(path, body, token), path)
        as Map<String, dynamic>;
  }

  Future<http.Response> rawPost(
    String path,
    Map<String, dynamic> body, [
    String? token,
  ]) {
    return _client
        .post(
          Uri.parse('${AppConfig.apiUrl}$path'),
          headers: {
            'Content-Type': 'application/json',
            if (token != null) 'Authorization': 'Bearer $token',
          },
          body: jsonEncode(body),
        )
        .timeout(timeout);
  }

  Future<http.Response> rawPut(
    String path,
    Map<String, dynamic> body,
    String token,
  ) {
    return _client
        .put(
          Uri.parse('${AppConfig.apiUrl}$path'),
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer $token',
          },
          body: jsonEncode(body),
        )
        .timeout(timeout);
  }

  Future<void> upload(
    String path,
    File file,
    String token, {
    Map<String, String> fields = const {},
  }) async {
    decode(await rawUpload(path, file, token, fields: fields), path);
  }

  Future<http.Response> rawUpload(
    String path,
    File file,
    String token, {
    Map<String, String> fields = const {},
  }) async {
    final request =
        http.MultipartRequest('POST', Uri.parse('${AppConfig.apiUrl}$path'));
    request.headers['Authorization'] = 'Bearer $token';
    request.fields.addAll(fields);
    request.files.add(await http.MultipartFile.fromPath('file', file.path));
    final streamed = await request.send().timeout(const Duration(seconds: 30));
    return http.Response.fromStream(streamed);
  }

  dynamic decode(http.Response response, String path) {
    final dynamic data =
        response.body.isEmpty ? null : jsonDecode(response.body);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      final message =
          data is Map ? data['error'] ?? data['message'] : response.body;
      throw ApiException('$path failed: $message');
    }
    return data;
  }
}

class ApiException implements Exception {
  ApiException(this.message);

  final String message;

  @override
  String toString() => message;
}
