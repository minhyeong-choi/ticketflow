// SP2에서 springdoc-openapi 도입 후 api/generated/의 생성 타입으로 교체될 자리.
// 지금은 domain/user의 실제 DTO(SignupRequest/LoginRequest/UserResponse/TokenResponse)를 손으로 옮겨적은 것.
// 이 예외는 이 파일 하나로 한정한다 (docs 참고: FRONTEND.md 3절, 이번 스캐폴딩 계획 1절).

export type UserRole = 'USER' | 'ADMIN'

export interface SignupRequest {
  email: string
  password: string
  name: string
}

export interface LoginRequest {
  email: string
  password: string
}

export interface TokenResponse {
  accessToken: string
}

export interface UserResponse {
  id: number
  email: string
  name: string
  phone: string | null
  role: UserRole
}

export interface UpdateProfileRequest {
  name: string
  phone?: string | null
}

export interface ChangePasswordRequest {
  currentPassword: string
  newPassword: string
}
