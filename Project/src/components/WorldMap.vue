<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { geoNaturalEarth1, geoPath, geoGraticule10, select, zoom, zoomIdentity, type ZoomBehavior } from 'd3'
import { feature } from 'topojson-client'
import type { Topology, GeometryCollection } from 'topojson-specification'
import type { FeatureCollection, Geometry } from 'geojson'
import worldData from 'world-atlas/countries-110m.json'
import { RouterLink } from 'vue-router'
import Icon from '@/components/ui/Icon.vue'
import UserAvatar from '@/components/ui/UserAvatar.vue'

import { mapMarkers, type MapMarker, type MapPoint } from '@/domain/mapMarkers'
const props = defineProps<{ points: MapPoint[]; loading?: boolean }>()
const WIDTH = 880
const HEIGHT = 420
const MAX_ZOOM = 32
const svg = ref<SVGSVGElement>()
const transform = ref('translate(0,0) scale(1)')
const scale = ref(1)
const pixelsPerUnit = ref(1)
const remScale = ref(1)
const activeId = ref('')
const selectedClusterIds = ref<string[]>([])
const active = computed(() => props.points.find(point => point.id === activeId.value))
const clusterCities = computed(() => props.points.filter(point => selectedClusterIds.value.includes(point.id)))
const markerScale = computed(() => remScale.value / (pixelsPerUnit.value * scale.value))
const projection = geoNaturalEarth1().rotate([-20, 0]).scale(143).translate([440, 260])
// Start around Moscow and the surrounding regions; zooming out still reaches the world.
const centralRussia = projection([37.62, 55.75])!
const defaultTransform = zoomIdentity.translate(WIDTH / 2, HEIGHT / 2).scale(10).translate(-centralRussia[0], -centralRussia[1])
const path = geoPath(projection)
const topology = worldData as unknown as Topology<{ countries: GeometryCollection }>
const countries = (feature(topology, topology.objects.countries) as FeatureCollection<Geometry>).features.filter(country => country.id !== '010')
const grid = path(geoGraticule10()) || ''

const markers = computed(() => mapMarkers(props.points, projection, scale.value, pixelsPerUnit.value / remScale.value))

let behavior: ZoomBehavior<SVGSVGElement, unknown> | undefined
let resizeObserver: ResizeObserver | undefined
function measureViewport() {
  if (!svg.value) return
  const bounds = svg.value.getBoundingClientRect()
  // SVG uses xMidYMid meet, including letterboxing on narrow screens.
  pixelsPerUnit.value = Math.max(.01, Math.min(bounds.width / WIDTH, bounds.height / HEIGHT))
  remScale.value = (Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16) / 16
}
onMounted(() => {
  if (!svg.value) return
  measureViewport()
  resizeObserver = new ResizeObserver(measureViewport)
  resizeObserver.observe(svg.value)
  behavior = zoom<SVGSVGElement, unknown>().scaleExtent([1, MAX_ZOOM]).extent([[0, 0], [WIDTH, HEIGHT]])
    .translateExtent([[-400, -220], [1280, 700]])
    .filter(event => event.type === 'wheel' ? event.ctrlKey : !event.button)
    .on('zoom', event => { transform.value = event.transform.toString(); scale.value = event.transform.k })
  select(svg.value).call(behavior).call(behavior.transform, defaultTransform)
})
onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  if (svg.value) select(svg.value).interrupt().on('.zoom', null)
})
function changeZoom(factor: number) {
  selectedClusterIds.value = []
  if (svg.value && behavior) select(svg.value).interrupt().call(behavior.scaleBy, factor)
}
function resetZoom() {
  activeId.value = ''
  selectedClusterIds.value = []
  if (svg.value && behavior) select(svg.value).interrupt().call(behavior.transform, defaultTransform)
}
function openCity(id: string) { selectedClusterIds.value = []; activeId.value = activeId.value === id ? '' : id }
function activateMarker(marker: MapMarker) {
  if (!marker.clustered) { openCity(marker.points[0]!.id); return }
  activeId.value = ''
  selectedClusterIds.value = []
  if (!svg.value || !behavior) return
  if (scale.value >= MAX_ZOOM - .01) {
    // Identical coordinates stay reachable even at the maximum zoom.
    selectedClusterIds.value = marker.points.map(point => point.id)
    return
  }
  const next = zoomIdentity.translate(WIDTH / 2, HEIGHT / 2).scale(Math.min(MAX_ZOOM, scale.value * 2.2)).translate(-marker.position[0], -marker.position[1])
  const selection = select(svg.value).interrupt()
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) selection.call(behavior.transform, next)
  else selection.transition().duration(280).call(behavior.transform, next)
}
</script>

<template lang="pug">
.world-map(:aria-busy="loading")
  svg.map-canvas(ref="svg" viewBox="0 0 880 420" role="group" aria-label="Карта участников по городам. Выберите группу, чтобы приблизить карту, или город, чтобы увидеть участников.")
    defs
      radialGradient(id="map-glow")
        stop(offset="0%" stop-color="#7c6634" stop-opacity=".13")
        stop(offset="100%" stop-color="#152015" stop-opacity="0")
    rect(width="880" height="420" fill="url(#map-glow)")
    g(:transform="transform")
      path.graticule(:d="grid")
      path.country(v-for="country in countries" :key="String(country.id)" :d="path(country) || ''")
      g.map-marker(v-for="marker in markers" :key="marker.id" :transform="`translate(${marker.position[0]},${marker.position[1]}) scale(${markerScale})`" :data-kind="marker.clustered ? 'cluster' : 'city'" :data-cities="marker.points.length" tabindex="0" role="button" :aria-label="marker.clustered ? `${marker.labels.join(', ')}. ${marker.count} участников в ${marker.points.length} городах. Приблизить.` : `${marker.points[0].city}: ${marker.count} участников`" :aria-pressed="!marker.clustered && activeId === marker.id" @click.stop="activateMarker(marker)" @keydown.enter.prevent.stop="activateMarker(marker)" @keydown.space.prevent.stop="activateMarker(marker)")
        circle.marker-hit(r="24")
        circle.marker-halo(:r="marker.clustered ? 23 : 21" :class="{ selected: activeId === marker.id }")
        circle.marker-body(:r="marker.clustered ? 19 : 16" :class="{ selected: activeId === marker.id, clustered: marker.clustered }")
        text.marker-count(font-size="13" text-anchor="middle" dominant-baseline="central") {{ marker.count }}
        text.marker-label(font-size="11" :y="marker.labelOffset[1]" text-anchor="middle")
          tspan(v-for="(label,index) in marker.labels" :key="label" :x="marker.labelOffset[0]" :dy="index ? 13 : 0") {{ label }}
  .map-coordinate Обзорная карта
  .map-controls
    button(aria-label="Приблизить карту" title="Приблизить" :disabled="scale >= MAX_ZOOM" @click="changeZoom(1.5)")
      Icon(name="plus")
    button(aria-label="Отдалить карту" title="Отдалить" :disabled="scale <= 1" @click="changeZoom(1 / 1.5)")
      Icon(name="minus")
    button(aria-label="Вернуться к центральной России" title="Центральная Россия" @click="resetZoom")
      Icon(name="expand")
  .map-popup(v-if="active")
    .popup-heading
      div
        strong {{ active.city }}
        span {{ active.country }} · {{ active.count }} участников
      button.icon-button(aria-label="Закрыть город" @click="activeId = ''")
        Icon(name="xmark")
    UserAvatar.popup-user(v-for="user in active.users" :key="user.id" :user="user")
    RouterLink.popup-all(:to="{path: '/users', query: {city: active.city}}") Все участники в городе →
  .map-popup(v-else-if="clusterCities.length")
    .popup-heading
      strong Выберите город
      button.icon-button(aria-label="Закрыть список городов" @click="selectedClusterIds = []")
        Icon(name="xmark")
    button.popup-city(v-for="city in clusterCities" :key="city.id" @click="openCity(city.id)")
      span {{ city.city }}
      span {{ city.count }}
  .map-empty(v-if="!loading && !points.length") По вашему запросу никого не найдено
  .map-loading(v-if="loading") Обновляем карту…
</template>

<style scoped>
.world-map{position:relative;min-height:15rem;background:#151a14;overflow:hidden}.map-canvas{display:block;width:100%;height:auto;min-height:15rem;cursor:grab;touch-action:pan-y}.map-canvas:active{cursor:grabbing}.country{fill:#30382a;stroke:#151d11;stroke-width:.6;vector-effect:non-scaling-stroke}.graticule{fill:none;stroke:#3b4432;stroke-width:.4;opacity:.3}.map-marker{cursor:pointer;outline:0}.marker-hit{fill:transparent;pointer-events:all}.marker-halo{fill:#e3893630;pointer-events:none}.marker-body{fill:#e89546;stroke:#f6b570;stroke-width:1.5;transition:fill .15s;pointer-events:none}.marker-body.clustered{fill:#efab5e;stroke:#ffe0a1;stroke-width:2}.marker-body.selected,.map-marker:focus .marker-body,.map-marker:hover .marker-body{fill:#ffd69c;stroke:white;stroke-width:2}.marker-halo.selected{fill:#ecad5355}.marker-count{font-family:Manrope,sans-serif;font-weight:800;fill:#312211;pointer-events:none}.marker-label{fill:#d8d6bd;paint-order:stroke;stroke:#172013;stroke-width:3px;stroke-linejoin:round;pointer-events:none}.map-controls{position:absolute;right:.75rem;bottom:.75rem;display:flex;flex-direction:column;gap:.25rem}.map-controls button{border:1px solid #38432e;background:#1b2417;color:#b5c3a7;border-radius:.35rem;width:2.75rem;height:2.75rem;display:grid;place-items:center;font-size:.8rem}.map-controls button:hover:not(:disabled){color:var(--accent)}.map-controls button:disabled{opacity:.4;cursor:default}.map-coordinate{position:absolute;bottom:1.1rem;left:1.3rem;font-size:.55rem;letter-spacing:.08rem;color:#657656}.map-popup{position:absolute;left:1rem;top:.7rem;width:15rem;max-width:calc(100% - 5rem);max-height:calc(100% - 1.4rem);overflow-y:auto;background:#1d2519f7;border:1px solid #4d5d3c;border-radius:.6rem;padding:.8rem;box-shadow:0 .7rem 2rem #0005;backdrop-filter:blur(10px)}.popup-heading{display:flex;justify-content:space-between;align-items:center;margin-bottom:.6rem}.popup-heading strong{display:block;font-size:.8rem}.popup-heading span{font-size:.6rem;color:#9cab8d}.popup-heading .icon-button{width:2.75rem;height:2.75rem}.popup-user{display:flex;align-items:center;gap:.5rem;font-size:.7rem;padding:.4rem 0;min-height:2.75rem}.popup-user>svg{margin-left:auto;font-size:.6rem;color:#95a67f}.popup-all{font-size:.7rem;color:var(--accent);display:block;border-top:1px solid var(--border);padding-top:.7rem;margin-top:.4rem;min-height:2.75rem}.popup-city{display:flex;align-items:center;justify-content:space-between;gap:.5rem;width:100%;min-height:2.75rem;padding:.4rem 0;border:0;border-top:1px solid #38432e;background:transparent;color:#d8d6bd;text-align:left;font-size:.75rem}.popup-city span:last-child{color:var(--accent)}.map-empty,.map-loading{position:absolute;top:1rem;left:50%;transform:translateX(-50%);font-size:.7rem;padding:.6rem .8rem;border-radius:.3rem;background:#1c2518e8;color:#c3ccba;text-align:center}
</style>
