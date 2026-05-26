import 'package:flutter/material.dart';
import 'package:noona_mobile_flutter/core/theme/app_colors.dart';

class GrammarHeatRow extends StatelessWidget {
  const GrammarHeatRow({
    required this.label,
    required this.value,
    required this.color,
    super.key,
  });

  final String label;
  final double value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 10),
      child: Row(
        children: [
          SizedBox(width: 116, child: Text(label)),
          Expanded(
            child: LinearProgressIndicator(
              value: value,
              color: color,
              backgroundColor: AppColors.border,
              borderRadius: BorderRadius.circular(20),
            ),
          ),
          const SizedBox(width: 10),
          Text('${(value * 100).round()}%'),
        ],
      ),
    );
  }
}
