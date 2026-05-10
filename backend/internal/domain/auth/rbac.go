package auth

var rolePermissions = map[string][]Permission{
	"admin": {AdminPermission, UserPermission},
	"user":  {UserPermission},
}