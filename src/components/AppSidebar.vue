<script setup>
import { RouterLink } from 'vue-router'
import {
    Server,
    Users,
    Music,
    PhoneCall,
    BarChart3,
} from 'lucide-vue-next'
</script>

<template>
    <aside class="sidebar">

        <div class="logo">
            <PhoneCall :size="25" />
            <span>Voice System</span>
        </div>

        <nav>

            <RouterLink to="/sip-trunks">
                <Server :size="19" />
                <span>SIP Trunks</span>
            </RouterLink>

            <RouterLink to="/subscribers">
                <Users :size="19" />
                <span>Abonentlar</span>
            </RouterLink>

            <RouterLink to="/audio">
                <Music :size="19" />
                <span>Audio</span>
            </RouterLink>

            <RouterLink to="/campaigns">
                <PhoneCall :size="19" />
                <span>Qo‘ng‘iroqlar</span>
            </RouterLink>

            <RouterLink to="/calls">
                <BarChart3 :size="19" />
                <span>Natijalar</span>
            </RouterLink>

        </nav>

    </aside>
</template>