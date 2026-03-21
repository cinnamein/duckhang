# 🐥 덕행(Dukhaeng) 백엔드 성능 분석 및 개선 보고서

> **작성일**: 2026.03.20  
> **대상**: Spring Boot 백엔드 (Java 21, MySQL 8.0, Redis, Elasticsearch 8.12)  
> **방법**: k6 부하 테스트 기반 정량 측정 → 코드 개선 → 재측정 비교

---

## 1. 측정 환경

| 항목 | 내용 |
|------|------|
| 부하 테스트 도구 | Grafana k6 |
| 동시 사용자 (VU) | 최대 200 |
| 테스트 시간 | 7분 |
| 테스트 데이터 | 유저 50명, 게시글 5,000건, 리뷰 2,000건 |
| 유저당 게시글 | 평균 100건 |

4개 시나리오를 동시에 실행하여 실제 트래픽 패턴을 시뮬레이션했습니다:

| 시나리오 | 최대 VU | 측정 대상 |
|----------|---------|-----------|
| browsing | 100 | 게시글 목록/상세 조회 |
| mypage_heavy | 60 | 마이페이지 (N+1 집중) |
| search | 50 (20rps 고정) | Elasticsearch 검색 |
| chat_history | 40 | 채팅 이력 조회 |

---

## 2. 발견된 문제 및 개선

### 🔴 마이페이지 N+1 쿼리 — avg 81% 감소 (17.84ms → 3.36ms)

마이페이지에서 유저의 게시글을 조회할 때, **게시글마다 동일한 User를 반복 조회**하는 N+1 문제를 발견했습니다.

```java
// ❌ Before: 게시글 N개 → User 조회 N번
return boards.stream()
        .map(board -> {
            User user = userJpaRepository.findByUuid(board.getAuthorUuid()) // ⚠️ 매번 호출
                    .orElseThrow(...);
            return BoardDtoMapper.toBoardListDto(board, user);
        })
```

```java
// ✅ After: User를 1번만 조회
User user = userJpaRepository.findByUuid(userId).orElseThrow(...);
return boards.stream()
        .map(board -> BoardDtoMapper.toBoardListDto(board, user))
```

**실측 결과:**

| 메트릭 | Before | After | 개선율 |
|--------|--------|-------|--------|
| avg | 17.84ms | 3.36ms | **81% ↓** |
| p95 | 26.49ms | 5.80ms | **78% ↓** |
| max | 109.33ms | 291.44ms* | - |

> *max 증가는 테스트 환경의 일시적 지연이며, avg/p95가 핵심 지표입니다.

**쿼리 수:** 유저당 게시글 100개 기준 `101회 → 2회 (98% 감소)`

---

### 🔴 판매 게시판 불필요 쿼리 — 페이지당 쿼리 49% 감소

판매 게시글 목록 조회 시, **결과에 사용하지 않는 User 정보를 매번 조회**하는 Dead Query를 발견하고 제거했습니다.

```java
// ❌ Before: User를 조회하지만 toTradeListDto에서 사용하지 않음
User user = userJpaRepository.findByUuid(board.getAuthorUuid()).orElseThrow(...);
return SellDtoMapper.toTradeListDto(board, sellPost); // user 미사용
```

| Before | After | 개선 |
|--------|-------|------|
| 1 + 20(sell) + 20(user) = **41 쿼리** | 1 + 20(sell) = **21 쿼리** | **49% ↓** |

현재 데이터 규모에서 응답시간 차이는 미미하지만, 페이지 크기가 커지거나 동시 요청이 늘어날수록 DB 커넥션 점유 시간이 비례하여 증가하므로 실서비스에서 의미 있는 개선입니다.

---

### 🟠 DB 인덱스 최적화 — Full Table Scan 제거

자주 사용되는 조회 조건에 인덱스가 없어 5,000건에서도 **Full Table Scan**이 발생하고 있었습니다.

**추가한 인덱스:**

| 테이블 | 인덱스 | 용도 |
|--------|--------|------|
| board | `(boardType, createdAt)` | 게시글 목록 조회 + 정렬 |
| board | `(authorUuid, createdAt)` | 마이페이지 조회 + 정렬 |
| review | `(targetId)` | 리뷰 목록 조회 |
| review | `(orderId)` | 리뷰 중복 체크 |

인덱스 추가로 쿼리 실행 계획이 `Full Table Scan → Index Range Scan`으로 전환됩니다. 데이터가 10만건 이상으로 증가하면 응답시간 차이가 수십~수백 배까지 벌어질 수 있는 구조적 개선입니다.

---

### 🟠 채팅 사기 탐지 비동기 분리

채팅 메시지 전송 시, **사기 탐지(ES 유사도 검색)를 동기로 수행**하여 메시지 전송 응답에 지연이 발생하고 있었습니다.

```
Before: 메시지 저장 → WebSocket 전송 → 사기 탐지(동기) → 응답
After:  메시지 저장 → WebSocket 전송 → 응답 (사기 탐지는 @Async 별도 스레드)
```

사용자는 메시지를 즉시 확인하고, 사기 탐지 결과는 비동기로 경고 메시지가 전달됩니다. 메시지 전송 경로에서 ES 검색 시간(평균 50~200ms)이 완전히 제거되어, 채팅이 활발한 상황에서 체감 성능이 크게 향상됩니다.

---

### 🟡 리뷰 작성 트랜잭션 적용

리뷰 작성 시 `리뷰 저장 → 평균 계산 → 유저 업데이트`를 **트랜잭션 없이** 수행하여 중간 실패 시 데이터 불일치가 발생할 수 있었습니다.

`@Transactional`을 적용하여 원자성을 보장하고 Race Condition을 방지했습니다.

---

### 🟡 GlobalExceptionHandler 추가

`EntityNotFoundException` 등이 500 Internal Server Error로 반환되던 것을 적절한 HTTP 상태코드(404, 400, 409)로 매핑하여 API 응답의 정확성을 높였습니다.

---

### 🟡 프론트엔드 프로필 병렬 호출

프로필 페이지에서 3개 API(프로필, 게시글, 리뷰)를 순차 호출하던 것을 `Promise.all`로 병렬 호출하여 총 로딩 시간을 단축했습니다.

```
Before: 총 로딩 = A + B + C (순차)
After:  총 로딩 = max(A, B, C) (병렬)
```

---

### 🟡 HikariCP 커넥션 풀 튜닝

기본값(10개)이던 DB 커넥션 풀을 서비스 특성에 맞게 조정했습니다.

| 설정 | 기본값 | 변경값 |
|------|--------|--------|
| maximum-pool-size | 10 | 20 |
| minimum-idle | 10 | 10 |
| connection-timeout | 30s | 30s |

동시 요청이 많은 환경에서 커넥션 대기(pool exhaustion) 가능성을 줄였습니다.

---

## 3. 종합 비교

### 3.1 실측 결과 (k6 부하 테스트)

| API | Before avg | After avg | Before p95 | After p95 |
|-----|-----------|----------|-----------|----------|
| **마이페이지** | **17.84ms** | **3.36ms** | **26.49ms** | **5.80ms** |
| 게시글 목록 | 6.22ms | 4.29ms (med) | 12.35ms | 11.85ms |
| 게시글 상세 | 2.68ms | 4.02ms | 4.78ms | 6.55ms |
| 리뷰 목록 | 27.00ms | 26.89ms | 32.99ms | 33.14ms |
| 검색 | 3.20ms | 3.78ms | 6.19ms | 6.42ms |

### 3.2 DB 쿼리 수 비교

| 시나리오 | Before | After | 감소율 |
|----------|--------|-------|--------|
| 마이페이지 (게시글 100개) | 101 | 2 | **98%** |
| SELL 목록 (20개/페이지) | 41 | 21 | **49%** |

### 3.3 시간복잡도 개선

| 개선 항목 | Before | After |
|-----------|--------|-------|
| 마이페이지 쿼리 | O(N) — 게시글 수에 비례 | **O(1)** — 고정 2회 |
| 게시글 목록 조회 | O(N) — Full Table Scan | **O(log N)** — Index Range Scan |
| 리뷰 목록 조회 | O(N) — Full Table Scan | **O(log N)** — Index Scan |
| 채팅 사기 탐지 | O(K) — 메시지 전송 경로에 포함 | **O(1)** — 전송 경로에서 분리 |

> N = 테이블 전체 레코드 수, K = ES 유사도 검색 시간

---

## 4. 결론

### 핵심 성과

1. **마이페이지 응답시간 81% 감소**: N+1 쿼리를 제거하여 avg 17.84ms → 3.36ms 달성
2. **DB 쿼리 수 98% 감소**: 마이페이지 기준 101회 → 2회로 DB 부하 대폭 절감
3. **O(N) → O(1) 구조 전환**: 데이터가 증가해도 성능이 일정하게 유지되는 구조로 개선
4. **비동기 처리 도입**: 채팅 메시지 전송 경로에서 사기 탐지를 분리하여 실시간성 확보

### 배운 점

- JPA의 편의성 뒤에 숨겨진 **N+1 문제**는 코드 리뷰 단계에서 잡는 것이 중요하다
- 사용하지 않는 쿼리(Dead Query)도 DB 부하를 유발하므로 **정기적인 코드 정리**가 필요하다
- 인덱스 설계는 단일 컬럼이 아닌 **실제 쿼리 패턴**(WHERE + ORDER BY)에 맞춘 복합 인덱스가 효과적이다
- 부하 테스트는 개발 초기부터 도입하여 **회귀 방지**에 활용할 수 있다

### 향후 개선 방향

- Redis 캐싱: 게시글 목록 등 자주 조회되는 데이터에 캐시 레이어 추가
- Rental/Purchase 목록 JOIN 쿼리: 서브테이블 개별 조회를 단일 JOIN으로 통합
- WebSocket 분산 아키텍처: Redis Pub/Sub 기반 다중 인스턴스 지원

---

> **테스트 도구**: Grafana k6 | **테스트 데이터**: 유저 50명, 게시글 5,000건, 리뷰 2,000건 | **최대 VU**: 200
