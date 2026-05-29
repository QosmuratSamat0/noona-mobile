import 'package:flutter/material.dart';
import 'package:noona_mobile_flutter/core/theme/app_colors.dart';
import 'package:noona_mobile_flutter/domain/entities/app_user.dart';
import 'package:noona_mobile_flutter/domain/repositories/noona_repository.dart';
import 'package:noona_mobile_flutter/presentation/widgets/app_card.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({
    required this.repository,
    required this.token,
    required this.user,
    required this.onUserChanged,
    required this.onLogout,
    super.key,
  });

  final NoonaRepository repository;
  final String token;
  final AppUser user;
  final ValueChanged<AppUser> onUserChanged;
  final VoidCallback onLogout;

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  static const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  bool saving = false;

  Future<void> _setLevel(String level) async {
    if (saving || level == widget.user.cefrLevel) return;
    setState(() => saving = true);
    try {
      final next = await widget.repository
          .updateCEFRLevel(widget.user.id, level, widget.token);
      widget.onUserChanged(next);
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('$error')));
      }
    } finally {
      if (mounted) setState(() => saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final initial =
        widget.user.email.isEmpty ? 'U' : widget.user.email[0].toUpperCase();
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        const SizedBox(height: 20),
        CircleAvatar(
          radius: 44,
          backgroundColor: AppColors.primarySoft,
          child: Text(
            initial,
            style: const TextStyle(
              fontSize: 32,
              fontWeight: FontWeight.w900,
              color: AppColors.primary,
            ),
          ),
        ),
        const SizedBox(height: 14),
        Text(
          widget.user.name ?? 'Noona learner',
          textAlign: TextAlign.center,
          style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900),
        ),
        Text(
          widget.user.email,
          textAlign: TextAlign.center,
          style: const TextStyle(color: AppColors.muted),
        ),
        const SizedBox(height: 24),
        AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const ListTile(
                leading: Icon(Icons.school_outlined),
                title: Text('English level'),
                subtitle: Text('Noona adapts chat replies to this level'),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                child: Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: levels.map((level) {
                    final selected = widget.user.cefrLevel == level;
                    return ChoiceChip(
                      label: Text(level),
                      selected: selected,
                      onSelected: saving ? null : (_) => _setLevel(level),
                    );
                  }).toList(),
                ),
              ),
              const Divider(),
              const ListTile(
                leading: Icon(Icons.notifications_none),
                title: Text('Notification preferences'),
                trailing: Text('On'),
              ),
              const Divider(),
              const ListTile(
                leading: Icon(Icons.flag_outlined),
                title: Text('Daily goal'),
                trailing: Text('10 min'),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        OutlinedButton.icon(
          onPressed: widget.onLogout,
          icon: const Icon(Icons.logout),
          label: const Text('Logout'),
        ),
      ],
    );
  }
}
