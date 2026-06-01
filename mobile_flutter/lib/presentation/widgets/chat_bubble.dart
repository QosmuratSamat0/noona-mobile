import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/material.dart';
import 'package:noona_mobile_flutter/domain/entities/chat_message.dart';

class ChatBubble extends StatefulWidget {
  const ChatBubble(this.message, {this.onTranslate, super.key});

  final ChatMessage message;
  final Future<void> Function(ChatMessage message)? onTranslate;

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

  Future<void> _playAudio(String emptyMessage) async {
    final audioUrl = message.audioUrl?.trim();
    debugPrint('sound button tapped, audioUrl=$audioUrl');
    if (_isPlaying) {
      await _player.stop();
      if (mounted) setState(() => _isPlaying = false);
      return;
    }
    if (audioUrl == null || audioUrl.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(emptyMessage)),
      );
      return;
    }

    try {
      setState(() => _isPlaying = true);
      await _player.stop();
      await _player.play(UrlSource(audioUrl));
      await _player.onPlayerComplete.first.timeout(
        const Duration(minutes: 2),
        onTimeout: () => const AudioEvent(eventType: AudioEventType.complete),
      );
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('Audio error: $error')));
    } finally {
      if (mounted) setState(() => _isPlaying = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isUser = message.role == 'user';
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
                      ? () => _playAudio('The audio reply is not ready yet.')
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
                      color: Colors.black.withValues(alpha: 0.06),
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
                    'tap for feedback',
                    style: TextStyle(
                      color: Colors.black.withValues(alpha: 0.35),
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
                    onTap: () => widget.onTranslate?.call(message),
                  ),
                  const SizedBox(width: 8),
                  _ActionButton(
                    icon: _isPlaying
                        ? Icons.stop_rounded
                        : Icons.volume_up_outlined,
                    onTap: () =>
                        _playAudio('The audio reply is not ready yet.'),
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
                    icon: _isPlaying
                        ? Icons.stop_rounded
                        : Icons.volume_up_outlined,
                    onTap: () => _playAudio('Original audio is not ready yet.'),
                  ),
                ],
              ],
            ),
            if (!isUser && message.translation?.trim().isNotEmpty == true) ...[
              const SizedBox(height: 6),
              Container(
                constraints: BoxConstraints(
                    maxWidth: MediaQuery.sizeOf(context).width * 0.78),
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(
                  color: const Color(0xFF3B5BDB).withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  message.translation!,
                  style: const TextStyle(
                    color: Color(0xFF334155),
                    fontSize: 13,
                    height: 1.35,
                  ),
                ),
              ),
            ],
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
      barrierColor: Colors.black.withValues(alpha: 0.42),
      backgroundColor: Colors.transparent,
      builder: (context) =>
          _FeedbackSheet(message: message, feedback: feedback),
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
    final sentence = feedback.original?.isNotEmpty == true
        ? feedback.original!
        : widget.message.text;
    final score = grammarTab
        ? _grammarScore(feedback, grammarMistakes, sentence)
        : _pronunciationScore(pronunciationMistakes, sentence);

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
                        _scoreLabel(score),
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

  int _grammarScore(
    ChatFeedback feedback,
    List<ChatMistake> mistakes,
    String sentence,
  ) {
    final wordCount = _wordCount(sentence);
    var issueCount = mistakes.length;

    if (issueCount == 0 &&
        _normalized(feedback.correctedText).isNotEmpty &&
        _normalized(feedback.correctedText) != _normalized(sentence)) {
      issueCount = _changedWordCount(sentence, feedback.correctedText);
    }

    if (issueCount == 0) return 100;
    final penalty = (issueCount / wordCount.clamp(1, 40)) * 60;
    return (100 - penalty).round().clamp(40, 99);
  }

  String _scoreLabel(int score) {
    if (score >= 80) return 'Well done!';
    if (score >= 60) return 'Good try!';
    if (score >= 40) return 'Keep practicing!';
    return 'Try again!';
  }

  int _pronunciationScore(List<ChatMistake> mistakes, String sentence) {
    if (mistakes.isEmpty) return 100;
    final wordCount = _wordCount(sentence);
    final penalty = (mistakes.length / wordCount.clamp(1, 40)) * 55;
    return (100 - penalty).round().clamp(45, 99);
  }

  int _wordCount(String text) {
    final words = RegExp(r"[A-Za-z]+(?:'[A-Za-z]+)?")
        .allMatches(text)
        .map((match) => match.group(0))
        .whereType<String>()
        .toList();
    return words.isEmpty ? 1 : words.length;
  }

  int _changedWordCount(String original, String corrected) {
    final originalWords = _words(original);
    final correctedWords = _words(corrected);
    if (originalWords.isEmpty && correctedWords.isEmpty) return 0;
    final common =
        _longestCommonSubsequenceLength(originalWords, correctedWords);
    final changed = [originalWords.length, correctedWords.length]
            .reduce((a, b) => a > b ? a : b) -
        common;
    return changed.clamp(1, _wordCount(original));
  }

  int _longestCommonSubsequenceLength(List<String> a, List<String> b) {
    final dp =
        List.generate(a.length + 1, (_) => List<int>.filled(b.length + 1, 0));
    for (var i = 1; i <= a.length; i++) {
      for (var j = 1; j <= b.length; j++) {
        if (a[i - 1] == b[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
        } else {
          dp[i][j] = dp[i - 1][j] > dp[i][j - 1] ? dp[i - 1][j] : dp[i][j - 1];
        }
      }
    }
    return dp[a.length][b.length];
  }

  List<String> _words(String text) {
    return RegExp(r"[A-Za-z]+(?:'[A-Za-z]+)?")
        .allMatches(text.toLowerCase())
        .map((match) => match.group(0))
        .whereType<String>()
        .toList();
  }

  String _normalized(String text) {
    return _words(text).join(' ');
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
                      color: Colors.black.withValues(alpha: 0.1), blurRadius: 3)
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
              ? 'No grammar mistakes found.'
              : 'Correct: $correctedText');
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Mistakes:',
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
            const TableRow(
              decoration: BoxDecoration(color: Color(0xFFF1F3F5)),
              children: [
                _TableHeader('Type'),
                _TableHeader('Original'),
                _TableHeader('Correct'),
              ],
            ),
            ...mistakes.map((e) => TableRow(
                  decoration: const BoxDecoration(
                      border: Border(
                          top: BorderSide(
                              color: Color(0xFFE9ECEF), width: 0.5))),
                  children: [
                    _TableCell(_labelForType(e.type),
                        color: const Color(0xFFC92A2A)),
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
    if (lower.contains('vocab')) return 'Vocabulary';
    if (lower.contains('pronunciation')) return 'Pronunciation';
    if (lower.contains('tense')) return 'Verb tense';
    return 'Grammar';
  }
}

class _PronunciationPanel extends StatelessWidget {
  const _PronunciationPanel({required this.mistakes});

  final List<ChatMistake> mistakes;

  @override
  Widget build(BuildContext context) {
    if (mistakes.isEmpty) {
      return const _InfoLine(
        text: 'No pronunciation issues detected from this recording.',
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Pronunciation notes:',
          style: TextStyle(
              fontSize: 13, fontWeight: FontWeight.w500, color: Colors.black),
        ),
        const SizedBox(height: 8),
        Table(
          columnWidths: const {
            0: FlexColumnWidth(2),
            1: FlexColumnWidth(2),
            2: FlexColumnWidth(3),
          },
          children: [
            const TableRow(
              decoration: BoxDecoration(color: Color(0xFFF1F3F5)),
              children: [
                _TableHeader('Heard'),
                _TableHeader('Target'),
                _TableHeader('Practice'),
              ],
            ),
            ...mistakes.map((mistake) => TableRow(
                  decoration: const BoxDecoration(
                      border: Border(
                          top: BorderSide(
                              color: Color(0xFFE9ECEF), width: 0.5))),
                  children: [
                    _TableCell(mistake.original),
                    _TableCell(mistake.corrected,
                        color: const Color(0xFF2F9E44)),
                    _TableCell(_practiceTip(mistake.corrected)),
                  ],
                )),
          ],
        ),
      ],
    );
  }

  String _practiceTip(String target) {
    final clean = target.trim();
    if (clean.isEmpty) return 'Repeat it slowly, then at normal speed.';
    return 'Say "$clean" slowly, then repeat it in the full sentence.';
  }
}

class _TableHeader extends StatelessWidget {
  final String text;
  const _TableHeader(this.text);
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
        child: Text(text,
            style: const TextStyle(fontSize: 12, color: Colors.grey)),
      );
}

class _TableCell extends StatelessWidget {
  final String text;
  final Color? color;
  const _TableCell(this.text, {this.color});

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
        child: Text(text,
            style: TextStyle(
                fontSize: 13, color: color, fontWeight: FontWeight.normal)),
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
            color: const Color(0xFF3B5BDB).withValues(alpha: 0.12),
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

class _Range {
  const _Range(this.start, this.end);

  final int start;
  final int end;
}
