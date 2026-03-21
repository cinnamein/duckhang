import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Rate } from 'k6/metrics';

// ============================================================
// 🐥 덕행(Dukhaeng) 백엔드 성능 부하 테스트 (대량 데이터용)
// ============================================================

// --- 커스텀 메트릭 ---
const boardListDuration = new Trend('board_list_duration', true);
const boardDetailDuration = new Trend('board_detail_duration', true);
const myPageDuration = new Trend('mypage_duration', true);
const reviewListDuration = new Trend('review_list_duration', true);
const searchDuration = new Trend('search_duration', true);
const chatRoomListDuration = new Trend('chatroom_list_duration', true);
const chatRecentDuration = new Trend('chat_recent_duration', true);
const errorRate = new Rate('errors');

const BASE_URL = __ENV.BASE_URL || 'http://localhost';

export const options = {
  scenarios: {
    // 시나리오 1: 일반 브라우징 (게시글 목록 + 상세)
    browsing: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 10 },
        { duration: '1m', target: 50 },
        { duration: '2m', target: 50 },
        { duration: '1m', target: 100 },
        { duration: '2m', target: 100 },
        { duration: '30s', target: 0 },
      ],
      exec: 'browsingScenario',
    },
    // 시나리오 2: 마이페이지 + 리뷰 (N+1 집중 테스트)
    mypage_heavy: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 5 },
        { duration: '1m', target: 30 },
        { duration: '2m', target: 30 },
        { duration: '1m', target: 60 },
        { duration: '2m', target: 60 },
        { duration: '30s', target: 0 },
      ],
      exec: 'mypageScenario',
      startTime: '10s',
    },
    // 시나리오 3: 검색
    search: {
      executor: 'constant-arrival-rate',
      rate: 20,
      timeUnit: '1s',
      duration: '3m',
      preAllocatedVUs: 50,
      exec: 'searchScenario',
      startTime: '20s',
    },
    // 시나리오 4: 채팅 이력 조회
    chat_history: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 10 },
        { duration: '2m', target: 40 },
        { duration: '2m', target: 40 },
        { duration: '30s', target: 0 },
      ],
      exec: 'chatScenario',
      startTime: '15s',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<2000', 'p(99)<5000'],
    'board_list_duration': ['p(95)<1000'],
    'board_detail_duration': ['p(95)<500'],
    'mypage_duration': ['p(95)<2000'],
    'review_list_duration': ['p(95)<1000'],
    'search_duration': ['p(95)<1500'],
    'chatroom_list_duration': ['p(95)<1000'],
    'chat_recent_duration': ['p(95)<1000'],
    errors: ['rate<0.05'],
  },
};

// --- 테스트 데이터 ---
// 게시글 타입: SELL, PURCHASE, RENTAL만 상세 조회 가능 (서브테이블 있음)
const BOARD_TYPES_LIST = ['SELL', 'PURCHASE', 'RENTAL', 'EXCHANGE', 'DELEGATE', 'HELPER', 'MATE'];
const BOARD_TYPES_DETAIL = ['SELL', 'PURCHASE', 'RENTAL'];

const SEARCH_KEYWORDS = ['포카', '앨범', '굿즈', '트레카', '인형', '키링', '슬로건', '티셔츠', 'BTS', 'NCT'];

// 유저 UUID: LPAD(HEX(i), 32, '0') 형식 → 00000000-0000-0000-0000-00000000000N
function userUuid(n) {
  const hex = n.toString(16).padStart(32, '0');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}

// 50명의 유저 UUID
const SAMPLE_USER_UUIDS = [];
for (let i = 1; i <= 50; i++) {
  SAMPLE_USER_UUIDS.push(userUuid(i));
}

// 게시글 ID: 1 ~ 5000 범위에서 랜덤 샘플링
const SAMPLE_SELL_IDS = [1, 50, 100, 200, 400, 600, 800, 1000];
const SAMPLE_PURCHASE_IDS = [1001, 1100, 1200, 1400, 1600, 1800];
const SAMPLE_RENTAL_IDS = [1801, 1900, 2000, 2200, 2400, 2500];
const SAMPLE_ROOM_IDS = [1, 2, 3, 4, 5];

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ============================================================
// 시나리오 1: 일반 브라우징
// ============================================================
export function browsingScenario() {
  group('게시글 목록 조회', () => {
    const boardType = randomItem(BOARD_TYPES_LIST);
    const page = Math.floor(Math.random() * 10);

    const res = http.get(
      `${BASE_URL}/api/board/${boardType}?page=${page}&size=20`,
      { tags: { name: 'GET /board/{type}' } }
    );

    boardListDuration.add(res.timings.duration);
    check(res, {
      '게시글 목록 200 OK': (r) => r.status === 200,
      '게시글 목록 응답시간 < 1s': (r) => r.timings.duration < 1000,
    }) || errorRate.add(1);
  });

  sleep(1);

  group('게시글 상세 조회', () => {
    // SELL/PURCHASE/RENTAL만 상세 조회 (서브테이블 있는 타입)
    const typeChoice = Math.floor(Math.random() * 3);
    let boardType, boardId;
    if (typeChoice === 0) {
      boardType = 'SELL';
      boardId = randomItem(SAMPLE_SELL_IDS);
    } else if (typeChoice === 1) {
      boardType = 'PURCHASE';
      boardId = randomItem(SAMPLE_PURCHASE_IDS);
    } else {
      boardType = 'RENTAL';
      boardId = randomItem(SAMPLE_RENTAL_IDS);
    }

    const res = http.get(
      `${BASE_URL}/api/board/${boardType}/${boardId}`,
      { tags: { name: 'GET /board/{type}/{id}' } }
    );

    boardDetailDuration.add(res.timings.duration);
    check(res, {
      '게시글 상세 200 OK': (r) => r.status === 200,
      '게시글 상세 응답시간 < 500ms': (r) => r.timings.duration < 500,
    }) || errorRate.add(1);
  });

  sleep(Math.random() * 2 + 1);
}

// ============================================================
// 시나리오 2: 마이페이지 (N+1 집중)
// ============================================================
export function mypageScenario() {
  const userId = randomItem(SAMPLE_USER_UUIDS);

  group('마이페이지 - 내 게시글 조회', () => {
    const res = http.get(
      `${BASE_URL}/api/board/user/${userId}`,
      { tags: { name: 'GET /board/user/{id}' } }
    );

    myPageDuration.add(res.timings.duration);
    check(res, {
      '마이페이지 200 OK': (r) => r.status === 200,
      '마이페이지 응답시간 < 2s': (r) => r.timings.duration < 2000,
    }) || errorRate.add(1);
  });

  sleep(0.5);

  group('마이페이지 - 리뷰 목록 조회', () => {
    const res = http.get(
      `${BASE_URL}/api/review/${userId}?pageNumber=0&pageSize=10`,
      { tags: { name: 'GET /review/{userId}' } }
    );

    reviewListDuration.add(res.timings.duration);
    check(res, {
      '리뷰 목록 200 OK': (r) => r.status === 200,
      '리뷰 목록 응답시간 < 1s': (r) => r.timings.duration < 1000,
    }) || errorRate.add(1);
  });

  sleep(Math.random() * 2 + 1);
}

// ============================================================
// 시나리오 3: 검색
// ============================================================
export function searchScenario() {
  group('물품 검색', () => {
    const keyword = randomItem(SEARCH_KEYWORDS);

    const res = http.get(
      `${BASE_URL}/api/board/search?keyword=${encodeURIComponent(keyword)}&page=0&size=20`,
      { tags: { name: 'GET /board/search' } }
    );

    searchDuration.add(res.timings.duration);
    check(res, {
      '검색 200 OK': (r) => r.status === 200,
      '검색 응답시간 < 1.5s': (r) => r.timings.duration < 1500,
    }) || errorRate.add(1);
  });
}

// ============================================================
// 시나리오 4: 채팅 이력 조회
// ============================================================
export function chatScenario() {
  group('채팅방 목록 조회', () => {
    const res = http.get(
      `${BASE_URL}/api/chat/chatroom`,
      { tags: { name: 'GET /chat/chatroom' } }
    );

    chatRoomListDuration.add(res.timings.duration);
    check(res, {
      '채팅방 목록 응답': (r) => r.status === 200 || r.status === 401,
    }) || errorRate.add(1);
  });

  sleep(0.5);

  group('최근 채팅 50개 조회', () => {
    const roomId = randomItem(SAMPLE_ROOM_IDS);

    const res = http.get(
      `${BASE_URL}/api/chat/recent/${roomId}?page=0&size=50&sort=createdAt,desc`,
      { tags: { name: 'GET /chat/recent/{roomId}' } }
    );

    chatRecentDuration.add(res.timings.duration);
    check(res, {
      '채팅 이력 응답': (r) => r.status === 200 || r.status === 401,
      '채팅 이력 응답시간 < 1s': (r) => r.timings.duration < 1000,
    }) || errorRate.add(1);
  });

  sleep(Math.random() * 2 + 1);
}
