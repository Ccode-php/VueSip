import api from './api'

export default {
    async getAll() {
        const response = await api.get('/sip-trunks')
        return response.data
    },

    async getOne(id) {
        const response = await api.get(`/sip-trunks/${id}`)
        return response.data
    },

    async create(data) {
        const response = await api.post('/sip-trunks', data)
        return response.data
    },

    async update(id, data) {
        const response = await api.put(`/sip-trunks/${id}`, data)
        return response.data
    },

    async delete(id) {
        const response = await api.delete(`/sip-trunks/${id}`)
        return response.data
    },
}