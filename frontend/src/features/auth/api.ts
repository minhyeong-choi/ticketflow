import { apiClient } from '@/api/client'
import type {
  ChangePasswordRequest,
  LoginRequest,
  SignupRequest,
  TokenResponse,
  UpdateProfileRequest,
  UserResponse,
} from './types'

export const authApi = {
  signup: (payload: SignupRequest) =>
    apiClient.post<null>('/api/auth/signup', payload, { skipAuth: true }),
  login: (payload: LoginRequest) =>
    apiClient.post<TokenResponse>('/api/auth/login', payload, { skipAuth: true }),
  fetchMe: () => apiClient.get<UserResponse>('/api/users/me'),
  updateMe: (payload: UpdateProfileRequest) => apiClient.patch<UserResponse>('/api/users/me', payload),
  changePassword: (payload: ChangePasswordRequest) =>
    apiClient.patch<null>('/api/users/me/password', payload),
}
