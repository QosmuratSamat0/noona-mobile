import 'dart:convert';
import 'dart:io';
import 'dart:math';

import 'package:flutter/material.dart';
import 'package:noona_mobile_flutter/core/theme/app_colors.dart';
import 'package:noona_mobile_flutter/domain/entities/chat_message.dart';
import 'package:noona_mobile_flutter/domain/repositories/noona_repository.dart';
import 'package:noona_mobile_flutter/presentation/widgets/chat_bubble.dart';
import 'package:path_provider/path_provider.dart';
import 'package:record/record.dart';
import 'package:web_socket_channel/web_socket_channel.dart';

class ChatScreen extends StatefulWidget {
  const ChatScreen({required this.repository, required this.token, super.key});

  final NoonaRepository repository;
  final String token;

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  final recorder = AudioRecorder();
  final draft = TextEditingController();
  final messages = <ChatMessage>[ChatMessage.coachSeed()];
  WebSocketChannel? channel;
  String? sessionId;
  String status = 'idle';
  bool _disposed = false;
  int _reconnectAttempt = 0;

  @override
  void initState() {
    super.initState();
    _boot();
    _connectWs();
  }

  @override
  void dispose() {
    _disposed = true;
    channel?.sink.close();
    recorder.dispose();
    draft.dispose();
    super.dispose();
  }

  Future<void> _boot() async {
    try {
      final sessions = await widget.repository.sessions(widget.token);
      final id = sessions.isEmpty ? await widget.repository.createSession(widget.token) : '${sessions.first['id']}';
      final history = await widget.repository.messages(id, widget.token);
      if (!mounted) return;
      setState(() {
        sessionId = id;
        if (history.isNotEmpty) {
          messages
            ..clear()
            ..addAll(history);
        }
      });
    } catch (_) {}
  }

  void _connectWs() {
    if (_disposed) return;
    channel = WebSocketChannel.connect(widget.repository.wsUri(widget.token));
    channel!.stream.listen(
      (event) {
        _reconnectAttempt = 0;
        try {
          final payload = jsonDecode('$event') as Map<String, dynamic>;
          final data = payload['data'] as Map<String, dynamic>? ?? {};
          if (payload['type'] == 'audio_processing_result') {
            final analysis = data['analysis'] as Map<String, dynamic>? ?? {};
            setState(() {
              messages.add(ChatMessage(
                id: 'u-${DateTime.now().millisecondsSinceEpoch}',
                role: 'user',
                text: '${data['transcript'] ?? 'Audio uploaded'}',
              ));
              messages.add(ChatMessage(
                id: 'c-${DateTime.now().millisecondsSinceEpoch}',
                role: 'coach',
                text: 'Good work. ${analysis['correction'] ?? ''}',
                note: '${analysis['explanation'] ?? ''}',
              ));
              status = 'idle';
            });
          }
        } catch (_) {}
      },
      onError: (_) {
        if (mounted) setState(() => status = 'idle');
        _scheduleReconnect();
      },
      onDone: _scheduleReconnect,
    );
  }

  void _scheduleReconnect() {
    if (_disposed) return;
    _reconnectAttempt += 1;
    final seconds = min(30, pow(2, _reconnectAttempt).toInt());
    Future<void>.delayed(Duration(seconds: seconds), () {
      if (!_disposed) _connectWs();
    });
  }

  Future<void> _send() async {
    final text = draft.text.trim();
    final id = sessionId;
    if (text.isEmpty || id == null) return;
    setState(() {
      messages.add(ChatMessage(id: 'local-${DateTime.now().millisecondsSinceEpoch}', role: 'user', text: text));
      draft.clear();
    });
    await widget.repository.sendMessage(id, text, widget.token).catchError((_) => messages.removeLast());
  }

  Future<void> _startRecord() async {
    if (!await recorder.hasPermission()) return;
    final dir = await getTemporaryDirectory();
    final path = '${dir.path}/noona-${DateTime.now().millisecondsSinceEpoch}.m4a';
    await recorder.start(const RecordConfig(encoder: AudioEncoder.aacLc), path: path);
    setState(() => status = 'recording');
  }

  Future<void> _stopRecord() async {
    if (status != 'recording') return;
    final path = await recorder.stop();
    if (path == null) return;
    setState(() => status = 'uploading');
    await widget.repository.uploadAudio(File(path), widget.token);
    setState(() => status = 'processing');
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        const ListTile(
          leading: CircleAvatar(backgroundColor: AppColors.primarySoft, child: Text('AI')),
          title: Text('AI Coach', style: TextStyle(fontWeight: FontWeight.w900)),
          subtitle: Text('Online'),
        ),
        Expanded(
          child: ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: messages.length,
            itemBuilder: (context, index) => ChatBubble(messages[index]),
          ),
        ),
        Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            children: [
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: draft,
                      decoration: const InputDecoration(hintText: 'Type a message...', border: OutlineInputBorder()),
                    ),
                  ),
                  const SizedBox(width: 8),
                  IconButton.filled(onPressed: _send, icon: const Icon(Icons.send)),
                ],
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  GestureDetector(
                    onLongPressStart: (_) => _startRecord(),
                    onLongPressEnd: (_) => _stopRecord(),
                    child: CircleAvatar(
                      radius: 34,
                      backgroundColor: status == 'recording' ? AppColors.danger : AppColors.primary,
                      child: const Icon(Icons.mic, color: Colors.white),
                    ),
                  ),
                  const SizedBox(width: 14),
                  Text(status == 'recording' ? 'Listening...' : status == 'idle' ? 'Hold to speak' : 'Waiting for coach'),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }
}
