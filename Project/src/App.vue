<script setup lang="ts">
import { NConfigProvider, NDialogProvider, NMessageProvider, darkTheme, ruRU, dateRuRU } from 'naive-ui';
import AppTooltip from '@/components/ui/AppTooltip.vue';
import type { GlobalThemeOverrides } from 'naive-ui';

const theme: GlobalThemeOverrides = {
  common: {
    primaryColor: '#ff7a00', primaryColorHover: '#ff9433', primaryColorPressed: '#e96e00',
    bodyColor: '#101110', cardColor: '#191b19', modalColor: '#191b19', popoverColor: '#222522',
    borderColor: '#333733', textColorBase: '#eeefea', borderRadius: '0.75rem',
    fontFamily: "'Manrope', 'Segoe UI', sans-serif",
  },
  Button: { heightMedium: '2.75rem', heightLarge: '3rem', borderRadiusMedium: '0.6rem' },
  Input: { heightMedium: '2.75rem', borderRadius: '0.6rem', color: '#111411' },
  Select: { peers: { InternalSelection: { heightMedium: '2.75rem', borderRadius: '0.6rem', color: '#111411' } } },
  Modal: { peers: { Card: { borderRadius: '1rem' } } },
};
</script>

<template lang="pug">
n-config-provider(:theme="darkTheme" :theme-overrides="theme" :locale="ruRU" :date-locale="dateRuRU")
  n-dialog-provider
    n-message-provider
      router-view
      AppTooltip
</template>
