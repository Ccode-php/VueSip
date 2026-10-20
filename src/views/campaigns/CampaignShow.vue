<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
useRoute
import campaignService from '../../services/campaignService'

const route = useRoute()
const router = useRouter()

const campaign = ref(null)
const loading = ref(true)
const error = ref('')
const starting = ref(false)

const campaignId = computed(() => route.params.id)
let pollerInterval = null

// 1. Ma'lumotlarni yuklash va yangilash funksiyasi (Yagona e'lon)
async function loadCampaign() {
    // Poller fonda aylanganda ekran o'chib-yonmasligi uchun faqat birinchi marta loading = true bo'ladi
    if (campaign.value === null) {
        loading.value = true
    }
    error.value = ''

    try {
        const response = await campaignService.getOne(campaignId.value)
        const data = response.data
        campaign.value = data?.data ?? data

        // Agar kampaniya tugasa yoki xato bersa, poller'ni avtomatik to'xtatamiz
        if (['completed', 'stopped', 'failed'].includes(String(campaign.value?.status).toLowerCase())) {
            stopPoller()
        }
    } catch (e) {
        console.error(e)
        error.value = e.response?.data?.message || 'Campaign ma’lumotlarini yuklashda xatolik.'
    } finally {
        loading.value = false
    }
}

// 2. Kampaniyani ishga tushirish (Start) funksiyasi
async function startCampaign() {
    if (!confirm('Kampaniyani ishga tushirishni xohlaysizmi? Avtomatik qo‘ng‘iroqlar boshlanadi.')) {
        return
    }

    starting.value = true
    try {
        await campaignService.start(campaignId.value)
        await loadCampaign()
        startPoller() // Qo'ng'iroq boshlangach jonli yangilashni yoqamiz
    } catch (e) {
        alert(e.response?.data?.message || 'Kampaniyani boshlashda xatolik yuz berdi.')
    } finally {
        starting.value = false
    }
}

// 3. Poller (Real-time yangilash) boshqaruvi
function startPoller() {
    if (pollerInterval) return
    pollerInterval = setInterval(() => {
        loadCampaign()
    }, 3000) // Har 3 soniyada jonli statusni tekshiradi
}

function stopPoller() {
    if (pollerInterval) {
        clearInterval(pollerInterval)
        pollerInterval = null
    }
}

// Computed propertys va boshqa yordamchi funksiyalar (Siz yozgan variantlar)
const callResults = computed(() => {
    const data = campaign.value
    if (!data) return []
    if (Array.isArray(data.calls)) return data.calls
    if (Array.isArray(data.results)) return data.results
    if (Array.isArray(data.recipients)) return data.recipients
    if (Array.isArray(data.campaign_recipients)) return data.campaign_recipients
    return []
})

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
    return statuses[status] || { label: campaign.value?.status || 'Noma’lum', className: 'campaign-status-default' }
})

const targetInfo = computed(() => {
    const type = campaign.value?.target_type
    if (type === 'all') return 'Barcha faol abonentlar'
    if (type === 'groups') return 'Kategoriyalar bo‘yicha'
    if (type === 'individual') return 'Alohida abonentlar'
    return type || 'Ko‘rsatilmagan'
})

const statistics = computed(() => {
    const results = callResults.value
    const total = results.length
    const answered = results.filter(item => ['answered', 'success'].includes(String(item.status).toLowerCase())).length
    const failed = results.filter(item => ['failed', 'busy', 'no_answer'].includes(String(item.status).toLowerCase())).length
    const completed = results.filter(item => ['answered', 'failed', 'busy', 'no_answer'].includes(String(item.status).toLowerCase())).length
    return { total, completed, failed, answered }
})

function getRelationName(value) {
    if (!value) return '—'
    if (typeof value === 'string') return value
    return value.name || '—'
}

function getAudioName(data) { return getRelationName(data?.audio_file || data?.audioFile) }
function getTrunkName(data) { return getRelationName(data?.sip_trunk || data?.sipTrunk) }
function getSubscriberName(item) { return item?.name || '—' }

function getPhone(item) { return item?.phone || '—' }

function resultStatus(status) {
    const value = String(status || '').toLowerCase()
    const statuses = {
        answered: { label: 'Javob berdi', className: 'result-status-success' },
        failed: { label: 'Xatolik', className: 'result-status-failed' },
        busy: { label: 'Band', className: 'result-status-warning' },
        no_answer: { label: 'Javob bermadi', className: 'result-status-warning' },
        pending: { label: 'Kutilmoqda', className: 'result-status-pending' },
        ringing: { label: 'Chalinmoqda', className: 'result-status-running' },
    }
    return statuses[value] || { label: status || 'Noma’lum', className: 'result-status-muted' }
}

function formatDate(value) {
    if (!value) return '—'
    return new Date(value).toLocaleString('uz-UZ', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function formatDuration(value) {
    if (!value) return '00:00'
    const mins = Math.floor(value / 60)
    const secs = value % 60
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

const groupNames = computed(() => formatTargetNames(campaign.value?.groups))
const subscriberNames = computed(() => formatTargetNames(campaign.value?.subscribers))
function formatTargetNames(arr) { return Array.isArray(arr) ? arr.map(i => i.name).join(', ') : '' }

onMounted(async () => {
    await loadCampaign()
    // Agar sahifaga kirganda kampaniya allaqachon ishlab turgan bo'lsa poller avtomatik faollashadi
    if (['running', 'queued'].includes(String(campaign.value?.status).toLowerCase())) {
        startPoller()
    }
})

onUnmounted(() => {
    stopPoller() // Sahifadan chiqqanda poller'ni to'xtatish
})
</script>


<template>
    <div class="page campaign-show-page">
        <div class="page-header campaign-show-header">
            <div>
                <div class="eyebrow">QO‘NG‘IROQLAR BOSHQARUVI</div>
                <h1>Campaign tafsilotlari</h1>
                <p class="page-description">
                    Campaign sozlamalari va qo‘ng‘iroqlar natijalarini ko‘ring.
                </p>
            </div>

            <div class="campaign-show-header-actions">
                <button type="button" class="btn btn-secondary" :disabled="loading" @click="loadCampaign">
                    ↻ Yangilash
                </button>

                <!-- views/campaigns/CampaignShow.vue ichidagi campaign-show-header-actions bo'limiga qo'shing -->
                <div class="campaign-show-header-actions">
                    <button v-if="campaign && campaign.status === 'draft'" type="button" class="btn btn-primary"
                        :disabled="starting" @click="startCampaign">
                        🚀 Kampaniyani Boshlash
                    </button>
                    <!-- ... mavjud Yangilash va Orqaga tugmalari shu yerda qoladi ... -->
                </div>


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
                <button type="button" class="campaign-show-retry" @click="loadCampaign">
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
                            ID: {{ campaign.id ?? campaignId }}
                            <span class="campaign-meta-separator">•</span>
                            Yaratilgan: {{ formatDate(campaign.created_at) }}
                        </p>
                    </div>
                </div>

                <div class="campaign-hero-stats">
                    <div>
                        <span>Qabul qiluvchilar</span>
                        <strong>{{ statistics.total }}</strong>
                    </div>
                    <div>
                        <span>Javob berganlar</span>
                        <strong>{{ statistics.answered }}</strong>
                    </div>
                    <div>
                        <span>Xatoliklar</span>
                        <strong>{{ statistics.failed }}</strong>
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
                        <small>Har bir abonentga</small>
                    </div>
                </article>

                <article class="campaign-show-stat-card">
                    <div class="campaign-show-stat-icon stat-icon-green">✓</div>
                    <div>
                        <span>Yakunlangan</span>
                        <strong>{{ statistics.completed }}</strong>
                        <small>Qo‘ng‘iroqlar</small>
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
                            <strong>{{ getTrunkName(campaign) }}</strong>
                        </div>

                        <div class="campaign-detail-row">
                            <span>Audio fayl</span>
                            <strong>{{ getAudioName(campaign) }}</strong>
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
                            <span>Boshlangan vaqt</span>
                            <strong>{{ formatDate(campaign.started_at) }}</strong>
                        </div>

                        <div class="campaign-detail-row">
                            <span>Yakunlangan vaqt</span>
                            <strong>{{ formatDate(campaign.completed_at || campaign.finished_at) }}</strong>
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
                        <p v-else>
                            Kategoriya nomlari API javobida kelmagan yoki tanlov bo‘sh.
                        </p>
                    </div>

                    <div v-else-if="campaign.target_type === 'individual'" class="campaign-target-detail">
                        <span>Tanlangan abonentlar</span>
                        <p v-if="subscriberNames">{{ subscriberNames }}</p>
                        <p v-else>
                            Abonentlar ro‘yxati API javobida kelmagan yoki tanlov bo‘sh.
                        </p>
                    </div>

                    <div v-else class="campaign-target-detail">
                        <span>Qamrov</span>
                        <p>Barcha faol abonentlar campaign bajarilayotganda tanlanishi kerak.</p>
                    </div>

                    <div class="campaign-target-warning">
                        <span>i</span>
                        <p>
                            Ko‘rsatilgan abonentlar soni API qaytargan ma’lumotlarga bog‘liq.
                            Haqiqiy qo‘ng‘iroq natijalari pastdagi jadvalda ko‘rsatiladi.
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
                            <p>Abonentlar bo‘yicha holatlar va urinishlar</p>
                        </div>
                    </div>

                    <span class="campaign-results-count">
                        {{ callResults.length }} ta yozuv
                    </span>
                </div>

                <div v-if="callResults.length" class="campaign-results-table-wrap">
                    <table class="campaign-results-table">
                        <thead>
                            <tr>
                                <th>Abonent</th>
                                <th>Telefon</th>
                                <th>Holat</th>
                                <th>Urinishlar</th>
                                <th>Davomiylik</th>
                                <th>Vaqt</th>
                                <th>Xabar</th>
                            </tr>
                        </thead>

                        <tbody>
                            <tr v-for="(item, index) in callResults" :key="item.id ?? index">
                                <td>
                                    <div class="campaign-result-person">
                                        <span class="campaign-result-avatar">
                                            {{ getSubscriberName(item).charAt(0).toUpperCase() }}
                                        </span>
                                        <strong>{{ getSubscriberName(item) }}</strong>
                                    </div>
                                </td>

                                <td class="campaign-result-phone">
                                    {{ getPhone(item) }}
                                </td>

                                <td>
                                    <span class="result-status-badge"
                                        :class="resultStatus(item.status || item.call_status).className">
                                        {{ resultStatus(item.status || item.call_status).label }}
                                    </span>
                                </td>

                                <td>
                                    {{ item.attempts ?? item.attempt_count ?? item.retry_count ?? '—' }}
                                </td>

                                <td>
                                    {{ formatDuration(item.duration ?? item.duration_seconds) }}
                                </td>

                                <td class="campaign-result-date">
                                    {{ formatDate(item.started_at || item.called_at || item.created_at) }}
                                </td>

                                <td class="campaign-result-message">
                                    {{ item.error_message || item.message || item.hangup_cause || '—' }}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div v-else class="campaign-results-empty">
                    <div class="campaign-results-empty-icon">
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M8 6h13M8 12h13M8 18h13" />
                            <path d="M3 6h.01M3 12h.01M3 18h.01" />
                        </svg>
                    </div>
                    <h3>Hozircha qo‘ng‘iroq natijalari yo‘q</h3>
                    <p>
                        Campaign hali ishga tushmagan bo‘lishi mumkin yoki natijalar API orqali
                        ushbu sahifaga qaytarilmayapti.
                    </p>
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
