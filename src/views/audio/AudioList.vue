<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import audioService from '../../services/audioService'

const router = useRouter()

const audioFiles = ref([])
const loading = ref(false)

async function loadAudio() {
    loading.value = true

    try {
        const response = await audioService.getAll()

        audioFiles.value = response.data || []
    } catch (error) {
        console.error('Audio yuklashda xatolik:', error)
    } finally {
        loading.value = false
    }
}

function formatSize(bytes) {
    if (!bytes) {
        return '0 KB'
    }

    if (bytes < 1024 * 1024) {
        return `${Math.round(bytes / 1024)} KB`
    }

    return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

function formatDuration(seconds) {
    if (!seconds) {
        return ''
    }

    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60

    return `${mins}:${String(secs).padStart(2, '0')}`
}

async function deleteAudio(audio) {
    const confirmed = confirm(`"${audio.name}" audio faylini o‘chirmoqchimisiz?`)

    if (!confirmed) {
        return
    }

    try {
        await audioService.delete(audio.id)

        await loadAudio()
    } catch (error) {
        console.error(error)

        alert(
            error.response?.data?.message ||
            'Audio o‘chirishda xatolik yuz berdi.'
        )
    }
}

onMounted(loadAudio)
</script>

<template>
    <div class="page audio-page">
        <div class="page-header">
            <div>
                <h1>Audio</h1>

                <p>Ovozli xabar audio fayllari.</p>
            </div>

            <button
                class="btn btn-primary"
                type="button"
                @click="router.push('/audio/create')"
            >
                + Audio qo‘shish
            </button>
        </div>

        <div v-if="loading" class="card">
            Audio fayllar yuklanmoqda...
        </div>

        <div v-else-if="!audioFiles.length" class="card">
            Hozircha audio fayllar mavjud emas.
        </div>

        <div v-else class="al-list">
            <div
                v-for="audio in audioFiles"
                :key="audio.id"
                class="card al-row"
            >
                <div class="al-icon">🎵</div>

                <div class="al-info">
                    <strong class="al-name" :title="audio.name">{{ audio.name }}</strong>

                    <span class="al-meta">
                        {{ audio.original_name }}
                        · {{ formatSize(audio.size) }}<template v-if="audio.duration"> · {{ formatDuration(audio.duration) }}</template>
                    </span>
                </div>

                <audio
                    class="al-player"
                    controls
                    preload="none"
                    :src="audioService.streamUrl(audio.id)"
                ></audio>

                <button
                    class="al-delete"
                    type="button"
                    title="O‘chirish"
                    @click="deleteAudio(audio)"
                >
                    🗑️
                </button>
            </div>
        </div>
    </div>
</template>