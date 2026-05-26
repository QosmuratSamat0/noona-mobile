class AppUser {
  const AppUser({required this.id, required this.email, this.name, this.role});

  final String id;
  final String email;
  final String? name;
  final String? role;

  factory AppUser.fromJson(Map<String, dynamic> json) {
    return AppUser(
      id: '${json['id']}',
      email: '${json['email']}',
      name: json['name'] as String?,
      role: json['role'] as String?,
    );
  }
}
