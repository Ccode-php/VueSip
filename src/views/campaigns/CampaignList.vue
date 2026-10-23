<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import campaignService from '../../services/campaignService'

const router = useRouter()

const campaigns = ref([])
const loading = ref(false)

let timer = null

async function loadCampaigns({ silent = false } = {}) {
    if (!silent) {
        loading.value = true
    }

    try {
        const response = await campaignService.getAll()

        campaigns.value = response.data || []
    } catch (error) {
        console.error('Campaignlarni yuklashda xatolik:', error)
    } finally {
        loading.value = false
    }
}

// Ishlayotgan campaign bo'lsa, ro'yxat 10 soniyada bir yangilanadi (progress ko'rinib turadi)
const hasRunning = computed(() =>
    campaigns.value.some((item) => ['running', 'queued'].includes(item.status))
)

function statusText(status) {
    const statuses = {
        draft: 'Qoralama',
        queued: 'Navbatda',
        running: 'Ishlamoqda',
        completed: 'Tugagan',
        stopped: 'To‘xtatilgan',
        failed: 'Xatolik',
    }

    return statuses[status] || status
}

function targetText(campaign) {
    if (campaign.target_type === 'all') {
        return 'Barcha abonentlar'
    }

    if (campaign.target_type === 'groups') {
        const names = (campaign.groups || []).map((group) => group.name)

        if (!names.length) {
            return 'Kategoriyalar bo‘yicha'
        }

        return names.length > 3
            ? `${names.slice(0, 3).join(', ')} va yana ${names.length - 3} ta`
            : names.join(', ')
    }

    return 'Tanlangan abonentlar'
}

function progress(campaign) {
    const total = Number(campaign.recipients_count || 0)

    if (!total) {
        return 0
    }

    return Math.min(100, Math.round((Number(campaign.finished_count || 0) / total) * 100))
}

async function deleteCampaign(campaign) {
    if (campaign.status === 'running') {
        alert('Ishlayotgan campaignni o‘chirib bo‘lmaydi.')
        return
    }

    const confirmed = confirm(`"${campaign.name}" campaignini o‘chirmoqchimisiz?`)

    if (!confirmed) {
        return
    }

    try {
        await campaignService.delete(campaign.id)

        await loadCampaigns()
    } catch (error) {
        console.error(error)

        alert(
            error.response?.data?.message ||
            'Campaignni o‘chirishda xatolik yuz berdi.'
        )
    }
}

onMounted(() => {
    loadCampaigns()

    timer = setInterval(() => {
        if (hasRunning.value) {
            loadCampaigns({ silent: true })
        }
    }, 10000)
})

onUnmounted(() => {
    clearInterval(timer)
})
</script>

<template>
    <div class="page">
        <div class="page-header">
            <div>
                <h1>Campaignlar</h1>

                <p>Ovozli xabar yuborish campaignlari.</p>
            </div>

            <button
                class="btn btn-primary"
                type="button"
                @click="router.push('/campaigns/create')"
            >
                + Campaign yaratish
            </button>
        </div>

        <div v-if="loading" class="card">
            Campaignlar yuklanmoqda...
        </div>

        <div v-else-if="!campaigns.length" class="card">
            Hozircha campaignlar mavjud emas.
        </div>

        <div v-else class="campaign-list">
            <div
                v-for="campaign in campaigns"
                :key="campaign.id"
                class="card campaign-card"
            >
                <div class="campaign-card-header">
                    <div>
                        <h3>{{ campaign.name }}</h3>

                        <p>{{ targetText(campaign) }}</p>
                    </div>

                    <span
                        class="campaign-status"
                        :class="`status-${campaign.status}`"
                    >
                        {{ statusText(campaign.status) }}
                    </span>
                </div>

                <div class="campaign-details">
                    <div>
                        <span>SIP Trunk</span>

                        <strong>{{ campaign.sip_trunk?.name || '—' }}</strong>
                    </div>

                    <div>
                        <span>Audio</span>

                        <strong>{{ campaign.audio_file?.name || '—' }}</strong>
                    </div>

                    <div>
                        <span>Raqamlar</span>

                        <strong>{{ campaign.recipients_count || 0 }}</strong>
                    </div>

                    <div>
                        <span>Concurrent</span>

                        <strong>{{ campaign.max_concurrent_calls }}</strong>
                    </div>
                </div>

                <div v-if="campaign.recipients_count">
                    <div class="cs-mini-progress">
                        <div :style="{ width: progress(campaign) + '%' }"></div>
                    </div>

                    <small class="cs-sub">
                        {{ campaign.finished_count || 0 }} / {{ campaign.recipients_count }}
                        yakunlangan ({{ progress(campaign) }}%)
                    </small>
                </div>

                <div class="actions">
                    <button
                        class="btn"
                        type="button"
                        @click="router.push(`/campaigns/${campaign.id}`)"
                    >
                        Ko‘rish
                    </button>

                    <button
                        v-if="campaign.status !== 'running'"
                        class="btn btn-danger"
                        type="button"
                        @click="deleteCampaign(campaign)"
                    >
                        🗑️ O‘chirish
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>
