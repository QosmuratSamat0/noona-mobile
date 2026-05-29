import 'package:flutter/material.dart';
import 'package:noona_mobile_flutter/domain/entities/app_user.dart';
import 'package:noona_mobile_flutter/domain/entities/auth_tokens.dart';
import 'package:noona_mobile_flutter/domain/repositories/noona_repository.dart';
import 'package:noona_mobile_flutter/presentation/screens/chat_screen.dart';
import 'package:noona_mobile_flutter/presentation/screens/dashboard_screen.dart';
import 'package:noona_mobile_flutter/presentation/screens/profile_screen.dart';
import 'package:noona_mobile_flutter/presentation/screens/stats_screen.dart';

class MainShell extends StatefulWidget {
  const MainShell({
    required this.repository,
    required this.tokens,
    required this.user,
    required this.onLogout,
    super.key,
  });

  final NoonaRepository repository;
  final AuthTokens tokens;
  final AppUser user;
  final VoidCallback onLogout;

  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> {
  int index = 0;
  late AppUser user = widget.user;

  @override
  Widget build(BuildContext context) {
    final token = widget.tokens.accessToken;
    final screens = [
      DashboardScreen(
        repository: widget.repository,
        token: token,
        user: user,
        onPractice: () => setState(() => index = 1),
      ),
      ChatScreen(repository: widget.repository, token: token),
      StatsScreen(repository: widget.repository, token: token),
      ProfileScreen(
        repository: widget.repository,
        token: token,
        user: user,
        onUserChanged: (next) => setState(() => user = next),
        onLogout: widget.onLogout,
      ),
    ];
    return Scaffold(
      body: SafeArea(child: screens[index]),
      bottomNavigationBar: NavigationBar(
        selectedIndex: index,
        onDestinationSelected: (value) => setState(() => index = value),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.home_outlined), label: 'Home'),
          NavigationDestination(
              icon: Icon(Icons.chat_bubble_outline), label: 'Chat'),
          NavigationDestination(icon: Icon(Icons.bar_chart), label: 'Stats'),
          NavigationDestination(
              icon: Icon(Icons.person_outline), label: 'Profile'),
        ],
      ),
    );
  }
}
