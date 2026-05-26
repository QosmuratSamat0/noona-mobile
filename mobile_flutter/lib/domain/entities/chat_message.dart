class ChatMessage {
  const ChatMessage({required this.id, required this.role, required this.text, this.note});

  final String id;
  final String role;
  final String text;
  final String? note;

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
      text: '${json['content'] ?? ''}',
    );
  }
}
