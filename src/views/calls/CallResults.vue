<!-- views/calls/CallResults.vue -->
<script setup>
import { onMounted, ref, computed } from 'vue'
import * as XLSX from 'xlsx'
import campaignService from '../../services/campaignService'

const results = ref([])
const loading = ref(false)
const filterStatus = ref('')
const searchName = ref('')

async function loadAllResults() {
    loading.value = true
    try {
        const response = await campaignService.getAll()
        const allData = []
        
        // Barcha faol va tugagan kampaniyalarning abonent yozuvlarini bitta massivga yig'amiz
        response.data.forEach(camp => {
            const recipients = camp.recipients || camp.campaign_recipients || []
            recipients.forEach(r => {
                allData.push({ ...r, campaign_name: camp.name })
            })
        })
        results.value = allData
    } catch (e) {
        console.error('Natijalarni yig‘ishda xatolik:', e)
    } finally {
        loading.value = false
    }
}

const filteredResults = computed(() => {
    return results.value.filter(item => {
        const matchesStatus = filterStatus.value ? item.status === filterStatus.value : true
        const matchesName = searchName.value ? item.name.toLowerCase().includes(searchName.value.toLowerCase()) : true
        return matchesStatus && matchesName
    })
})

function exportToExcel() {
    if (!filteredResults.value.length) return alert('Eksport qilish uchun ma’lumot yo‘q.')
    
    // Excel fayl uchun chiroyli o'zbekcha ustunlar tuzilmasi
    const excelRows = filteredResults.value.map((item, index) => ({
        '#': index + 1,
        'Kampaniya nomi': item.campaign_name,
        'Abonent': item.name,
        'Telefon raqami': item.phone,
        'Urinish (Attempt)': item.attempt,
        'Holati (Status)': item.status === 'answered' ? 'Javob berdi' : item.status,
        'Davomiyligi (soniya)': item.duration || 0,
        'Sana': new Date(item.created_at).toLocaleString('uz-UZ')
    }))

    const worksheet = XLSX.utils.json_to_sheet(excelRows)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Hisobot')
    
    XLSX.writeFile(workbook, `Kompaniya_Natijalari_${new Date().toISOString().slice(0,10)}.xlsx`)
}

onMounted(loadAllResults)
</script>

<template>
    <div class="page">
        <div class="page-header">
            <div>
                <h1>Qo‘ng‘iroqlar Natijalari</h1>
                <p class="page-description">Barcha bajarilgan kampaniyalar hisobotlari va Excel eksport bo‘limi.</p>
            </div>
            <button class="btn btn-primary" @click="exportToExcel">📥 Excelga Yuklash (.xlsx)</button>
        </div>

        <div class="card filter-card" style="margin-bottom: 20px; padding: 15px;">
            <div style="display: flex; gap: 15px;">
                <input v-model="searchName" type="text" placeholder="Abonent ismi bo'yicha qidirish..." class="form-control" style="flex: 1;" />
                <select v-model="filterStatus" class="form-control" style="width: 220px;">
                    <option value="">Barcha holatlar</option>
                    <option value="pending">Kutilmoqda</option>
                    <option value="ringing">Chalinmoqda</option>
                    <option value="answered">Javob berdi</option>
                    <option value="no_answer">Javob bermadi</option>
                    <option value="busy">Band</option>
                </select>
            </div>
        </div>

        <div class="card">
            <div v-if="loading" class="loading">Ma’lumotlar yuklanmoqda...</div>
            <div v-else-if="!filteredResults.length" class="empty">Qo‘ng‘iroq natijalari topilmadi.</div>
            <div v-else class="table-wrapper">
                <table class="table">
                    <thead>
                        <tr>
                            <th>Kampaniya</th>
                            <th>Abonent</th>
                            <th>Telefon</th>
                            <th>Holat</th>
                            <th>Urinish</th>
                            <th>Davomiylik</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="item in filteredResults" :key="item.id">
                            <td>{{ item.campaign_name }}</td>
                            <td><strong>{{ item.name }}</strong></td>
                            <td>{{ item.phone }}</td>
                            <td>
                                <span class="status-badge" :class="item.status === 'answered' ? 'status-enabled' : 'status-disabled'">
                                    {{ item.status === 'answered' ? 'Javob berdi' : item.status }}
                                </span>
                            </td>
                            <td>{{ item.attempt }} / {{ item.max_attempts }}</td>
                            <td>{{ item.duration ? item.duration + ' sek' : '—' }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</template>
