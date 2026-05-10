package auth

type Permission string

const (
	AdminPermission Permission = "admin"
	UserPermission   Permission = "user"
)
