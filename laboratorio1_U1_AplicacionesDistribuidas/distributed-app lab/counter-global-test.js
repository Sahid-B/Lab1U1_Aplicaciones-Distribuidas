import http from 'k6/http';
import { check } from 'k6';

const BASE = 'http://localhost:30080';

export const options = {
    scenarios: {
        burst: {
            executor: 'per-vu-iterations',
            vus: 100,
            iterations: 1,
            maxDuration: '30s',
        },
    },
    thresholds: { http_req_failed: ['rate<0.01'] },
};

export function setup() {
    const r = http.get(`${BASE}/reset-global`);
    console.log(`SETUP | contador reiniciado: ${r.body}`);
}

export default function () {
    const requestId = `vu${__VU}-it${__ITER}-${Date.now()}`;
    const res = http.get(`${BASE}/increment-global?requestId=${requestId}`);
    check(res, { 'status is 200': (r) => r.status === 200 });
    if (res.status === 200) {
        const d = res.json();
        console.log(`VU ${__VU} | Pod: ${d.pod} | Global: ${d.globalCounter} | Attempts: ${d.attempts}`);
    }
}

export function teardown() {
    const r = http.get(`${BASE}/global-value`);
    console.log(`FINAL | contador global = ${r.json().globalCounter} (esperado: 100)`);
}
