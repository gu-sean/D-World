# 시연용 DB 덤프 — 다른 PC에서 명령어로 바로 테스트하기

- `d_world_demo.sql`: 시험 계정·시연 데이터가 든 **DB 전체 덤프** (스키마 + 기준 데이터 + 시연 데이터)
- `develop`을 받은 뒤 명령어 한 줄로 DB 복원 + 백엔드 실행 (파일 이동·DB 수동 생성 불필요)

## 시험 계정

| 항목 | 값 |
|---|---|
| 휴대폰(아이디) | `01099999999` |
| 비밀번호 | `1234567890` |
| 닉네임 | `tester01` |

> 로컬 개발·시연 전용 계정이다. 비밀번호가 약하므로 공유·운영 환경에서는 쓰지 않는다.

## 내 PC는 어느 쪽인가

- `npm run demo`가 환경을 **자동 선택**: Docker 실행 중이면 Docker, 아니면 설치된 PostgreSQL(`psql`)

| | A. Docker 환경 | B. Docker 없는 환경 |
|---|---|---|
| 준비물 | Docker Desktop(**실행 중**), Node 22.9+ | PostgreSQL 16 설치(`psql` 포함, 서버 실행 중), Node 22.9+ |
| DB | `docker compose`의 postgres 컨테이너를 알아서 띄움 | 설치된 PostgreSQL을 사용 (계정·DB는 스크립트가 만들거나 직접 준비) |
| 실행 | `npm run demo` | `npm run demo` (같은 명령, 자동 감지) |

공통 첫 단계:

```sh
git pull                      # develop 최신으로
cd backend
npm install                   # 처음 한 번
```

## A. Docker 환경

```sh
npm run demo
```

1. postgres 컨테이너 기동, 없으면 DB 생성
2. `db/dumps/d_world_demo.sql` 복원 (이미 복원돼 있으면 건너뜀)
3. `backend/.env`가 없으면 `.env.example`로 만들고 로컬 값을 채움 (있으면 그대로 사용)
4. 백엔드 빌드 → 실행 (http://localhost:3000, 종료는 Ctrl+C)

> 이 스크립트는 `postgres`만 띄운다. MinIO(로컬 객체 저장소, AI·업로드 시험용)는 기본 `docker compose up`에 포함되지 않고
> 필요할 때만 `docker compose --profile minio up -d minio`로 띄운다(버킷 `dworld-dev` 자동 생성, 콘솔 http://localhost:9001, 계정 minioadmin/minioadmin).

## B. Docker 없는 환경 (PostgreSQL을 직접 설치)

### 1) PostgreSQL 16 설치하고 서버를 켠다

| OS | 방법 |
|---|---|
| Windows | https://www.postgresql.org/download/windows/ 설치 프로그램(설치 때 정한 `postgres` 비밀번호를 기억), 또는 `winget install PostgreSQL.PostgreSQL.16` |
| macOS | `brew install postgresql@16 && brew services start postgresql@16` |
| Ubuntu/Debian | `sudo apt install postgresql-16` (서비스는 자동 실행) |

- `psql`이 PATH에 없어도 Windows·macOS의 기본 설치 위치는 스크립트가 찾는다. 그래도 못 찾으면 `PG_BIN=<psql이 있는 폴더>`를 준다.
- 서버 버전이 16이 아니어도 복원은 대개 되지만, 덤프를 다시 만들 때는 `pg_dump` 버전이 서버와 같아야 한다.

### 2) 실행 — 계정·DB는 스크립트가 만들어 준다

기본 접속 주소는 `postgres://dworld:dworld@localhost:5432/d_world`(DB 이름 `d_world`, 계정 `dworld`/`dworld`)다.
이 계정과 DB가 아직 없으면 **PostgreSQL 관리자 접속 주소를 `DEMO_ADMIN_URL`로 주면** 스크립트가 만들어 복원까지 한다.

```sh
# bash / zsh (macOS, Linux, Git Bash)
DEMO_ADMIN_URL='postgres://postgres:<관리자비밀번호>@localhost:5432/postgres' npm run demo
```
```powershell
# PowerShell
$env:DEMO_ADMIN_URL = 'postgres://postgres:<관리자비밀번호>@localhost:5432/postgres'; npm run demo
```
```bat
:: cmd
set DEMO_ADMIN_URL=postgres://postgres:<관리자비밀번호>@localhost:5432/postgres && npm run demo
```

- 관리자 비밀번호에 `@ : / # %` 같은 문자가 있으면 URL 인코딩(`%40` 등)해서 넣는다.
- 한 번 만들고 나면 이후에는 `npm run demo`만 하면 된다 (`backend/.env`에 접속 주소가 저장되고 다시 읽는다).
- 관리자 주소를 주고 싶지 않으면 PostgreSQL 관리자로 아래 두 줄을 직접 실행한 뒤 `npm run demo` 한다.

```sh
psql -U postgres -c "CREATE ROLE dworld LOGIN PASSWORD 'dworld' CREATEDB"
psql -U postgres -c "CREATE DATABASE d_world OWNER dworld"
```

### 다른 주소·계정을 쓰려면

```sh
DEMO_DATABASE_URL='postgres://내계정:비밀번호@localhost:5432/내DB' npm run demo
```
(PowerShell: `$env:DEMO_DATABASE_URL = '...'; npm run demo`)

### 스크립트 없이 손으로 복원하려면

빈 DB에 한 줄이면 된다. 덤프에 `--clean --if-exists`가 있어 같은 이름의 표가 있으면 지우고 다시 만든다.

```sh
psql -d d_world -v ON_ERROR_STOP=1 -f db/dumps/d_world_demo.sql
```

파일 첫머리의 `\restrict` 줄은 psql 16.10 이상에서만 동작한다. 오래된 psql이면 그 줄(`\restrict`, `\unrestrict`로 시작하는 줄)을
지우고 실행한다. (`npm run demo`는 이 줄을 알아서 지운다.)

## 서버가 뜬 뒤 확인

```sh
curl http://localhost:3000/health
curl -X POST http://localhost:3000/api/v1/auth/login -H 'Content-Type: application/json' \
  -d '{"phoneNumber":"01099999999","password":"1234567890"}'
```

## 명령어

`backend` 폴더에서 실행한다.

| 명령 | 하는 일 |
|---|---|
| `npm run demo` | 위의 전체 과정. 이미 복원돼 있으면 DB는 그대로 두고 서버만 띄움 |
| `npm run demo:reset` | 이미 복원돼 있어도 덤프로 **DB를 다시 덮어씀** (처음 상태로 되돌리기) |
| `npm run demo:dump` | 지금 DB를 덤프 파일로 다시 저장 (`d_world_demo.sql`, `SHA256.txt` 갱신) |
| `npm run demo:refresh` | **덤프 갱신 한 줄**: 임시 DB에 복원 → 최신 마이그레이션 → 빌드 → `demo:fill` → 덤프 저장 → 임시 DB 삭제 (실제 DB는 건드리지 않음, Docker 또는 로컬 PostgreSQL 필요) |
| `npm run demo:fill` | 비어 있는 표(검수·제재·탈퇴·정산·지급·회수·진화 등)를 앱 API·서비스로 채움. 재실행 안전. 먼저 `npm run build` |

옵션은 `node scripts/demo.mjs`로 직접 줄 수 있다.
`--docker` / `--local`(환경 강제), `--no-start`(서버는 띄우지 않고 준비만), `--force`(덮어쓰기), `--skip-verify`(덤프 해시 검증 생략), `--dump --out <경로>`.
예: `node scripts/demo.mjs --local --no-start`

## 안전장치

- 대상 DB에 **시험 계정이 아닌 다른 사용자 데이터가 있으면 덮어쓰지 않고 멈춘다.**
  복원은 그 DB의 기존 표를 지우고 다시 만들기 때문이다. 덮어써도 되면 `npm run demo:reset`.
- 이미 `localhost:3000`에서 백엔드가 떠 있으면 새로 띄우지 않는다.
- 이미 있는 `backend/.env`는 건드리지 않는다. `DATABASE_URL`이 대상 DB를 가리키지 않으면 경고만 한다.

## 덤프에 들어 있는 것

- 시험 계정의 시연 데이터: 목표 4(활성·완료·일시정지), 미션 30(완료·인증 중·대기·취소),
  인증 기록 6(승인·거절·이의 제기), 펫 "모모", 포인트 내역 4건·상점 구매 1건, 업적 "첫 목표 달성",
  챌린지 참여 1건, 알림 3건, 문의 1건, AI 리포트 1건, 연속 기록 1일
- `demo:fill` 데이터: 문의 처리, 이용 제한, 탈퇴 요청, 소셜 연결, 검수, 챌린지 정산·지급, 회수 청구, 펫 진화 등 (아래 "별도 시연 사용자")
- 개발 시드 계정(휴대폰 `01000000001`, 관리자 `dev_admin`) — 비밀번호는 시드를 돌린 사람이 정한 값이라 이 덤프만으로는 알 수 없다
- 마이그레이션 14개 적용 상태(`schema_migrations`) → `npm run db:migrate` 불필요
- **데이터를 뺀 표**(구조만 있음): 로그인 세션(`auth_sessions`·`admin_sessions`), 인증번호 이력,
  멱등 키, 푸시 기기 → 복원한 뒤 새로 로그인하면 된다

> 이 파일에는 비밀번호 해시(개발 관리자·개발 사용자·시험 계정)가 들어 있다. 로컬 개발용 값이지만,
> 운영·공유 DB에 복원하거나 실제 비밀번호를 쓰는 계정을 넣어 다시 덤프하지 않는다.

## 복원 후 확인 목록

| 화면 | 기대하는 모습 |
|---|---|
| 로그인 | 시험 계정으로 로그인됨 |
| 마이 | Lv.2, 경험치 120 / 300, 370P, 대표 펫 "모모" |
| 연속 기록 | 현재 1일 |
| 리포트 | 분야별 진행 숫자, AI 리포트 1건 |
| 업적 | "첫 목표 달성" 획득 |
| 포인트 내역 · 인벤토리 | 내역 4건, 펫 간식 1개 |
| 챌린지 | 내 챌린지 1건 |
| 알림함 · 문의 | 알림 3건, 문의 1건 |
| 홈 | 미션 카드. **복원할 때 시험 계정의 미션·기록 날짜를 오늘로 맞춰 주므로** 언제 복원해도 오늘 미션이 보인다 (덤프 기준일 2026-11-12, 로직은 `backend/scripts/demo-align-dates.mjs`. 원장·정산·다른 시연 사용자는 옮기지 않는다. 시드 공개 챌린지 `7일 스쿼트`는 복원일 기준 오늘+2일 시작으로 다시 맞춘다) |

## 문제가 생기면

| 증상 | 원인·해결 |
|---|---|
| `Docker도 psql도 찾을 수 없어요` | A(Docker Desktop 실행) 또는 B(PostgreSQL 설치) 중 하나를 준비. `psql`이 PATH에 없으면 `PG_BIN` |
| Docker는 설치했는데 B로 넘어감 | Docker Desktop이 꺼져 있다(`docker info`가 실패). 켜거나 `--docker`로 확인 |
| `PostgreSQL 서버에 연결할 수 없어요` | 서버가 꺼져 있거나 주소·포트가 다르다. 서비스를 켜고 `DEMO_DATABASE_URL`을 확인 |
| `접속 계정 … 또는 DB …가 없어요` | `DEMO_ADMIN_URL`을 주거나 위의 `CREATE ROLE`·`CREATE DATABASE` 두 줄을 실행 |
| `다른 사용자 N명의 데이터가 있어요` | 대상 DB가 이미 쓰던 DB다. 새 DB를 쓰거나(`DEMO_DATABASE_URL`) 덮어써도 되면 `npm run demo:reset` |
| `비밀번호 인증 실패(password authentication failed)` | 접속 계정 비밀번호가 다르다. `DEMO_DATABASE_URL`/`DEMO_ADMIN_URL` 확인 |
| 코드를 고치며 자동 재시작으로 보고 싶다 | DB는 `npm run demo`로 복원해 두고(`--no-start`로 준비만 해도 된다), 서버는 `npm run start:dev`로 띄운다 (`chokidar`가 개발 의존성에 들어 있어 `npm install` 뒤 바로 된다) |

## 앱(모바일)으로 테스트하려면

- `mobile/.env`: `API_BASE_URL=http://localhost:3000/api/v1`, `SOCIAL_LOGIN_MODE=mock`
- 안드로이드 에뮬레이터는 `adb reverse tcp:3000 tcp:3000` 필요 (`npm run android`가 해 준다)
- 빌드·실행 방법과 알려진 문제는 `mobile/README.md`

## 알아 둘 것

- **사진·영상 업로드:** 스크립트가 만드는 `.env`는 `STORAGE_DRIVER=memory`라 업로드가 실제로는 되지 않는다.
  업로드까지 보려면 `.env`에 `STORAGE_DRIVER=r2`와 `R2_*` 값을 넣는다(값은 팀에서 받는다).
- **AI 판정:** AI 서버는 이 스크립트가 띄우지 않음 → 인증 제출 뒤 판정은 대기 상태
- **관리자 웹:** `dev_admin` 비밀번호를 모르면 새 관리자를 만든다.
  `ADMIN_PASSWORD=<비밀번호> node --env-file-if-exists=.env scripts/create-admin.mjs <로그인ID> <이메일>`
- **덤프 검증:** 복원 직전에 `SHA256.txt`와 대조한다. 다르면 멈추고(`--skip-verify`로만 우회), 줄바꿈만 CRLF로 바뀐 경우는 LF로 되돌려 쓴다.
  `db/dumps/.gitattributes`가 줄바꿈 변환을 막으니 `.sql`을 편집기로 열어 저장하지 말 것.
- **덤프 갱신 절차:** 마이그레이션(`db/migrations`)을 추가·변경한 사람이 맡는다.
  1. `develop`을 최신으로 받는다.
  2. `cd backend && npm run demo:refresh` (한 줄). 끝나면 `d_world_demo.sql`과 `SHA256.txt`가 함께 바뀐다.
  3. 두 파일을 마이그레이션과 같은 커밋·PR에 올린다. 덤프가 마이그레이션보다 뒤처지면 단위 테스트(`demo-dump-fresh`)가 실패한다.
  4. 두 사람이 동시에 갱신해 충돌이 나면 **병합하지 말고** 한쪽 버전을 택한 뒤 2번을 다시 한다(덤프는 통째로 교체되는 파일이다).
  (다시 만든 덤프는 `CHECK` 제약 표기 등 글자 모양이 조금 달라질 수 있지만 데이터는 같다.)

## 별도 시연 사용자

- `demo:fill`은 시험 계정을 보호하려고 상태가 바뀐 사용자를 따로 생성
- 비밀번호는 모두 시험 계정과 동일

| 전화번호 | 닉네임 | 용도 |
|---|---|---|
| `01011110001` | 제재시연 | 이용 제한 |
| `01011110002` | 탈퇴요청시연 | 탈퇴 요청 |
| `01011110003` | 챌린지제작시연 | 사용자 제작 챌린지 검수 |
| `01011110004` | 연속기록시연 | 7일 연속 마일스톤 |
| `01011110005` | 포인트회수시연 | 미회수 청구 |
| `01011110006` | 펫진화시연 | 펫 진화 |
| `01011110100` ~ `01011110104` | 정산시연A~E | 챌린지 정산·지급(일부 지급 실패 1건이 남아 있음) |

- `challenge_score_snapshots`는 앱이 쓰지 않는 표 → 빈 상태가 정상
