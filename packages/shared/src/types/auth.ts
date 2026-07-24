export type UserRole = "USER" | "ADMIN";

export interface UserPublic {
  id: string;
  email: string;
  name?: string | null;
  role: UserRole;
  createdAt?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name?: string;
}

export interface JWTPayload {
  userId: string;
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

export interface AuthTokenResponse {
  token: string;
  user: UserPublic;
}
