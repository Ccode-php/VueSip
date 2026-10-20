import api from './api'

export default {
    async getAll() {
        const response = await api.get(
            '/campaigns'
        )

        return response.data
    },

    async getOne(id) {
        const response = await api.get(
            `/campaigns/${id}`
        )

        return response.data
    },

    async create(data) {
        const response = await api.post(
            '/campaigns',
            data
        )

        return response.data
    },

    async update(id, data) {
        const response = await api.put(
            `/campaigns/${id}`,
            data
        )

        return response.data
    },

    async delete(id) {
        const response = await api.delete(
            `/campaigns/${id}`
        )

        return response.data
    },

    async start(id) {
        const response = await api.post(`/campaigns/${id}/start`)
        return response.data
    },
}