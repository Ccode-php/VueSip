import api from './api'

export default {
    async getAll() {
        const response = await api.get(
            '/subscriber-groups'
        )

        return response.data
    },

    async getTree() {
        const response = await api.get(
            '/subscriber-groups-tree'
        )

        return response.data
    },

    async getOne(id) {
        const response = await api.get(
            `/subscriber-groups/${id}`
        )

        return response.data
    },

    async create(data) {
        const response = await api.post(
            '/subscriber-groups',
            data
        )

        return response.data
    },

    async update(id, data) {
        const response = await api.put(
            `/subscriber-groups/${id}`,
            data
        )

        return response.data
    },

    async delete(id) {
        const response = await api.delete(
            `/subscriber-groups/${id}`
        )

        return response.data
    },
}