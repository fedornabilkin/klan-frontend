<script setup lang="ts">
withDefaults(defineProps<{ step?: number | 'any' }>(), { step: 1 });
const model = defineModel<number | null | undefined>();
function onInput(event: Event) {
  const value = (event.target as HTMLInputElement).valueAsNumber;
  model.value = Number.isFinite(value) ? value : null;
}
</script>

<template>
  <input class="number-field" type="number" :inputmode="step === 1 ? 'numeric' : 'decimal'"
    :step="step" :value="model ?? ''" @input="onInput" />
</template>

<style scoped>
.number-field{display:block;min-width:0;width:100%;padding:.6rem .75rem;border:1px solid var(--border);border-radius:.4rem;color:var(--text);background:var(--surface-raised);font:inherit;font-variant-numeric:tabular-nums}
.number-field:focus-visible{outline:2px solid var(--accent);outline-offset:1px}
</style>
