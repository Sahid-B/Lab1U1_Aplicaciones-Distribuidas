import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
    vus: 1,
    duration: '10s',
};

export default function () {

    const res = http.get(
        'http://localhost:30080/api/info'
    );

    check(res, {
        'status is 200': (r) => r.status === 200,
        'response contains version':
            (r) => r.body.includes('version'),
    });

    if (res.status === 200) {

        const data = res.json();

        console.log(
            `VU ${__VU} | ` +
            `Iteration ${__ITER} | ` +
            `Pod: ${data.pod} | ` +
            `Version: ${ data.version }`
        );
    }

    sleep(1);
}