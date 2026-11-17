<script setup lang="ts">
import { computed } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import {
  faArrowRight, faArrowLeft, faArrowUpRightFromSquare, faBagShopping, faBars, faBell, faBolt, faBook, faBookOpen, faBullseye, faCalendar,
  faCalendarDays, faChartSimple, faCheck, faCheckCircle, faChevronDown, faChevronLeft, faChevronRight,
  faChevronUp, faCircleInfo, faCircleQuestion, faClock, faClose, faCompass, faDownload, faEllipsis, faEnvelope, faExpand, faFileImport, faFilter,
  faFire, faFlag, faGear, faGlobe, faHouse, faLayerGroup, faList, faLocationDot, faLock, faMagnifyingGlass,
  faMap, faMedal, faMessage, faMinus, faMountain, faMountainSun, faNewspaper, faPaperPlane, faPen, faPeopleGroup, faPlus, faQuoteLeft,
  faRightFromBracket, faRocket, faRotateRight, faScroll, faSearch, faShield, faShieldHalved, faSliders, faStar,
  faTags, faTent, faThumbsUp, faTrash, faTrophy, faUpload, faUser, faUserPlus, faUsers, faXmark,
} from '@fortawesome/free-solid-svg-icons';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';

const props = defineProps<{ name: string; size?: string | number; title?: string }>();
const icons: Record<string, IconDefinition> = {
  'arrow-right': faArrowRight, 'arrow-left': faArrowLeft, 'arrow-up-right-from-square': faArrowUpRightFromSquare,
  bars: faBars, menu: faBars, bell: faBell, bolt: faBolt, backpack: faBagShopping, bullseye: faBullseye, 'file-import': faFileImport, book: faBook, 'book-open': faBookOpen, calendar: faCalendar,
  'calendar-days': faCalendarDays, chart: faChartSimple, 'chart-simple': faChartSimple, 'chart-line': faChartSimple,
  check: faCheck, 'check-circle': faCheckCircle, 'circle-check': faCheckCircle,
  'chevron-down': faChevronDown, 'chevron-left': faChevronLeft, 'chevron-right': faChevronRight, 'chevron-up': faChevronUp,
  info: faCircleInfo, 'circle-info': faCircleInfo, 'circle-question': faCircleQuestion, clock: faClock, close: faClose, compass: faCompass,
  download: faDownload, ellipsis: faEllipsis, envelope: faEnvelope, expand: faExpand, filter: faFilter, fire: faFire, flag: faFlag,
  gear: faGear, settings: faGear, globe: faGlobe, house: faHouse, home: faHouse, 'layer-group': faLayerGroup,
  layers: faLayerGroup, tags: faTags, scroll: faScroll, minus: faMinus, 'quote-left': faQuoteLeft, list: faList, 'location-dot': faLocationDot, location: faLocationDot, pin: faLocationDot, lock: faLock,
  'magnifying-glass': faMagnifyingGlass, search: faSearch, map: faMap, medal: faMedal, message: faMessage,
  comment: faMessage, 'comment-dots': faMessage, mountain: faMountain, 'mountain-sun': faMountainSun, newspaper: faNewspaper,
  news: faNewspaper, pen: faPen, edit: faPen, 'pen-to-square': faPen, 'people-group': faPeopleGroup, plus: faPlus,
  'right-from-bracket': faRightFromBracket, logout: faRightFromBracket, rocket: faRocket, 'rotate-right': faRotateRight,
  refresh: faRotateRight, shield: faShield, 'shield-halved': faShieldHalved, sliders: faSliders, star: faStar,
  tent: faTent, 'thumbs-up': faThumbsUp, trash: faTrash, 'trash-can': faTrash, trophy: faTrophy, upload: faUpload,
  user: faUser, 'user-plus': faUserPlus, users: faUsers, xmark: faXmark, telegram: faPaperPlane,
};
const icon = computed(() => icons[props.name] ?? faCircleInfo);
const style = computed(() => props.size ? { fontSize: typeof props.size === 'number' ? `${props.size}rem` : props.size } : undefined);
</script>

<template lang="pug">
font-awesome-icon.ui-icon(:icon="icon" :style="style" :title="title" :aria-hidden="title ? undefined : true")
</template>

<style scoped>
.ui-icon { display: inline-block; flex-shrink: 0; width: 1.1em; }
</style>
