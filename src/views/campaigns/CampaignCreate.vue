
<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'

import campaignService from '../../services/campaignService'
import sipTrunkService from '../../services/sipTrunkService'
import subscriberService from '../../services/subscriberService'
import subscriberGroupService from '../../services/subscriberGroupService'
import audioService from '../../services/audioService'

const router = useRouter()

const loading = ref(true)
const saving = ref(false)
const error = ref('')

const trunks = ref([])
const audios = ref([])
const groups = ref([])
const subscribers = ref([])

const form = reactive({
    name: '',
    sip_trunk_id: '',
    audio_file_id: '',
    target_type: 'all',
    group_ids: [],
    subscriber_ids: [],
    max_concurrent_calls: 1,
    max_attempts: 1,
})

const selectedGroups = computed(() =>
    groups.value.filter(group =>
        form.group_ids.some(
            id => String(id) === String(group.id)
        )
    )
)

const selectedSubscribers = computed(() =>
    subscribers.value.filter(subscriber =>
        form.subscriber_ids.some(id => String(id) === String(subscriber.id))
    )
)

const selectedTrunk = computed(() =>
    trunks.value.find(trunk =>
        String(trunk.id) === String(form.sip_trunk_id)
    )
)

const selectedAudio = computed(() =>
    audios.value.find(audio =>
        String(audio.id) === String(form.audio_file_id)
    )
)

const recipientDescription = computed(() => {
    if (form.target_type === 'all') {
        return 'Barcha faol abonentlar'
    }

    if (form.target_type === 'groups') {
        return `${form.group_ids.length} ta kategoriya tanlangan`
    }

    return `${form.subscriber_ids.length} ta abonent tanlangan`
})

const recipientCount = computed(() => {
    if (form.target_type === 'groups') {
        const groupIds = new Set(
            form.group_ids.map(Number)
        )

        return subscribers.value.filter(subscriber => {
            const groupId = Number(
                subscriber.subscriber_group_id ??
                subscriber.group?.id
            )

            return (
                subscriber.enabled !== false &&
                groupIds.has(groupId)
            )
        }).length
    }

    if (form.target_type === 'individual') {
        return selectedSubscribers.value.filter(
            subscriber => subscriber.enabled !== false
        ).length
    }

    return subscribers.value.filter(
        subscriber => subscriber.enabled !== false
    ).length
})

async function loadData() {
    loading.value = true
    error.value = ''

    try {
        const [
            trunkResponse,
            audioResponse,
            groupResponse,
            subscriberResponse,
        ] = await Promise.all([
            sipTrunkService.getAll(),
            audioService.getAll(),
            subscriberGroupService.getAll(),
            subscriberService.getAll(),
        ])

        trunks.value = trunkResponse.data || []
        audios.value = audioResponse.data || []
        groups.value = groupResponse.data || []
        subscribers.value = subscriberResponse.data || []
    } catch (e) {
        error.value =
            e.response?.data?.message ||
            'Maʼlumotlarni yuklashda xatolik.'
    } finally {
        loading.value = false
    }
}

function getDescendantGroupIds(parentId) {
    const result = []
    const visited = new Set([Number(parentId)])
    const queue = [Number(parentId)]

    while (queue.length > 0) {
        const currentId = queue.shift()

        for (const group of groups.value) {
            const id = Number(group.id)
            const pid = Number(group.parent_id)

            if (
                pid === currentId &&
                !visited.has(id)
            ) {
                visited.add(id)
                result.push(id)
                queue.push(id)
            }
        }
    }

    return result
}

function toggleGroup(id) {
    const groupId = Number(id)
    const descendantIds = getDescendantGroupIds(groupId)
    const relatedIds = [groupId, ...descendantIds]

    const isSelected = form.group_ids.some(
        selectedId => Number(selectedId) === groupId
    )

    if (isSelected) {
        // Ota kategoriya olib tashlansa,
        // uning ichki kategoriyalari ham olib tashlanadi.
        const removeIds = new Set(relatedIds)

        form.group_ids = form.group_ids.filter(
            selectedId => !removeIds.has(Number(selectedId))
        )

        return
    }

    // Ota kategoriya tanlansa, barcha ichki
    // kategoriyalarni ham belgilaymiz.
    const selectedIds = new Set(
        form.group_ids.map(Number)
    )

    for (const relatedId of relatedIds) {
        selectedIds.add(relatedId)
    }

    form.group_ids = [...selectedIds]
} 

function toggleSubscriber(id) {
    const index = form.subscriber_ids.findIndex(
        selectedId => String(selectedId) === String(id)
    )

    if (index === -1) {
        form.subscriber_ids.push(id)
    } else {
        form.subscriber_ids.splice(index, 1)
    }
}

function clearSelection(type) {
    if (type === 'groups') {
        form.group_ids = []
    }

    if (type === 'individual') {
        form.subscriber_ids = []
    }
}

async function save() {
    error.value = ''

    if (!form.name.trim()) {
        error.value = 'Campaign nomini kiriting.'
        return
    }

    if (!form.sip_trunk_id) {
        error.value = 'SIP Trunk tanlang.'
        return
    }

    if (!form.audio_file_id) {
        error.value = 'Audio fayl tanlang.'
        return
    }

    if (form.target_type === 'groups' && form.group_ids.length === 0) {
        error.value = 'Kamida bitta kategoriya tanlang.'
        return
    }

    if (
        form.target_type === 'individual' &&
        form.subscriber_ids.length === 0
    ) {
        error.value = 'Kamida bitta abonent tanlang.'
        return
    }

    const concurrency = Number(form.max_concurrent_calls)
    const attempts = Number(form.max_attempts)

    if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 100) {
        error.value = 'Parallel qo‘ng‘iroqlar soni 1 dan 100 gacha bo‘lishi kerak.'
        return
    }

    if (!Number.isInteger(attempts) || attempts < 1 || attempts > 10) {
        error.value = 'Urinishlar soni 1 dan 10 gacha bo‘lishi kerak.'
        return
    }

    saving.value = true

    try {
        await campaignService.create({
            name: form.name.trim(),
            sip_trunk_id: Number(form.sip_trunk_id),
            audio_file_id: Number(form.audio_file_id),
            target_type: form.target_type,
            group_ids: form.target_type === 'groups'
                ? form.group_ids.map(Number)
                : [],
            subscriber_ids: form.target_type === 'individual'
                ? form.subscriber_ids.map(Number)
                : [],
            max_concurrent_calls: concurrency,
            max_attempts: attempts,
        })

        router.push('/campaigns')
    } catch (e) {
        const validationErrors = e.response?.data?.errors

        error.value = validationErrors
            ? Object.values(validationErrors).flat().join(' ')
            : e.response?.data?.message ||
              'Campaign yaratishda xatolik.'
    } finally {
        saving.value = false
    }
}

onMounted(loadData)
</script>

<template>
    <div class="page campaign-create-page">
        <div class="page-header campaign-create-header">
            <div>
                <div class="eyebrow">QO‘NG‘IROQLAR BOSHQARUVI</div>
                <h1>Yangi campaign</h1>
                <p class="page-description">
                    Audio xabarni tanlang va qo‘ng‘iroq qilinadigan abonentlarni belgilang.
                </p>
            </div>

            <button
                type="button"
                class="btn btn-secondary"
                :disabled="saving"
                @click="router.push('/campaigns')"
            >
                ← Orqaga
            </button>
        </div>

        <div v-if="error" class="alert alert-error campaign-create-alert">
            <span class="campaign-alert-icon">!</span>
            <span>{{ error }}</span>
        </div>

        <div v-if="loading" class="card campaign-loading">
            <span class="loading-spinner"></span>
            <span>Maʼlumotlar yuklanmoqda...</span>
        </div>

        <form
            v-else
            class="card campaign-form-card"
            @submit.prevent="save"
        >
            <section class="campaign-section">
                <div class="campaign-section-heading">
                    <div class="section-icon">01</div>
                    <div>
                        <h2>Asosiy ma’lumotlar</h2>
                        <p>Campaign nomi, aloqa kanali va ovozli xabar</p>
                    </div>
                </div>

                <div class="campaign-main-grid">
                    <div class="form-group campaign-full-width">
                        <label for="campaign-name">Campaign nomi *</label>
                        <input
                            id="campaign-name"
                            v-model="form.name"
                            class="form-control"
                            type="text"
                            maxlength="255"
                            placeholder="Masalan, Imtihon haqida xabar"
                            required
                        />
                        <small>Campaign ro‘yxatida ko‘rinadigan nom.</small>
                    </div>

                    <div class="form-group">
                        <label for="campaign-trunk">SIP Trunk *</label>
                        <select
                            id="campaign-trunk"
                            v-model="form.sip_trunk_id"
                            class="form-control"
                            required
                        >
                            <option value="">SIP Trunk tanlang</option>
                            <option
                                v-for="trunk in trunks"
                                :key="trunk.id"
                                :value="trunk.id"
                            >
                                {{ trunk.name }}
                            </option>
                        </select>
                        <small>
                            Qo‘ng‘iroqlar shu SIP Trunk orqali amalga oshiriladi.
                        </small>
                        <p v-if="trunks.length === 0" class="field-hint-warning">
                            Hozircha SIP Trunk topilmadi.
                        </p>
                    </div>

                    <div class="form-group">
                        <label for="campaign-audio">Audio xabar *</label>
                        <select
                            id="campaign-audio"
                            v-model="form.audio_file_id"
                            class="form-control"
                            required
                        >
                            <option value="">Audio fayl tanlang</option>
                            <option
                                v-for="audio in audios"
                                :key="audio.id"
                                :value="audio.id"
                            >
                                {{ audio.name }}
                            </option>
                        </select>
                        <small>Qo‘ng‘iroq javob berilganda ijro etiladigan audio.</small>
                        <p v-if="audios.length === 0" class="field-hint-warning">
                            Hozircha audio fayl topilmadi.
                        </p>
                    </div>
                </div>

                <div class="campaign-choice-strip">
                    <div class="campaign-choice-item">
                        <span class="choice-dot choice-dot-blue"></span>
                        <div>
                            <small>Tanlangan SIP Trunk</small>
                            <strong>{{ selectedTrunk?.name || 'Tanlanmagan' }}</strong>
                        </div>
                    </div>

                    <div class="campaign-choice-item">
                        <span class="choice-dot choice-dot-purple"></span>
                        <div>
                            <small>Tanlangan audio</small>
                            <strong>{{ selectedAudio?.name || 'Tanlanmagan' }}</strong>
                        </div>
                    </div>
                </div>
            </section>

            <div class="campaign-section-divider"></div>

            <section class="campaign-section">
                <div class="campaign-section-heading">
                    <div class="section-icon">02</div>
                    <div>
                        <h2>Qabul qiluvchilar</h2>
                        <p>Qo‘ng‘iroq qaysi abonentlarga yuborilishini belgilang</p>
                    </div>
                </div>

                <div class="target-options">
                    <label
                        class="target-option"
                        :class="{ 'target-option-active': form.target_type === 'all' }"
                    >
                        <input
                            v-model="form.target_type"
                            type="radio"
                            name="target_type"
                            value="all"
                        />
                        <span class="target-option-icon target-icon-all">
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                                <circle cx="9" cy="7" r="4" />
                                <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                            </svg>
                        </span>
                        <span class="target-option-content">
                            <strong>Barcha abonentlar</strong>
                            <small>Barcha faol abonentlarni qamrab olish</small>
                        </span>
                        <span class="target-option-check"></span>
                    </label>

                    <label
                        class="target-option"
                        :class="{ 'target-option-active': form.target_type === 'groups' }"
                    >
                        <input
                            v-model="form.target_type"
                            type="radio"
                            name="target_type"
                            value="groups"
                        />
                        <span class="target-option-icon target-icon-groups">
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                                <rect x="3" y="3" width="7" height="7" rx="1.5" />
                                <rect x="14" y="3" width="7" height="7" rx="1.5" />
                                <rect x="3" y="14" width="7" height="7" rx="1.5" />
                                <rect x="14" y="14" width="7" height="7" rx="1.5" />
                            </svg>
                        </span>
                        <span class="target-option-content">
                            <strong>Kategoriyalar bo‘yicha</strong>
                            <small>Bir nechta kategoriyani tanlash</small>
                        </span>
                        <span class="target-option-check"></span>
                    </label>

                    <label
                        class="target-option"
                        :class="{ 'target-option-active': form.target_type === 'individual' }"
                    >
                        <input
                            v-model="form.target_type"
                            type="radio"
                            name="target_type"
                            value="individual"
                        />
                        <span class="target-option-icon target-icon-individual">
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                                <circle cx="12" cy="8" r="4" />
                                <path d="M4 21v-2a8 8 0 0 1 16 0v2z" />
                            </svg>
                        </span>
                        <span class="target-option-content">
                            <strong>Alohida abonentlar</strong>
                            <small>Kerakli abonentlarni qo‘lda belgilash</small>
                        </span>
                        <span class="target-option-check"></span>
                    </label>
                </div>

                <div v-if="form.target_type === 'groups'" class="recipient-picker">
                    <div class="recipient-picker-header">
                        <div>
                            <h3>Kategoriyalarni tanlang</h3>
                            <p>Bir nechta kategoriyani belgilashingiz mumkin.</p>
                        </div>
                        <span class="selection-count">
                            {{ form.group_ids.length }} tanlandi
                        </span>
                    </div>

                    <div v-if="groups.length" class="recipient-list">
                        <label
                            v-for="group in groups"
                            :key="group.id"
                            class="recipient-row"
                            :class="{
                                'recipient-row-selected': form.group_ids.some(
                                    id => String(id) === String(group.id)
                                )
                            }"
                        >
                            <input
                                type="checkbox"
                                :checked="form.group_ids.some(
                                    id => String(id) === String(group.id)
                                )"
                                @change="toggleGroup(group.id)"
                            />
                            <span class="recipient-checkbox-mark"></span>
                            <span class="recipient-row-main">
                                <strong>{{ group.name }}</strong>
                                <small>Kategoriya</small>
                            </span>
                            <span class="recipient-count-pill">
                                {{ group.subscribers_count ?? 0 }} abonent
                            </span>
                        </label>
                    </div>

                    <div v-else class="empty-selection">
                        Kategoriyalar topilmadi. Avval abonentlar bo‘limida kategoriya yarating.
                    </div>

                    <div class="recipient-picker-footer">
                        <span>{{ recipientDescription }}</span>
                        <button
                            type="button"
                            class="text-button"
                            @click="clearSelection('groups')"
                        >
                            Tanlovni tozalash
                        </button>
                    </div>
                </div>



                

                <div v-if="form.target_type === 'individual'" class="recipient-picker">
                    <div class="recipient-picker-header">
                        <div>
                            <h3>Abonentlarni tanlang</h3>
                            <p>Qo‘ng‘iroq yuboriladigan abonentlarni belgilang.</p>
                        </div>
                        <span class="selection-count">
                            {{ form.subscriber_ids.length }} tanlandi
                        </span>
                    </div>

                    <div v-if="subscribers.length" class="recipient-list">
                        <label
                            v-for="subscriber in subscribers"
                            :key="subscriber.id"
                            class="recipient-row"
                            :class="{
                                'recipient-row-selected': form.subscriber_ids.some(
                                    id => String(id) === String(subscriber.id)
                                )
                            }"
                        >
                            <input
                                type="checkbox"
                                :checked="form.subscriber_ids.some(
                                    id => String(id) === String(subscriber.id)
                                )"
                                @change="toggleSubscriber(subscriber.id)"
                            />
                            <span class="recipient-checkbox-mark"></span>
                            <span class="recipient-avatar">
                                {{ (subscriber.name || '?').trim().charAt(0).toUpperCase() }}
                            </span>
                            <span class="recipient-row-main">
                                <strong>{{ subscriber.name }}</strong>
                                <small>{{ subscriber.group?.name || 'Kategoriya yo‘q' }}</small>
                            </span>
                            <span
                                class="subscriber-status"
                                :class="subscriber.enabled === false ? 'status-disabled' : 'status-enabled'"
                            >
                                {{ subscriber.enabled === false ? 'Nofaol' : 'Faol' }}
                            </span>
                        </label>
                    </div>

                    <div v-else class="empty-selection">
                        Abonentlar topilmadi. Avval abonent qo‘shing.
                    </div>

                    <div class="recipient-picker-footer">
                        <span>{{ recipientDescription }}</span>
                        <button
                            type="button"
                            class="text-button"
                            @click="clearSelection('individual')"
                        >
                            Tanlovni tozalash
                        </button>
                    </div>
                </div>

                <div v-if="form.target_type === 'all'" class="all-recipients-note">
                    <span class="all-note-icon">i</span>
                    <div>
                        <strong>Barcha faol abonentlar tanlanadi</strong>
                        <p>
                            Campaign bajarilganda tizim abonentlarning faol holatini tekshirishi kerak.
                            Quyidagi son yuklangan abonentlar ro‘yxatidan hisoblanadi.
                        </p>
                    </div>
                    <div class="all-recipient-number">
                        <strong>{{ recipientCount }}</strong>
                        <small>abonent</small>
                    </div>
                </div>
            </section>

            <div class="campaign-section-divider"></div>

            <section class="campaign-section">
                <div class="campaign-section-heading">
                    <div class="section-icon">03</div>
                    <div>
                        <h2>Qo‘ng‘iroq sozlamalari</h2>
                        <p>Bir vaqtdagi qo‘ng‘iroqlar va qayta urinishlar soni</p>
                    </div>
                </div>

                <div class="call-settings-grid">
                    <div class="setting-card">
                        <div class="setting-card-icon setting-icon-blue">
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.96.36 1.9.7 2.8a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.84.58 2.8.7A2 2 0 0 1 22 16.92z" />
                            </svg>
                        </div>
                        <div class="setting-card-copy">
                            <label for="campaign-concurrency">Parallel qo‘ng‘iroqlar</label>
                            <p>Bir vaqtning o‘zida nechta qo‘ng‘iroq bajarilsin?</p>
                        </div>
                        <div class="setting-input-wrap">
                            <input
                                id="campaign-concurrency"
                                v-model.number="form.max_concurrent_calls"
                                class="form-control setting-number-input"
                                type="number"
                                min="1"
                                max="100"
                                required
                            />
                            <span>ta</span>
                        </div>
                        <div class="setting-footnote">
                            <span class="setting-footnote-dot"></span>
                            Ruxsat etilgan oraliq: 1–100
                        </div>
                    </div>

                    <div class="setting-card">
                        <div class="setting-card-icon setting-icon-purple">
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                                <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
                                <path d="M3 3v5h5M12 7v5l3 2" />
                            </svg>
                        </div>
                        <div class="setting-card-copy">
                            <label for="campaign-attempts">Urinishlar soni</label>
                            <p>Har bir abonentga ko‘pi bilan necha marta qo‘ng‘iroq qilinsin?</p>
                        </div>
                        <div class="setting-input-wrap">
                            <input
                                id="campaign-attempts"
                                v-model.number="form.max_attempts"
                                class="form-control setting-number-input"
                                type="number"
                                min="1"
                                max="10"
                                required
                            />
                            <span>marta</span>
                        </div>
                        <div class="setting-footnote">
                            <span class="setting-footnote-dot"></span>
                            Ruxsat etilgan oraliq: 1–10
                        </div>
                    </div>
                </div>
            </section>

            <div class="campaign-section-divider"></div>

            <section class="campaign-summary">
                <div class="summary-heading">
                    <div class="summary-icon">
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M8 6h13M8 12h13M8 18h13" />
                            <path d="M3 6h.01M3 12h.01M3 18h.01" />
                        </svg>
                    </div>
                    <div>
                        <h2>Campaign xulosasi</h2>
                        <p>Yaratishdan oldin sozlamalarni tekshiring.</p>
                    </div>
                </div>

                <div class="summary-grid">
                    <div class="summary-item">
                        <span>Qabul qiluvchilar</span>
                        <strong>{{ recipientDescription }}</strong>
                    </div>
                    <div class="summary-item">
                        <span>Taxminiy abonentlar soni</span>
                        <strong>{{ recipientCount }}</strong>
                    </div>
                    <div class="summary-item">
                        <span>Parallel qo‘ng‘iroqlar</span>
                        <strong>{{ form.max_concurrent_calls }} ta</strong>
                    </div>
                    <div class="summary-item">
                        <span>Urinishlar soni</span>
                        <strong>{{ form.max_attempts }} marta</strong>
                    </div>
                </div>

                <div
                    v-if="form.target_type === 'groups' && selectedGroups.length"
                    class="summary-selected-list"
                >
                    <span>Tanlangan kategoriyalar:</span>
                    <span
                        v-for="group in selectedGroups"
                        :key="group.id"
                        class="summary-chip"
                    >
                        {{ group.name }}
                    </span>
                </div>

                <div
                    v-if="form.target_type === 'individual' && selectedSubscribers.length"
                    class="summary-selected-list"
                >
                    <span>Tanlangan abonentlar:</span>
                    <span
                        v-for="subscriber in selectedSubscribers"
                        :key="subscriber.id"
                        class="summary-chip"
                    >
                        {{ subscriber.name }}
                    </span>
                </div>
            </section>

            <div class="campaign-form-footer">
                <p><span>*</span> Majburiy maydonlar</p>

                <div class="campaign-form-actions">
                    <button
                        type="button"
                        class="btn btn-secondary"
                        :disabled="saving"
                        @click="router.push('/campaigns')"
                    >
                        Bekor qilish
                    </button>

                    <button
                        type="submit"
                        class="btn btn-primary campaign-submit-btn"
                        :disabled="saving"
                    >
                        <span v-if="!saving">Campaign yaratish <span aria-hidden="true">→</span></span>
                        <span v-else>Yaratilmoqda...</span>
                    </button>
                </div>
            </div>
        </form>
    </div>
</template>
