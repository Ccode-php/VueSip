import axios from 'axios'

// Hamma joyda bir xil: '/api'.
//  - Windows (npm run dev): vite.config.js dagi proxy 127.0.0.1:8000 ga yo'naltiradi
//  - K3s: Ingress /api ni Laravel ga yo'naltiradi
const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || '/api',
    headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
    },
})

api.interceptors.response.use((response) => {
    // SIP trunk saqlandi, lekin Asterisk fayliga yozish yoki reload bajarilmadi.
    // Backend buni `sync_error` sifatida qaytaradi (jimgina yutib yubormaydi).
    const syncError = response.data?.sync_error

    if (syncError) {
        window.alert(
            'SIP Trunk bazaga saqlandi, lekin Asterisk sozlamasi yangilanmadi:\n\n' +
            syncError
        )
    }

    return response
})

export default api
