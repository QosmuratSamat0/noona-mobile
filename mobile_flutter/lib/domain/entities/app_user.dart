class AppUser {
  const AppUser({
    required this.id,
    required this.email,
    this.name,
    this.role,
    this.cefrLevel = 'A1',
    this.nativeLanguage = 'ru',
  });

  final String id;
  final String email;
  final String? name;
  final String? role;
  final String cefrLevel;
  final String nativeLanguage;

  AppUser copyWith({String? cefrLevel, String? nativeLanguage}) {
    return AppUser(
      id: id,
      email: email,
      name: name,
      role: role,
      cefrLevel: cefrLevel ?? this.cefrLevel,
      nativeLanguage: nativeLanguage ?? this.nativeLanguage,
    );
  }

  factory AppUser.fromJson(Map<String, dynamic> json) {
    return AppUser(
      id: '${json['id']}',
      email: '${json['email']}',
      name: json['name'] as String?,
      role: json['role'] as String?,
      cefrLevel: '${json['cefr_level'] ?? 'A1'}',
      nativeLanguage: '${json['native_language'] ?? 'ru'}',
    );
  }
}
