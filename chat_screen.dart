import 'package:flutter/material.dart';

// ─── Entry point (remove if using inside existing app) ───────────────────────
void main() => runApp(const NoonaApp());

class NoonaApp extends StatelessWidget {
  const NoonaApp({super.key});
  @override
  Widget build(BuildContext context) => MaterialApp(
        debugShowCheckedModeBanner: false,
        theme: NoonaTheme.light(),
        home: const ChatScreen(),
      );
}

// ─── Theme ────────────────────────────────────────────────────────────────────
class NoonaTheme {
  static const primary = Color(0xFF3B5BDB);
  static const bg = Color(0xFFF0F4FF);
  static const white = Colors.white;
  static const good = Color(0xFF2F9E44);
  static const bad = Color(0xFFC92A2A);
  static const mark = Color(0xFFFFE3E3);

  static ThemeData light() => ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: primary),
        scaffoldBackgroundColor: bg,
        fontFamily: 'SF Pro Text',
        useMaterial3: true,
      );
}

// ─── Models ───────────────────────────────────────────────────────────────────
enum MessageRole { user, ai }

class ChatMessage {
  final String text;
  final MessageRole role;
  final AnalysisResult? analysis;

  const ChatMessage({
    required this.text,
    required this.role,
    this.analysis,
  });
}

class AnalysisResult {
  final int grammarScore;
  final int pronunciationScore;
  final List<GrammarError> grammarErrors;
  final List<PhonemeResult> phonemes;
  final String targetWord;

  const AnalysisResult({
    required this.grammarScore,
    required this.pronunciationScore,
    required this.grammarErrors,
    required this.phonemes,
    required this.targetWord,
  });
}

class GrammarError {
  final String errorType;
  final String wrong;
  final String correct;
  const GrammarError(this.errorType, this.wrong, this.correct);
}

class PhonemeResult {
  final String phone;
  final String feedback;
  final bool isGood;
  const PhonemeResult(this.phone, this.feedback, {required this.isGood});
}

// ─── Demo data ────────────────────────────────────────────────────────────────
final _demoMessages = [
  const ChatMessage(
    role: MessageRole.ai,
    text: 'Tell me about your day. What did you do this morning?',
  ),
  ChatMessage(
    role: MessageRole.user,
    text: 'I go to work yesterday and meet my friend there.',
    analysis: AnalysisResult(
      grammarScore: 71,
      pronunciationScore: 93,
      grammarErrors: const [
        GrammarError('Время глагола', 'go', 'went'),
        GrammarError('Время глагола', 'meet', 'met'),
      ],
      phonemes: const [
        PhonemeResult('/m/', 'Excellent!', isGood: true),
        PhonemeResult('/ii/', 'Very good', isGood: true),
        PhonemeResult('/t/', 'Sounded like d', isGood: false),
      ],
      targetWord: 'meet',
    ),
  ),
  const ChatMessage(
    role: MessageRole.ai,
    text:
        'Good try! Use past tense — "I went to work yesterday and met my friend." Try again! 💪',
  ),
];

// ─── Chat Screen ──────────────────────────────────────────────────────────────
class ChatScreen extends StatelessWidget {
  const ChatScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: _buildAppBar(context),
      body: Column(
        children: [
          Expanded(
            child: ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: _demoMessages.length,
              separatorBuilder: (_, __) => const SizedBox(height: 14),
              itemBuilder: (context, i) {
                final msg = _demoMessages[i];
                return msg.role == MessageRole.user
                    ? _UserBubble(message: msg)
                    : _AiBubble(message: msg);
              },
            ),
          ),
          _InputBar(),
        ],
      ),
    );
  }

  PreferredSizeWidget _buildAppBar(BuildContext context) {
    return AppBar(
      backgroundColor: NoonaTheme.primary,
      foregroundColor: Colors.white,
      title: Row(
        children: [
          CircleAvatar(
            radius: 18,
            backgroundColor: Colors.white.withOpacity(0.2),
            child: const Icon(Icons.psychology_outlined,
                color: Colors.white, size: 20),
          ),
          const SizedBox(width: 10),
          const Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Noona AI',
                  style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w500,
                      color: Colors.white)),
              Text('Разговорная практика',
                  style: TextStyle(
                      fontSize: 11, color: Colors.white70)),
            ],
          ),
        ],
      ),
      actions: [
        Container(
          margin: const EdgeInsets.only(right: 12),
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
          decoration: BoxDecoration(
            color: Colors.white.withOpacity(0.15),
            borderRadius: BorderRadius.circular(20),
          ),
          child: const Row(
            children: [
              Icon(Icons.local_fire_department,
                  color: Colors.white, size: 16),
              SizedBox(width: 4),
              Text('7 дней',
                  style:
                      TextStyle(color: Colors.white, fontSize: 12)),
            ],
          ),
        ),
      ],
    );
  }
}

// ─── AI Bubble ────────────────────────────────────────────────────────────────
class _AiBubble extends StatelessWidget {
  final ChatMessage message;
  const _AiBubble({required this.message});

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.centerLeft,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            constraints: BoxConstraints(
                maxWidth: MediaQuery.of(context).size.width * 0.78),
            padding:
                const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(
              color: NoonaTheme.white,
              borderRadius: const BorderRadius.only(
                topLeft: Radius.circular(20),
                topRight: Radius.circular(20),
                bottomRight: Radius.circular(20),
                bottomLeft: Radius.circular(5),
              ),
              boxShadow: [
                BoxShadow(
                    color: Colors.black.withOpacity(0.06),
                    blurRadius: 4,
                    offset: const Offset(0, 1))
              ],
            ),
            child: Text(message.text,
                style: const TextStyle(fontSize: 14, height: 1.5)),
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              _ActionButton(
                  icon: Icons.translate, onTap: () {}),
              const SizedBox(width: 8),
              _ActionButton(
                  icon: Icons.volume_up_outlined, onTap: () {}),
            ],
          ),
        ],
      ),
    );
  }
}

// ─── User Bubble ──────────────────────────────────────────────────────────────
class _UserBubble extends StatelessWidget {
  final ChatMessage message;
  const _UserBubble({required this.message});

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.centerRight,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          GestureDetector(
            onTap: () => _showAnalysis(context),
            child: Container(
              constraints: BoxConstraints(
                  maxWidth: MediaQuery.of(context).size.width * 0.78),
              padding:
                  const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: const BoxDecoration(
                color: NoonaTheme.primary,
                borderRadius: BorderRadius.only(
                  topLeft: Radius.circular(20),
                  topRight: Radius.circular(20),
                  bottomLeft: Radius.circular(20),
                  bottomRight: Radius.circular(5),
                ),
              ),
              child: Text(
                message.text,
                style: const TextStyle(
                    fontSize: 14, color: Colors.white, height: 1.5),
              ),
            ),
          ),
          const SizedBox(height: 6),
          // ── action buttons under user bubble ──
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              _UserActionButton(
                icon: Icons.bar_chart,
                onTap: () => _showAnalysis(context),
              ),
              const SizedBox(width: 8),
              _UserActionButton(
                  icon: Icons.refresh, onTap: () {}),
              const SizedBox(width: 8),
              _UserActionButton(
                  icon: Icons.volume_up_outlined, onTap: () {}),
            ],
          ),
        ],
      ),
    );
  }

  void _showAnalysis(BuildContext context) {
    if (message.analysis == null) return;
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => AnalysisModal(analysis: message.analysis!),
    );
  }
}

// ─── Action buttons ───────────────────────────────────────────────────────────
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
            color: NoonaTheme.primary.withOpacity(0.12),
            shape: BoxShape.circle,
          ),
          child: Icon(icon, size: 15, color: NoonaTheme.primary),
        ),
      );
}

class _UserActionButton extends StatelessWidget {
  final IconData icon;
  final VoidCallback onTap;
  const _UserActionButton({required this.icon, required this.onTap});

  @override
  Widget build(BuildContext context) => GestureDetector(
        onTap: onTap,
        child: Container(
          width: 28,
          height: 28,
          decoration: BoxDecoration(
            color: NoonaTheme.primary.withOpacity(0.12),
            shape: BoxShape.circle,
          ),
          child: Icon(icon, size: 15, color: NoonaTheme.primary),
        ),
      );
}

// ─── Input Bar ────────────────────────────────────────────────────────────────
class _InputBar extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      color: NoonaTheme.bg,
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
      child: Column(
        children: [
          const Text('Нажми и говори',
              style: TextStyle(fontSize: 11, color: Colors.grey)),
          const SizedBox(height: 8),
          GestureDetector(
            onTap: () {},
            child: Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                color: const Color(0xFFE03131),
                shape: BoxShape.circle,
                boxShadow: [
                  BoxShadow(
                      color: const Color(0xFFE03131).withOpacity(0.35),
                      blurRadius: 8,
                      offset: const Offset(0, 2))
                ],
              ),
              child: const Icon(Icons.mic, color: Colors.white, size: 26),
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Analysis Modal ───────────────────────────────────────────────────────────
class AnalysisModal extends StatefulWidget {
  final AnalysisResult analysis;
  const AnalysisModal({super.key, required this.analysis});

  @override
  State<AnalysisModal> createState() => _AnalysisModalState();
}

class _AnalysisModalState extends State<AnalysisModal>
    with SingleTickerProviderStateMixin {
  late TabController _tabs;

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 2, vsync: this, initialIndex: 1);
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 32),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // handle
          Container(
            margin: const EdgeInsets.only(top: 12, bottom: 16),
            width: 36,
            height: 4,
            decoration: BoxDecoration(
              color: Colors.grey[300],
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          // close button
          Align(
            alignment: Alignment.topRight,
            child: GestureDetector(
              onTap: () => Navigator.pop(context),
              child: Container(
                width: 28,
                height: 28,
                decoration: BoxDecoration(
                    color: Colors.grey[100],
                    shape: BoxShape.circle),
                child: const Icon(Icons.close, size: 16),
              ),
            ),
          ),
          const SizedBox(height: 4),
          // tab bar
          Container(
            height: 38,
            decoration: BoxDecoration(
              color: Colors.grey[100],
              borderRadius: BorderRadius.circular(20),
            ),
            child: TabBar(
              controller: _tabs,
              indicator: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                boxShadow: [
                  BoxShadow(
                      color: Colors.black.withOpacity(0.1),
                      blurRadius: 3)
                ],
              ),
              indicatorSize: TabBarIndicatorSize.tab,
              dividerColor: Colors.transparent,
              labelColor: Colors.black,
              unselectedLabelColor: Colors.grey,
              labelStyle: const TextStyle(
                  fontSize: 13, fontWeight: FontWeight.w500),
              tabs: const [
                Tab(text: 'Grammar'),
                Tab(text: 'Pronunciation'),
              ],
            ),
          ),
          const SizedBox(height: 16),
          // tab content
          SizedBox(
            height: 320,
            child: TabBarView(
              controller: _tabs,
              children: [
                _GrammarTab(analysis: widget.analysis),
                _PronunciationTab(analysis: widget.analysis),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Grammar Tab ──────────────────────────────────────────────────────────────
class _GrammarTab extends StatelessWidget {
  final AnalysisResult analysis;
  const _GrammarTab({required this.analysis});

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text('${analysis.grammarScore}%',
                  style: const TextStyle(
                      fontSize: 28,
                      fontWeight: FontWeight.w500,
                      color: NoonaTheme.good)),
              const SizedBox(width: 8),
              const Text('неплохо!',
                  style: TextStyle(
                      fontSize: 14, color: NoonaTheme.good)),
            ],
          ),
          const SizedBox(height: 8),
          // highlighted sentence
          Container(
            padding: const EdgeInsets.symmetric(
                horizontal: 12, vertical: 8),
            decoration: const BoxDecoration(
              border: Border(
                  left: BorderSide(color: Colors.grey, width: 3)),
            ),
            child: const Text.rich(
              TextSpan(children: [
                TextSpan(text: 'I '),
                TextSpan(
                    text: 'go',
                    style: TextStyle(
                        backgroundColor: NoonaTheme.mark,
                        color: NoonaTheme.bad)),
                TextSpan(
                    text:
                        ' to work yesterday and '),
                TextSpan(
                    text: 'meet',
                    style: TextStyle(
                        backgroundColor: NoonaTheme.mark,
                        color: NoonaTheme.bad)),
                TextSpan(text: ' my friend there.'),
              ]),
              style: TextStyle(fontSize: 14, height: 1.6),
            ),
          ),
          const SizedBox(height: 14),
          const Text('Ошибки:',
              style: TextStyle(
                  fontSize: 13, fontWeight: FontWeight.w500)),
          const SizedBox(height: 8),
          Table(
            columnWidths: const {
              0: FlexColumnWidth(2),
              1: FlexColumnWidth(1.5),
              2: FlexColumnWidth(1.5),
            },
            children: [
              TableRow(
                decoration:
                    BoxDecoration(color: Colors.grey[100]),
                children: const [
                  _TableHeader('Тип'),
                  _TableHeader('Было'),
                  _TableHeader('Правильно'),
                ],
              ),
              ...analysis.grammarErrors.map((e) => TableRow(
                    decoration: BoxDecoration(
                        border: Border(
                            top: BorderSide(
                                color: Colors.grey[200]!,
                                width: 0.5))),
                    children: [
                      _TableCell(e.errorType,
                          color: NoonaTheme.bad),
                      _TableCell(e.wrong),
                      _TableCell(e.correct,
                          color: NoonaTheme.good),
                    ],
                  )),
            ],
          ),
        ],
      ),
    );
  }
}

// ─── Pronunciation Tab ────────────────────────────────────────────────────────
class _PronunciationTab extends StatelessWidget {
  final AnalysisResult analysis;
  const _PronunciationTab({required this.analysis});

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text('${analysis.pronunciationScore}%',
                  style: const TextStyle(
                      fontSize: 28,
                      fontWeight: FontWeight.w500,
                      color: NoonaTheme.good)),
              const SizedBox(width: 8),
              const Text('Well done!',
                  style: TextStyle(
                      fontSize: 14, color: NoonaTheme.good)),
            ],
          ),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.symmetric(
                horizontal: 12, vertical: 8),
            decoration: const BoxDecoration(
              border: Border(
                  left: BorderSide(color: Colors.grey, width: 3)),
            ),
            child: const Text.rich(
              TextSpan(children: [
                TextSpan(
                    text:
                        'I go to work yesterday and '),
                TextSpan(
                    text: 'meet',
                    style: TextStyle(
                        backgroundColor: NoonaTheme.mark,
                        color: NoonaTheme.bad)),
                TextSpan(text: ' my friend there.'),
              ]),
              style: TextStyle(fontSize: 14, height: 1.6),
            ),
          ),
          const SizedBox(height: 12),
          // listen row
          Row(
            children: [
              _AvatarIcon(
                  icon: Icons.person_outline,
                  bgColor: const Color(0xFFE8F4FD)),
              const SizedBox(width: 8),
              _IconBtn(icon: Icons.volume_up_outlined),
              const SizedBox(width: 8),
              _AvatarIcon(
                  icon: Icons.psychology_outlined,
                  bgColor: const Color(0xFFFFF3E0),
                  iconColor: const Color(0xFFE67700)),
              const SizedBox(width: 8),
              _IconBtn(icon: Icons.volume_up_outlined),
              const Spacer(),
              const Text('PRACTICE',
                  style:
                      TextStyle(fontSize: 12, color: Colors.grey)),
              const SizedBox(width: 8),
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: Colors.grey[100],
                  shape: BoxShape.circle,
                  border: Border.all(
                      color: Colors.grey[300]!,
                      width: 0.5),
                ),
                child: const Icon(Icons.mic,
                    size: 18, color: NoonaTheme.primary),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(analysis.targetWord,
              style: const TextStyle(
                  fontSize: 18, fontWeight: FontWeight.w500)),
          const SizedBox(height: 8),
          Table(
            columnWidths: const {
              0: FlexColumnWidth(2),
              1: FlexColumnWidth(2),
              2: FlexColumnWidth(3),
            },
            children: [
              TableRow(
                decoration:
                    BoxDecoration(color: Colors.grey[100]),
                children: const [
                  _TableHeader('Syllable'),
                  _TableHeader('Phone'),
                  _TableHeader('Feedback'),
                ],
              ),
              ...analysis.phonemes.map((p) => TableRow(
                    decoration: BoxDecoration(
                        border: Border(
                            top: BorderSide(
                                color: Colors.grey[200]!,
                                width: 0.5))),
                    children: [
                      _TableCell(
                          analysis.phonemes.indexOf(p) == 0
                              ? analysis.targetWord
                              : '',
                          bold: analysis.phonemes.indexOf(p) ==
                              0),
                      _TableCell(p.phone),
                      _TableCell(p.feedback,
                          color: p.isGood
                              ? NoonaTheme.good
                              : NoonaTheme.bad),
                    ],
                  )),
            ],
          ),
          const SizedBox(height: 16),
          // dots
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
                      i == 0 ? NoonaTheme.primary : Colors.grey[300],
                  shape: BoxShape.circle,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Small helpers ────────────────────────────────────────────────────────────
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
      this.iconColor = NoonaTheme.primary});
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
            color: Colors.grey[100], shape: BoxShape.circle),
        child: Icon(icon, size: 15, color: Colors.grey[600]),
      );
}
