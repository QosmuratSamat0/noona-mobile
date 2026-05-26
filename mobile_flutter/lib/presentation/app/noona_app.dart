import 'dart:async';

import 'package:flutter/material.dart';
import 'package:noona_mobile_flutter/core/network/api_client.dart';
import 'package:noona_mobile_flutter/core/storage/session_store.dart';
import 'package:noona_mobile_flutter/core/theme/app_theme.dart';
import 'package:noona_mobile_flutter/data/repositories/backend_noona_repository.dart';
import 'package:noona_mobile_flutter/domain/entities/app_user.dart';
import 'package:noona_mobile_flutter/domain/entities/auth_tokens.dart';
import 'package:noona_mobile_flutter/domain/repositories/noona_repository.dart';
import 'package:noona_mobile_flutter/presentation/screens/login_screen.dart';
import 'package:noona_mobile_flutter/presentation/screens/main_shell.dart';

class NoonaApp extends StatelessWidget {
  const NoonaApp({super.key});

  @override
  Widget build(BuildContext context) {
    final sessionStore = SessionStore();
    return MaterialApp(
      title: 'Noona',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light(),
      home: AppRoot(
        repository: BackendNoonaRepository(ApiClient(), sessionStore),
        sessionStore: sessionStore,
      ),
    );
  }
}

class AppRoot extends StatefulWidget {
  const AppRoot({
    required this.repository,
    required this.sessionStore,
    super.key,
  });

  final NoonaRepository repository;
  final SessionStore sessionStore;

  @override
  State<AppRoot> createState() => _AppRootState();
}

class _AppRootState extends State<AppRoot> {
  AuthTokens? tokens;
  AppUser? user;
  bool booting = true;

  @override
  void initState() {
    super.initState();
    widget.repository.setSessionExpiredHandler(_expireSession);
    _restore();
  }

  Future<void> _restore() async {
    try {
      final saved = await widget.sessionStore.load();
      if (saved != null) {
        final profile = await widget.repository.me(saved.accessToken);
        setState(() {
          tokens = saved;
          user = profile;
        });
      }
    } catch (_) {
      await widget.sessionStore.clear();
    } finally {
      if (mounted) setState(() => booting = false);
    }
  }

  Future<void> _onLogin(AuthTokens nextTokens, AppUser nextUser) async {
    await widget.sessionStore.save(nextTokens);
    setState(() {
      tokens = nextTokens;
      user = nextUser;
    });
  }

  Future<void> _logout() async {
    final old = tokens;
    setState(() {
      tokens = null;
      user = null;
    });
    if (old != null) unawaited(widget.repository.logout(old!));
    await widget.sessionStore.clear();
  }

  Future<void> _expireSession() async {
    if (!mounted) return;
    setState(() {
      tokens = null;
      user = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (booting) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    if (tokens == null || user == null) {
      return LoginScreen(repository: widget.repository, onLogin: _onLogin);
    }
    return MainShell(
      repository: widget.repository,
      tokens: tokens!,
      user: user!,
      onLogout: _logout,
    );
  }
}
