import api from './api'

export default {
    // params: { page, per_page, campaign_id, status, search }
    // Javob: { data: [...], current_page, last_page, total, ... }
    async getAll(params = {}) {
        const response = await api.get('/call-results', { params })
        return response.data
    },
}
