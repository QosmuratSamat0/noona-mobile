import 'package:flutter/material.dart';
import 'package:noona_mobile_flutter/core/theme/app_colors.dart';
import 'package:noona_mobile_flutter/domain/entities/app_user.dart';
import 'package:noona_mobile_flutter/presentation/widgets/app_card.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({required this.user, required this.onLogout, super.key});

  final AppUser user;
  final VoidCallback onLogout;

  @override
  Widget build(BuildContext context) {
    final initial = user.email.isEmpty ? 'U' : user.email[0].toUpperCase();
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        const SizedBox(height: 20),
        CircleAvatar(
          radius: 44,
          backgroundColor: AppColors.primarySoft,
          child: Text(
            initial,
            style: const TextStyle(fontSize: 32, fontWeight: FontWeight.w900, color: AppColors.primary),
          ),
        ),
        const SizedBox(height: 14),
        Text(
          user.name ?? 'Noona learner',
          textAlign: TextAlign.center,
          style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900),
        ),
        Text(user.email, textAlign: TextAlign.center, style: const TextStyle(color: AppColors.muted)),
        const SizedBox(height: 24),
        const AppCard(
          child: Column(
            children: [
              ListTile(leading: Icon(Icons.notifications_none), title: Text('Notification preferences'), trailing: Text('On')),
              Divider(),
              ListTile(leading: Icon(Icons.flag_outlined), title: Text('Daily goal'), trailing: Text('10 min')),
              Divider(),
              ListTile(leading: Icon(Icons.language), title: Text('Language interface'), trailing: Text('English')),
            ],
          ),
        ),
        const SizedBox(height: 16),
        OutlinedButton.icon(onPressed: onLogout, icon: const Icon(Icons.logout), label: const Text('Logout')),
      ],
    );
  }
}
