<!-- views/calls/CallResults.vue -->
<script setup>
import { onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import * as XLSX from 'xlsx'

import campaignService from '../../services/campaignService'
import callResultService from '../../services/callResultService'
import {
    STATUS_FILTERS,
    callStatus,
    formatDateTime,
    formatDuration,
} from '../../utils/callStatus'

const PER_PAGE = 50

const items = ref([])
const campaigns = ref([])

const loading = ref(false)
const exporting = ref(false)
const error = ref('')

const page = ref(1)
const lastPage = ref(1)
const total = ref(0)

const filters = reactive({
    campaign_id: '',
    status: '',
    search: '',
})

let searchTimer = null

function buildParams(extra = {}) {
    const params = { ...extra }

    if (filters.campaign_id) params.campaign_id = filters.campaign_id
    if (filters.status) params.status = filters.status
    if (filters.search.trim()) params.search = filters.search.trim()

    return params
}

async function load() {
    loading.value = true
    error.value = ''

    try {
        const response = await callResultService.getAll(
            buildParams({ page: page.value, per_page: PER_PAGE })
        )

        items.value = Array.isArray(response.data) ? response.data : []
        lastPage.value = response.last_page || 1
        total.value = response.total || 0
    } catch (e) {
        console.error('Natijalarni yuklashda xatolik:', e)

        error.value =
            e.response?.data?.message ||
            'Natijalarni yuklashda xatolik yuz berdi.'
    } finally {
        loading.value = false
    }
}

async function loadCampaigns() {
    try {
        const response = await campaignService.getAll()

        campaigns.value = response.data || []
    } catch (e) {
        console.error(e)
    }
}

function goToPage(value) {
    if (value < 1 || value > lastPage.value || value === page.value) {
        return
    }

    page.value = value
    load()
}

// Filtr o'zgarganda 1-sahifadan boshlaymiz
watch(() => [filters.campaign_id, filters.status], () => {
    page.value = 1
    load()
})

// Qidiruvda har bir harfga so'rov yubormaslik uchun biroz kutamiz
watch(() => filters.search, () => {
    clearTimeout(searchTimer)

    searchTimer = setTimeout(() => {
        page.value = 1
        load()
    }, 400)
})

async function exportToExcel() {
    if (!total.value) {
        alert('Eksport qilish uchun ma’lumot yo‘q.')
        return
    }

    exporting.value = true

    try {
        const all = []
        let current = 1
        let last = 1

        // Filtrga mos hamma yozuvlarni bo'lib-bo'lib olamiz
        do {
            const response = await callResultService.getAll(
                buildParams({ page: current, per_page: 1000 })
            )

            all.push(...(response.data || []))

            last = response.last_page || 1
            current += 1
        } while (current <= last && all.length < 50000)

        const rows = all.map((item, index) => ({
            '#': index + 1,
            'Kampaniya': item.campaign?.name || '',
            'Abonent': item.name,
            'Telefon raqami': item.phone,
            'Holat': callStatus(item).label,
            'Urinish': `${item.attempt} / ${item.max_attempts}`,
            'Davomiyligi (soniya)': item.duration || 0,
            'Boshlangan': formatDateTime(item.started_at),
            'Tugagan': formatDateTime(item.finished_at),
            'Izoh': item.error_message || item.sip_reason || '',
        }))

        const worksheet = XLSX.utils.json_to_sheet(rows)
        const workbook = XLSX.utils.book_new()

        XLSX.utils.book_append_sheet(workbook, worksheet, 'Hisobot')

        XLSX.writeFile(
            workbook,
            `Qongiroq_natijalari_${new Date().toISOString().slice(0, 10)}.xlsx`
        )
    } catch (e) {
        console.error(e)
        alert('Excel faylni tayyorlashda xatolik yuz berdi.')
    } finally {
        exporting.value = false
    }
}

onMounted(() => {
    loadCampaigns()
    load()
})

onUnmounted(() => {
    clearTimeout(searchTimer)
})
</script>

<template>
    <div class="page">
        <div class="page-header">
            <div>
                <h1>Qo‘ng‘iroqlar natijalari</h1>
                <p class="page-description">
                    Barcha kampaniyalar bo‘yicha natijalar va Excel eksport.
                </p>
            </div>

            <button
                class="btn btn-primary"
                type="button"
                :disabled="exporting || !total"
                @click="exportToExcel"
            >
                {{ exporting ? 'Tayyorlanmoqda...' : '📥 Excelga yuklash (.xlsx)' }}
            </button>
        </div>

        <div class="card">
            <div class="cs-toolbar">
                <input
                    v-model="filters.search"
                    type="text"
                    placeholder="Abonent ismi yoki telefon bo‘yicha qidirish..."
                    class="form-control cs-grow"
                />

                <select v-model="filters.campaign_id" class="form-control">
                    <option value="">Barcha kampaniyalar</option>
                    <option
                        v-for="campaign in campaigns"
                        :key="campaign.id"
                        :value="campaign.id"
                    >
                        {{ campaign.name }}
                    </option>
                </select>

                <select v-model="filters.status" class="form-control">
                    <option
                        v-for="option in STATUS_FILTERS"
                        :key="option.value"
                        :value="option.value"
                    >
                        {{ option.label }}
                    </option>
                </select>
            </div>

            <div v-if="error" class="alert alert-error">{{ error }}</div>

            <div v-if="loading" class="loading">Ma’lumotlar yuklanmoqda...</div>

            <div v-else-if="!items.length" class="empty">
                Qo‘ng‘iroq natijalari topilmadi.
            </div>

            <div v-else class="table-wrapper">
                <table class="table">
                    <thead>
                        <tr>
                            <th>Kampaniya</th>
                            <th>Abonent</th>
                            <th>Telefon</th>
                            <th>Holat</th>
                            <th>Urinish</th>
                            <th>Davomiylik</th>
                            <th>Vaqt</th>
                        </tr>
                    </thead>

                    <tbody>
                        <tr v-for="item in items" :key="item.id">
                            <td>{{ item.campaign?.name || '—' }}</td>

                            <td>
                                <strong>{{ item.name }}</strong>
                            </td>

                            <td>{{ item.phone }}</td>

                            <td>
                                <span class="cs-badge" :class="callStatus(item).cls">
                                    {{ callStatus(item).label }}
                                </span>
                            </td>

                            <td>{{ item.attempt }} / {{ item.max_attempts }}</td>

                            <td>{{ formatDuration(item.duration) }}</td>

                            <td>{{ formatDateTime(item.started_at) }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div v-if="items.length" class="cs-pager">
                <span>
                    Jami: {{ total }} ta yozuv · {{ page }} / {{ lastPage }}-sahifa
                </span>

                <div class="cs-pager-buttons">
                    <button
                        type="button"
                        class="btn btn-secondary"
                        :disabled="page <= 1 || loading"
                        @click="goToPage(page - 1)"
                    >
                        ← Oldingi
                    </button>

                    <button
                        type="button"
                        class="btn btn-secondary"
                        :disabled="page >= lastPage || loading"
                        @click="goToPage(page + 1)"
                    >
                        Keyingi →
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>
