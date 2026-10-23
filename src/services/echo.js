import Echo from 'laravel-echo'
import Pusher from 'pusher-js'
import { ref } from 'vue'

// Reverb Pusher protokolida ishlaydi, shuning uchun pusher-js kerak.
window.Pusher = Pusher

/**
 * WebSocket holati: initialized | connecting | connected | unavailable | failed | disconnected
 * Sahifada "Jonli" belgisini ko'rsatish uchun ishlatiladi.
 */
export const wsState = ref('idle')

let echo = null

/**
 * Echo faqat birinchi marta kerak bo'lganda yaratiladi.
 * Manzil sahifaning o'zi bilan bir xil (same-origin):
 *   - K3s:   Ingress /app yo'lini Reverb ga yo'naltiradi
 *   - dev:   vite.config.js dagi proxy /app ni Reverb ga yo'naltiradi
 */
export function getEcho() {
    if (echo) {
        return echo
    }

    const secure = window.location.protocol === 'https:'
    const port = Number(window.location.port || (secure ? 443 : 80))

    echo = new Echo({
        broadcaster: 'reverb',
        // Bu kalit ochiq (brauzerga ko'rinadi). Maxfiy qism REVERB_APP_SECRET serverda qoladi.
        key: import.meta.env.VITE_REVERB_APP_KEY || 'avtosip',
        wsHost: window.location.hostname,
        wsPort: port,
        wssPort: port,
        forceTLS: secure,
        enabledTransports: ['ws', 'wss'],
    })

    const connection = echo.connector?.pusher?.connection

    if (connection) {
        wsState.value = connection.state

        connection.bind('state_change', (states) => {
            wsState.value = states.current
        })
    }

    return echo
}
