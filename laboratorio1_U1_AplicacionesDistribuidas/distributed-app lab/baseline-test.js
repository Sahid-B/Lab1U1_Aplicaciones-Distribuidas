import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
    vus: 100,
    duration: '30s',

    thresholds: {
        http_req_failed: ['rate<0.01'],
        http_req_duration: ['p(95)<250'],
    },
};

export default function () {

    const res = http.get(
        'http://localhost:30080/api/info'
    );

    check(res, {
        'status is 200': (r) => r.status === 200,
    });

    if (res.status === 200) {

        const data = res.json();

        // Mostrar solo las primeras 2 iteraciones
        // de cada usuario virtual.
        if (__ITER < 2) {

            console.log(
                `VU ${__VU} | ` +
                `Iteration ${__ITER} | ` +
                `Pod: ${data.pod} | ` +
                `Version: ${ data.version }`
            );
        }
    }

    sleep(0.1);
}
