class Mistake {
  const Mistake({
    required this.id,
    required this.type,
    required this.original,
    required this.corrected,
  });

  final String id;
  final String type;
  final String original;
  final String corrected;

  factory Mistake.fromJson(Map<String, dynamic> json) {
    return Mistake(
      id: '${json['id']}',
      type: '${json['type'] ?? 'Grammar'}',
      original: '${json['original'] ?? ''}',
      corrected: '${json['corrected'] ?? ''}',
    );
  }
}
