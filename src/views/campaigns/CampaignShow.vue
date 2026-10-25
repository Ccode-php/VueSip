<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import campaignService from '../../services/campaignService'
import { getEcho, wsState } from '../../services/echo'
import {
    STATUS_FILTERS,
    callStatus,
    formatDateTime,
    formatDuration,
    formatTime,
    groupRecipients,
} from '../../utils/callStatus'

const route = useRoute()
const router = useRouter()

const campaignId = computed(() => route.params.id)

const PER_PAGE = 50

const campaign = ref(null)
const stats = ref(emptyStats())

const loading = ref(true)
const error = ref('')
const starting = ref(false)
const stopping = ref(false)

const rows = ref([])
const groupedRows = computed(() => groupRecipients(rows.value))
const rowsLoading = ref(false)
const page = ref(1)
const lastPage = ref(1)
const totalRows = ref(0)
const statusFilter = ref('')

let channelName = null
let statsTimer = null
let fallbackTimer = null

function emptyStats() {
    return {
        total: 0,
        pending: 0,
        ringing: 0,
        in_call: 0,
        answered: 0,
        played: 0,
        busy: 0,
        no_answer: 0,
        failed: 0,
        finished: 0,
        percent: 0,
    }
}

/* ------------------------------------------------------------------ */
/* Ma'lumot yuklash                                                    */
/* ------------------------------------------------------------------ */

async function loadCampaign({ silent = false } = {}) {
    if (!silent) {
        loading.value = true
    }

    error.value = ''

    try {
        const response = await campaignService.getOne(campaignId.value)
        const data = response.data

        campaign.value = data
        stats.value = { ...emptyStats(), ...(data?.stats || {}) }
    } catch (e) {
        console.error(e)

        if (!silent) {
            error.value =
                e.response?.data?.message ||
                'Campaign ma’lumotlarini yuklashda xatolik.'
        }
    } finally {
        loading.value = false
    }
}

// Yengil so'rov: faqat holat va hisoblagichlar
async function loadStats() {
    try {
        const response = await campaignService.getStats(campaignId.value)
        const data = response.data

        if (campaign.value) {
            campaign.value.status = data.status
            campaign.value.started_at = data.started_at
            campaign.value.finished_at = data.finished_at
        }

        stats.value = { ...emptyStats(), ...(data?.stats || {}) }
    } catch (e) {
        console.error('Hisoblagichlarni yangilashda xatolik:', e)
    }
}

async function loadRows({ silent = false } = {}) {
    if (!silent) {
        rowsLoading.value = true
    }

    try {
        const params = { page: page.value, per_page: PER_PAGE }

        if (statusFilter.value) {
            params.status = statusFilter.value
        }

        const response = await campaignService.getRecipients(campaignId.value, params)

        rows.value = Array.isArray(response.data) ? response.data : []
        lastPage.value = response.last_page || 1
        totalRows.value = response.total || 0

        // Boshqa foydalanuvchi ma'lumotlarni o'chirgan bo'lsa, oxirgi sahifaga qaytamiz
        if (page.value > lastPage.value) {
            page.value = lastPage.value
        }
    } catch (e) {
        console.error('Abonentlarni yuklashda xatolik:', e)
    } finally {
        rowsLoading.value = false
    }
}

async function refreshAll() {
    await Promise.all([loadCampaign({ silent: true }), loadRows()])
}

/* ------------------------------------------------------------------ */
/* Real-time (Reverb)                                                  */
/* ------------------------------------------------------------------ */

function subscribe() {
    try {
        channelName = `campaign.${campaignId.value}`

        getEcho()
            .channel(channelName)
            .listen('.recipient.updated', onRecipientUpdated)
    } catch (e) {
        // WebSocket ishlamasa ham sahifa 10 soniyalik yangilanish bilan ishlayveradi
        console.warn('Real-time ulanish o‘rnatilmadi:', e)
    }
}

function unsubscribe() {
    if (!channelName) {
        return
    }

    try {
        getEcho().leave(channelName)
    } catch (e) {
        console.warn(e)
    }

    channelName = null
}

function onRecipientUpdated(payload) {
    const row = rows.value.find((item) => item.id === payload.id)

    if (row) {
        Object.assign(row, payload)
    }

    scheduleStats()
}

// Ko'p hodisa ketma-ket kelsa, hisoblagich so'rovi bitta bo'lib ketadi
function scheduleStats() {
    clearTimeout(statsTimer)

    statsTimer = setTimeout(loadStats, 1200)
}

// Kampaniya ishlayotganda: WebSocket uzilib qolsa ham ma'lumot eskirmasligi uchun
function startFallback() {
    if (fallbackTimer) {
        return
    }

    fallbackTimer = setInterval(async () => {
        await loadStats()

        if (wsState.value !== 'connected') {
            await loadRows({ silent: true })
        }
    }, 10000)
}

function stopFallback() {
    clearInterval(fallbackTimer)
    fallbackTimer = null
}

watch(
    () => campaign.value?.status,
    (status, previous) => {
        if (['running', 'queued'].includes(status)) {
            startFallback()
            return
        }

        stopFallback()

        // Ishlash tugadi yoki to'xtatildi: oxirgi holatni bir marta yangilab olamiz
        if (previous && ['running', 'queued'].includes(previous)) {
            loadRows({ silent: true })
        }
    }
)

watch(statusFilter, () => {
    page.value = 1
    loadRows()
})

function goToPage(value) {
    if (value < 1 || value > lastPage.value || value === page.value) {
        return
    }

    page.value = value
    loadRows()
}

/* ------------------------------------------------------------------ */
/* Amallar                                                             */
/* ------------------------------------------------------------------ */

async function startCampaign() {
    const text = campaign.value?.status === 'stopped'
        ? 'Kampaniyani davom ettirasizmi?'
        : 'Kampaniyani ishga tushirishni xohlaysizmi? Avtomatik qo‘ng‘iroqlar boshlanadi.'

    if (!confirm(text)) {
        return
    }

    starting.value = true

    try {
        await campaignService.start(campaignId.value)
        await refreshAll()
    } catch (e) {
        alert(e.response?.data?.message || 'Kampaniyani boshlashda xatolik yuz berdi.')
    } finally {
        starting.value = false
    }
}

async function stopCampaign() {
    if (!confirm('Kampaniyani to‘xtatasizmi? Davom etayotgan suhbatlar tugaguncha kutiladi, yangi qo‘ng‘iroq chiqmaydi.')) {
        return
    }

    stopping.value = true

    try {
        await campaignService.stop(campaignId.value)
        await refreshAll()
    } catch (e) {
        alert(e.response?.data?.message || 'Kampaniyani to‘xtatishda xatolik yuz berdi.')
    } finally {
        stopping.value = false
    }
}

/* ------------------------------------------------------------------ */
/* Ko'rinish uchun hisoblangan qiymatlar                              */
/* ------------------------------------------------------------------ */

const canStart = computed(() =>
    ['draft', 'stopped'].includes(String(campaign.value?.status))
)

const canStop = computed(() => campaign.value?.status === 'running')

const statusInfo = computed(() => {
    const status = String(campaign.value?.status || '').toLowerCase()

    const statuses = {
        draft: { label: 'Qoralama', className: 'campaign-status-draft' },
        queued: { label: 'Navbatda', className: 'campaign-status-pending' },
        running: { label: 'Bajarilmoqda', className: 'campaign-status-running' },
        completed: { label: 'Yakunlangan', className: 'campaign-status-completed' },
        failed: { label: 'Xatolik', className: 'campaign-status-failed' },
        stopped: { label: 'To‘xtatilgan', className: 'campaign-status-paused' },
    }

    return statuses[status] || {
        label: campaign.value?.status || 'Noma’lum',
        className: 'campaign-status-default',
    }
})

const targetInfo = computed(() => {
    const type = campaign.value?.target_type

    if (type === 'all') return 'Barcha faol abonentlar'
    if (type === 'groups') return 'Kategoriyalar bo‘yicha'
    if (type === 'individual') return 'Alohida abonentlar'

    return type || 'Ko‘rsatilmagan'
})

const answeredTotal = computed(() => stats.value.answered + stats.value.in_call)
const failedTotal = computed(() => stats.value.busy + stats.value.no_answer + stats.value.failed)

const wsInfo = computed(() => {
    switch (wsState.value) {
        case 'connected':
            return { label: 'Jonli', cls: 'cs-live--on' }
        case 'connecting':
        case 'initialized':
            return { label: 'Ulanmoqda...', cls: 'cs-live--wait' }
        default:
            return { label: 'Jonli aloqa yo‘q (10 soniyada yangilanadi)', cls: 'cs-live--off' }
    }
})

const groupNames = computed(() =>
    Array.isArray(campaign.value?.groups)
        ? campaign.value.groups.map((item) => item.name).join(', ')
        : ''
)

const subscriberNames = computed(() => {
    const names = campaign.value?.subscriber_names

    if (!Array.isArray(names) || !names.length) {
        return ''
    }

    const extra = (campaign.value.subscribers_count || 0) - names.length

    return names.join(', ') + (extra > 0 ? ` va yana ${extra} ta` : '')
})

const chips = computed(() => [
    { label: 'Kutilmoqda', value: stats.value.pending },
    { label: 'Jiringlamoqda', value: stats.value.ringing },
    { label: 'Suhbatda', value: stats.value.in_call },
    { label: 'Javob berdi', value: stats.value.answered },
    { label: 'To‘liq eshitdi', value: stats.value.played },
    { label: 'Band', value: stats.value.busy },
    { label: 'Javob bermadi', value: stats.value.no_answer },
    { label: 'Xatolik', value: stats.value.failed },
])

function relationName(value) {
    if (!value) return '—'
    if (typeof value === 'string') return value

    return value.name || '—'
}

/* ------------------------------------------------------------------ */

onMounted(async () => {
    await loadCampaign()

    if (!campaign.value) {
        return
    }

    await loadRows()
    subscribe()

    if (['running', 'queued'].includes(campaign.value.status)) {
        startFallback()
    }
})

onUnmounted(() => {
    clearTimeout(statsTimer)
    stopFallback()
    unsubscribe()
})
</script>

<template>
    <div class="page campaign-show-page">
        <div class="page-header campaign-show-header">
            <div>
                <div class="eyebrow">QO‘NG‘IROQLAR BOSHQARUVI</div>
                <h1>Campaign tafsilotlari</h1>
                <p class="page-description">
                    Campaign sozlamalari va qo‘ng‘iroqlar natijalarini real vaqtda kuzating.
                </p>
            </div>

            <div class="campaign-show-header-actions">
                <span class="cs-live" :class="wsInfo.cls">{{ wsInfo.label }}</span>

                <button type="button" class="btn btn-secondary" :disabled="loading" @click="refreshAll">
                    ↻ Yangilash
                </button>

                <button v-if="canStart" type="button" class="btn btn-primary" :disabled="starting"
                    @click="startCampaign">
                    {{
                        starting
                            ? 'Ishga tushmoqda...'
                            : (campaign?.status === 'stopped' ? '▶ Davom ettirish' : '🚀 Kampaniyani boshlash')
                    }}
                </button>

                <button v-if="canStop" type="button" class="btn btn-danger" :disabled="stopping" @click="stopCampaign">
                    {{ stopping ? 'To‘xtatilmoqda...' : '⏹ To‘xtatish' }}
                </button>

                <button type="button" class="btn btn-secondary" @click="router.push('/campaigns')">
                    ← Ro‘yxatga qaytish
                </button>
            </div>
        </div>

        <div v-if="error" class="campaign-show-error">
            <div class="campaign-show-error-icon">!</div>
            <div>
                <strong>Ma’lumotlarni yuklab bo‘lmadi</strong>
                <p>{{ error }}</p>
                <button type="button" class="campaign-show-retry" @click="loadCampaign()">
                    Qayta urinish
                </button>
            </div>
        </div>

        <div v-else-if="loading" class="card campaign-show-loading">
            <span class="campaign-show-spinner"></span>
            <span>Campaign ma’lumotlari yuklanmoqda...</span>
        </div>

        <template v-else-if="campaign">
            <section class="campaign-hero-card">
                <div class="campaign-hero-main">
                    <div class="campaign-hero-icon">
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path
                                d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.96.36 1.9.7 2.8a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.84.58 2.8.7A2 2 0 0 1 22 16.92z" />
                        </svg>
                    </div>

                    <div class="campaign-hero-title">
                        <div class="campaign-hero-title-row">
                            <h2>{{ campaign.name || `Campaign #${campaign.id}` }}</h2>
                            <span class="campaign-status-badge" :class="statusInfo.className">
                                <span class="campaign-status-dot"></span>
                                {{ statusInfo.label }}
                            </span>
                        </div>

                        <p>
                            ID: {{ campaign.id }}
                            <span class="campaign-meta-separator">•</span>
                            Yaratilgan: {{ formatDateTime(campaign.created_at) }}
                        </p>
                    </div>
                </div>

                <div class="campaign-hero-stats">
                    <div>
                        <span>Qabul qiluvchilar</span>
                        <strong>{{ stats.total }}</strong>
                    </div>
                    <div>
                        <span>Javob berganlar</span>
                        <strong>{{ answeredTotal }}</strong>
                    </div>
                    <div>
                        <span>Javobsiz / xato</span>
                        <strong>{{ failedTotal }}</strong>
                    </div>
                </div>
            </section>

            <section class="card cs-progress-card">
                <div class="cs-progress-head">
                    <h2>Bajarilish jarayoni</h2>
                    <span class="cs-progress-percent">{{ stats.percent }}%</span>
                </div>

                <div class="cs-progress-bar">
                    <div class="cs-progress-fill" :style="{ width: stats.percent + '%' }"></div>
                </div>

                <div class="cs-chips">
                    <div v-for="chip in chips" :key="chip.label" class="cs-chip">
                        <strong>{{ chip.value }}</strong>
                        <span>{{ chip.label }}</span>
                    </div>
                </div>
            </section>

            <section class="campaign-show-stat-grid">
                <article class="campaign-show-stat-card">
                    <div class="campaign-show-stat-icon stat-icon-blue">☎</div>
                    <div>
                        <span>Parallel qo‘ng‘iroqlar</span>
                        <strong>{{ campaign.max_concurrent_calls ?? 1 }}</strong>
                        <small>Bir vaqtda</small>
                    </div>
                </article>

                <article class="campaign-show-stat-card">
                    <div class="campaign-show-stat-icon stat-icon-purple">↻</div>
                    <div>
                        <span>Urinishlar soni</span>
                        <strong>{{ campaign.max_attempts ?? 1 }}</strong>
                        <small>Har bir raqamga</small>
                    </div>
                </article>

                <article class="campaign-show-stat-card">
                    <div class="campaign-show-stat-icon stat-icon-green">✓</div>
                    <div>
                        <span>Yakunlangan</span>
                        <strong>{{ stats.finished }}</strong>
                        <small>{{ stats.total }} tadan</small>
                    </div>
                </article>

                <article class="campaign-show-stat-card">
                    <div class="campaign-show-stat-icon stat-icon-orange">◎</div>
                    <div>
                        <span>Qamrov turi</span>
                        <strong class="campaign-target-stat">{{ targetInfo }}</strong>
                        <small>Tanlangan qabul qiluvchilar</small>
                    </div>
                </article>
            </section>

            <div class="campaign-show-content-grid">
                <section class="card campaign-show-panel">
                    <div class="campaign-show-panel-heading">
                        <div class="campaign-panel-icon panel-icon-blue">01</div>
                        <div>
                            <h2>Campaign ma’lumotlari</h2>
                            <p>Asosiy sozlamalar</p>
                        </div>
                    </div>

                    <div class="campaign-detail-list">
                        <div class="campaign-detail-row">
                            <span>Campaign nomi</span>
                            <strong>{{ campaign.name || '—' }}</strong>
                        </div>

                        <div class="campaign-detail-row">
                            <span>SIP Trunk</span>
                            <strong>{{ relationName(campaign.sip_trunk) }}</strong>
                        </div>

                        <div class="campaign-detail-row">
                            <span>Audio fayl</span>
                            <strong>{{ relationName(campaign.audio_file) }}</strong>
                        </div>

                        <div class="campaign-detail-row">
                            <span>Qabul qiluvchilar turi</span>
                            <strong>{{ targetInfo }}</strong>
                        </div>

                        <div class="campaign-detail-row">
                            <span>Parallel qo‘ng‘iroqlar</span>
                            <strong>{{ campaign.max_concurrent_calls ?? 1 }} ta</strong>
                        </div>

                        <div class="campaign-detail-row">
                            <span>Urinishlar soni</span>
                            <strong>{{ campaign.max_attempts ?? 1 }} marta</strong>
                        </div>

                        <div class="campaign-detail-row">
                            <span>Qayta urinish oralig‘i</span>
                            <strong>{{ campaign.retry_delay_minutes ?? 10 }} daqiqa</strong>
                        </div>

                        <div class="campaign-detail-row">
                            <span>Boshlangan vaqt</span>
                            <strong>{{ formatDateTime(campaign.started_at) }}</strong>
                        </div>

                        <div class="campaign-detail-row">
                            <span>Yakunlangan vaqt</span>
                            <strong>{{ formatDateTime(campaign.finished_at) }}</strong>
                        </div>
                    </div>
                </section>

                <section class="card campaign-show-panel">
                    <div class="campaign-show-panel-heading">
                        <div class="campaign-panel-icon panel-icon-purple">02</div>
                        <div>
                            <h2>Qabul qiluvchilar</h2>
                            <p>Campaign qamrovi haqida</p>
                        </div>
                    </div>

                    <div class="campaign-target-summary">
                        <div class="campaign-target-summary-icon">
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                                <circle cx="12" cy="8" r="4" />
                                <path d="M4 21v-2a8 8 0 0 1 16 0v2z" />
                            </svg>
                        </div>
                        <div>
                            <span>Tanlov turi</span>
                            <strong>{{ targetInfo }}</strong>
                        </div>
                    </div>

                    <div v-if="campaign.target_type === 'groups'" class="campaign-target-detail">
                        <span>Tanlangan kategoriyalar</span>
                        <p v-if="groupNames">{{ groupNames }}</p>
                        <p v-else>Kategoriyalar topilmadi.</p>
                    </div>

                    <div v-else-if="campaign.target_type === 'individual'" class="campaign-target-detail">
                        <span>Tanlangan abonentlar</span>
                        <p v-if="subscriberNames">{{ subscriberNames }}</p>
                        <p v-else>Abonentlar topilmadi.</p>
                    </div>

                    <div v-else class="campaign-target-detail">
                        <span>Qamrov</span>
                        <p>Campaign yaratilgan paytdagi barcha faol abonentlar.</p>
                    </div>

                    <div class="campaign-target-warning">
                        <span>i</span>
                        <p>
                            Abonent ro‘yxati campaign yaratilgan paytda belgilanadi.
                            Keyin qo‘shilgan abonentlar bu campaignga kirmaydi.
                            Bitta abonentning har bir telefon raqami alohida qator bo‘ladi.
                        </p>
                    </div>
                </section>
            </div>

            <section class="card campaign-results-panel">
                <div class="campaign-results-header">
                    <div class="campaign-show-panel-heading">
                        <div class="campaign-panel-icon panel-icon-green">03</div>
                        <div>
                            <h2>Qo‘ng‘iroqlar natijalari</h2>
                            <p>Holatlar o‘zgarganda jadval o‘zi yangilanadi</p>
                        </div>
                    </div>

                    <span class="campaign-results-count">
                        {{ totalRows }} ta yozuv
                    </span>
                </div>

                <div class="cs-toolbar">
                    <select v-model="statusFilter" class="form-control">
                        <option v-for="option in STATUS_FILTERS" :key="option.value" :value="option.value">
                            {{ option.label }}
                        </option>
                    </select>
                </div>

                <div v-if="rowsLoading && !rows.length" class="campaign-results-empty">
                    <p>Yuklanmoqda...</p>
                </div>

                <div v-else-if="rows.length" class="campaign-results-table-wrap">
                    <table class="campaign-results-table">
                        <thead>
                            <tr>
                                <th>Abonent</th>
                                <th>Kategoriya</th>
                                <th>Telefon</th>
                                <th>Holat</th>
                                <th>Urinish</th>
                                <th>Davomiylik</th>
                                <th>Vaqt</th>
                                <th>Izoh</th>
                            </tr>
                        </thead>

                        <tbody>
                            <tr v-for="g in groupedRows" :key="g.key">
                                <td>
                                    <div class="campaign-result-person">
                                        <span class="campaign-result-avatar">
                                            {{ (g.name || '?').charAt(0).toUpperCase() }}
                                        </span>
                                        <strong>{{ g.name || '—' }}</strong>
                                    </div>
                                </td>

                                <td>{{ g.group_name || '—' }}</td>

                                <td class="campaign-result-phone">{{ g.phones || '—' }}</td>

                                <td>
                                    <div v-for="item in g.items" :key="item.id" class="cs-line">
                                        <span v-if="g.items.length > 1" class="cs-phone-tag">{{ item.phone }}</span>
                                        <span class="cs-badge" :class="callStatus(item).cls">
                                            {{ callStatus(item).label }}
                                        </span>
                                        <span v-if="item.status === 'pending' && item.next_attempt_at"
                                            class="cs-phone-tag">
                                            {{ formatTime(item.next_attempt_at) }} dan keyin
                                        </span>
                                    </div>
                                </td>

                                <td>
                                    <div v-for="item in g.items" :key="item.id" class="cs-line">
                                        {{ item.attempt }} / {{ item.max_attempts }}
                                    </div>
                                </td>

                                <td>
                                    <div v-for="item in g.items" :key="item.id" class="cs-line">
                                        {{ formatDuration(item.duration) }}
                                    </div>
                                </td>

                                <td class="campaign-result-date">
                                    <div v-for="item in g.items" :key="item.id" class="cs-line">
                                        {{ formatDateTime(item.started_at) }}
                                    </div>
                                </td>

                                <td class="cs-message">
                                    <div v-for="item in g.items" :key="item.id" class="cs-line">
                                        {{ item.error_message || item.sip_reason || '—' }}
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>

                    <div class="cs-pager">
                        <span>{{ page }} / {{ lastPage }}-sahifa</span>

                        <div class="cs-pager-buttons">
                            <button type="button" class="btn btn-secondary" :disabled="page <= 1"
                                @click="goToPage(page - 1)">
                                ← Oldingi
                            </button>

                            <button type="button" class="btn btn-secondary" :disabled="page >= lastPage"
                                @click="goToPage(page + 1)">
                                Keyingi →
                            </button>
                        </div>
                    </div>
                </div>

                <div v-else class="campaign-results-empty">
                    <div class="campaign-results-empty-icon">
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M8 6h13M8 12h13M8 18h13" />
                            <path d="M3 6h.01M3 12h.01M3 18h.01" />
                        </svg>
                    </div>
                    <h3>Yozuvlar topilmadi</h3>
                    <p v-if="statusFilter">Tanlangan holat bo‘yicha yozuv yo‘q.</p>
                    <p v-else>Bu campaignda hali abonentlar yo‘q.</p>
                </div>
            </section>

            <div class="campaign-show-bottom-actions">
                <button type="button" class="btn btn-secondary" @click="router.push('/campaigns')">
                    ← Campaignlar ro‘yxati
                </button>
            </div>
        </template>

        <div v-else class="card campaign-results-empty">
            <h3>Campaign topilmadi</h3>
            <p>Ushbu ID bo‘yicha campaign mavjud emas yoki o‘chirilgan.</p>
            <button type="button" class="btn btn-primary" @click="router.push('/campaigns')">
                Campaignlar ro‘yxatiga qaytish
            </button>
        </div>
    </div>
</template>
