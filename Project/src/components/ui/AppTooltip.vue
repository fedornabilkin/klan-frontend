<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue';

const id = 'klan-tooltip';
const bubble = ref<HTMLElement>();
const content = ref('');
let anchor: Element | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
let tapped: Element | null = null;
let observer: MutationObserver;
let sizes: ResizeObserver;

function trigger(node: EventTarget | null) {
  return node instanceof Element ? node.closest('[data-tooltip]') : null;
}

function hide() {
  clearTimeout(timer);
  observer.disconnect();
  sizes.disconnect();
  if (anchor) {
    const others = (anchor.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(value => value && value !== id);
    if (others.length) anchor.setAttribute('aria-describedby', others.join(' '));
    else anchor.removeAttribute('aria-describedby');
  }
  anchor = null;
  content.value = '';
}

function position() {
  const tip = bubble.value;
  if (!anchor || !tip) return;
  const bounds = anchor.getBoundingClientRect();
  const margin = 8, gap = 7;
  if (!anchor.isConnected || !bounds.width || bounds.bottom < 0 || bounds.top > innerHeight || bounds.right < 0 || bounds.left > innerWidth) return hide();
  const { width, height } = tip.getBoundingClientRect();
  const left = Math.max(margin, Math.min(bounds.left + (bounds.width - width) / 2, innerWidth - width - margin));
  const top = bounds.top >= height + gap + margin ? bounds.top - height - gap : bounds.bottom + gap;
  tip.style.left = left + 'px';
  tip.style.top = Math.max(margin, Math.min(top, innerHeight - height - margin)) + 'px';
}

async function show(target: Element) {
  clearTimeout(timer);
  const label = target.getAttribute('data-tooltip');
  if (!label || !target.isConnected) return hide();
  if (anchor !== target) {
    hide();
    anchor = target;
    const describedBy = target.getAttribute('aria-describedby');
    target.setAttribute('aria-describedby', [describedBy, id].filter(Boolean).join(' '));
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-tooltip'] });
    sizes.observe(target);
  }
  content.value = label;
  await nextTick();
  if (anchor !== target || !bubble.value) return;
  position();
  if (anchor) sizes.observe(bubble.value);
}

function schedule(target: Element | null, delay = 140) {
  clearTimeout(timer);
  if (target === anchor) return;
  timer = setTimeout(() => { if (target) void show(target); else hide(); }, delay);
}

function over(event: PointerEvent) {
  if (event.pointerType === 'touch') return;
  if (bubble.value?.contains(event.target as Node)) clearTimeout(timer);
  else schedule(trigger(event.target));
}
function out(event: PointerEvent) {
  if (event.pointerType === 'touch' || bubble.value?.contains(event.relatedTarget as Node)) return;
  const next = trigger(event.relatedTarget);
  schedule(next ?? trigger(document.activeElement));
}
function focus(event: FocusEvent) {
  if (!(tapped && event.target instanceof Element && event.target.contains(tapped))) schedule(trigger(event.target), 0);
}
function blur(event: FocusEvent) { schedule(trigger(event.relatedTarget), 0); }
function press(event: PointerEvent) {
  tapped = event.pointerType === 'touch' ? trigger(event.target) : null;
  if (tapped) void show(tapped);
  else hide();
}
function click(event: MouseEvent) {
  // On touch, a badge inside a profile link can be read without leaving the page.
  if (tapped?.matches('[data-tooltip-detail]') && tapped === trigger(event.target) && tapped.closest('a')) {
    event.preventDefault();
    event.stopPropagation();
  }
  tapped = null;
}
function key(event: KeyboardEvent) { if (event.key === 'Escape') hide(); }

onMounted(() => {
  observer = new MutationObserver(() => {
    if (!anchor) return;
    const label = anchor.getAttribute('data-tooltip');
    if (!anchor.isConnected || !label) hide();
    else { content.value = label; position(); }
  });
  sizes = new ResizeObserver(position);
  document.addEventListener('pointerover', over);
  document.addEventListener('pointerout', out);
  document.addEventListener('pointerdown', press);
  document.addEventListener('click', click, true);
  document.addEventListener('focusin', focus);
  document.addEventListener('focusout', blur);
  document.addEventListener('keydown', key);
  window.addEventListener('scroll', position, true);
  window.addEventListener('resize', position);
});
onBeforeUnmount(() => {
  hide();
  document.removeEventListener('pointerover', over);
  document.removeEventListener('pointerout', out);
  document.removeEventListener('pointerdown', press);
  document.removeEventListener('click', click, true);
  document.removeEventListener('focusin', focus);
  document.removeEventListener('focusout', blur);
  document.removeEventListener('keydown', key);
  window.removeEventListener('scroll', position, true);
  window.removeEventListener('resize', position);
});
</script>

<template>
  <Teleport to="body">
    <div v-if="content" :id="id" ref="bubble" role="tooltip" class="app-tooltip">{{ content }}</div>
  </Teleport>
</template>

<style scoped>
.app-tooltip{position:fixed;z-index:10000;box-sizing:border-box;width:max-content;max-width:min(22rem,calc(100vw - 16px));padding:.45rem .7rem;border:1px solid #52524a;border-radius:.5rem;background:#292b27;color:#f4f1ea;box-shadow:0 4px 18px #0006;font:500 .78rem/1.45 Manrope,'Segoe UI',sans-serif;overflow-wrap:anywhere}
@media(prefers-reduced-motion:no-preference){.app-tooltip{animation:tip-in 100ms ease-out}@keyframes tip-in{from{opacity:0}to{opacity:1}}}
</style>
