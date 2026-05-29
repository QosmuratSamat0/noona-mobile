class AppUser {
  const AppUser({
    required this.id,
    required this.email,
    this.name,
    this.role,
    this.cefrLevel = 'A1',
  });

  final String id;
  final String email;
  final String? name;
  final String? role;
  final String cefrLevel;

  AppUser copyWith({String? cefrLevel}) {
    return AppUser(
      id: id,
      email: email,
      name: name,
      role: role,
      cefrLevel: cefrLevel ?? this.cefrLevel,
    );
  }

  factory AppUser.fromJson(Map<String, dynamic> json) {
    return AppUser(
      id: '${json['id']}',
      email: '${json['email']}',
      name: json['name'] as String?,
      role: json['role'] as String?,
      cefrLevel: '${json['cefr_level'] ?? 'A1'}',
    );
  }
}
