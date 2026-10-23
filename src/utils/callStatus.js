// Qo'ng'iroq holatlari uchun yagona joy: CampaignShow va CallResults shundan foydalanadi.

export const STATUS_FILTERS = [
    { value: '', label: 'Barcha holatlar' },
    { value: 'pending', label: 'Kutilmoqda' },
    { value: 'ringing', label: 'Jiringlamoqda' },
    { value: 'answered', label: 'Javob berdi' },
    { value: 'busy', label: 'Band' },
    { value: 'no_answer', label: 'Javob bermadi' },
    { value: 'failed', label: 'Xatolik' },
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
