// 쿼리 키 팩토리. feature별 hooks.ts에서 이 팩토리를 통해서만 키를 만든다(임의 문자열 배열 금지).
export const queryKeys = {
  catalog: {
    all: ['catalog', 'performances'] as const,
    list: () => [...queryKeys.catalog.all, 'list'] as const,
  },
  auth: {
    me: ['auth', 'me'] as const,
  },
}
