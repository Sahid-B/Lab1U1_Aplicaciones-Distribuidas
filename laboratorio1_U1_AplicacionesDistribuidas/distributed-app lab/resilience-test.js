import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
    stages: [
        { duration: '10s', target: 20 },
        { duration: '40s', target: 20 },
        { duration: '10s', target: 0 },
    ],

    thresholds: {
        http_req_failed: ['rate<0.01'],
        http_req_duration: ['p(95)<500'],
        checks: ['rate>0.99'],
    },
};

export default function () {

    const res = http.get(
        'http://localhost:30080/api/info'
    );

    const success = check(res, {
        'status is 200': (r) => r.status === 200,
    });

    if (success) {

        const data = res.json();

        // Mostrar una muestra para no saturar la consola
        if (__ITER % 10 === 0) {

            console.log(
                `VU ${__VU} | ` +
                `Iteration ${__ITER} | ` +
                `Pod: ${data.pod} | ` +
                `Version: ${ data.version }`
            );
        }
    }

    sleep(0.25);
}