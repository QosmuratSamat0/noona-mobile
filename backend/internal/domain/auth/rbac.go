package auth

import "github.com/QosmuratSamat0/Noona-AI/backend/internal/domain/user"

var rolePermissions = map[user.Role][]Permission{
	user.RoleAdmin: {AdminPermission, UserPermission},
	user.RoleUser:  {UserPermission},
}

func HasPermission(role user.Role, permission Permission) bool {
	perms, ok := rolePermissions[role]
	if !ok {
		return false
	}

	for _, p := range perms {
		if p == permission {
			return true
		}
	}
	return false
}
