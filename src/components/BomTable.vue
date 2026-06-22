<script setup lang="ts">
/**
 * Sortable, browsable bill-of-materials table for a project folio.
 * Click any column header to sort; click again to flip direction.
 */
import { ref, computed } from "vue";

interface BomItem {
    part: string;
    qty: number;
    ref?: string;
    buyUrl?: string;
    buyLabel?: string;
}

const props = defineProps<{ items: BomItem[] }>();

type SortKey = "part" | "qty" | "ref";
const sortKey = ref<SortKey>("part");
const sortDir = ref<1 | -1>(1);
const query = ref("");

function setSort(key: SortKey) {
    if (sortKey.value === key) sortDir.value = (sortDir.value * -1) as 1 | -1;
    else {
        sortKey.value = key;
        sortDir.value = 1;
    }
}

const rows = computed(() => {
    const q = query.value.trim().toLowerCase();
    const filtered = q
        ? props.items.filter(
              (i) =>
                  i.part.toLowerCase().includes(q) ||
                  (i.ref || "").toLowerCase().includes(q),
          )
        : [...props.items];
    return filtered.sort((a, b) => {
        let av: string | number;
        let bv: string | number;
        if (sortKey.value === "qty") {
            av = a.qty;
            bv = b.qty;
        } else {
            av = (a[sortKey.value] || "").toString().toLowerCase();
            bv = (b[sortKey.value] || "").toString().toLowerCase();
        }
        if (av < bv) return -1 * sortDir.value;
        if (av > bv) return 1 * sortDir.value;
        return 0;
    });
});

const totalParts = computed(() =>
    props.items.reduce((sum, i) => sum + (i.qty || 0), 0),
);

function caret(key: SortKey) {
    if (sortKey.value !== key)
        return "ph-bold ph-arrows-down-up bom-caret-idle";
    return sortDir.value === 1
        ? "ph-bold ph-caret-up"
        : "ph-bold ph-caret-down";
}
</script>

<template>
    <div>
        <div class="bom-toolbar">
            <div class="bom-search">
                <i class="ph-bold ph-magnifying-glass"></i>
                <input
                    v-model="query"
                    type="text"
                    placeholder="Filter items..."
                />
            </div>
            <div class="bom-total">
                <strong>{{ items.length }}</strong> items ·
                <strong>{{ totalParts }}</strong> total
            </div>
        </div>

        <div class="bom-table-wrap">
            <table class="bom-table">
                <thead>
                    <tr>
                        <th class="bom-th" @click="setSort('part')">
                            <span>Item</span><i :class="caret('part')"></i>
                        </th>
                        <th class="bom-th bom-th--qty" @click="setSort('qty')">
                            <span>Qty</span><i :class="caret('qty')"></i>
                        </th>
                        <th class="bom-th bom-th--ref" @click="setSort('ref')">
                            <span>Ref</span><i :class="caret('ref')"></i>
                        </th>
                        <th class="bom-th bom-th--buy">Source</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="(item, i) in rows" :key="item.part + i">
                        <td class="bom-td-part">{{ item.part }}</td>
                        <td class="bom-td-qty">{{ item.qty }}&times;</td>
                        <td class="bom-td-ref">{{ item.ref || "-" }}</td>
                        <td class="bom-td-buy">
                            <a
                                v-if="item.buyUrl"
                                :href="item.buyUrl"
                                target="_blank"
                                rel="noopener"
                                class="bom-buy"
                            >
                                <i class="ph-bold ph-arrow-up-right"></i
                                >{{ item.buyLabel || "Buy" }}
                            </a>
                            <span v-else class="bom-buy-none">-</span>
                        </td>
                    </tr>
                    <tr v-if="rows.length === 0">
                        <td colspan="4" class="bom-empty">
                            No parts match "{{ query }}"
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
</template>

<style scoped>
.bom-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 0.75rem;
    flex-wrap: wrap;
}
.bom-search {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex: 1 1 180px;
    max-width: 280px;
    border: 1.5px solid rgba(26, 26, 26, 0.12);
    border-radius: 0.5rem;
    padding: 0.4rem 0.7rem;
    background: rgba(250, 243, 232, 0.6);
    transition: border-color 0.15s;
}
.bom-search:focus-within {
    border-color: #d94800;
}
.bom-search i {
    color: #6b5b4a;
    font-size: 0.85rem;
}
.bom-search input {
    border: none;
    outline: none;
    background: transparent;
    font-size: 0.85rem;
    color: #1a1a1a;
    width: 100%;
}
.bom-total {
    font-size: 0.78rem;
    color: #6b5b4a;
}
.bom-total strong {
    color: #1a1a1a;
    font-weight: 700;
}

.bom-table-wrap {
    overflow-x: auto;
    border: 1px solid rgba(26, 26, 26, 0.08);
    border-radius: 0.625rem;
}
.bom-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.85rem;
}
.bom-th {
    text-align: left;
    padding: 0.6rem 0.75rem;
    font-size: 0.66rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #4a3d2f;
    background: #ece0cc;
    cursor: pointer;
    user-select: none;
    white-space: nowrap;
    transition: color 0.15s;
}
.bom-th:hover {
    color: #d94800;
}
.bom-th span {
    margin-right: 0.3rem;
}
.bom-th i {
    font-size: 0.7rem;
}
.bom-caret-idle {
    opacity: 0.35;
}
.bom-th--qty {
    width: 1%;
}
.bom-table tbody td {
    padding: 0.55rem 0.75rem;
    border-top: 1px solid rgba(26, 26, 26, 0.06);
    color: #1a1a1a;
    vertical-align: middle;
}
.bom-table tbody tr:nth-child(even) {
    background: rgba(26, 26, 26, 0.02);
}
.bom-table tbody tr:hover {
    background: rgba(217, 72, 0, 0.04);
}
.bom-td-part {
    font-weight: 600;
}
.bom-td-qty {
    font-family: "Fraunces", serif;
    font-weight: 700;
    color: #ff5900;
    white-space: nowrap;
}
.bom-td-ref {
    font-family: ui-monospace, "SF Mono", Menlo, monospace;
    font-size: 0.75rem;
    color: #6b5b4a;
    white-space: nowrap;
}
.bom-buy {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.72rem;
    font-weight: 700;
    color: #6b5b4a;
    background: rgba(26, 26, 26, 0.05);
    border-radius: 999px;
    padding: 0.2rem 0.6rem;
    text-decoration: none;
    white-space: nowrap;
    transition:
        color 0.15s,
        background 0.15s;
}
.bom-buy:hover {
    color: #ff5900;
    background: rgba(255, 89, 0, 0.08);
}
.bom-buy i {
    font-size: 0.62rem;
}
.bom-buy-none {
    color: #b8a589;
}
.bom-empty {
    text-align: center;
    color: #6b5b4a;
    padding: 1.5rem !important;
    font-size: 0.82rem;
}
</style>
