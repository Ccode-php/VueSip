<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Eye, Trash2 } from 'lucide-vue-next'
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
    <div class="page campaigns-page">
        <div class="page-header">
            <div>
                <h1>Campaignlar</h1>

                <p class="page-description">Ovozli xabar yuborish campaignlari.</p>
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

        <div v-else class="cl-list">
            <div class="cl-row cl-head">
                <div>Campaign</div>
                <div>Holat</div>
                <div>Jarayon</div>
                <div>Trunk / Audio</div>
                <div class="cl-num">Raqam</div>
                <div class="cl-actions"></div>
            </div>

            <div
                v-for="campaign in campaigns"
                :key="campaign.id"
                class="card cl-row cl-item"
                @click="router.push(`/campaigns/${campaign.id}`)"
            >
                <div class="cl-main">
                    <strong class="cl-name">{{ campaign.name }}</strong>
                    <span class="cl-sub">{{ targetText(campaign) }}</span>
                </div>

                <div>
                    <span
                        class="campaign-status"
                        :class="`status-${campaign.status}`"
                    >
                        {{ statusText(campaign.status) }}
                    </span>
                </div>

                <div class="cl-progress">
                    <template v-if="campaign.recipients_count">
                        <div class="cs-mini-progress">
                            <div :style="{ width: progress(campaign) + '%' }"></div>
                        </div>

                        <span class="cl-sub">
                            {{ campaign.finished_count || 0 }} / {{ campaign.recipients_count }}
                            ({{ progress(campaign) }}%)
                        </span>
                    </template>

                    <span v-else class="cl-sub">—</span>
                </div>

                <div class="cl-main">
                    <span class="cl-name">{{ campaign.sip_trunk?.name || '—' }}</span>
                    <span class="cl-sub">{{ campaign.audio_file?.name || '—' }}</span>
                </div>

                <div class="cl-num">
                    <strong>{{ campaign.recipients_count || 0 }}</strong>
                    <span class="cl-sub">bir vaqtda {{ campaign.max_concurrent_calls }}</span>
                </div>

                <div class="cl-actions" @click.stop>
                    <button
                        class="cl-icon-btn"
                        type="button"
                        title="Ko‘rish"
                        @click="router.push(`/campaigns/${campaign.id}`)"
                    >
                        <Eye :size="16" />
                    </button>

                    <button
                        v-if="campaign.status !== 'running'"
                        class="cl-icon-btn cl-danger"
                        type="button"
                        title="O‘chirish"
                        @click="deleteCampaign(campaign)"
                    >
                        <Trash2 :size="16" />
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>