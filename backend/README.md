# Routy Backend (Final MVP Schema)

README(루트)의 최종 설계 문서를 기준으로 백엔드를 정렬한 버전입니다.

## 1) Run

```bash
cd backend
npm install
# backend/.env 생성 (아래 Environment Variables 섹션 참고)
npm run dev
```

GraphQL endpoint:

- `http://localhost:4000/graphql`

## 2) Environment Variables

필수:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`

선택:

- `PORT` (기본값 `4000`)
- `GOOGLE_PLACES_API_KEY` (Google 링크 import, 장소 상세 동기화, 장소 사진 프록시, 정적 경로 지도 프록시에 사용)
- `AI_PROVIDER` (`gemini` 또는 `openai`, 미설정 시 자동 선택)
- `GEMINI_API_KEY` / `GEMINI_MODEL`
- `OPENAI_API_KEY` / `OPENAI_MODEL`
- `OAUTH_REDIRECT_TO` (Google OAuth URL 생성 시 사용)
- `SENTRY_DSN` / `SENTRY_ENVIRONMENT`

Legacy fallback:

- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GOOGLE_MAPS_API_KEY` (신규 설정은 `GOOGLE_PLACES_API_KEY` 권장)

## 3) Supabase SQL Bootstrap

실행 파일:

- `supabase/sql/001_init_requirements.sql`
- `supabase/sql/002_usage_events.sql` (기존 DB에 import/AI 사용량 추적 테이블을 추가하거나 컬럼명을 최신 상태로 맞출 때)
- `supabase/sql/003_drop_unused_place_fields.sql` (기존 DB에서 더 이상 쓰지 않는 `places` 컬럼 `primary_type_display_name/reviews/phone`을 제거할 때)

주의:

- 이 스크립트는 `places/place_lists/place_list_items/schedules/schedule_days/schedule_stops`를 **drop 후 재생성**합니다.

생성 테이블:

- `places` (공용 장소 원본)
- `place_lists` (유저 리스트 헤더, 출력 언어 포함)
- `place_list_items` (리스트별 장소 + 메모/우선순위)
- `import_usage_events` (Google import 월간 사용량 이벤트 로그)
- `ai_usage_events` (AI 일정 생성 사용량 이벤트 로그)
- `schedules` (생성 시점 출력 언어 스냅샷 포함)
- `schedule_days`
- `schedule_stops` (`reason` + `visit_tip` 저장)

## 4) GraphQL Domain Summary

### Auth

- `signUp`
- `signIn`
- `signInWithGoogle`
- `deleteMyAccount`

### Place (Shared)

- `places`
- `place`
- `placeByGooglePlaceId`
- `parseGoogleMapsLink`
- `importPlaceFromGoogleLink`
- `upsertPlace`
- `refreshPlaceDetails`

### Place List

- `myPlaceLists`
- `placeList`
- `createPlaceList`
- `updatePlaceList`
- `deletePlaceList`
- `addPlaceListItem`
- `updatePlaceListItem`
- `removePlaceListItem`

### Schedule

- `mySchedules`
- `schedule`
- `createSchedule` (리스트 기반 생성)
- `regenerateSchedule`
- `moveScheduleStop`
- `deleteSchedule`

## 5) MVP Generation Notes

- 일정 생성은 리스트 아이템(`place_list_items`)을 기반으로 수행
- `is_must_visit=true` 아이템은 `MUSTVISIT` 상태로 우선 배치
- 정렬은 nearest-neighbor 기반 + 간단 이동 추정
- stop 단위 필드 저장:
  - `time`
  - `label`
  - `is_must_visit`
  - `reason`
  - `visit_tip`
  - `transport_to_next`
- AI 생성 프롬프트는 `generationInput.outputLanguage`와 `generationInput.tripDays`를 받아, 방문 날짜와 언어를 기준으로 `visit_tip`을 생성하도록 구성
- AI provider는 `AI_PROVIDER`로 선택하며, 미설정 시에는 기본적으로 Gemini를 쓰고 `OPENAI_API_KEY`만 있는 환경에서는 OpenAI를 자동 선택
- 모델을 고정하고 싶으면 `GEMINI_MODEL`, `OPENAI_MODEL`만 지정하면 되고, 추가 fallback 모델이나 OpenAI organization/project 설정은 현재 코드에서 사용하지 않음

## 6) 고도화 (Future Enhancements)

나중에 Routy 백엔드 서비스를 고도화할 때 체크해볼 만한 항목들입니다. (작업 재개 시 참고용)

- **AI 백그라운드 워커 분리 (Microservice):** 현재 `crawler.js`와 `geminiOptimizer.js`가 Node.js 메인 서버에 일체형으로 통합되어 있습니다 (MVP 적합). 추후 LLM 응답 대기 시간이 길어져 병목 현상(Blocking)이 발생하면 Python 워커(혹은 Node.js `BullMQ` + `Redis`)를 도입하여 비동기로 처리하는 이벤트 소싱 구조로 분리하는 것이 좋습니다.
- **일정 부분 편집 및 커스텀 장소 기능:** 현재는 일정 전체 생성 및 `moveScheduleStop`을 통한 순서 변경만 지원됩니다. 개별 장소를 새로 끼워넣거나(커스텀 장소), 삭제하는 기능을 GraphQL Mutation으로 확장해야 합니다.
- **카테고리 필터 검색:** 장소를 `LANDMARK`, `MEAL`, `BRUNCH`, `CAFE`, `SNACK`, `NIGHT`, `SHOP`, `NATURE`, `STAY` 등으로 추론(`inferCategory`)하고 있으나, 이를 통한 목록 필터링 조회 API(`placesByCategory` 등)를 추가하면 좋습니다.
- **최적화 DB 트랜잭션:** 다중 테이블 Insert/Update(`createSchedule` 등) 수행 도중 실패 시 부분 데이터가 남는 것을 방지하기 위해 Supabase RPC(Stored Procedure)를 통한 원자적 트랜잭션을 고려할 수 있습니다.
- **에러 모니터링 및 로깅:** AWS나 운영 환경 배포 시, `winston`이나 `Sentry`를 통해 크롤링 에러와 외부 API(Google, Gemini) 응답 실패를 전문적으로 추적하도록 보강하세요.
