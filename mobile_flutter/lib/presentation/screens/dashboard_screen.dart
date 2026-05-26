import 'package:flutter/material.dart';
import 'package:noona_mobile_flutter/core/theme/app_colors.dart';
import 'package:noona_mobile_flutter/domain/entities/activity_summary.dart';
import 'package:noona_mobile_flutter/domain/entities/app_user.dart';
import 'package:noona_mobile_flutter/domain/entities/mistake.dart';
import 'package:noona_mobile_flutter/domain/repositories/noona_repository.dart';
import 'package:noona_mobile_flutter/presentation/widgets/app_card.dart';
import 'package:noona_mobile_flutter/presentation/widgets/grammar_heat_row.dart';
import 'package:noona_mobile_flutter/presentation/widgets/metric_card.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({
    required this.repository,
    required this.token,
    required this.user,
    required this.onPractice,
    super.key,
  });

  final NoonaRepository repository;
  final String token;
  final AppUser user;
  final VoidCallback onPractice;

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  ActivitySummary activity = ActivitySummary.empty();
  List<Mistake> mistakes = [];
  int sessions = 0;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final results = await Future.wait([
      widget.repository.activity(widget.token).catchError((_) => activity),
      widget.repository.mistakes(widget.token).catchError((_) => <Mistake>[]),
      widget.repository.sessions(widget.token).catchError((_) => <Map<String, dynamic>>[]),
    ]);
    if (!mounted) return;
    setState(() {
      activity = results[0] as ActivitySummary;
      mistakes = results[1] as List<Mistake>;
      sessions = (results[2] as List).length;
    });
  }

  @override
  Widget build(BuildContext context) {
    final firstName = widget.user.name?.split(' ').first ?? widget.user.email.split('@').first;
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Hey, $firstName!',
                  style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w900, color: AppColors.text),
                ),
                const SizedBox(height: 4),
                Text(
                  activity.currentStreak > 0 ? '${activity.currentStreak} day streak - keep going' : 'Ready to practice?',
                  style: const TextStyle(color: AppColors.muted),
                ),
              ],
            ),
            const _Badge('A2 level'),
          ],
        ),
        const SizedBox(height: 20),
        GridView.count(
          crossAxisCount: 2,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          crossAxisSpacing: 12,
          mainAxisSpacing: 12,
          childAspectRatio: 1.4,
          children: [
            MetricCard('${activity.currentStreak}', 'Day streak'),
            MetricCard('$sessions', 'Sessions total'),
            MetricCard('${mistakes.length}', 'Corrections'),
            const MetricCard('A2', 'CEFR level'),
          ],
        ),
        const SizedBox(height: 16),
        AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Grammar heatmap', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 18)),
              const SizedBox(height: 12),
              ..._topMistakes().map((item) => GrammarHeatRow(label: item.$1, value: item.$2, color: item.$3)),
            ],
          ),
        ),
        const SizedBox(height: 16),
        SizedBox(
          height: 54,
          child: FilledButton.icon(
            onPressed: widget.onPractice,
            icon: const Icon(Icons.mic_none),
            label: const Text('Start practice'),
          ),
        ),
      ],
    );
  }

  List<(String, double, Color)> _topMistakes() {
    if (mistakes.isEmpty) {
      return const [
        ('Past tense', .78, AppColors.danger),
        ('Articles', .52, AppColors.warning),
        ('Prepositions', .38, AppColors.success),
      ];
    }
    final counts = <String, int>{};
    for (final mistake in mistakes) {
      counts[mistake.type] = (counts[mistake.type] ?? 0) + 1;
    }
    return counts.entries.take(4).map((e) => (e.key, e.value / mistakes.length, AppColors.primary)).toList();
  }
}

class _Badge extends StatelessWidget {
  const _Badge(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(color: AppColors.primarySoft, borderRadius: BorderRadius.circular(20)),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        child: Text(text, style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.w800)),
      ),
    );
  }
}
