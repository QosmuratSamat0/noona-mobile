import 'package:flutter/material.dart';
import 'package:noona_mobile_flutter/core/theme/app_colors.dart';
import 'package:noona_mobile_flutter/domain/entities/activity_summary.dart';
import 'package:noona_mobile_flutter/domain/entities/mistake.dart';
import 'package:noona_mobile_flutter/domain/repositories/noona_repository.dart';
import 'package:noona_mobile_flutter/presentation/widgets/app_card.dart';

class StatsScreen extends StatefulWidget {
  const StatsScreen({required this.repository, required this.token, super.key});

  final NoonaRepository repository;
  final String token;

  @override
  State<StatsScreen> createState() => _StatsScreenState();
}

class _StatsScreenState extends State<StatsScreen> {
  ActivitySummary activity = ActivitySummary.empty();
  List<Mistake> mistakes = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final nextActivity = await widget.repository.activity(widget.token).catchError((_) => activity);
    final nextMistakes = await widget.repository.mistakes(widget.token).catchError((_) => <Mistake>[]);
    if (mounted) {
      setState(() {
        activity = nextActivity;
        mistakes = nextMistakes;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final maxDay = activity.days.fold<int>(1, (max, value) => value > max ? value : max);
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        const Text('Progress', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w900)),
        const SizedBox(height: 16),
        AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Current level', style: TextStyle(color: AppColors.muted)),
              const Text('A2', style: TextStyle(fontSize: 32, fontWeight: FontWeight.w900)),
              const SizedBox(height: 10),
              LinearProgressIndicator(value: .62, borderRadius: BorderRadius.circular(20)),
              const SizedBox(height: 6),
              const Text('62% to B1', style: TextStyle(color: AppColors.muted)),
            ],
          ),
        ),
        const SizedBox(height: 14),
        AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Sessions - last 7 days', style: TextStyle(fontWeight: FontWeight.w900)),
              const SizedBox(height: 14),
              SizedBox(
                height: 120,
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: activity.days
                      .map(
                        (day) => Expanded(
                          child: Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 4),
                            child: FractionallySizedBox(
                              heightFactor: (day / maxDay).clamp(.08, 1),
                              alignment: Alignment.bottomCenter,
                              child: DecoratedBox(
                                decoration: BoxDecoration(color: AppColors.primary, borderRadius: BorderRadius.circular(8)),
                              ),
                            ),
                          ),
                        ),
                      )
                      .toList(),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),
        AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Recent corrections', style: TextStyle(fontWeight: FontWeight.w900)),
              const SizedBox(height: 12),
              if (mistakes.isEmpty)
                const Text('Practice from chat to collect corrections here.', style: TextStyle(color: AppColors.muted)),
              ...mistakes.take(8).map(
                    (m) => ListTile(
                      contentPadding: EdgeInsets.zero,
                      title: Text(m.type),
                      subtitle: Text('${m.original} -> ${m.corrected}'),
                    ),
                  ),
            ],
          ),
        ),
      ],
    );
  }
}
