
<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import subscriberService from '../../services/subscriberService'
import subscriberGroupService from '../../services/subscriberGroupService'

const route = useRoute()
const router = useRouter()

const isEdit = computed(() => Boolean(route.params.id))

const loading = ref(false)
const saving = ref(false)
const error = ref('')
const groups = ref([])

function createEmptyPhone(label = 'Asosiy', isPrimary = true) {
    return {
        phone: '',
        label,
        is_primary: isPrimary,
        enabled: true,
    }
}

const form = reactive({
    subscriber_group_id: '',
    name: '',
    type: 'student',
    enabled: true,
    phones: [createEmptyPhone()],
})

function getErrorMessage(err, fallback) {
    const errors = err.response?.data?.errors

    if (errors) {
        return Object.values(errors).flat().join(' ')
    }

    return err.response?.data?.message || fallback
}

async function loadGroups() {
    try {
        const response = await subscriberGroupService.getAll()

        groups.value = Array.isArray(response?.data)
            ? response.data
            : []
    } catch (err) {
        console.error('Bo‘limlarni yuklash xatosi:', err)

        error.value = getErrorMessage(
            err,
            'Bo‘limlarni yuklashda xatolik yuz berdi.'
        )
    }
}

async function loadSubscriber() {
    if (!isEdit.value) return

    loading.value = true
    error.value = ''

    try {
        const response = await subscriberService.getOne(route.params.id)

        // Laravel show javobi: { success: true, data: { ...subscriber } }
        const subscriber = response?.data

        if (!subscriber || !subscriber.id) {
            throw new Error('Abonent ma’lumotlari topilmadi.')
        }

        form.subscriber_group_id =
            subscriber.subscriber_group_id == null
                ? ''
                : String(subscriber.subscriber_group_id)

        form.name = subscriber.name ?? ''
        form.type = subscriber.type ?? 'student'
        form.enabled = Boolean(subscriber.enabled)

        const phones = Array.isArray(subscriber.phones)
            ? subscriber.phones
            : []

        form.phones = phones
            .filter(phone => phone && typeof phone === 'object')
            .slice(0, 2)
            .map((phone, index) => ({
                phone: phone.phone ?? '',
                label: phone.label || (index === 0 ? 'Asosiy' : 'Qo‘shimcha'),
                is_primary: Boolean(phone.is_primary),
                enabled: phone.enabled !== false,
            }))

        if (!form.phones.length) {
            form.phones = [createEmptyPhone()]
        }

        // Agar asosiy raqam belgilanmagan bo‘lsa, birinchisini asosiy qilamiz.
        if (!form.phones.some(phone => phone.is_primary)) {
            form.phones[0].is_primary = true
        } else {
            // Ma’lumotlar noto‘g‘ri bo‘lib, bir nechta asosiy raqam bo‘lsa,
            // faqat birinchisi asosiy bo‘lib qoladi.
            let primaryFound = false

            form.phones.forEach(phone => {
                if (phone.is_primary && !primaryFound) {
                    primaryFound = true
                } else {
                    phone.is_primary = false
                }
            })
        }
    } catch (err) {
        console.error('Abonentni yuklash xatosi:', err)

        error.value = getErrorMessage(
            err,
            'Abonent ma’lumotlarini yuklashda xatolik yuz berdi.'
        )
    } finally {
        loading.value = false
    }
}

function addPhone() {
    if (form.phones.length >= 2) return

    form.phones.push(
        createEmptyPhone('Qo‘shimcha', false)
    )
}

function removePhone(index) {
    if (form.phones.length <= 1) return

    const removedPrimary = form.phones[index]?.is_primary

    form.phones.splice(index, 1)

    if (removedPrimary && form.phones.length) {
        setPrimary(0)
    }
}

function setPrimary(index) {
    form.phones.forEach((phone, phoneIndex) => {
        phone.is_primary = phoneIndex === index
    })
}

function normalizePhone(value) {
    return String(value ?? '').replace(/[\s()-]/g, '')
}

async function save() {
    error.value = ''

    if (!form.name.trim()) {
        error.value = 'Abonent ismini kiriting.'
        return
    }

    if (!['student', 'employee'].includes(form.type)) {
        error.value = 'Abonent turini tanlang.'
        return
    }

    const validPhones = form.phones
        .map(phone => ({
            phone: normalizePhone(phone.phone),
            label: String(phone.label ?? '').trim(),
            is_primary: Boolean(phone.is_primary),
            enabled: Boolean(phone.enabled),
        }))
        .filter(phone => phone.phone !== '')

    if (!validPhones.length) {
        error.value = 'Kamida bitta telefon raqamini kiriting.'
        return
    }

    if (validPhones.length > 2) {
        error.value = 'Maksimal ikkita telefon raqami kiritish mumkin.'
        return
    }

    const invalidPhone = validPhones.find(
        phone => !/^\+?\d{7,15}$/.test(phone.phone)
    )

    if (invalidPhone) {
        error.value =
            'Telefon raqami noto‘g‘ri. Raqamni +998901234567 shaklida kiriting.'
        return
    }

    const normalizedNumbers = validPhones.map(phone => phone.phone)

    if (new Set(normalizedNumbers).size !== normalizedNumbers.length) {
        error.value = 'Bir xil telefon raqamini ikki marta kiritmang.'
        return
    }

    // Bo‘sh telefon qatori olib tashlanganidan keyin ham asosiy raqam mavjud bo‘lsin.
    if (!validPhones.some(phone => phone.is_primary)) {
        validPhones[0].is_primary = true
    }

    // Faqat bitta raqam asosiy bo‘lishi mumkin.
    let primaryFound = false

    validPhones.forEach(phone => {
        if (phone.is_primary && !primaryFound) {
            primaryFound = true
        } else {
            phone.is_primary = false
        }
    })

    saving.value = true

    try {
        const payload = {
            subscriber_group_id: form.subscriber_group_id
                ? Number(form.subscriber_group_id)
                : null,

            name: form.name.trim(),
            type: form.type,
            enabled: Boolean(form.enabled),

            phones: validPhones.map((phone, index) => ({
                phone: phone.phone,
                label: phone.label || (index === 0 ? 'Asosiy' : 'Qo‘shimcha'),
                is_primary: Boolean(phone.is_primary),
                enabled: Boolean(phone.enabled),
            })),
        }

        if (isEdit.value) {
            await subscriberService.update(route.params.id, payload)
        } else {
            await subscriberService.create(payload)
        }

        await router.push('/subscribers')
    } catch (err) {
        console.error('Abonentni saqlash xatosi:', err)

        error.value = getErrorMessage(
            err,
            'Abonentni saqlashda xatolik yuz berdi.'
        )
    } finally {
        saving.value = false
    }
}

onMounted(async () => {
    await loadGroups()

    if (isEdit.value) {
        await loadSubscriber()
    }
})
</script>

<template>
    <div class="page subscriber-form-page">
        <div class="page-header">
            <div>
                <div class="eyebrow">ABONENTLAR</div>

                <h1>
                    {{ isEdit ? 'Abonentni tahrirlash' : 'Yangi abonent' }}
                </h1>

                <p class="page-description">
                    Abonent ma’lumotlarini kiriting va telefon raqamlarini sozlang.
                </p>
            </div>

            <button
                type="button"
                class="btn btn-secondary"
                :disabled="saving"
                @click="router.push('/subscribers')"
            >
                ← Orqaga
            </button>
        </div>

        <div v-if="error" class="alert alert-error">
            {{ error }}
        </div>

        <div v-if="loading" class="loading card">
            Ma’lumotlar yuklanmoqda...
        </div>

        <form
            v-else
            class="card subscriber-form-card"
            @submit.prevent="save"
        >
            <div class="form-section-heading">
                <div class="section-icon">01</div>

                <div>
                    <h2>Asosiy ma’lumotlar</h2>
                    <p>Abonentning ismi, kategoriyasi va turi</p>
                </div>
            </div>

            <div class="form-grid">
                <div class="form-group">
                    <label for="subscriber-name">Ism va familiya *</label>

                    <input
                        id="subscriber-name"
                        v-model="form.name"
                        class="form-control"
                        type="text"
                        placeholder="Masalan, Ali Valiyev"
                        maxlength="255"
                        required
                    />
                </div>

                <div class="form-group">
                    <label for="subscriber-group">Kategoriya</label>

                    <select
                        id="subscriber-group"
                        v-model="form.subscriber_group_id"
                        class="form-control"
                    >
                        <option value="">Kategoriyasiz</option>

                        <option
                            v-for="group in groups"
                            :key="group.id"
                            :value="String(group.id)"
                        >
                            {{ group.name }}
                        </option>
                    </select>
                </div>

                <div class="form-group">
                    <label for="subscriber-type">Abonent turi *</label>

                    <select
                        id="subscriber-type"
                        v-model="form.type"
                        class="form-control"
                        required
                    >
                        <option value="student">Talaba</option>
                        <option value="employee">Xodim</option>
                    </select>
                </div>
            </div>

            <div class="subscriber-divider"></div>

            <div class="form-section-heading">
                <div class="section-icon">02</div>

                <div>
                    <h2>Telefon raqamlari</h2>
                    <p>
                        Bitta abonentga ko‘pi bilan ikkita raqam biriktiriladi.
                    </p>
                </div>

                <button
                    v-if="form.phones.length < 2"
                    type="button"
                    class="btn btn-secondary phone-add-btn"
                    @click="addPhone"
                >
                    + Raqam qo‘shish
                </button>
            </div>

            <div class="phone-list">
                <div
                    v-for="(phone, index) in form.phones"
                    :key="index"
                    class="phone-card"
                >
                    <div class="phone-card-top">
                        <div class="phone-number-badge">
                            {{ index + 1 }}
                        </div>

                        <div class="phone-card-title">
                            <strong>
                                {{ index === 0 ? 'Birinchi raqam' : 'Ikkinchi raqam' }}
                            </strong>

                            <span>
                                {{ phone.is_primary ? 'Asosiy raqam' : 'Qo‘shimcha raqam' }}
                            </span>
                        </div>

                        <button
                            v-if="form.phones.length > 1"
                            type="button"
                            class="phone-remove-btn"
                            @click="removePhone(index)"
                        >
                            O‘chirish
                        </button>
                    </div>

                    <div class="phone-fields">
                        <div class="form-group">
                            <label :for="`phone-${index}`">
                                Telefon raqami *
                            </label>

                            <input
                                :id="`phone-${index}`"
                                v-model="phone.phone"
                                class="form-control"
                                type="tel"
                                inputmode="tel"
                                placeholder="+998901234567"
                                maxlength="20"
                                :required="index === 0"
                            />
                        </div>

                        <div class="form-group">
                            <label :for="`phone-label-${index}`">
                                Raqam nomi
                            </label>

                            <input
                                :id="`phone-label-${index}`"
                                v-model="phone.label"
                                class="form-control"
                                type="text"
                                placeholder="Asosiy yoki qo‘shimcha"
                                maxlength="50"
                            />
                        </div>
                    </div>

                    <label class="primary-phone-choice">
                        <input
                            type="radio"
                            name="primary_phone"
                            :checked="phone.is_primary"
                            @change="setPrimary(index)"
                        />

                        <span>
                            Asosiy qo‘ng‘iroq raqami sifatida ishlatish
                        </span>
                    </label>
                </div>
            </div>

            <div class="subscriber-divider"></div>

            <div class="subscriber-active-row">
                <div>
                    <strong>Abonent holati</strong>
                    <p>Faol abonent kampaniyaga kiritilishi mumkin.</p>
                </div>

                <label class="switch-control">
                    <input v-model="form.enabled" type="checkbox" />
                    <span class="switch-track"></span>
                    <span class="switch-label">
                        {{ form.enabled ? 'Faol' : 'Nofaol' }}
                    </span>
                </label>
            </div>

            <div class="subscriber-form-footer">
                <p><span>*</span> Majburiy maydonlar</p>

                <div class="form-actions">
                    <button
                        type="button"
                        class="btn btn-secondary"
                        :disabled="saving"
                        @click="router.push('/subscribers')"
                    >
                        Bekor qilish
                    </button>

                    <button
                        type="submit"
                        class="btn btn-primary"
                        :disabled="saving"
                    >
                        {{
                            saving
                                ? 'Saqlanmoqda...'
                                : (isEdit ? 'O‘zgarishlarni saqlash' : 'Abonentni saqlash')
                        }}
                    </button>
                </div>
            </div>
        </form>
    </div>
</template>