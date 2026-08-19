// SP2 이전 로컬 타입. 실 API 연동 시 B의 OpenAPI 생성 타입(api/generated)으로 교체된다.
// docs/study/02-developer-b-workflow.md의 WaitingStatusResponse 개념을 판별 유니온으로 표현:
// 대기 중이면 rank만, 입장 허용되면 entryToken만 갖는다(둘 다 갖는 경우가 없어야 화면 분기가 명확해진다).
export type WaitingStatus =
  | { status: 'WAITING'; rank: number }
  | { status: 'ENTERED'; entryToken: string }
