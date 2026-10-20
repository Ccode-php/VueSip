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
        console.error(
            'Audio yuklashda xatolik:',
            error
        )
    } finally {
        loading.value = false
    }
}

function getAudioUrl(path) {
    if (!path) {
        return ''
    }

    return `http://127.0.0.1:8000/storage/${path}`
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

async function deleteAudio(audio) {
    const confirmed = confirm(
        `"${audio.name}" audio faylini o‘chirmoqchimisiz?`
    )

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

onMounted(() => {
    loadAudio()
})
</script>

<template>
    <div class="page">

        <div class="page-header">

            <div>
                <h1>Audio</h1>

                <p>
                    Ovozli xabar audio fayllari.
                </p>
            </div>

            <button
                class="btn btn-primary"
                type="button"
                @click="router.push('/audio/create')"
            >
                + Audio qo‘shish
            </button>

        </div>

        <div
            v-if="loading"
            class="card"
        >
            Audio fayllar yuklanmoqda...
        </div>

        <div
            v-else-if="!audioFiles.length"
            class="card"
        >
            Hozircha audio fayllar mavjud emas.
        </div>

        <div
            v-else
            class="audio-grid"
        >

            <div
                v-for="audio in audioFiles"
                :key="audio.id"
                class="card audio-card"
            >

                <div class="audio-info">

                    <div class="audio-icon">
                        🎵
                    </div>

                    <div>
                        <h3>
                            {{ audio.name }}
                        </h3>

                        <p>
                            {{ audio.original_name }}
                        </p>

                        <small>
                            {{ formatSize(audio.size) }}
                        </small>
                    </div>

                </div>

                <audio
                    controls
                    preload="metadata"
                    :src="getAudioUrl(audio.file_path)"
                ></audio>

                <div class="actions">

                    <button
                        class="btn btn-danger"
                        type="button"
                        @click="deleteAudio(audio)"
                    >
                        🗑️ O‘chirish
                    </button>

                </div>

            </div>

        </div>

    </div>
</template>