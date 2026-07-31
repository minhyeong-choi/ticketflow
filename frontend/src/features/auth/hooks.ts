import { useMutation, useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/api/queryKeys'
import { authApi } from './api'
import { useAuthStore } from './store'
import type { LoginRequest, SignupRequest } from './types'

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
