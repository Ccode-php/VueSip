import { createRouter, createWebHistory } from 'vue-router'

import SipTrunkList from '../views/sip/SipTrunkList.vue'
import SipTrunkForm from '../views/sip/SipTrunkForm.vue'

import SubscriberList from '../views/subscribers/SubscriberList.vue'
import SubscriberForm from '../views/subscribers/SubscriberForm.vue'

import AudioList from '../views/audio/AudioList.vue'
import AudioForm from '../views/audio/AudioForm.vue'

import CampaignList from '../views/campaigns/CampaignList.vue'
import CampaignCreate from '../views/campaigns/CampaignCreate.vue'
import CampaignShow from '../views/campaigns/CampaignShow.vue'

import CallResults from '../views/calls/CallResults.vue'

const routes = [
    {
        path: '/',
        redirect: '/subscribers',
    },

    {
        path: '/sip-trunks',
        component: SipTrunkList,
    },

    {
        path: '/sip-trunks/create',
        component: SipTrunkForm,
    },

    {
        path: '/sip-trunks/:id/edit',
        component: SipTrunkForm,
    },

    {
        path: '/subscribers',
        component: SubscriberList,
    },

    {
        path: '/subscribers/create',
        component: SubscriberForm,
    },

    {
        path: '/subscribers/:id/edit',
        component: SubscriberForm,
    },

    {
        path: '/audio',
        component: AudioList,
    },

    {
        path: '/audio/create',
        component: AudioForm,
    },

    {
        path: '/campaigns',
        component: CampaignList,
    },

    {
        path: '/campaigns/create',
        component: CampaignCreate,
    },

    {
        path: '/campaigns/:id',
        component: CampaignShow,
    },

    {
        path: '/calls',
        component: CallResults,
    },
]

const router = createRouter({
    history: createWebHistory(),
    routes,
})

export default router