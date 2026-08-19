import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/api/queryKeys'
import { authApi } from './api'
import { useAuthStore } from './store'
import type { ChangePasswordRequest, LoginRequest, SignupRequest, UpdateProfileRequest } from './types'

export function useSignup() {
  return useMutation({
    mutationFn: (payload: SignupRequest) => authApi.signup(payload),
    retry: 0,
  })
}

export function useLogin() {
  const setSession = useAuthStore((s) => s.setSession)

  return useMutation({
    mutationFn: async (payload: LoginRequest) => {
      const token = await authApi.login(payload)
      // fetchMe는 api/client.ts가 store에서 토큰을 읽어 주입하므로, 유저 정보를 받아오기 전에 먼저 토큰을 반영해야 한다.
      useAuthStore.setState({ accessToken: token.accessToken })
      const user = await authApi.fetchMe()
      setSession(token.accessToken, user)
      return user
    },
    retry: 0,
  })
}

export function useMe() {
  const accessToken = useAuthStore((s) => s.accessToken)

  return useQuery({
    queryKey: queryKeys.auth.me,
    queryFn: authApi.fetchMe,
    enabled: !!accessToken,
  })
}

// 좌석 선점/해제/확정과 달리 프로필 수정은 도메인 동시성 제약이 없지만, 팀 관례상 뮤테이션은
// retry:0으로 통일한다(중복 제출 방지).
export function useUpdateProfile() {
  const updateUser = useAuthStore((s) => s.updateUser)
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: UpdateProfileRequest) => authApi.updateMe(payload),
    retry: 0,
    onSuccess: (user) => {
      // Header 등은 useMe()가 아니라 authStore.user를 직접 구독하므로 스토어를 즉시 갱신한다.
      updateUser(user)
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.me })
    },
  })
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (payload: ChangePasswordRequest) => authApi.changePassword(payload),
    retry: 0,
  })
}
