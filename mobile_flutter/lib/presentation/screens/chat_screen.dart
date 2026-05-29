import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:math';

import 'package:flutter/material.dart';
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
  final scrollController = ScrollController();
  final messages = <ChatMessage>[ChatMessage.coachSeed()];
  WebSocketChannel? channel;
  String? sessionId;
  String status = 'idle';
  bool isTextMode = false;
  bool _disposed = false;
  int _reconnectAttempt = 0;
  Timer? _recordingLimitTimer;

  @override
  void initState() {
    super.initState();
    _boot();
    _connectWs();
  }

  @override
  void dispose() {
    _disposed = true;
    _recordingLimitTimer?.cancel();
    channel?.sink.close();
    recorder.dispose();
    draft.dispose();
    scrollController.dispose();
    super.dispose();
  }

  void _scrollToBottom({bool animated = true}) {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || !scrollController.hasClients) return;
      final target = scrollController.position.maxScrollExtent;
      if (animated) {
        scrollController.animateTo(
          target,
          duration: const Duration(milliseconds: 260),
          curve: Curves.easeOutCubic,
        );
      } else {
        scrollController.jumpTo(target);
      }
    });
  }

  Future<void> _boot() async {
    try {
      final sessions = await widget.repository.sessions(widget.token);
      final id = sessions.isEmpty
          ? await widget.repository.createSession(widget.token)
          : '${sessions.first['id']}';
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
      _scrollToBottom(animated: false);
    } catch (_) {}
  }

  void _addMessage(ChatMessage message) {
    setState(() => messages.add(message));
    _scrollToBottom();
  }

  void _attachFeedback(String jobId, ChatFeedback feedback) {
    setState(() {
      for (var i = messages.length - 1; i >= 0; i--) {
        final message = messages[i];
        if (message.role == 'user' && message.jobId == jobId) {
          messages[i] = message.copyWith(
              feedback: message.feedback?.merge(feedback) ?? feedback);
          break;
        }
      }
      status = 'idle';
    });
    _scrollToBottom();
  }

  void _attachAudio(String jobId, String audioUrl) {
    if (audioUrl.trim().isEmpty) return;
    setState(() {
      for (var i = messages.length - 1; i >= 0; i--) {
        final message = messages[i];
        if (message.role == 'coach' && message.jobId == jobId) {
          messages[i] = message.copyWith(audioUrl: audioUrl);
          return;
        }
      }
    });
    _scrollToBottom();
  }

  void _connectWs() {
    if (_disposed) return;
    final nextChannel =
        WebSocketChannel.connect(widget.repository.wsUri(widget.token));
    channel = nextChannel;

    nextChannel.ready.then((_) {
      _reconnectAttempt = 0;
    }).catchError((_) {
      if (!mounted || _disposed || channel != nextChannel) return;
      setState(() => status = 'idle');
      _scheduleReconnect();
    });

    nextChannel.stream.listen(
      (event) {
        _reconnectAttempt = 0;
        try {
          final payload = jsonDecode('$event') as Map<String, dynamic>;
          final data = payload['data'] as Map<String, dynamic>? ?? {};
          switch (payload['type']) {
            case 'audio_error':
              _addMessage(ChatMessage(
                id: 'e-${DateTime.now().millisecondsSinceEpoch}',
                role: 'coach',
                text: 'I could not hear a clear sentence.',
                note: 'Please record 2-8 seconds and speak closer to the mic.',
              ));
              setState(() {
                status = 'idle';
              });
              break;
            case 'transcript_final':
              _addMessage(ChatMessage(
                id: 'u-${DateTime.now().millisecondsSinceEpoch}',
                role: 'user',
                text: '${data['text'] ?? ''}',
                jobId: '${data['job_id'] ?? ''}',
              ));
              break;
            case 'quick_feedback':
              _attachFeedback(
                  '${data['job_id'] ?? ''}', ChatFeedback.fromQuick(data));
              break;
            case 'deep_feedback':
              final analysis = data['analysis'] as Map<String, dynamic>? ?? {};
              _attachFeedback('${data['job_id'] ?? ''}',
                  ChatFeedback.fromAnalysis(analysis));
              break;
            case 'coach_reply':
              _addMessage(ChatMessage(
                id: 'c-${DateTime.now().millisecondsSinceEpoch}',
                role: 'coach',
                text: '${data['text'] ?? ''}',
                jobId: '${data['job_id'] ?? ''}',
              ));
              break;
            case 'tts_ready':
              _attachAudio(
                  '${data['job_id'] ?? ''}', '${data['audio_url'] ?? ''}');
              break;
            case 'audio_processing_result':
              final analysis = data['analysis'] as Map<String, dynamic>? ?? {};
              _addMessage(ChatMessage(
                id: 'u-${DateTime.now().millisecondsSinceEpoch}',
                role: 'user',
                text: '${data['transcript'] ?? 'Audio uploaded'}',
                feedback: ChatFeedback.fromAnalysis(analysis),
              ));
              setState(() {
                status = 'idle';
              });
              break;
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
    final localId = 'local-${DateTime.now().millisecondsSinceEpoch}';
    setState(() {
      messages.add(ChatMessage(
          id: localId, role: 'user', text: text));
      draft.clear();
    });
    _scrollToBottom();
    try {
      final reply = await widget.repository.sendMessage(id, text, widget.token);
      if (!mounted) return;
      setState(() {
        final feedback = reply.feedback;
        if (feedback != null) {
          final index = messages.indexWhere((message) => message.id == localId);
          if (index != -1) {
            messages[index] = messages[index].copyWith(feedback: feedback);
          }
        }
        messages.add(ChatMessage(
          id: reply.id,
          role: reply.role,
          text: reply.text,
          note: reply.note,
          jobId: reply.jobId,
          audioUrl: reply.audioUrl,
        ));
      });
      _scrollToBottom();
    } catch (_) {
      if (mounted) setState(() => messages.removeLast());
    }
  }

  Future<void> _startRecord() async {
    if (status == 'recording') return;
    if (!await recorder.hasPermission()) return;
    final dir = await getTemporaryDirectory();
    final path =
        '${dir.path}/noona-${DateTime.now().millisecondsSinceEpoch}.m4a';
    await recorder.start(const RecordConfig(encoder: AudioEncoder.aacLc),
        path: path);
    setState(() => status = 'recording');
    _recordingLimitTimer?.cancel();
    _recordingLimitTimer = Timer(const Duration(seconds: 10), () {
      _stopRecord();
    });
  }

  Future<void> _stopRecord() async {
    if (status != 'recording') return;
    _recordingLimitTimer?.cancel();
    final path = await recorder.stop();
    if (path == null) return;
    setState(() => status = 'uploading');
    try {
      await widget.repository.uploadAudio(
        File(path),
        widget.token,
        sessionId: sessionId,
      );
      if (mounted) setState(() => status = 'processing');
    } catch (error) {
      if (!mounted) return;
      setState(() => status = 'idle');
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('$error')));
    }
  }

  Future<void> _toggleRecord() {
    return status == 'recording' ? _stopRecord() : _startRecord();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      color: const Color(0xFFF0F4FF),
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 12),
            decoration: const BoxDecoration(color: Color(0xFF3B5BDB)),
            child: SafeArea(
              bottom: false,
              child: Row(
                children: [
                  Container(
                    width: 38,
                    height: 38,
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.18),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.psychology_outlined,
                        color: Colors.white, size: 21),
                  ),
                  const SizedBox(width: 11),
                  const Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text('Noona AI',
                            style: TextStyle(
                                color: Colors.white,
                                fontSize: 15,
                                fontWeight: FontWeight.w500)),
                        SizedBox(height: 2),
                        Text('Speaking practice',
                            style: TextStyle(
                                color: Colors.white70,
                                fontSize: 11,
                                fontWeight: FontWeight.normal)),
                      ],
                    ),
                  ),
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.16),
                      borderRadius: BorderRadius.circular(99),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.local_fire_department,
                            color: Colors.white, size: 15),
                        SizedBox(width: 4),
                        Text('7 days',
                            style: TextStyle(
                                color: Colors.white,
                                fontSize: 12,
                                fontWeight: FontWeight.normal)),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          Expanded(
            child: ListView.builder(
              controller: scrollController,
              padding: const EdgeInsets.fromLTRB(14, 16, 14, 10),
              itemCount: messages.length,
              itemBuilder: (context, index) => ChatBubble(messages[index]),
            ),
          ),
          isTextMode
              ? Container(
                  decoration: BoxDecoration(
                    color: Colors.white,
                    border: Border(
                      top: BorderSide(color: Colors.grey[200]!, width: 0.5),
                    ),
                  ),
                  padding: EdgeInsets.only(
                    bottom:
                        MediaQuery.of(context).viewInsets.bottom > 0 ? 12 : 20,
                  ),
                  child: SafeArea(
                    top: false,
                    child: Row(
                      children: [
                        // Microphone: switch back to voice mode.
                        GestureDetector(
                          onTap: () => setState(() => isTextMode = false),
                          child: const SizedBox(
                            width: 44,
                            height: 44,
                            child: Icon(Icons.mic,
                                color: Color(0xFF3B5BDB), size: 22),
                          ),
                        ),
                        // Text input expands to the remaining width.
                        Expanded(
                          child: TextField(
                            controller: draft,
                            onSubmitted: (_) => _send(),
                            decoration: InputDecoration(
                              hintText: 'Type a message...',
                              hintStyle: TextStyle(
                                  color: Colors.grey[300], fontSize: 14),
                              border: InputBorder.none,
                              contentPadding:
                                  const EdgeInsets.symmetric(vertical: 8),
                            ),
                            style: const TextStyle(
                                fontSize: 14, color: Colors.black87),
                            textInputAction: TextInputAction.send,
                            keyboardType: TextInputType.text,
                            maxLines: 1,
                          ),
                        ),
                        // Send.
                        GestureDetector(
                          onTap: _send,
                          child: const SizedBox(
                            width: 44,
                            height: 44,
                            child: Icon(Icons.send_rounded,
                                color: Color(0xFF3B5BDB), size: 22),
                          ),
                        ),
                      ],
                    ),
                  ),
                )
              : Container(
                  padding: const EdgeInsets.fromLTRB(14, 10, 14, 28),
                  decoration: const BoxDecoration(color: Color(0xFFF0F4FF)),
                  child: SafeArea(
                    top: false,
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          status == 'recording'
                              ? 'Tap stop to send'
                              : status == 'idle'
                                  ? 'Tap and speak'
                                  : 'Waiting for a reply...',
                          style: const TextStyle(
                              color: Colors.grey,
                              fontSize: 11,
                              fontWeight: FontWeight.normal),
                        ),
                        const SizedBox(height: 8),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const SizedBox(
                                width: 56), // spacer to center the mic
                            const Spacer(),
                            GestureDetector(
                              onTap: status == 'uploading' ||
                                      status == 'processing'
                                  ? null
                                  : _toggleRecord,
                              child: Container(
                                width: 56,
                                height: 56,
                                decoration: BoxDecoration(
                                  color: const Color(0xFFE03131),
                                  shape: BoxShape.circle,
                                  boxShadow: [
                                    BoxShadow(
                                        color: const Color(0xFFE03131)
                                            .withValues(alpha: 0.35),
                                        blurRadius: 8,
                                        offset: const Offset(0, 2))
                                  ],
                                ),
                                child: Icon(
                                  status == 'recording'
                                      ? Icons.stop
                                      : Icons.mic,
                                  color: Colors.white,
                                  size: 26,
                                ),
                              ),
                            ),
                            const Spacer(),
                            // Switch to text input.
                            GestureDetector(
                              onTap: () => setState(() => isTextMode = true),
                              child: Container(
                                width: 44,
                                height: 44,
                                decoration: BoxDecoration(
                                  color: const Color(0xFF3B5BDB)
                                      .withValues(alpha: 0.12),
                                  shape: BoxShape.circle,
                                ),
                                child: const Icon(Icons.keyboard_alt_outlined,
                                    color: Color(0xFF3B5BDB), size: 22),
                              ),
                            ),
                            const SizedBox(width: 12),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
        ],
      ),
    );
  }
}
