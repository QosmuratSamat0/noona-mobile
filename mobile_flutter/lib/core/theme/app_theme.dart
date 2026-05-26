import 'package:flutter/material.dart';
import 'package:noona_mobile_flutter/core/theme/app_colors.dart';

class AppTheme {
  const AppTheme._();

  static ThemeData light() {
    return ThemeData(
      colorScheme: ColorScheme.fromSeed(seedColor: AppColors.primary),
      scaffoldBackgroundColor: AppColors.bg,
      useMaterial3: true,
      fontFamily: 'Roboto',
    );
  }
}
