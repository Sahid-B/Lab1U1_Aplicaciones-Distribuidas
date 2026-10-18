import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = 'http://localhost:30080';

export const options = {
    vus: 20,
    duration: '40s',
};

export function setup() {
    http.get(`${BASE}/reset-global`);
}

export default function () {
    const requestId = `vu${__VU}-it${__ITER}-${Date.now()}`;
    const res = http.get(`${BASE}/increment-global?requestId=${requestId}`);
    const ok = check(res, { 'status is 200': (r) => r.status === 200 });
    if (ok) {
        console.log(`OK | VU ${__VU} | Pod: ${res.json().pod} | Global: ${res.json().globalCounter}`);
    } else {
        console.error(`ERROR | VU ${__VU} | Status: ${res.status}`);
    }
    sleep(0.5);
}

export function teardown() {
    const r = http.get(`${BASE}/global-value`);
    console.log(`FINAL | contador global = ${r.json().globalCounter}`);
}