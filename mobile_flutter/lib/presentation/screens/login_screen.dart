import 'package:flutter/material.dart';
import 'package:noona_mobile_flutter/core/config/app_config.dart';
import 'package:noona_mobile_flutter/core/theme/app_colors.dart';
import 'package:noona_mobile_flutter/domain/entities/app_user.dart';
import 'package:noona_mobile_flutter/domain/entities/auth_tokens.dart';
import 'package:noona_mobile_flutter/domain/repositories/noona_repository.dart';
import 'package:noona_mobile_flutter/presentation/widgets/app_field.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({
    required this.repository,
    required this.onLogin,
    super.key,
  });

  final NoonaRepository repository;
  final Future<void> Function(AuthTokens tokens, AppUser user) onLogin;

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final email = TextEditingController(text: 'alikhan@gmail.com');
  final password = TextEditingController(text: 'password123');
  bool loading = false;

  @override
  void dispose() {
    email.dispose();
    password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() => loading = true);
    try {
      final tokens = await widget.repository.login(email.text.trim(), password.text);
      final user = await widget.repository.me(tokens.accessToken);
      await widget.onLogin(tokens, user);
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$error')));
      }
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const CircleAvatar(
                radius: 34,
                backgroundColor: AppColors.primary,
                child: Text(
                  'ML',
                  style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 22),
                ),
              ),
              const SizedBox(height: 18),
              const Text(
                'Noona',
                style: TextStyle(fontSize: 28, fontWeight: FontWeight.w900, color: AppColors.text),
              ),
              const SizedBox(height: 6),
              const Text('AI English Speaking Coach', style: TextStyle(color: AppColors.muted)),
              const SizedBox(height: 42),
              AppField(label: 'Email', controller: email),
              const SizedBox(height: 14),
              AppField(label: 'Password', controller: password, obscure: true),
              const SizedBox(height: 22),
              SizedBox(
                width: double.infinity,
                height: 54,
                child: FilledButton(
                  onPressed: loading ? null : _submit,
                  child: loading
                      ? const CircularProgressIndicator(color: Colors.white)
                      : const Text('Sign in'),
                ),
              ),
              const SizedBox(height: 20),
              Text(
                AppConfig.apiUrl,
                textAlign: TextAlign.center,
                style: const TextStyle(color: AppColors.muted, fontSize: 11),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
