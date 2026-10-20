<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import audioService from '../../services/audioService'

const router = useRouter()

const name = ref('')
const file = ref(null)
const loading = ref(false)
const error = ref('')

function handleFileChange(event) {
    file.value = event.target.files[0] || null
}

async function submit() {
    error.value = ''

    if (!name.value.trim()) {
        error.value = 'Audio nomini kiriting.'
        return
    }

    if (!file.value) {
        error.value = 'Audio faylni tanlang.'
        return
    }

    loading.value = true

    try {
        const formData = new FormData()

        formData.append(
            'name',
            name.value.trim()
        )

        formData.append(
            'audio',
            file.value
        )

        await audioService.create(formData)

        router.push('/audio')

    } catch (err) {
        console.error(err)

        if (err.response?.data?.errors) {
            const errors = err.response.data.errors

            error.value = Object.values(errors)
                .flat()
                .join(' ')
        } else {
            error.value =
                err.response?.data?.message ||
                'Audio yuklashda xatolik yuz berdi.'
        }

    } finally {
        loading.value = false
    }
}
</script>

<template>
    <div class="page">

        <div class="page-header">
            <div>
                <h1>Audio qo‘shish</h1>

                <p>
                    Ovozli xabar uchun audio fayl yuklang.
                </p>
            </div>

            <button
                class="btn"
                type="button"
                @click="router.push('/audio')"
            >
                ← Orqaga
            </button>
        </div>

        <div class="card">

            <div
                v-if="error"
                class="error-message"
            >
                {{ error }}
            </div>

            <div class="form-group">
                <label>
                    Audio nomi
                </label>

                <input
                    v-model="name"
                    type="text"
                    class="form-control"
                    placeholder="Masalan: Dars boshlanishi"
                />
            </div>

            <div class="form-group">
                <label>
                    Audio fayl
                </label>

                <input
                    type="file"
                    class="form-control"
                    accept=".mp3,.wav,.ogg,audio/mpeg,audio/wav,audio/ogg"
                    @change="handleFileChange"
                />

                <small>
                    Ruxsat etilgan formatlar:
                    MP3, WAV, OGG.
                    Maksimal hajm: 50 MB.
                </small>
            </div>

            <div
                v-if="file"
                class="selected-file"
            >
                Tanlangan fayl:
                <strong>
                    {{ file.name }}
                </strong>
            </div>

            <div class="actions">

                <button
                    class="btn"
                    type="button"
                    @click="router.push('/audio')"
                >
                    Bekor qilish
                </button>

                <button
                    class="btn btn-primary"
                    type="button"
                    :disabled="loading"
                    @click="submit"
                >
                    {{
                        loading
                            ? 'Yuklanmoqda...'
                            : 'Yuklash'
                    }}
                </button>

            </div>

        </div>
    </div>
</template>