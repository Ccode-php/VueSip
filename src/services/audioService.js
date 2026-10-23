import api from './api'

export default {
    async getAll() {
        const response = await api.get('/audio-files')
        return response.data
    },

    async getOne(id) {
        const response = await api.get(`/audio-files/${id}`)
        return response.data
    },

    async create(formData) {
        const response = await api.post(
            '/audio-files',
            formData,
            {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
                // Katta fayl konvertatsiya qilinadi (ffmpeg), shuning uchun kutish vaqti uzoqroq
                timeout: 180000,
            }
        )

        return response.data
    },

    async update(id, data) {
        const response = await api.put(`/audio-files/${id}`, data)
        return response.data
    },

    async delete(id) {
        const response = await api.delete(`/audio-files/${id}`)
        return response.data
    },

    // <audio> pleyer uchun manzil. Fayl endi Asterisk papkasida turadi,
    // shuning uchun /storage emas, Laravel orqali beriladi.
    streamUrl(id) {
        const base = import.meta.env.VITE_API_URL || '/api'
        return `${base}/audio-files/${id}/stream`
    },
}
