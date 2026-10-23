<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
    Plus,
    Pencil,
    Trash2,
    Settings,
    RefreshCw,
} from 'lucide-vue-next'

import sipTrunkService from '../../services/sipTrunkService'

const router = useRouter()

const trunks = ref([])
const loading = ref(false)
const error = ref('')

async function loadTrunks() {
    loading.value = true
    error.value = ''

    try {
        const response = await sipTrunkService.getAll()

        trunks.value = response.data ?? []
    } catch (err) {
        console.error(err)

        error.value =
            err.response?.data?.message ||
            'SIP Trunklarni yuklashda xatolik yuz berdi.'
    } finally {
        loading.value = false
    }
}

function createTrunk() {
    router.push('/sip-trunks/create')
}

function editTrunk(id) {
    router.push(`/sip-trunks/${id}/edit`)
}

async function deleteTrunk(trunk) {
    const confirmed = confirm(
        `"${trunk.name}" SIP Trunkni o‘chirishni xohlaysizmi?`
    )

    if (!confirmed) {
        return
    }

    try {
        await sipTrunkService.delete(trunk.id)

        await loadTrunks()
    } catch (err) {
        console.error(err)

        alert(
            err.response?.data?.message ||
            'SIP Trunkni o‘chirishda xatolik yuz berdi.'
        )
    }
}

onMounted(loadTrunks)
</script>

<template>
    <div class="page">

        <div class="page-header">

            <div>
                <h1>SIP Trunks</h1>
                <p class="page-description">
                    Asterisk uchun SIP Trunk konfiguratsiyalarini boshqarish
                </p>
            </div>

            <div class="actions">
                <button
                    class="btn btn-secondary"
                    @click="loadTrunks"
                    :disabled="loading"
                >
                    <RefreshCw :size="17" />
                    Yangilash
                </button>

                <button
                    class="btn btn-primary"
                    @click="createTrunk"
                >
                    <Plus :size="18" />
                    SIP Trunk qo‘shish
                </button>
            </div>

        </div>

        <div
            v-if="error"
            class="alert alert-danger"
        >
            {{ error }}
        </div>

        <div class="card">

            <div v-if="loading" class="loading">
                SIP Trunklar yuklanmoqda...
            </div>

            <div
                v-else-if="trunks.length === 0"
                class="empty"
            >
                <Settings :size="40" />

                <h3>SIP Trunk mavjud emas</h3>

                <p>
                    Birinchi SIP Trunkni qo‘shing.
                </p>

                <button
                    class="btn btn-primary"
                    @click="createTrunk"
                >
                    <Plus :size="17" />
                    SIP Trunk qo‘shish
                </button>
            </div>

            <div
                v-else
                class="table-wrapper"
            >

                <table class="table">

                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Nomi</th>
                            <th>Provider</th>
                            <th>Server</th>
                            <th>Port</th>
                            <th>Transport</th>
                            <th>Codec</th>
                            <th>Kanallar</th>
                            <th>Holat</th>
                            <th>Amallar</th>
                        </tr>
                    </thead>

                    <tbody>

                        <tr
                            v-for="trunk in trunks"
                            :key="trunk.id"
                        >

                            <td>
                                #{{ trunk.id }}
                            </td>

                            <td>
                                <strong>
                                    {{ trunk.name }}
                                </strong>
                            </td>

                            <td>
                                {{ trunk.provider || '—' }}
                            </td>

                            <td>
                                {{ trunk.host }}
                            </td>

                            <td>
                                {{ trunk.port }}
                            </td>

                            <td>
                                {{ trunk.transport?.toUpperCase() }}
                            </td>

                            <td>
                                {{ trunk.codec || '—' }}
                            </td>

                            <td>
                                {{ trunk.max_concurrent_calls }}
                            </td>

                            <td>
                                <span
                                    class="status-badge"
                                    :class="trunk.enabled
                                        ? 'status-enabled'
                                        : 'status-disabled'"
                                >
                                    {{
                                        trunk.enabled
                                            ? 'Faol'
                                            : 'O‘chiq'
                                    }}
                                </span>
                            </td>

                            <td>

                                <div class="actions">

                                    <button
                                        class="icon-btn"
                                        title="Tahrirlash"
                                        @click="editTrunk(trunk.id)"
                                    >
                                        <Pencil :size="17" />
                                    </button>

                                    <button
                                        class="icon-btn danger"
                                        title="O‘chirish"
                                        @click="deleteTrunk(trunk)"
                                    >
                                        <Trash2 :size="17" />
                                    </button>

                                </div>

                            </td>

                        </tr>

                    </tbody>

                </table>

            </div>

        </div>

    </div>
</template>

<style scoped>
.page-description {
    margin: 5px 0 0;
    color: #6b7280;
    font-size: 14px;
}

.alert {
    padding: 12px 15px;
    border-radius: 8px;
    margin-bottom: 18px;
}

.alert-danger {
    background: #fee2e2;
    color: #991b1b;
}

.loading {
    padding: 40px;
    text-align: center;
    color: #6b7280;
}

.empty {
    padding: 50px 20px;
    text-align: center;
    color: #6b7280;
}

.empty h3 {
    color: #374151;
    margin-bottom: 5px;
}

.empty p {
    margin-bottom: 20px;
}

.status-badge {
    display: inline-block;
    padding: 4px 9px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 600;
}

.status-enabled {
    background: #dcfce7;
    color: #166534;
}

.status-disabled {
    background: #f3f4f6;
    color: #6b7280;
}

.icon-btn {
    width: 34px;
    height: 34px;

    border: 1px solid #e5e7eb;
    background: white;

    border-radius: 7px;

    display: inline-flex;
    align-items: center;
    justify-content: center;

    color: #374151;
}

.icon-btn:hover {
    background: #f3f4f6;
}

.icon-btn.danger {
    color: #dc2626;
}
</style>