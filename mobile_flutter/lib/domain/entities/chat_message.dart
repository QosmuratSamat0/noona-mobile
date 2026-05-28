class ChatFeedback {
  const ChatFeedback({
    required this.correctedText,
    required this.reason,
    this.original,
    this.mistakes = const [],
  });

  final String correctedText;
  final String reason;
  final String? original;
  final List<ChatMistake> mistakes;

  factory ChatFeedback.fromQuick(Map<String, dynamic> json) {
    return ChatFeedback(
      correctedText: '${json['corrected_text'] ?? ''}'.trim(),
      reason: '${json['reason'] ?? ''}'.trim(),
      original: '${json['original'] ?? ''}'.trim(),
    );
  }

  factory ChatFeedback.fromAnalysis(Map<String, dynamic> json) {
    final rawMistakes = json['mistakes'];
    final mistakes = rawMistakes is List
        ? rawMistakes
            .whereType<Map<String, dynamic>>()
            .map(ChatMistake.fromJson)
            .toList()
        : const <ChatMistake>[];
    return ChatFeedback(
      correctedText: '${json['correction'] ?? ''}'.trim(),
      reason: '${json['explanation'] ?? ''}'.trim(),
      mistakes: mistakes,
    );
  }

  ChatFeedback merge(ChatFeedback next) {
    return ChatFeedback(
      correctedText: next.correctedText.isNotEmpty ? next.correctedText : correctedText,
      reason: next.reason.isNotEmpty ? next.reason : reason,
      original: next.original?.isNotEmpty == true ? next.original : original,
      mistakes: next.mistakes.isNotEmpty ? next.mistakes : mistakes,
    );
  }
}

class ChatMistake {
  const ChatMistake({
    required this.type,
    required this.original,
    required this.corrected,
  });

  final String type;
  final String original;
  final String corrected;

  factory ChatMistake.fromJson(Map<String, dynamic> json) {
    return ChatMistake(
      type: '${json['type'] ?? ''}'.trim(),
      original: '${json['original'] ?? ''}'.trim(),
      corrected: '${json['corrected'] ?? ''}'.trim(),
    );
  }
}

class ChatMessage {
  const ChatMessage({
    required this.id,
    required this.role,
    required this.text,
    this.note,
    this.jobId,
    this.feedback,
    this.audioUrl,
  });

  final String id;
  final String role;
  final String text;
  final String? note;
  final String? jobId;
  final ChatFeedback? feedback;
  final String? audioUrl;

  ChatMessage copyWith({
    String? id,
    String? role,
    String? text,
    String? note,
    String? jobId,
    ChatFeedback? feedback,
    String? audioUrl,
  }) {
    return ChatMessage(
      id: id ?? this.id,
      role: role ?? this.role,
      text: text ?? this.text,
      note: note ?? this.note,
      jobId: jobId ?? this.jobId,
      feedback: feedback ?? this.feedback,
      audioUrl: audioUrl ?? this.audioUrl,
    );
  }

  factory ChatMessage.coachSeed() {
    return const ChatMessage(
      id: 'coach-1',
      role: 'coach',
      text: 'Hey! What did you do last weekend?',
    );
  }

  factory ChatMessage.fromJson(Map<String, dynamic> json) {
    return ChatMessage(
      id: '${json['id']}',
      role: json['role'] == 'user' ? 'user' : 'coach',
      text: _cleanCoachText('${json['content'] ?? ''}'),
      audioUrl: '${json['audio_url'] ?? ''}'.trim().isEmpty ? null : '${json['audio_url']}',
    );
  }
}

String _cleanCoachText(String text) {
  return text.replaceAll('**', '').replaceAll(RegExp(r'^\s*\*\s+', multiLine: true), '').trim();
}
