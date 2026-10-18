import http from 'k6/http';
import { check, sleep } from 'k6';

const VUS = parseInt(__ENV.VUS || '20');

export const options = {
    vus: VUS,
    duration: '30s',
    thresholds: {
        http_req_failed: ['rate<0.01'],
        http_req_duration: ['p(95)<500'],
    },
};

export default function () {
    const res = http.get('http://localhost:30080/api/info');
    check(res, { 'status is 200': (r) => r.status === 200 });
    sleep(0.1);
}
