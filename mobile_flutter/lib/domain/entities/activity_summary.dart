class ActivitySummary {
  const ActivitySummary({required this.currentStreak, required this.days});

  final int currentStreak;
  final List<int> days;

  factory ActivitySummary.empty() {
    return ActivitySummary(currentStreak: 0, days: List.filled(7, 0));
  }

  factory ActivitySummary.fromJson(Map<String, dynamic>? json) {
    final stats = (json?['daily_stats'] as List<dynamic>? ?? const [])
        .map((item) => (item as Map<String, dynamic>)['session_count'] as int? ?? 0)
        .toList();
    return ActivitySummary(
      currentStreak: (json?['streak'] as Map<String, dynamic>?)?['current_streak'] as int? ?? 0,
      days: stats.isEmpty ? List.filled(7, 0) : stats.take(7).toList(),
    );
  }
}
