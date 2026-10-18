import http from 'k6/http';
import { check } from 'k6';

export const options = {
    scenarios: {
        burst: {
            executor: 'per-vu-iterations',
            vus: 100,
            iterations: 1,
            maxDuration: '30s',
        },
    },
};

export default function () {
    const res = http.get('http://localhost:30080/increment');
    check(res, { 'status is 200': (r) => r.status === 200 });
    const d = res.json();
    console.log(`VU ${__VU} | Pod: ${d.pod} | Counter: ${d.counter}`);
}
