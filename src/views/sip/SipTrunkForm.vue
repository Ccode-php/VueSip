<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, Save } from 'lucide-vue-next'

import sipTrunkService from '../../services/sipTrunkService'

const router = useRouter()
const route = useRoute()

const loading = ref(false)
const saving = ref(false)
const error = ref('')

const isEdit = computed(() => !!route.params.id)

const form = reactive({
    name: '',
    provider: '',
    host: '',
    port: 5060,
    transport: 'udp',
    auth_type: 'username_password',
    username: '',
    password: '',
    realm: '',
    from_user: '',
    from_domain: '',
    outbound_proxy: '',
    codec: 'alaw',
    dtmf_mode: 'rfc4733',
    caller_id: '',
    max_concurrent_calls: 1,
    enabled: true,
})

async function loadTrunk() {
    if (!isEdit.value) {
        return
    }

    loading.value = true
    error.value = ''

    try {
        const response = await sipTrunkService.getOne(route.params.id)

        const trunk = response.data

        Object.assign(form, {
            name: trunk.name ?? '',
            provider: trunk.provider ?? '',
            host: trunk.host ?? '',
            port: trunk.port ?? 5060,
            transport: trunk.transport ?? 'udp',
            auth_type: trunk.auth_type ?? 'username_password',
            username: trunk.username ?? '',
            password: '',
            realm: trunk.realm ?? '',
            from_user: trunk.from_user ?? '',
            from_domain: trunk.from_domain ?? '',
            outbound_proxy: trunk.outbound_proxy ?? '',
            codec: trunk.codec ?? 'alaw',
            dtmf_mode: trunk.dtmf_mode ?? 'rfc4733',
            caller_id: trunk.caller_id ?? '',
            max_concurrent_calls:
                trunk.max_concurrent_calls ?? 1,
            enabled: trunk.enabled ?? true,
        })
    } catch (err) {
        console.error(err)

        error.value =
            err.response?.data?.message ||
            'SIP Trunkni yuklashda xatolik yuz berdi.'
    } finally {
        loading.value = false
    }
}

async function save() {
    error.value = ''

    if (!form.name) {
        error.value = 'SIP Trunk nomini kiriting.'
        return
    }

    if (!form.host) {
        error.value = 'SIP server manzilini kiriting.'
        return
    }

    saving.value = true

    try {
        const data = {
            ...form,
            port: Number(form.port),
            max_concurrent_calls:
                Number(form.max_concurrent_calls),
        }

        if (isEdit.value) {
            await sipTrunkService.update(
                route.params.id,
                data
            )
        } else {
            await sipTrunkService.create(data)
        }

        router.push('/sip-trunks')
    } catch (err) {
        console.error(err)

        if (err.response?.status === 422) {
            const errors = err.response.data.errors

            error.value = Object.values(errors)
                .flat()
                .join('\n')
        } else {
            error.value =
                err.response?.data?.message ||
                'Saqlashda xatolik yuz berdi.'
        }
    } finally {
        saving.value = false
    }
}

function cancel() {
    router.push('/sip-trunks')
}

onMounted(loadTrunk)
</script>

<template>
    <div class="page">

        <div class="page-header">

            <div>
                <h1>
                    {{
                        isEdit
                            ? 'SIP Trunkni tahrirlash'
                            : 'Yangi SIP Trunk'
                    }}
                </h1>
            </div>

            <button
                class="btn btn-secondary"
                @click="cancel"
            >
                <ArrowLeft :size="17" />
                Orqaga
            </button>

        </div>

        <div
            v-if="error"
            class="alert alert-danger"
        >
            {{ error }}
        </div>

        <div
            v-if="loading"
            class="card loading"
        >
            Yuklanmoqda...
        </div>

        <div
            v-else
            class="card"
        >

            <form @submit.prevent="save">

                <div class="form-grid">

                    <div class="form-group">
                        <label>SIP Trunk nomi *</label>

                        <input
                            v-model="form.name"
                            class="form-control"
                            placeholder="Masalan: uztelecom"
                        >
                    </div>

                    <div class="form-group">
                        <label>Provider</label>

                        <input
                            v-model="form.provider"
                            class="form-control"
                            placeholder="UZTELECOM"
                        >
                    </div>

                    <div class="form-group">
                        <label>SIP Server *</label>

                        <input
                            v-model="form.host"
                            class="form-control"
                            placeholder="sip.example.com"
                        >
                    </div>

                    <div class="form-group">
                        <label>Port *</label>

                        <input
                            v-model="form.port"
                            type="number"
                            class="form-control"
                        >
                    </div>

                    <div class="form-group">
                        <label>Transport *</label>

                        <select
                            v-model="form.transport"
                            class="form-control"
                        >
                            <option value="udp">UDP</option>
                            <option value="tcp">TCP</option>
                            <option value="tls">TLS</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label>Authentication *</label>

                        <select
                            v-model="form.auth_type"
                            class="form-control"
                        >
                            <option value="username_password">
                                Username / Password
                            </option>

                            <option value="ip">
                                IP based
                            </option>
                        </select>
                    </div>

                    <div
                        v-if="form.auth_type === 'username_password'"
                        class="form-group"
                    >
                        <label>Username</label>

                        <input
                            v-model="form.username"
                            class="form-control"
                        >
                    </div>

                    <div
                        v-if="form.auth_type === 'username_password'"
                        class="form-group"
                    >
                        <label>Password</label>

                        <input
                            v-model="form.password"
                            type="password"
                            class="form-control"
                            :placeholder="
                                isEdit
                                    ? 'O‘zgartirmasangiz bo‘sh qoldiring'
                                    : ''
                            "
                        >
                    </div>

                    <div class="form-group">
                        <label>Realm</label>

                        <input
                            v-model="form.realm"
                            class="form-control"
                        >
                    </div>

                    <div class="form-group">
                        <label>From User</label>

                        <input
                            v-model="form.from_user"
                            class="form-control"
                        >
                    </div>

                    <div class="form-group">
                        <label>From Domain</label>

                        <input
                            v-model="form.from_domain"
                            class="form-control"
                        >
                    </div>

                    <div class="form-group">
                        <label>Outbound Proxy</label>

                        <input
                            v-model="form.outbound_proxy"
                            class="form-control"
                            placeholder="sip:proxy.example.com"
                        >
                    </div>

                    <div class="form-group">
                        <label>Codec</label>

                        <input
                            v-model="form.codec"
                            class="form-control"
                            placeholder="alaw,ulaw"
                        >
                    </div>

                    <div class="form-group">
                        <label>DTMF Mode</label>

                        <select
                            v-model="form.dtmf_mode"
                            class="form-control"
                        >
                            <option value="rfc4733">
                                RFC4733
                            </option>

                            <option value="inband">
                                Inband
                            </option>

                            <option value="info">
                                SIP INFO
                            </option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label>Caller ID</label>

                        <input
                            v-model="form.caller_id"
                            class="form-control"
                            placeholder="+998..."
                        >
                    </div>

                    <div class="form-group">
                        <label>Concurrent Calls</label>

                        <input
                            v-model="form.max_concurrent_calls"
                            type="number"
                            min="1"
                            class="form-control"
                        >
                    </div>

                    <div class="form-group">
                        <label>Holat</label>

                        <select
                            v-model="form.enabled"
                            class="form-control"
                        >
                            <option :value="true">
                                Faol
                            </option>

                            <option :value="false">
                                O‘chiq
                            </option>
                        </select>
                    </div>

                </div>

                <div
                    style="
                        margin-top: 25px;
                        display: flex;
                        justify-content: flex-end;
                        gap: 10px;
                    "
                >

                    <button
                        type="button"
                        class="btn btn-secondary"
                        @click="cancel"
                    >
                        Bekor qilish
                    </button>

                    <button
                        type="submit"
                        class="btn btn-primary"
                        :disabled="saving"
                    >
                        <Save :size="17" />

                        {{
                            saving
                                ? 'Saqlanmoqda...'
                                : 'Saqlash'
                        }}
                    </button>

                </div>

            </form>

        </div>

    </div>
</template>

<style scoped>
.alert {
    white-space: pre-line;
    padding: 12px 15px;
    border-radius: 8px;
    margin-bottom: 18px;
}

.alert-danger {
    background: #fee2e2;
    color: #991b1b;
}

.loading {
    text-align: center;
    padding: 40px;
}
</style>