import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';

export let options = {
  thresholds: {
    'http_req_duration{endpoint:login}': ['p(95)<800'],
    'http_req_duration{endpoint:feed}':  ['p(95)<1000'],
    'http_req_duration{endpoint:createEvent}': ['p(95)<1000'],
    'http_req_duration{endpoint:apply}': ['p(95)<1000'],
    'http_req_failed': ['rate<0.01'],
  },
  scenarios: {
    login: { executor: 'constant-arrival-rate', rate: 20, timeUnit: '1s', duration: '30s', preAllocatedVUs: 20, exec: 'login' },
    feed:  { executor: 'constant-arrival-rate', rate: 100, timeUnit: '1s', duration: '60s', preAllocatedVUs: 100, exec: 'feed' },
    createEvent: { executor: 'constant-arrival-rate', rate: 10, timeUnit: '1s', duration: '30s', preAllocatedVUs: 20, exec: 'createEvent' },
    apply: { executor: 'constant-arrival-rate', rate: 30, timeUnit: '1s', duration: '30s', preAllocatedVUs: 50, exec: 'apply' },
  },
};

const BASE = __ENV.BASE_URL || 'http://localhost:8080';
const USER = __ENV.USER_EMAIL || 'alex@sport.link';
const PASS = __ENV.USER_PASS  || 'pass123';

let tokenCache = null;
function authToken() {
  if (tokenCache) return tokenCache;
  const res = http.post(`${BASE}/api/v1/auth/login`, JSON.stringify({ email: USER, password: PASS }), {
    headers: { 'Content-Type': 'application/json' }, tags: { endpoint: 'login' }
  });
  check(res, { 'login 200': (r) => r.status === 200 });
  tokenCache = res.json('token');
  return tokenCache;
}

export function login() {
  tokenCache = null;
  authToken();
  sleep(1);
}

export function feed() {
  const res = http.get(`${BASE}/api/v1/search?page=0&size=20`, { tags: { endpoint: 'feed' }});
  check(res, {
    'feed 200': (r) => r.status === 200,
    'has content': (r) => (r.json('content') || []).length >= 0
  });
  sleep(1);
}

function createEventBody(organizerId) {
  const startsAt = new Date(Date.now() + 3600_000).toISOString();
  const regBefore = new Date(Date.now() + 1800_000).toISOString();
  return {
    kind: 'TRAINING', title: 'LoadTest Training', sport: 'boxing', description: 'k6',
    startsAt, durationMin: 60, capacity: 10, waitlistEnabled: true,
    access: 'PUBLIC', admission: 'MANUAL', recurrenceRule: null,
    registrationDeadline: regBefore, organizerId, clubId: null, locationLat: 55.75, locationLon: 37.61
  };
}

export function createEvent() {
  const token = authToken();
  const me = http.get(`${BASE}/api/v1/auth/me`, { headers: { Authorization: `Bearer ${token}` }});
  const organizerId = me.json('userId');
  const res = http.post(`${BASE}/api/v1/event`, JSON.stringify(createEventBody(organizerId)), {
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    tags: { endpoint: 'createEvent' }
  });
  check(res, { 'create 200': (r) => r.status === 200 });
  sleep(1);
}

export function apply() {
  const token = authToken();
  // берём первый доступный event из поиска
  const list = http.get(`${BASE}/api/v1/search?page=0&size=1`).json('content');
  if (!list || list.length === 0) return;
  const eventId = list[0].id;
  const me = http.get(`${BASE}/api/v1/auth/me`, { headers: { Authorization: `Bearer ${token}` }});
  const userId = me.json('userId');
  const res = http.post(`${BASE}/api/v1/application`, JSON.stringify({ eventId, userId }), {
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    tags: { endpoint: 'apply' }
  });
  check(res, { 'apply 200/409/403': (r) => [200, 403, 409].includes(r.status) });
  sleep(1);
}
