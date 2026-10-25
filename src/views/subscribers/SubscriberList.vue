<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
    Plus,
    Pencil,
    Trash2,
    Search,
    Users,
    FolderPlus,
    RefreshCw,
    X,
} from 'lucide-vue-next'
import * as XLSX from 'xlsx'

import subscriberService from '../../services/subscriberService'
import subscriberGroupService from '../../services/subscriberGroupService'

const router = useRouter()

const subscribers = ref([])
const groups = ref([])

const loading = ref(false)
const error = ref('')

const search = ref('')
const selectedGroup = ref('')

const showGroupModal = ref(false)
const groupSaving = ref(false)
const groupError = ref('')
const editingGroupId = ref(null)

const groupForm = ref({
    name: '',
    description: '',
    enabled: true,
    parent_id: null,
})

const importFile = ref(null)
const importPreview = ref([])
const importing = ref(false)
const importResult = ref(null)

const filteredSubscribers = computed(() => subscribers.value)

// Har qanday chuqurlikdagi kategoriyalarni daraxt bo‘yicha tekis ro‘yxatga aylantiradi.
// depth qiymati UI da ichki kategoriyalarni surib ko‘rsatish uchun ishlatiladi.
const displayGroups = computed(() => {
    const byParent = new Map()

    for (const group of groups.value) {
        const key = group.parent_id == null ? 'root' : String(group.parent_id)
        if (!byParent.has(key)) byParent.set(key, [])
        byParent.get(key).push(group)
    }

    const sortByName = list => list.sort((a, b) =>
        String(a.name || '').localeCompare(String(b.name || ''), 'uz')
    )

    for (const list of byParent.values()) sortByName(list)

    const ordered = []
    const visited = new Set()

    function walk(parentId, depth) {
        const key = parentId == null ? 'root' : String(parentId)
        for (const group of byParent.get(key) || []) {
            const id = String(group.id)
            if (visited.has(id)) continue
            visited.add(id)
            ordered.push({ ...group, depth })
            walk(group.id, depth + 1)
        }
    }

    walk(null, 0)

    // Noto‘g‘ri parent_id yoki eski ma’lumot bo‘lsa ham elementlar yo‘qolmasin.
    for (const group of groups.value) {
        if (visited.has(String(group.id))) continue
        visited.add(String(group.id))
        ordered.push({ ...group, depth: 0 })
        walk(group.id, 1)
    }

    return ordered
})

// Tahrirlanayotgan kategoriyaning o‘zi va uning avlodlari ota sifatida tanlanmaydi.
const parentGroups = computed(() => {
    const forbidden = new Set()
    const childrenByParent = new Map()

    for (const group of groups.value) {
        if (group.parent_id == null) continue
        const key = String(group.parent_id)
        if (!childrenByParent.has(key)) childrenByParent.set(key, [])
        childrenByParent.get(key).push(group)
    }

    function addDescendants(id) {
        const key = String(id)
        for (const child of childrenByParent.get(key) || []) {
            const childId = String(child.id)
            if (forbidden.has(childId)) continue
            forbidden.add(childId)
            addDescendants(child.id)
        }
    }

    if (editingGroupId.value != null) {
        forbidden.add(String(editingGroupId.value))
        addDescendants(editingGroupId.value)
    }

    return [...groups.value]
        .filter(group => !forbidden.has(String(group.id)))
        .sort((a, b) => getGroupLabel(a).localeCompare(getGroupLabel(b), 'uz'))
})

// Kategoriyaning to‘liq yo‘lini qaytaradi: Student → 1-kurs → 101-guruh.
function getGroupLabel(group) {
    if (!group) return '—'

    const names = []
    const visited = new Set()
    let current = group

    while (current && !visited.has(String(current.id))) {
        visited.add(String(current.id))
        if (current.name) names.unshift(current.name)

        if (current.parent_id == null) break
        current = groups.value.find(
            item => String(item.id) === String(current.parent_id)
        )
    }

    return names.join(' → ') || '—'
}

function getSubscriberPhones(subscriber) {
    const phones = Array.isArray(subscriber?.phones)
        ? subscriber.phones
        : []

    return [...phones]
        .filter(phone => phone && phone.phone)
        .sort((a, b) => Number(Boolean(b.is_primary)) - Number(Boolean(a.is_primary)))
}

function getErrorMessage(err, fallback) {
    const validationErrors = err.response?.data?.errors

    if (validationErrors) {
        return Object.values(validationErrors).flat().join(' ')
    }

    return err.response?.data?.message || fallback
}

async function loadGroups() {
    const response = await subscriberGroupService.getAll()
    groups.value = Array.isArray(response?.data) ? response.data : []
}

async function loadSubscribers() {
    loading.value = true
    error.value = ''

    try {
        const params = {}

        if (search.value.trim()) {
            params.search = search.value.trim()
        }

        if (selectedGroup.value !== '') {
            params.group_id = selectedGroup.value
        }

        const response = await subscriberService.getAll(params)

        subscribers.value = Array.isArray(response?.data)
            ? response.data
            : []
    } catch (err) {
        console.error('Abonentlarni yuklash xatosi:', err)
        subscribers.value = []
        error.value = getErrorMessage(
            err,
            'Abonentlarni yuklashda xatolik yuz berdi.'
        )
    } finally {
        loading.value = false
    }
}

async function loadAll() {
    error.value = ''

    try {
        await Promise.all([
            loadGroups(),
            loadSubscribers(),
        ])
    } catch (err) {
        console.error('Ma’lumotlarni yuklash xatosi:', err)
        error.value = getErrorMessage(
            err,
            'Ma’lumotlarni yuklashda xatolik yuz berdi.'
        )
    }
}

function createSubscriber() {
    router.push('/subscribers/create')
}

function editSubscriber(id) {
    router.push(`/subscribers/${id}/edit`)
}

async function deleteSubscriber(subscriber) {
    const confirmed = window.confirm(
        `"${subscriber.name}" abonentini o‘chirishni xohlaysizmi?`
    )

    if (!confirmed) return

    try {
        await subscriberService.delete(subscriber.id)
        await loadSubscribers()
    } catch (err) {
        console.error('Abonentni o‘chirish xatosi:', err)
        window.alert(
            getErrorMessage(err, 'Abonentni o‘chirishda xatolik yuz berdi.')
        )
    }
}

function openCreateGroup() {
    editingGroupId.value = null

    groupForm.value = {
        name: '',
        description: '',
        enabled: true,
        parent_id: null,
    }

    groupError.value = ''
    showGroupModal.value = true
}

function openEditGroup(group) {
    editingGroupId.value = group.id

    groupForm.value = {
        name: group.name || '',
        description: group.description || '',
        enabled: Boolean(group.enabled),
        parent_id: group.parent_id ?? null,
    }

    groupError.value = ''
    showGroupModal.value = true
}

function closeGroupModal() {
    if (groupSaving.value) return
    showGroupModal.value = false
}

async function saveGroup() {
    groupError.value = ''

    const name = String(groupForm.value.name || '').trim()

    if (!name) {
        groupError.value = 'Bo‘lim nomini kiriting.'
        return
    }

    groupSaving.value = true

    try {
        const data = {
            name,
            description: String(groupForm.value.description || '').trim() || null,
            enabled: Boolean(groupForm.value.enabled),
            parent_id: groupForm.value.parent_id
                ? Number(groupForm.value.parent_id)
                : null,
        }

        if (editingGroupId.value) {
            await subscriberGroupService.update(editingGroupId.value, data)
        } else {
            await subscriberGroupService.create(data)
        }

        showGroupModal.value = false
        await loadGroups()
    } catch (err) {
        console.error('Bo‘limni saqlash xatosi:', err)
        groupError.value = getErrorMessage(
            err,
            'Bo‘limni saqlashda xatolik yuz berdi.'
        )
    } finally {
        groupSaving.value = false
    }
}

async function deleteGroup(group) {
    if (Number(group.subscribers_count || 0) > 0) {
        window.alert(
            `Bu bo‘limda ${group.subscribers_count} ta abonent bor. ` +
            'Avval abonentlarni boshqa bo‘limga o‘tkazing.'
        )
        return
    }

    if (Number(group.children_count || 0) > 0) {
        window.alert(
            'Bu bo‘limda ichki kategoriyalar bor. Avval ularni boshqa joyga o‘tkazing yoki o‘chiring.'
        )
        return
    }

    const confirmed = window.confirm(
        `"${group.name}" bo‘limini o‘chirishni xohlaysizmi?`
    )

    if (!confirmed) return

    try {
        await subscriberGroupService.delete(group.id)

        if (String(selectedGroup.value) === String(group.id)) {
            selectedGroup.value = ''
        }

        await loadAll()
    } catch (err) {
        console.error('Bo‘limni o‘chirish xatosi:', err)
        window.alert(
            getErrorMessage(err, 'Bo‘limni o‘chirishda xatolik yuz berdi.')
        )
    }
}

async function refresh() {
    await loadAll()
}

onMounted(loadAll)

// Excel import
function openImportFile() {
    importFile.value?.click()
}

async function handleExcelImport(event) {
    const file = event.target.files?.[0]
    if (!file) return

    importPreview.value = []
    importResult.value = null

    try {
        const buffer = await file.arrayBuffer()
        const workbook = XLSX.read(buffer, { type: 'array' })
        const sheetName = workbook.SheetNames[0]

        if (!sheetName) {
            window.alert('Excel fayl ichida varaq topilmadi.')
            return
        }

        const worksheet = workbook.Sheets[sheetName]
        const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '' })

        importPreview.value = rows
            .map(row => ({
                name: String(
                    row['Ism'] ?? row['ism'] ?? row['Name'] ?? row['name'] ?? ''
                ).trim(),
                phone: String(
                    row['Telefon'] ?? row['telefon'] ?? row['Phone'] ?? row['phone'] ?? ''
                ).trim(),
                category: String(
                    row['Kategoriya'] ?? row['kategoriya'] ?? row['Category'] ?? row['category'] ?? ''
                ).trim(),
                type: String(
                    row['Turi'] ?? row['turi'] ?? row['Type'] ?? row['type'] ?? ''
                ).trim().toLowerCase(),
            }))
            .filter(row => row.name || row.phone || row.category || row.type)

        if (!importPreview.value.length) {
            window.alert('Excel faylda import qilinadigan qatorlar topilmadi.')
        }
    } catch (err) {
        console.error('Excel faylini o‘qish xatosi:', err)
        window.alert('Excel faylni o‘qib bo‘lmadi.')
    } finally {
        // Bir xil faylni qayta tanlashga ham ruxsat beradi.
        event.target.value = ''
    }
}

function clearImport() {
    importPreview.value = []
    importResult.value = null

    if (importFile.value) {
        importFile.value.value = ''
    }
}

async function startImport() {
    if (!importPreview.value.length) {
        window.alert('Import qilish uchun ma’lumot yo‘q.')
        return
    }

    const invalidRows = importPreview.value.filter(row =>
        !row.name ||
        !row.phone ||
        !row.category ||
        !['student', 'employee'].includes(row.type)
    )

    if (invalidRows.length) {
        window.alert(
            `${invalidRows.length} ta qatorda ma’lumot noto‘g‘ri yoki yetishmayapti. ` +
            'Ism, Telefon, Kategoriya va Turi ustunlarini tekshiring.'
        )
        return
    }

    importing.value = true

    try {
        const response = await subscriberService.importSubscribers(importPreview.value)

        // Xizmat Laravel javobini to‘g‘ridan-to‘g‘ri yoki data ichida qaytarishi mumkin.
        const outer = response?.data ?? response ?? {}
        const result = outer?.data && typeof outer.data === 'object'
            ? outer.data
            : outer

        importResult.value = {
            total: Number(result.total ?? importPreview.value.length),
            added: Number(result.added ?? 0),
            updated: Number(result.updated ?? 0),
            skipped: Number(result.skipped ?? 0),
            errors: Array.isArray(result.errors) ? result.errors : [],
        }

        importPreview.value = []
        await loadAll()
    } catch (err) {
        console.error('Excel import xatosi:', err)
        window.alert(
            getErrorMessage(err, 'Excel import qilishda xatolik yuz berdi.')
        )
    } finally {
        importing.value = false
    }
}


// Excel eksport: import fayli bilan bir xil ustunlar (qayta import qilsa bo'ladi)
function exportSubscribers() {
    const list = subscribers.value || []

    if (!list.length) {
        window.alert('Eksport qilish uchun abonent yo‘q.')
        return
    }

    const cmp = (a, b) => String(a).localeCompare(String(b), 'uz')

    // Kategoriya bo'yicha, keyin ism bo'yicha tartiblanadi
    const rows = [...list]
        .sort((a, b) =>
            cmp(a.group?.name || '', b.group?.name || '') || cmp(a.name, b.name)
        )
        .map((s) => ({
            Ism: s.name,
            Telefon: (s.phones || []).map((p) => p.phone).join(';'),
            Kategoriya: s.group?.name || '',
            Turi: s.type,
        }))

    const workbook = XLSX.utils.book_new()

    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), 'Barchasi')

    // Hamma bo'limlar tanlangan bo'lsa: har bir kategoriya uchun alohida varaq ham qo'shiladi
    if (!selectedGroup.value) {
        const byCategory = new Map()

        for (const row of rows) {
            const key = row.Kategoriya || 'Kategoriyasiz'

            if (!byCategory.has(key)) byCategory.set(key, [])
            byCategory.get(key).push(row)
        }

        const used = new Set(['barchasi'])

        for (const [name, items] of byCategory) {
            // Excel varaq nomi: 31 belgigacha, \ / ? * [ ] : bo'lmaydi, takrorlanmaydi
            const base = name.replace(/[\\/?*[\]:]/g, ' ').trim().slice(0, 28) || 'Kategoriya'
            let title = base
            let n = 2

            while (used.has(title.toLowerCase())) {
                title = `${base} ${n++}`
            }

            used.add(title.toLowerCase())
            XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(items), title)
        }
    }

    XLSX.writeFile(
        workbook,
        `Abonentlar_${new Date().toISOString().slice(0, 10)}.xlsx`
    )
}
</script>

<template>
    <div class="page">
        <div class="page-header">
            <div>
                <h1>Abonentlar</h1>
                <p class="page-description">
                    Talabalar va xodimlarni boshqarish
                </p>
            </div>

            <div class="actions">
                <button class="btn btn-secondary" type="button" @click="openCreateGroup">
                    <FolderPlus :size="18" />
                    Bo‘lim
                </button>

                <button class="btn btn-primary" type="button" @click="createSubscriber">
                    <Plus :size="18" />
                    Abonent qo‘shish
                </button>

                <button class="btn btn-primary" type="button" @click="openImportFile">
                    📥 Excel import
                </button>

                <button class="btn btn-secondary" type="button" @click="exportSubscribers">
                    📤 Excel eksport
                </button>

                <input ref="importFile" type="file" accept=".xlsx,.xls" hidden @change="handleExcelImport" />
            </div>
        </div>

        <div class="card filter-card">
            <div class="filter-row">
                <div class="search-box">
                    <Search :size="18" />
                    <input v-model="search" type="text" placeholder="Ism yoki telefon bo‘yicha qidirish..."
                        class="form-control" @keyup.enter="loadSubscribers" />
                </div>

                <select v-model="selectedGroup" class="form-control group-filter" @change="loadSubscribers">
                    <option value="">Barcha bo‘limlar</option>
                    <option v-for="group in displayGroups" :key="group.id" :value="group.id">
                        {{ '　'.repeat(group.depth || 0) }}{{ group.depth ? '↳ ' : '' }}{{ getGroupLabel(group) }}
                        ({{ group.subscribers_count || 0 }})
                    </option>
                </select>

                <button class="btn btn-secondary" type="button" @click="loadSubscribers">
                    <Search :size="17" />
                    Qidirish
                </button>

                <button class="btn btn-secondary" type="button" title="Yangilash" @click="refresh">
                    <RefreshCw :size="17" />
                </button>
            </div>
        </div>

        <!-- Kategoriyalar -->
        <div class="card">
            <div class="card-header-row">
                <div>
                    <h2>Kategoriyalar</h2>
                    <p class="section-description">
                        Asosiy kategoriya va uning ichki kategoriyalarini boshqaring.
                    </p>
                </div>

                <button class="btn btn-secondary btn-sm" type="button" @click="openCreateGroup">
                    <FolderPlus :size="16" />
                    Kategoriya qo‘shish
                </button>
            </div>

            <div v-if="displayGroups.length" class="groups-grid">
                <div v-for="group in displayGroups" :key="group.id" class="group-card" :class="{
                    'group-disabled': !group.enabled,
                    'group-child': group.depth > 0
                }" :style="{ marginLeft: `${Math.min(group.depth || 0, 5) * 12}px` }">
                    <div class="group-card-icon">
                        <Users :size="22" />
                    </div>

                    <div class="group-card-content">
                        <strong>
                            <span v-if="group.depth > 0" class="child-marker">↳ </span>
                            {{ group.name }}
                        </strong>

                        <small v-if="group.parent_id != null" class="parent-label">
                            Yo‘li: {{ getGroupLabel(group) }}
                        </small>

                        <span>{{ group.subscribers_count || 0 }} abonent</span>
                        <span v-if="group.children_count" class="children-count">
                            {{ group.children_count }} ta ichki kategoriya
                        </span>
                        <small v-if="group.description">{{ group.description }}</small>
                    </div>

                    <div class="group-card-actions">
                        <button class="icon-btn" title="Tahrirlash" type="button" @click="openEditGroup(group)">
                            <Pencil :size="16" />
                        </button>

                        <button class="icon-btn danger" title="O‘chirish" type="button" @click="deleteGroup(group)">
                            <Trash2 :size="16" />
                        </button>
                    </div>
                </div>
            </div>

            <div v-else class="empty-state small">
                <Users :size="32" />
                <p>Hozircha kategoriyalar mavjud emas.</p>
                <button class="btn btn-primary" type="button" @click="openCreateGroup">
                    Birinchi kategoriyani yaratish
                </button>
            </div>
        </div>

        <!-- Abonentlar -->
        <div class="card">
            <div class="card-header-row">
                <div>
                    <h2>
                        Abonentlar
                        <span class="count-badge">{{ filteredSubscribers.length }}</span>
                    </h2>
                </div>
            </div>

            <div v-if="error" class="alert alert-error">
                {{ error }}
            </div>

            <div v-if="loading" class="loading">
                Abonentlar yuklanmoqda...
            </div>

            <div v-else-if="filteredSubscribers.length === 0" class="empty-state">
                <Users :size="42" />
                <h3>Abonentlar topilmadi</h3>
                <p>Hozircha abonent mavjud emas yoki qidiruv natija bermadi.</p>

                <button class="btn btn-primary" type="button" @click="createSubscriber">
                    <Plus :size="18" />
                    Abonent qo‘shish
                </button>
            </div>

            <div v-else class="table-wrapper">
                <table class="table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Ism</th>
                            <th>Telefon</th>
                            <th>Turi</th>
                            <th>Kategoriya</th>
                            <th>Holat</th>
                            <th>Amallar</th>
                        </tr>
                    </thead>

                    <tbody>
                        <tr v-for="subscriber in filteredSubscribers" :key="subscriber.id">
                            <td>{{ subscriber.id }}</td>

                            <td>
                                <strong>{{ subscriber.name }}</strong>
                            </td>

                            <td>
                                <div v-if="getSubscriberPhones(subscriber).length" class="subscriber-phone-list">
                                    <div v-for="phone in getSubscriberPhones(subscriber)" :key="phone.id ?? phone.phone"
                                        class="subscriber-phone-item">
                                        <span class="subscriber-phone-number" :class="{
                                            'subscriber-phone-primary': phone.is_primary
                                        }">
                                            {{ phone.phone }}
                                        </span>

                                        <span class="subscriber-phone-label">
                                            {{ phone.is_primary ? 'Asosiy' : (phone.label || 'Qo‘shimcha') }}
                                        </span>

                                        <span v-if="phone.enabled === false" class="subscriber-phone-disabled">
                                            Nofaol
                                        </span>
                                    </div>
                                </div>

                                <span v-else class="subscriber-phone-empty">
                                    Raqam yo‘q
                                </span>
                            </td>

                            <td>
                                <span class="badge"
                                    :class="subscriber.type === 'student' ? 'badge-blue' : 'badge-purple'">
                                    {{ subscriber.type === 'student' ? 'Talaba' : 'Xodim' }}
                                </span>
                            </td>

                            <td>{{ getGroupLabel(subscriber.group) }}</td>

                            <td>
                                <span class="status-badge"
                                    :class="subscriber.enabled ? 'status-success' : 'status-disabled'">
                                    {{ subscriber.enabled ? 'Faol' : 'Nofaol' }}
                                </span>
                            </td>

                            <td>
                                <div class="table-actions">
                                    <button class="icon-btn" title="Tahrirlash" type="button"
                                        @click="editSubscriber(subscriber.id)">
                                        <Pencil :size="17" />
                                    </button>

                                    <button class="icon-btn danger" title="O‘chirish" type="button"
                                        @click="deleteSubscriber(subscriber)">
                                        <Trash2 :size="17" />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        <!-- Kategoriya yaratish/tahrirlash oynasi -->
        <div v-if="showGroupModal" class="modal-overlay" @click.self="closeGroupModal">
            <div class="modal">
                <div class="modal-header">
                    <h2>
                        {{ editingGroupId ? 'Kategoriyani tahrirlash' : 'Yangi kategoriya' }}
                    </h2>

                    <button class="icon-btn" type="button" :disabled="groupSaving" @click="closeGroupModal">
                        <X :size="20" />
                    </button>
                </div>

                <div v-if="groupError" class="alert alert-error">
                    {{ groupError }}
                </div>

                <form @submit.prevent="saveGroup">
                    <div class="form-group">
                        <label for="group-name">Kategoriya nomi</label>
                        <input id="group-name" v-model="groupForm.name" class="form-control" type="text"
                            placeholder="Masalan: Talabalar yoki 1-kurs" maxlength="255" required />
                    </div>

                    <div class="form-group">
                        <label for="group-parent">Ota kategoriya</label>
                        <select id="group-parent" v-model="groupForm.parent_id" class="form-control">
                            <option :value="null">Asosiy kategoriya</option>
                            <option v-for="parent in parentGroups" :key="parent.id" :value="parent.id">
                                {{ getGroupLabel(parent) }}
                            </option>
                        </select>
                        <small class="field-hint">
                            “Asosiy kategoriya” tanlansa, kategoriya yuqori darajada turadi.
                            Boshqa kategoriya tanlansa, uning ichki kategoriyasi bo‘ladi. Istalgan darajani tanlash
                            mumkin.
                        </small>
                    </div>

                    <div class="form-group">
                        <label for="group-description">Tavsif</label>
                        <textarea id="group-description" v-model="groupForm.description" class="form-control" rows="3"
                            placeholder="Kategoriya haqida..."></textarea>
                    </div>

                    <div class="form-checkbox">
                        <input id="group-enabled" v-model="groupForm.enabled" type="checkbox" />
                        <label for="group-enabled">Faol</label>
                    </div>

                    <div class="modal-footer">
                        <button class="btn btn-secondary" type="button" :disabled="groupSaving"
                            @click="closeGroupModal">
                            Bekor qilish
                        </button>

                        <button class="btn btn-primary" type="submit" :disabled="groupSaving">
                            {{ groupSaving ? 'Saqlanmoqda...' : 'Saqlash' }}
                        </button>
                    </div>
                </form>
            </div>
        </div>

        <!-- Excel import ko‘rib chiqish -->
        <div v-if="importPreview.length" class="card import-card">
            <div class="import-header">
                <div>
                    <h3>Excel import</h3>
                    <p>
                        {{ importPreview.length }} ta qator topildi.
                        Import qilishdan oldin ma’lumotlarni tekshiring.
                    </p>
                </div>

                <button class="btn" type="button" @click="clearImport">
                    ✕ Bekor qilish
                </button>
            </div>

            <div class="table-wrapper">
                <table class="table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Ism</th>
                            <th>Telefon</th>
                            <th>Kategoriya</th>
                            <th>Turi</th>
                        </tr>
                    </thead>

                    <tbody>
                        <tr v-for="(row, index) in importPreview" :key="index">
                            <td>{{ index + 1 }}</td>
                            <td>{{ row.name }}</td>
                            <td>{{ row.phone }}</td>
                            <td>{{ row.category }}</td>
                            <td>{{ row.type }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div class="actions">
                <button class="btn btn-primary" type="button" :disabled="importing" @click="startImport">
                    {{ importing ? 'Import qilinmoqda...' : 'Import qilish' }}
                </button>

                <button class="btn" type="button" :disabled="importing" @click="clearImport">
                    Bekor qilish
                </button>
            </div>
        </div>

        <!-- Excel import natijasi -->
        <div v-if="importResult" class="card">
            <h3>Import natijasi</h3>

            <div class="import-result">
                <div>
                    <strong>{{ importResult.total }}</strong>
                    <span>Jami</span>
                </div>

                <div>
                    <strong>{{ importResult.added }}</strong>
                    <span>Qo‘shildi</span>
                </div>

                <div>
                    <strong>{{ importResult.updated }}</strong>
                    <span>Yangilandi</span>
                </div>

                <div v-if="importResult.skipped">
                    <strong>{{ importResult.skipped }}</strong>
                    <span>O‘tkazib yuborildi</span>
                </div>

                <div>
                    <strong>{{ importResult.errors.length }}</strong>
                    <span>Xatolik</span>
                </div>
            </div>

            <div v-if="importResult.errors.length" class="import-errors">
                <h4>Xatoliklar</h4>
                <ul>
                    <li v-for="(item, index) in importResult.errors" :key="item.row ?? index">
                        {{ item.row ? `${item.row}-qator: ` : '' }}{{ item.message || item }}
                    </li>
                </ul>
            </div>
        </div>
    </div>
</template>

<style scoped>
.filter-row {
    display: flex;
    gap: 12px;
    align-items: center;
}

.search-box {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
    min-width: 180px;
}

.search-box .form-control {
    width: 100%;
}

.group-filter {
    width: 280px;
}

.card-header-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 14px;
    margin-bottom: 18px;
}

.card-header-row h2 {
    margin: 0;
}

.section-description {
    margin: 6px 0 0;
    color: #6b7280;
    font-size: 13px;
}

.count-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 25px;
    height: 25px;
    padding: 0 7px;
    margin-left: 6px;
    border-radius: 20px;
    background: #eef2ff;
    font-size: 13px;
}

.groups-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 14px;
}

.group-card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px;
    border: 1px solid #e5e7eb;
    border-radius: 10px;
    min-width: 0;
}

.group-card.group-child {
    border-left: 3px solid #818cf8;
}

.group-card.group-disabled {
    opacity: 0.55;
}

.group-card-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 42px;
    height: 42px;
    flex-shrink: 0;
    border-radius: 9px;
    background: #eef2ff;
}

.group-card-content {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;
    min-width: 0;
}

.group-card-content strong {
    overflow-wrap: anywhere;
}

.group-card-content span,
.group-card-content small {
    font-size: 12px;
    overflow-wrap: anywhere;
}

.group-card-content span {
    color: #6b7280;
}

.group-card-content small {
    color: #9ca3af;
}

.child-marker {
    color: #6366f1;
    font-weight: 700;
}

.parent-label {
    color: #6366f1 !important;
}

.children-count {
    color: #4f46e5 !important;
}

.group-card-actions,
.table-actions {
    display: flex;
    gap: 5px;
    flex-shrink: 0;
}

.icon-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    flex-shrink: 0;
    border: 1px solid #e5e7eb;
    border-radius: 7px;
    background: white;
    cursor: pointer;
}

.icon-btn:hover {
    background: #f3f4f6;
}

.icon-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.icon-btn.danger {
    color: #dc2626;
}

.icon-btn.danger:hover {
    background: #fef2f2;
}

.badge {
    display: inline-block;
    padding: 4px 9px;
    border-radius: 20px;
    font-size: 12px;
}

.badge-blue {
    background: #dbeafe;
    color: #1d4ed8;
}

.badge-purple {
    background: #ede9fe;
    color: #6d28d9;
}

.status-badge {
    display: inline-block;
    padding: 4px 9px;
    border-radius: 20px;
    font-size: 12px;
}

.status-success {
    background: #dcfce7;
    color: #15803d;
}

.status-disabled {
    background: #f3f4f6;
    color: #6b7280;
}

.subscriber-phone-list {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 7px;
    min-width: 160px;
}

.subscriber-phone-item {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 7px;
}

.subscriber-phone-number {
    color: #374151;
    font-size: 13px;
    font-weight: 500;
    font-variant-numeric: tabular-nums;
}

.subscriber-phone-primary {
    color: #111827;
    font-weight: 700;
}

.subscriber-phone-label {
    padding: 3px 7px;
    border-radius: 5px;
    background: #f3f4f6;
    color: #6b7280;
    font-size: 10px;
}

.subscriber-phone-disabled {
    padding: 3px 7px;
    border-radius: 5px;
    background: #fee2e2;
    color: #b91c1c;
    font-size: 10px;
}

.subscriber-phone-empty {
    color: #9ca3af;
    font-size: 13px;
}

.modal-overlay {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    background: rgba(0, 0, 0, 0.45);
    z-index: 1000;
}

.modal {
    width: 100%;
    max-width: 520px;
    max-height: 90vh;
    overflow-y: auto;
    background: white;
    border-radius: 12px;
    padding: 22px;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.2);
}

.modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 20px;
}

.modal-header h2 {
    margin: 0;
}

.form-group {
    margin-bottom: 16px;
}

.form-group label {
    display: block;
    margin-bottom: 7px;
}

.field-hint {
    display: block;
    margin-top: 6px;
    color: #6b7280;
    font-size: 12px;
    line-height: 1.5;
}

.modal-footer {
    display: flex;
    justify-content: flex-end;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 24px;
}

.form-checkbox {
    display: flex;
    align-items: center;
    gap: 8px;
}

.form-checkbox input {
    width: 16px;
    height: 16px;
}

.form-checkbox label {
    margin: 0;
}

.empty-state.small {
    padding: 25px;
}

.import-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    flex-wrap: wrap;
    gap: 12px;
    margin-bottom: 16px;
}

.import-header h3,
.import-header p {
    margin-top: 0;
}

.import-result {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    margin: 18px 0;
}

.import-result>div {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 90px;
    padding: 12px 16px;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
}

.import-result strong {
    font-size: 22px;
}

.import-result span {
    color: #6b7280;
    font-size: 12px;
}

.import-errors {
    color: #b91c1c;
}

.import-errors ul {
    padding-left: 22px;
}

@media (max-width: 800px) {
    .filter-row {
        flex-direction: column;
        align-items: stretch;
    }

    .group-filter {
        width: 100%;
    }

    .groups-grid {
        grid-template-columns: 1fr;
    }

    .group-card.group-child {
        margin-left: 0;
    }

    .table-wrapper {
        overflow-x: auto;
    }
}
</style>
