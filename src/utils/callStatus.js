// Qo'ng'iroq holatlari uchun yagona joy: CampaignShow va CallResults shundan foydalanadi.

export const STATUS_FILTERS = [
    { value: '', label: 'Barcha holatlar' },
    { value: 'pending', label: 'Kutilmoqda' },
    { value: 'ringing', label: 'Jiringlamoqda' },
    { value: 'answered', label: 'Javob berdi' },
    { value: 'busy', label: 'Band' },
    { value: 'no_answer', label: 'Javob bermadi' },
    { value: 'failed', label: 'Xatolik' },
    { value: 'skipped', label: 'O‘tkazib yuborildi' },
]

/**
 * Bitta yozuv uchun ko'rsatiladigan holat.
 * `answered` + finished_at yo'q  -> hozir suhbat ketmoqda
 * `answered` + played            -> audio oxirigacha eshitilgan
 * `answered` + !played           -> ko'tardi, lekin audio tugamasdan uzdi
 */
export function callStatus(item) {
    const status = String(item?.status || '').toLowerCase()

    switch (status) {
        case 'answered':
            if (!item.finished_at) {
                return { label: 'Suhbatda', cls: 'cs-badge--live' }
            }

            return item.played
                ? { label: 'To‘liq eshitdi', cls: 'cs-badge--ok' }
                : { label: 'Qisman eshitdi', cls: 'cs-badge--warn' }

        case 'ringing':
            return { label: 'Jiringlamoqda', cls: 'cs-badge--live' }

        case 'pending':
            return Number(item.attempt) > 1
                ? { label: 'Qayta urinish kutilmoqda', cls: 'cs-badge--warn' }
                : { label: 'Kutilmoqda', cls: 'cs-badge--muted' }

        case 'busy':
            return { label: 'Band', cls: 'cs-badge--warn' }

        case 'no_answer':
            return { label: 'Javob bermadi', cls: 'cs-badge--warn' }

        case 'failed':
            return { label: 'Xatolik', cls: 'cs-badge--bad' }

        case 'skipped':
            return { label: 'Kerak bo‘lmadi', cls: 'cs-badge--muted' }

        default:
            return { label: item?.status || 'Noma’lum', cls: 'cs-badge--muted' }
    }
}

export function formatDuration(seconds) {
    const value = Number(seconds)

    if (!value) {
        return '—'
    }

    const mins = Math.floor(value / 60)
    const secs = value % 60

    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

export function formatDateTime(value) {
    if (!value) {
        return '—'
    }

    const date = new Date(value)

    if (Number.isNaN(date.getTime())) {
        return '—'
    }

    const pad = (n) => String(n).padStart(2, '0')

    return (
        `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()} ` +
        `${pad(date.getHours())}:${pad(date.getMinutes())}`
    )
}

export function formatTime(value) {
    if (!value) {
        return ''
    }

    const date = new Date(value)

    if (Number.isNaN(date.getTime())) {
        return ''
    }

    const pad = (n) => String(n).padStart(2, '0')

    return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/**
 * Bitta abonentning raqamlarini (har biri alohida yozuv) bitta guruhga yig'adi.
 * Guruhlash kaliti: kampaniya + abonent.
 */
export function groupRecipients(items) {
    const map = new Map()

    for (const item of items) {
        const key = item.subscriber_id
            ? `${item.campaign_id}:${item.subscriber_id}`
            : `r${item.id}`

        if (!map.has(key)) {
            map.set(key, {
                key,
                name: item.name,
                group_name: item.group_name,
                campaign: item.campaign,
                items: [],
            })
        }

        map.get(key).items.push(item)
    }

    return [...map.values()].map((g) => {
        const sorted = [...g.items].sort((a, b) => a.id - b.id)

        return {
            ...g,
            items: sorted,
            phones: sorted.map((i) => i.phone).join(';'),
        }
    })
}

/** "AMI reason 3" kabi kodni tushunarli matnga aylantiradi. */
export function reasonText(raw) {
    const m = /AMI reason (\d+)/.exec(String(raw || ''))

    if (!m) {
        return String(raw || '')
    }

    switch (Number(m[1])) {
        case 3:
            return 'Jiringladi, lekin ko‘tarmadi'
        case 0:
            return 'Javob yo‘q (aniq sabab berilmagan)'
        case 5:
            return 'Band'
        default:
            return `Asterisk xato kodi: ${m[1]}`
    }
}

/**
 * Izoh matni. `siblings` - shu abonentning barcha raqamlari
 * (qaysi raqam javob berganini topish uchun).
 */
export function callNote(item, siblings = []) {
    const answered = siblings.find((x) => x.status === 'answered')

    if (item.status === 'skipped') {
        if (!answered) {
            return item.error_message || 'Qo‘ng‘iroq qilinmadi'
        }

        const order = siblings.indexOf(answered) + 1

        return `${order}-raqam (${answered.phone}) javob berdi`
    }

    if (item.status === 'answered') {
        if (!item.finished_at) return 'Suhbat davom etmoqda'

        return item.played
            ? 'Javob berdi, audio to‘liq eshitildi'
            : 'Javob berdi, audio to‘liq eshitilmadi'
    }

    return [reasonText(item.sip_reason), item.error_message].filter(Boolean).join('. ')
}