export type AuthTokens = {
  access_token: string;
  refresh_token: string;
};

export type User = {
  id: string;
  email: string;
  name?: string;
  role?: string;
};
