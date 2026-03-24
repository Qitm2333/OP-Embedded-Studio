<script setup lang="ts">
interface Row {
  name: string
  type?: string
  description: string
  required?: boolean
  default?: string
}

defineProps<{
  rows: Row[]
}>()
</script>

<template>
  <div class="sdk-table-wrap">
    <table class="sdk-table">
      <thead>
        <tr>
          <th>Prop</th>
          <th>Default</th>
          <th>Type</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.name">
          <td>
            <code class="sdk-table__code">{{ row.name }}<span v-if="row.required">*</span></code>
            <div class="sdk-table__description">{{ row.description }}</div>
          </td>
          <td>
            <code v-if="row.default" class="sdk-table__chip">{{ row.default }}</code>
            <span v-else>—</span>
          </td>
          <td>
            <code v-if="row.type" class="sdk-table__chip">{{ row.type }}</code>
            <span v-else>—</span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.sdk-table-wrap {
  overflow-x: auto;
}

.sdk-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  font-size: 14px;
}

.sdk-table th,
.sdk-table td {
  padding: 16px;
  vertical-align: top;
  border: 1px solid var(--vp-c-divider);
}

.sdk-table thead th {
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-2);
  font-weight: 600;
  text-align: left;
}

.sdk-table thead th:first-child {
  border-top-left-radius: 14px;
}

.sdk-table thead th:last-child {
  border-top-right-radius: 14px;
}

.sdk-table__code {
  color: var(--vp-c-brand-1);
}

.sdk-table__chip {
  display: inline-block;
  padding: 4px 10px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 10px;
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
  white-space: nowrap;
}

.sdk-table__description {
  margin-top: 8px;
  color: var(--vp-c-text-2);
  line-height: 1.6;
}
</style>
