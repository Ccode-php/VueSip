import api from './api'

export default {
    async getAll() {
        const response = await api.get('/campaigns')
        return response.data
    },

    async getOne(id) {
        const response = await api.get(`/campaigns/${id}`)
        return response.data
    },

    // Yengil so'rov: faqat holat va hisoblagichlar (real-time sahifa shuni chaqiradi)
    async getStats(id) {
        const response = await api.get(`/campaigns/${id}/stats`)
        return response.data
    },

    // Sahifalangan abonentlar ro'yxati: { data, current_page, last_page, total, ... }
    async getRecipients(id, params = {}) {
        const response = await api.get(`/campaigns/${id}/recipients`, { params })
        return response.data
    },

    async create(data) {
        const response = await api.post('/campaigns', data)
        return response.data
    },

    async update(id, data) {
        const response = await api.put(`/campaigns/${id}`, data)
        return response.data
    },

    async delete(id) {
        const response = await api.delete(`/campaigns/${id}`)
        return response.data
    },

    async start(id) {
        const response = await api.post(`/campaigns/${id}/start`)
        return response.data
    },

    async stop(id) {
        const response = await api.post(`/campaigns/${id}/stop`)
        return response.data
    },
}
