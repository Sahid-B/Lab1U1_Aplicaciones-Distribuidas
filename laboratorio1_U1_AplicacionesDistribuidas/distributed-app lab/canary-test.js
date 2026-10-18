import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
    vus: 20,
    duration: '60s',
    thresholds: {
        http_req_failed: ['rate<0.01'],
        http_req_duration: ['p(95)<500'],
        checks: ['rate>0.99'],
    },
};

export default function () {
    const res = http.get('http://localhost:30080/api/info');

    const ok = check(res, {
        'status is 200': (r) => r.status === 200,
    });

    if (ok) {
        const d = res.json();
        console.log(
            `VU ${__VU} | Iteration ${__ITER} | ` +
            `Pod: ${d.pod} | Version: ${d.version}`
        );
    } else {
        console.error(`ERROR | VU ${__VU} | Status: ${res.status}`);
    }

    sleep(0.5);
}
