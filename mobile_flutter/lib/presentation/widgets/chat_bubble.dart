import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/material.dart';
import 'package:noona_mobile_flutter/core/theme/app_colors.dart';
import 'package:noona_mobile_flutter/domain/entities/chat_message.dart';

class ChatBubble extends StatefulWidget {
  const ChatBubble(this.message, {super.key});

  final ChatMessage message;

  @override
  State<ChatBubble> createState() => _ChatBubbleState();
}

class _ChatBubbleState extends State<ChatBubble> {
  final _player = AudioPlayer();
  bool _isPlaying = false;

  ChatMessage get message => widget.message;

  @override
  void dispose() {
    _player.dispose();
    super.dispose();
  }

  Future<void> _playCoachAudio() async {
    final audioUrl = message.audioUrl?.trim();
    if (audioUrl == null || audioUrl.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Аудио ответ еще не готов.')),
      );
      return;
    }

    try {
      setState(() => _isPlaying = true);
      await _player.stop();
      await _player.play(UrlSource(audioUrl));
      await _player.onPlayerComplete.first
          .timeout(const Duration(minutes: 2), onTimeout: () {});
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('Ошибка аудио: $error')));
    } finally {
      if (mounted) setState(() => _isPlaying = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isUser = message.role == 'user';
    final hasNote = message.note != null && message.note!.trim().isNotEmpty;
    final hasFeedback = message.feedback != null;
    final canOpen = isUser ? hasFeedback : false;

    return Align(
      alignment: isUser ? Alignment.centerRight : Alignment.centerLeft,
      child: Padding(
        padding: const EdgeInsets.only(bottom: 16),
        child: Column(
          crossAxisAlignment:
              isUser ? CrossAxisAlignment.end : CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            GestureDetector(
              onTap: canOpen
                  ? () => _showFeedback(context)
                  : !isUser
                      ? _playCoachAudio
                      : null,
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                constraints: BoxConstraints(
                    maxWidth: MediaQuery.sizeOf(context).width * 0.78),
                decoration: BoxDecoration(
                  color: isUser ? const Color(0xFF3B5BDB) : Colors.white,
                  borderRadius: isUser
                      ? const BorderRadius.only(
                          topLeft: Radius.circular(20),
                          topRight: Radius.circular(20),
                          bottomLeft: Radius.circular(20),
                          bottomRight: Radius.circular(5),
                        )
                      : const BorderRadius.only(
                          topLeft: Radius.circular(20),
                          topRight: Radius.circular(20),
                          bottomRight: Radius.circular(20),
                          bottomLeft: Radius.circular(5),
                        ),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.06),
                      blurRadius: 4,
                      offset: const Offset(0, 1),
                    ),
                  ],
                ),
                child: Text(
                  message.text,
                  style: TextStyle(
                    color: isUser ? Colors.white : const Color(0xFF0F172A),
                    fontSize: 14,
                    height: 1.5,
                  ),
                ),
              ),
            ),
            if (isUser && hasFeedback) ...[
              const SizedBox(height: 4),
              GestureDetector(
                onTap: () => _showFeedback(context),
                child: Padding(
                  padding: const EdgeInsets.only(right: 4),
                  child: Text(
                    'нажми для анализа',
                    style: TextStyle(
                      color: Colors.black.withOpacity(0.35),
                      fontSize: 10,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ),
            ],
            const SizedBox(height: 6),
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (!isUser) ...[
                  _ActionButton(
                    icon: Icons.translate,
                    onTap: hasNote ? () => _showDetails(context) : () {},
                  ),
                  const SizedBox(width: 8),
                  _ActionButton(
                    icon: _isPlaying
                        ? Icons.stop_rounded
                        : Icons.volume_up_outlined,
                    onTap: _playCoachAudio,
                  ),
                ],
                if (isUser && hasFeedback) ...[
                  _ActionButton(
                    icon: Icons.bar_chart,
                    onTap: () => _showFeedback(context),
                  ),
                  const SizedBox(width: 8),
                  _ActionButton(
                    icon: Icons.refresh,
                    onTap: () {},
                  ),
                  const SizedBox(width: 8),
                  _ActionButton(
                    icon: Icons.volume_up_outlined,
                    onTap: () {},
                  ),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }

  void _showFeedback(BuildContext context) {
    final feedback = message.feedback;
    if (feedback == null) return;

    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      barrierColor: Colors.black.withOpacity(0.42),
      backgroundColor: Colors.transparent,
      builder: (context) =>
          _FeedbackSheet(message: message, feedback: feedback),
    );
  }

  void _showDetails(BuildContext context) {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (context) {
        return Container(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          child: SafeArea(
            top: false,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const _SheetHandle(),
                const SizedBox(height: 18),
                const Text(
                  'Noona feedback',
                  style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w900,
                      color: AppColors.text),
                ),
                const SizedBox(height: 14),
                _DetailBlock(label: 'Correction', text: message.text),
                const SizedBox(height: 12),
                _DetailBlock(label: 'Coach note', text: message.note ?? ''),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _FeedbackSheet extends StatefulWidget {
  const _FeedbackSheet({required this.message, required this.feedback});

  final ChatMessage message;
  final ChatFeedback feedback;

  @override
  State<_FeedbackSheet> createState() => _FeedbackSheetState();
}

class _FeedbackSheetState extends State<_FeedbackSheet> {
  bool grammarTab = true;

  @override
  Widget build(BuildContext context) {
    final feedback = widget.feedback;
    final grammarMistakes = feedback.mistakes
        .where((m) => m.type.toLowerCase() != 'pronunciation')
        .toList();
    final pronunciationMistakes = feedback.mistakes
        .where((m) => m.type.toLowerCase() == 'pronunciation')
        .toList();
    final score = grammarTab
        ? _grammarScore(grammarMistakes)
        : _pronunciationScore(pronunciationMistakes);
    final sentence = feedback.original?.isNotEmpty == true
        ? feedback.original!
        : widget.message.text;

    return DraggableScrollableSheet(
      initialChildSize: 0.56,
      minChildSize: 0.46,
      maxChildSize: 0.86,
      expand: false,
      builder: (context, controller) {
        return Container(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 18),
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          child: SafeArea(
            top: false,
            child: ListView(
              controller: controller,
              children: [
                Stack(
                  children: [
                    const Align(
                        alignment: Alignment.topCenter, child: _SheetHandle()),
                    Align(
                      alignment: Alignment.topRight,
                      child: _CloseButton(
                          onTap: () => Navigator.of(context).pop()),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                _SegmentedTabs(
                  grammarSelected: grammarTab,
                  onGrammar: () => setState(() => grammarTab = true),
                  onPronunciation: () => setState(() => grammarTab = false),
                ),
                const SizedBox(height: 18),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      '$score%',
                      style: const TextStyle(
                        color: Color(0xFF2F9E44),
                        fontSize: 28,
                        height: 1,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Padding(
                      padding: const EdgeInsets.only(bottom: 2),
                      child: Text(
                        score >= 90 ? 'Well done!' : 'неплохо!',
                        style: const TextStyle(
                            color: Color(0xFF2F9E44),
                            fontSize: 14,
                            fontWeight: FontWeight.w500),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                _SentencePreview(
                  sentence: sentence,
                  mistakes:
                      grammarTab ? grammarMistakes : pronunciationMistakes,
                ),
                const SizedBox(height: 18),
                if (grammarTab)
                  _GrammarPanel(
                      mistakes: grammarMistakes,
                      correctedText: feedback.correctedText)
                else
                  _PronunciationPanel(mistakes: pronunciationMistakes),
              ],
            ),
          ),
        );
      },
    );
  }

  int _grammarScore(List<ChatMistake> mistakes) {
    if (mistakes.isEmpty) return 93;
    return (91 - mistakes.length * 10).clamp(58, 91);
  }

  int _pronunciationScore(List<ChatMistake> mistakes) {
    if (mistakes.isEmpty) return 93;
    return (96 - mistakes.length * 8).clamp(62, 96);
  }
}

class _SegmentedTabs extends StatelessWidget {
  const _SegmentedTabs({
    required this.grammarSelected,
    required this.onGrammar,
    required this.onPronunciation,
  });

  final bool grammarSelected;
  final VoidCallback onGrammar;
  final VoidCallback onPronunciation;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 38,
      decoration: BoxDecoration(
        color: const Color(0xFFF1F3F5),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        children: [
          Expanded(
            child: _TabButton(
                label: 'Grammar', selected: grammarSelected, onTap: onGrammar),
          ),
          Expanded(
            child: _TabButton(
                label: 'Pronunciation',
                selected: !grammarSelected,
                onTap: onPronunciation),
          ),
        ],
      ),
    );
  }
}

class _TabButton extends StatelessWidget {
  const _TabButton(
      {required this.label, required this.selected, required this.onTap});

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: selected ? Colors.white : Colors.transparent,
          borderRadius: BorderRadius.circular(16),
          boxShadow: selected
              ? [
                  BoxShadow(
                      color: Colors.black.withOpacity(0.1),
                      blurRadius: 3)
                ]
              : null,
        ),
        child: Text(
          label,
          style: TextStyle(
            color: selected ? Colors.black : Colors.grey,
            fontSize: 13,
            fontWeight: FontWeight.w500,
          ),
        ),
      ),
    );
  }
}

class _SentencePreview extends StatelessWidget {
  const _SentencePreview({required this.sentence, required this.mistakes});

  final String sentence;
  final List<ChatMistake> mistakes;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.only(left: 12),
      decoration: const BoxDecoration(
        border: Border(left: BorderSide(color: Colors.grey, width: 3)),
      ),
      child: RichText(
        text: TextSpan(
          style: const TextStyle(
              color: Colors.black,
              fontSize: 14,
              height: 1.6,
              fontWeight: FontWeight.normal),
          children: _highlightMistakes(sentence, mistakes),
        ),
      ),
    );
  }

  List<TextSpan> _highlightMistakes(
      String sentence, List<ChatMistake> mistakes) {
    final ranges = <_Range>[];
    for (final mistake in mistakes) {
      final original = mistake.original.trim();
      if (original.isEmpty) continue;
      final start = sentence.toLowerCase().indexOf(original.toLowerCase());
      if (start >= 0) ranges.add(_Range(start, start + original.length));
    }
    ranges.sort((a, b) => a.start.compareTo(b.start));

    final spans = <TextSpan>[];
    var cursor = 0;
    for (final range in ranges) {
      if (range.start < cursor) continue;
      if (range.start > cursor) {
        spans.add(TextSpan(text: sentence.substring(cursor, range.start)));
      }
      spans.add(TextSpan(
        text: sentence.substring(range.start, range.end),
        style: const TextStyle(
          color: Color(0xFFC92A2A),
          backgroundColor: Color(0xFFFFE3E3),
        ),
      ));
      cursor = range.end;
    }
    if (cursor < sentence.length) {
      spans.add(TextSpan(text: sentence.substring(cursor)));
    }
    return spans.isEmpty ? [TextSpan(text: sentence)] : spans;
  }
}

class _GrammarPanel extends StatelessWidget {
  const _GrammarPanel({required this.mistakes, required this.correctedText});

  final List<ChatMistake> mistakes;
  final String correctedText;

  @override
  Widget build(BuildContext context) {
    if (mistakes.isEmpty) {
      return _InfoLine(
          text: correctedText.isEmpty
              ? 'Ошибок грамматики не найдено.'
              : 'Правильно: $correctedText');
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Ошибки:',
            style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w500,
                color: Colors.black)),
        const SizedBox(height: 8),
        Table(
          columnWidths: const {
            0: FlexColumnWidth(2),
            1: FlexColumnWidth(1.5),
            2: FlexColumnWidth(1.5),
          },
          children: [
            TableRow(
              decoration: const BoxDecoration(color: Color(0xFFF1F3F5)),
              children: const [
                _TableHeader('Тип'),
                _TableHeader('Было'),
                _TableHeader('Правильно'),
              ],
            ),
            ...mistakes.map((e) => TableRow(
                  decoration: const BoxDecoration(
                      border: Border(
                          top: BorderSide(
                              color: Color(0xFFE9ECEF),
                              width: 0.5))),
                  children: [
                    _TableCell(_labelForType(e.type), color: const Color(0xFFC92A2A)),
                    _TableCell(e.original),
                    _TableCell(e.corrected, color: const Color(0xFF2F9E44)),
                  ],
                )),
          ],
        ),
      ],
    );
  }

  String _labelForType(String type) {
    final lower = type.toLowerCase();
    if (lower.contains('vocab')) return 'Словарь';
    if (lower.contains('pronunciation')) return 'Произношение';
    return 'Время глагола';
  }
}

class _PronunciationPanel extends StatelessWidget {
  const _PronunciationPanel({required this.mistakes});

  final List<ChatMistake> mistakes;

  @override
  Widget build(BuildContext context) {
    final word = mistakes.isEmpty ? 'meet' : mistakes.first.original;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const _AvatarIcon(
                icon: Icons.person_outline,
                bgColor: Color(0xFFE8F4FD)),
            const SizedBox(width: 8),
            const _IconBtn(icon: Icons.volume_up_outlined),
            const SizedBox(width: 8),
            const _AvatarIcon(
                icon: Icons.psychology_outlined,
                bgColor: Color(0xFFFFF3E0),
                iconColor: Color(0xFFE67700)),
            const SizedBox(width: 8),
            const _IconBtn(icon: Icons.volume_up_outlined),
            const Spacer(),
            const Text('PRACTICE',
                style:
                    TextStyle(fontSize: 12, color: Colors.grey)),
            const SizedBox(width: 8),
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: const Color(0xFFF1F3F5),
                shape: BoxShape.circle,
                border: Border.all(
                    color: Colors.grey[300]!,
                    width: 0.5),
              ),
              child: const Icon(Icons.mic,
                  size: 18, color: Color(0xFF3B5BDB)),
            ),
          ],
        ),
        const SizedBox(height: 18),
        Text(word,
            style: const TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w500,
                color: Colors.black)),
        const SizedBox(height: 8),
        Table(
          columnWidths: const {
            0: FlexColumnWidth(2),
            1: FlexColumnWidth(2),
            2: FlexColumnWidth(3),
          },
          children: [
            TableRow(
              decoration: const BoxDecoration(color: Color(0xFFF1F3F5)),
              children: const [
                _TableHeader('Syllable'),
                _TableHeader('Phone'),
                _TableHeader('Feedback'),
              ],
            ),
            TableRow(
              decoration: const BoxDecoration(
                  border: Border(
                      top: BorderSide(
                          color: Color(0xFFE9ECEF),
                          width: 0.5))),
              children: [
                _TableCell(word, bold: true),
                const _TableCell('/m/'),
                const _TableCell('Excellent!', color: Color(0xFF2F9E44)),
              ],
            ),
            const TableRow(
              decoration: BoxDecoration(
                  border: Border(
                      top: BorderSide(
                          color: Color(0xFFE9ECEF),
                          width: 0.5))),
              children: [
                _TableCell(''),
                _TableCell('/ii/'),
                _TableCell('Very good', color: Color(0xFF2F9E44)),
              ],
            ),
            const TableRow(
              decoration: BoxDecoration(
                  border: Border(
                      top: BorderSide(
                          color: Color(0xFFE9ECEF),
                          width: 0.5))),
              children: [
                _TableCell(''),
                _TableCell('/t/'),
                _TableCell('Sounded like d', color: Color(0xFFC92A2A)),
              ],
            ),
          ],
        ),
        const SizedBox(height: 16),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: List.generate(
            3,
            (i) => Container(
              margin: const EdgeInsets.symmetric(horizontal: 3),
              width: 7,
              height: 7,
              decoration: BoxDecoration(
                color:
                    i == 0 ? const Color(0xFF3B5BDB) : Colors.grey[300],
                shape: BoxShape.circle,
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _TableHeader extends StatelessWidget {
  final String text;
  const _TableHeader(this.text);
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(
            horizontal: 10, vertical: 7),
        child: Text(text,
            style: const TextStyle(
                fontSize: 12, color: Colors.grey)),
      );
}

class _TableCell extends StatelessWidget {
  final String text;
  final Color? color;
  final bool bold;
  const _TableCell(this.text, {this.color, this.bold = false});
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(
            horizontal: 10, vertical: 7),
        child: Text(text,
            style: TextStyle(
                fontSize: 13,
                color: color,
                fontWeight:
                    bold ? FontWeight.w500 : FontWeight.normal)),
      );
}

class _AvatarIcon extends StatelessWidget {
  final IconData icon;
  final Color bgColor;
  final Color iconColor;
  const _AvatarIcon(
      {required this.icon,
      required this.bgColor,
      this.iconColor = const Color(0xFF3B5BDB)});
  @override
  Widget build(BuildContext context) => Container(
        width: 32,
        height: 32,
        decoration: BoxDecoration(
            color: bgColor, shape: BoxShape.circle),
        child: Icon(icon, size: 16, color: iconColor),
      );
}

class _IconBtn extends StatelessWidget {
  final IconData icon;
  const _IconBtn({required this.icon});
  @override
  Widget build(BuildContext context) => Container(
        width: 28,
        height: 28,
        decoration: BoxDecoration(
          color: const Color(0xFF3B5BDB).withOpacity(0.12),
          shape: BoxShape.circle,
        ),
        child: Icon(icon, size: 15, color: const Color(0xFF3B5BDB)),
      );
}

class _ActionButton extends StatelessWidget {
  final IconData icon;
  final VoidCallback onTap;
  const _ActionButton({required this.icon, required this.onTap});

  @override
  Widget build(BuildContext context) => GestureDetector(
        onTap: onTap,
        child: Container(
          width: 28,
          height: 28,
          decoration: BoxDecoration(
            color: const Color(0xFF3B5BDB).withOpacity(0.12),
            shape: BoxShape.circle,
          ),
          child: Icon(icon, size: 15, color: const Color(0xFF3B5BDB)),
        ),
      );
}

class _CloseButton extends StatelessWidget {
  const _CloseButton({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Container(
        width: 32,
        height: 32,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: const Color(0xFFE9ECEF)),
        ),
        child: const Icon(Icons.close_rounded, size: 18, color: Colors.black87),
      ),
    );
  }
}

class _SheetHandle extends StatelessWidget {
  const _SheetHandle();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 36,
      height: 4,
      decoration: BoxDecoration(
          color: const Color(0xFFD9D9D9),
          borderRadius: BorderRadius.circular(99)),
    );
  }
}

class _InfoLine extends StatelessWidget {
  const _InfoLine({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(text,
        style: const TextStyle(
            fontSize: 14, height: 1.4, fontWeight: FontWeight.w500));
  }
}

class _DetailBlock extends StatelessWidget {
  const _DetailBlock({required this.label, required this.text});

  final String label;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFF3B5BDB).withOpacity(0.06),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE9ECEF)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label,
              style: const TextStyle(
                  color: Colors.grey,
                  fontSize: 12,
                  fontWeight: FontWeight.w500)),
          const SizedBox(height: 6),
          Text(
            text,
            style: const TextStyle(
                color: Color(0xFF0F172A),
                fontSize: 14,
                height: 1.45,
                fontWeight: FontWeight.normal),
          ),
        ],
      ),
    );
  }
}

class _Range {
  const _Range(this.start, this.end);

  final int start;
  final int end;
}
