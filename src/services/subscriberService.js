
import api from './api'

export default {
    async getAll(params = {}) {
        const response = await api.get('/subscribers', { params })
        return response.data
    },

    async getOne(id) {
        const response = await api.get(`/subscribers/${id}`)
        return response.data
    },

    async create(data) {
        const response = await api.post('/subscribers', data)
        return response.data
    },

    async update(id, data) {
        const response = await api.put(`/subscribers/${id}`, data)
        return response.data
    },

    async delete(id) {
        const response = await api.delete(`/subscribers/${id}`)
        return response.data
    },

    async importSubscribers(subscribers) {
        const response = await api.post('/subscribers/import', {
            subscribers,
        })

        return response.data
    },
}