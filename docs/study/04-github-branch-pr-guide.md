# GitHub 브랜치, 커밋, PR 입문 가이드

이 문서는 GitHub를 처음 사용하는 개발자가 이 프로젝트에서 작업을 올리는 흐름을 이해할 수 있도록 정리한 가이드입니다.

핵심은 하나입니다.

```text
작업 하나 = 브랜치 하나 = PR 하나
```

파일 하나를 고칠 때마다 브랜치를 새로 만드는 것이 아닙니다. **의미 있는 작업 단위마다** 브랜치를 새로 만듭니다.

---

## 1. 기본 용어

### Repository

프로젝트 코드가 저장된 공간입니다.

이 프로젝트의 로컬 저장소는 다음 경로입니다.

```text
/Users/donghun0425/workspace/ticketflow
```

GitHub에 있는 원격 저장소는 `origin`이라고 부릅니다.

확인은 터미널에서 이렇게 합니다.

```bash
git remote -v
```

### Branch

브랜치는 작업용 가지입니다.

```text
master 또는 main = 팀이 공유하는 기준 코드
feat/jpa-entities = JPA 엔티티 작업용 가지
docs/jpa-entity-guide = 문서 작업용 가지
```

기준 코드에 바로 작업하지 않고, 작업용 브랜치에서 수정한 뒤 PR로 합칩니다.

### Commit

커밋은 변경사항의 저장 지점입니다.

예를 들어 문서를 추가했다면 이런 커밋을 만듭니다.

```text
docs: SQL 기반 JPA 엔티티 작성 가이드 추가
```

### Push

push는 내 컴퓨터의 커밋을 GitHub에 올리는 일입니다.

```text
내 컴퓨터 브랜치
→ GitHub 원격 브랜치
```

### Pull Request

PR은 내가 작업한 브랜치를 기준 브랜치에 합쳐달라는 요청입니다.

```text
feat/jpa-entities 브랜치 작업이 끝났습니다.
master에 합쳐도 되는지 리뷰해주세요.
```

---

## 2. 전체 작업 흐름

작업 하나를 시작할 때마다 보통 아래 순서로 진행합니다.

```text
1. 기준 브랜치로 이동
2. 최신 코드 받기
3. 새 작업 브랜치 만들기
4. 코드 또는 문서 수정
5. 변경사항 확인
6. 커밋
7. push
8. GitHub에서 PR 생성
9. 리뷰 후 merge
10. 다음 작업은 다시 기준 브랜치에서 시작
```

터미널로 쓰면 아래와 같습니다.

```bash
git switch master
git pull
git switch -c docs/jpa-entity-guide

# 파일 수정

git status
git add docs/study/03-jpa-entity-from-sql-guide.md docs/study/README.md
git commit -m "docs: SQL 기반 JPA 엔티티 작성 가이드 추가"
git push -u origin docs/jpa-entity-guide
```

---

## 3. 브랜치는 언제 새로 만드는가

브랜치는 **작업 단위**로 만듭니다.

좋은 예:

```text
docs/jpa-entity-guide
feat/jpa-entities
chore/openapi
feat/seat-hold
feat/booking-confirm
test/booking-concurrency
fix/booking-cancel-owner-check
```

나쁜 예:

```text
my-work
test
donghun
final
real-final
```

브랜치 이름만 봐도 무슨 작업인지 알 수 있어야 합니다.

---

## 4. 브랜치 이름 규칙

이 프로젝트에서는 아래 형식을 권장합니다.

```text
타입/작업-내용
```

자주 쓰는 타입:

| 타입 | 의미 | 예시 |
|---|---|---|
| `feat` | 기능 추가 | `feat/jpa-entities` |
| `fix` | 버그 수정 | `fix/booking-cancel-owner-check` |
| `docs` | 문서 변경 | `docs/github-guide` |
| `test` | 테스트 추가/수정 | `test/booking-concurrency` |
| `chore` | 설정, 빌드, 도구 변경 | `chore/openapi` |
| `refactor` | 동작 변경 없는 코드 정리 | `refactor/booking-service` |

브랜치 이름은 영어 소문자와 하이픈을 쓰는 편이 좋습니다.

```text
docs/github-guide
feat/seat-hold
```

---

## 5. 커밋 메시지 규칙

커밋 메시지는 아래 형식을 권장합니다.

```text
타입: 무엇을 했는지
```

예:

```text
docs: GitHub 브랜치와 PR 가이드 추가
feat: JPA 엔티티 10종 추가
fix: 예매 취소 시 소유자 검증 추가
test: 좌석 선점 Redis 락 테스트 추가
chore: springdoc-openapi 의존성 추가
```

커밋 메시지는 너무 길 필요가 없습니다. 대신 어떤 변경인지 명확해야 합니다.

---

## 6. IntelliJ에서 작업하는 방법

### 1단계: 기준 브랜치로 이동

1. IntelliJ 오른쪽 아래의 브랜치 이름을 클릭합니다.
2. `master` 또는 `main`을 선택합니다.
3. `Checkout`을 누릅니다.

이 프로젝트는 현재 원격 기준 브랜치가 `master`입니다.

### 2단계: 최신 코드 받기

상단 메뉴에서 다음을 선택합니다.

```text
Git
→ Pull...
→ Pull
```

단축키를 쓰는 경우:

```text
macOS: Command + T
```

### 3단계: 새 브랜치 만들기

1. 오른쪽 아래 브랜치 이름을 클릭합니다.
2. `New Branch`를 클릭합니다.
3. 브랜치 이름을 입력합니다.

예:

```text
docs/github-guide
```

4. `Create`를 클릭합니다.

### 4단계: 파일 수정

IntelliJ에서 파일을 만들거나 수정합니다.

예:

```text
docs/study/04-github-branch-pr-guide.md
```

### 5단계: 변경사항 확인

왼쪽 또는 아래쪽의 `Commit` 탭을 엽니다.

수정한 파일들이 목록에 표시됩니다.

### 6단계: 커밋

1. 커밋할 파일을 체크합니다.
2. 커밋 메시지를 입력합니다.

예:

```text
docs: GitHub 브랜치와 PR 가이드 추가
```

3. `Commit`을 클릭합니다.

`Commit and Push`를 눌러도 되지만, 처음에는 `Commit`과 `Push`를 나눠서 하는 편이 이해하기 쉽습니다.

### 7단계: Push

상단 메뉴에서 다음을 선택합니다.

```text
Git
→ Push...
→ Push
```

단축키:

```text
macOS: Command + Shift + K
Windows: Ctrl + Shift + K
```

처음 올리는 브랜치라면 IntelliJ가 원격 브랜치를 새로 만들겠다고 표시합니다. 그대로 `Push`하면 됩니다.

---

## 7. 터미널에서 작업하는 방법

현재 상태 확인:

```bash
git status
```

현재 브랜치 확인:

```bash
git branch --show-current
```

기준 브랜치로 이동:

```bash
git switch master
```

최신 코드 받기:

```bash
git pull
```

새 브랜치 만들기:

```bash
git switch -c docs/github-guide
```

변경사항 확인:

```bash
git status
```

변경 파일 추가:

```bash
git add docs/study/04-github-branch-pr-guide.md docs/study/README.md
```

커밋:

```bash
git commit -m "docs: GitHub 브랜치와 PR 가이드 추가"
```

GitHub에 올리기:

```bash
git push -u origin docs/github-guide
```

`-u`는 현재 로컬 브랜치와 GitHub 원격 브랜치를 연결한다는 뜻입니다. 처음 push할 때 한 번만 붙이면 됩니다.

---

## 8. GitHub에서 PR 만드는 방법

push가 끝나면 GitHub 저장소 웹페이지로 갑니다.

대부분 상단에 아래 버튼이 보입니다.

```text
Compare & pull request
```

클릭한 뒤 아래를 확인합니다.

```text
base: master
compare: 내가 push한 브랜치
```

예:

```text
base: master
compare: docs/github-guide
```

PR 제목:

```text
docs: GitHub 브랜치와 PR 가이드 추가
```

PR 본문 예시:

```md
## 변경 내용
- GitHub 브랜치, 커밋, push, PR 흐름 설명 문서 추가
- IntelliJ와 터미널 기준 작업 방법 정리
- docs/study/README.md 읽는 순서에 새 문서 추가

## 테스트
- 문서 변경이라 별도 테스트 미실행
```

작성 후 `Create pull request`를 누릅니다.

---

## 9. PR이 merge된 다음 해야 할 일

PR이 `master`에 merge되면 로컬도 최신 상태로 맞춥니다.

IntelliJ:

```text
오른쪽 아래 브랜치 클릭
→ master checkout
→ Git > Pull...
```

터미널:

```bash
git switch master
git pull
```

그다음 새 작업을 시작할 때 다시 브랜치를 만듭니다.

```bash
git switch -c feat/next-work
```

---

## 10. 자주 만나는 상황

### 커밋했는데 Push를 안 했다

로컬에는 저장됐지만 GitHub에는 아직 올라가지 않은 상태입니다.

IntelliJ:

```text
Git → Push...
```

터미널:

```bash
git push -u origin 현재브랜치명
```

### Push했는데 PR이 없다

GitHub에 브랜치는 올라갔지만 아직 merge 요청을 만들지 않은 상태입니다.

GitHub 저장소에서 `Compare & pull request`를 누르면 됩니다.

### 브랜치를 잘못 만들었다

아직 push하지 않았다면 브랜치 이름을 바꿀 수 있습니다.

```bash
git branch -m 새브랜치이름
```

이미 push했다면 팀원에게 말하고 새 브랜치를 다시 만드는 편이 더 쉽습니다.

### main과 master 중 무엇을 써야 하나

프로젝트마다 기준 브랜치 이름이 다릅니다.

현재 이 프로젝트는 원격 기준 브랜치가 `master`입니다.

확인은 이렇게 합니다.

```bash
git branch -vv
```

GitHub PR 화면에서도 `base`가 `master`인지 `main`인지 확인할 수 있습니다.

---

## 11. 작업 전 체크리스트

새 작업을 시작하기 전에 확인합니다.

```text
1. 지금 기준 브랜치가 master인가?
2. Pull로 최신 코드를 받았는가?
3. 작업 이름에 맞는 새 브랜치를 만들었는가?
4. 이번 브랜치에 하나의 작업만 넣고 있는가?
```

커밋 전에 확인합니다.

```text
1. git status 또는 IntelliJ Commit 탭에서 변경 파일을 확인했는가?
2. 관계없는 파일이 섞이지 않았는가?
3. 커밋 메시지가 변경 내용을 설명하는가?
```

PR 전에 확인합니다.

```text
1. Push를 했는가?
2. base 브랜치가 master인가?
3. compare 브랜치가 내가 작업한 브랜치인가?
4. PR 제목과 본문을 작성했는가?
```

---

## 12. 이 프로젝트에서 추천하는 PR 단위

아래처럼 작업을 나누면 리뷰하기 쉽습니다.

```text
docs/github-guide
→ GitHub 사용법 문서 추가

docs/jpa-entity-guide
→ SQL 기반 JPA 엔티티 작성 가이드 추가

feat/jpa-entities
→ 엔티티 10종과 공통 시간 매핑 클래스 추가

chore/openapi
→ springdoc-openapi 설정 추가

feat/seat-hold
→ Redis 좌석 선점/해제 API 추가

feat/booking-confirm
→ Mock 결제와 예매 확정 흐름 추가

test/booking-concurrency
→ 동시성 통합 테스트 추가
```

작업이 커질수록 PR을 작게 나누는 것이 좋습니다. 작은 PR은 리뷰가 빠르고, 문제가 생겨도 되돌리기 쉽습니다.
