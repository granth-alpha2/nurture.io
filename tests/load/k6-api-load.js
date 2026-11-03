import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const failureRate = new Rate('failed_requests');
const apiLatency = new Trend('api_latency');

export const options = {
  stages: [
    { duration: '30s', target: 20 },  // Ramp up to 20 virtual pedestrians
    { duration: '1m', target: 50 },   // Sustain 50 concurrent pedestrians
    { duration: '30s', target: 0 },   // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<250'], // 95% of requests must complete below 250ms
    failed_requests: ['rate<0.005'],  // Error rate must be less than 0.5% (API availability >99.5%)
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:3000';

export default function () {
  // 1. Health check
  let res = http.get(`${BASE_URL}/healthz`);
  let success = check(res, {
    'healthz status is 200': (r) => r.status === 200,
  });
  failureRate.add(!success);
  apiLatency.add(res.timings.duration);

  sleep(1);

  // 2. Place search
  const searchPayload = JSON.stringify({
    query: 'Demo Station',
    currentLocation: { latitude: 12.9716, longitude: 77.5946 },
  });
  const headers = { 'Content-Type': 'application/json' };
  res = http.post(`${BASE_URL}/v1/places/search`, searchPayload, { headers });
  success = check(res, {
    'search status is 200': (r) => r.status === 200,
  });
  failureRate.add(!success);
  apiLatency.add(res.timings.duration);

  sleep(2);
}
