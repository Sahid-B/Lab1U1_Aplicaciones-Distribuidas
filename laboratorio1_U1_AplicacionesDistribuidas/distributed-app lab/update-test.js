import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
    vus: 10,
    duration: '60s',

    thresholds: {
        http_req_failed: ['rate<0.01'],
        http_req_duration: ['p(95)<500'],
        checks: ['rate>0.99'],
    },
};

export default function () {

    const res = http.get('http://localhost:30080/api/info');

    const success = check(res, {
        'status is 200': (r) => r.status === 200,
    });

    if (success) {
        const data = res.json();

        // Mostrar una muestra periódica para observar
        // el cambio de Pods y versiones.
        if (__ITER % 5 === 0) {
            console.log(
                `VU ${__VU} | ` +
                `Iteration ${__ITER} | ` +
                `Pod: ${data.pod} | ` +
                `Version: ${data.version}`
            );
        }
    } else {
        console.error(
            `ERROR | VU ${__VU} | ` +
            `Iteration ${__ITER} | ` +
            `Status: ${res.status}`
        );
    }

    sleep(0.5);
}