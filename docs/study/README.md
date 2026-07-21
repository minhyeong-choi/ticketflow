# ticketFlow 개발 워크플로우 학습 문서

이 폴더는 **"무엇을 만들지"가 아니라 "어떤 순서로, 어떻게 만들지"**를 설명하는 문서입니다.

- `docs/ROADMAP.md` = **무엇을** 언제까지 만드는가 (계획서)
- `CLAUDE.md` = **어겨선 안 되는 규칙** (협업 제약)
- `docs/study/` = **어떻게 만드는가** (이 폴더, 실습 가이드)

## 읽는 순서

| 순서 | 문서 | 대상 | 내용 |
|---|---|---|---|
| 1 | [00-common-workflow.md](00-common-workflow.md) | **A, B 모두 필수** | 레이어 구조, 엔티티 작성법, DTO/예외/응답 규격, Git 흐름, 기능 하나 만드는 8단계 사이클 |
| 2 | [01-developer-a-workflow.md](01-developer-a-workflow.md) | 개발자 A | `booking`, `payment` — 주차별 진행 순서 |
| 2 | [02-developer-b-workflow.md](02-developer-b-workflow.md) | 개발자 B | `user`, `performance`, `waitingroom`, `notification` — 주차별 진행 순서 |

**00번을 건너뛰지 마세요.** A/B 문서는 00번에서 설명한 용어와 패턴을 이미 안다고 가정하고 쓰여 있습니다.

## 이 문서들을 쓰는 방법

1. 주차가 시작되면 본인 문서의 해당 주차 섹션을 **끝까지 한 번 읽습니다**. (중간부터 읽으면 순서가 꼬입니다)
2. "만들 파일" 목록을 그대로 브랜치의 할 일로 옮깁니다.
3. 각 단계를 따라가며 코드를 작성합니다. 문서의 코드는 **베껴 쓰라고 있는 게 아니라 형태를 보여주려고** 있습니다. 필드 이름·로직은 본인이 스키마를 보고 채웁니다.
4. "완료 확인" 항목을 직접 실행해서 통과하면 PR을 올립니다.

## 막혔을 때 확인 순서

1. **에러 메시지 첫 줄과 `Caused by:` 마지막 줄**을 먼저 읽습니다. (스택트레이스 전체를 읽지 마세요)
2. [00-common-workflow.md의 "자주 만나는 에러"](00-common-workflow.md#11-자주-만나는-에러와-읽는-법) 섹션에서 찾습니다.
3. 스키마 관련이면 `src/main/resources/db/migration/V1__init.sql`이 정답지입니다.
4. 그래도 모르면 **30분 넘게 붙잡지 말고** 상대 개발자에게 물어보세요. 2인 팀에서 혼자 막혀 있는 시간이 가장 비쌉니다.

## 검색할 때 주의 (중요)

이 프로젝트는 **버전이 매우 최신**입니다. 구글/블로그 예제 대부분이 그대로는 컴파일되지 않습니다.

| 기술 | 이 프로젝트 | 인터넷 예제 대부분 | 결과 |
|---|---|---|---|
| Spring Security | **7.1** | 5.x | `WebSecurityConfigurerAdapter`, `antMatchers()` → 없는 클래스/메서드 |
| jjwt | **0.12.6** | 0.11.x | `parserBuilder()`, `parseClaimsJws()` → 없는 메서드 |
| Spring Boot | **4.1.0** | 2.x / 3.x | `javax.*` → `jakarta.*` |
| Java | **26** | 8 / 11 | 문법은 호환되지만 `record`, `var`를 안 쓰는 낡은 코드 |

검색할 때는 **버전을 명시**하세요. `"spring security jwt"` 대신 `"spring security 6 SecurityFilterChain jwt"`처럼요.
