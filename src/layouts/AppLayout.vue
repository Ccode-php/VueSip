<script setup>
import AppSidebar from '../components/AppSidebar.vue'
import AppHeader from '../components/AppHeader.vue'
</script>

<template>
    <div class="app">
        <AppSidebar />

        <div class="main">
            <AppHeader />

            <main class="content">
                <slot />
            </main>
        </div>
    </div>
</template>