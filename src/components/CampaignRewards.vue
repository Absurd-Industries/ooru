<script setup lang="ts">
/**
 * Reward tiers + real backing flow. Backing reserves 25% now; the
 * balance is charged when the project ships, and you can cancel any
 * time before shipment for a full refund. Pledges persist in the local
 * store (src/lib/store.ts) as the current mock profile.
 */
import { ref, computed, onMounted, onUnmounted } from "vue";
import {
  getPledge,
  createPledge,
  cancelPledge,
  onChange,
} from "../lib/store";
import type { Pledge } from "../lib/store";

interface Tier {
  name: string;
  price: string;
  blurb: string;
  perks: string[];
  delivery: string;
  ships: string;
  backers: number;
  claimed: number;
  total: number | null;
}

const props = defineProps<{
  tiers: Tier[];
  campaignSlug: string;
}>();

const priceNum = (s: string) => parseInt(String(s).replace(/[^\d]/g, ""), 10) || 0;
const inr = (n: number) => "₹" + n.toLocaleString("en-IN");

const tick = ref(0);
let unsub: () => void = () => {};
onMounted(() => {
  unsub = onChange(() => tick.value++);
});
onUnmounted(() => unsub());

const myPledge = computed<Pledge | null>(() => {
  tick.value;
  return getPledge(props.campaignSlug);
});

function reserve(tier: Tier) {
  createPledge({
    campaignSlug: props.campaignSlug,
    tierName: tier.name,
    amountInr: priceNum(tier.price),
  });
}
function cancel() {
  if (myPledge.value) cancelPledge(myPledge.value.id);
}

function isMine(tier: Tier) {
  return myPledge.value?.tier_name === tier.name;
}
</script>

<template>
  <div id="sec-rewards" class="cr-root">
    <h2 class="font-serif font-bold text-base mb-1">Select a reward</h2>
    <p class="text-xs text-ink-faint mb-3">Reserve for 25% now, pay the rest when it ships.</p>

    <!-- Active pledge banner -->
    <Transition name="cr-fade">
      <div v-if="myPledge" class="cr-pledged">
        <div class="flex items-start gap-2">
          <i class="ph-fill ph-check-circle cr-pledged-icon"></i>
          <div class="min-w-0 flex-1">
            <div class="text-sm font-semibold">You reserved the {{ myPledge.tier_name }}</div>
            <div class="text-xs text-ink-light mt-0.5 leading-relaxed">
              <strong>{{ inr(myPledge.deposit_inr) }}</strong> deposit taken now ·
              <strong>{{ inr(myPledge.balance_inr) }}</strong> charged when it ships.
            </div>
            <button class="cr-cancel" @click="cancel">
              <i class="ph-bold ph-x-circle"></i> Cancel pledge &amp; refund deposit
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <div class="space-y-3">
      <div
        v-for="tier in tiers"
        :key="tier.name"
        class="reward-card"
        :class="{ 'reward-card--soldout': tier.total != null && tier.claimed >= tier.total, 'reward-card--mine': isMine(tier) }"
      >
        <div class="reward-card-head">
          <span class="reward-price">{{ tier.price }}</span>
          <span
            v-if="tier.total != null"
            class="reward-left"
            :class="{ 'reward-left--out': tier.claimed >= tier.total }"
          >
            {{ tier.claimed >= tier.total ? "Sold out" : `${tier.total - tier.claimed} of ${tier.total} left` }}
          </span>
        </div>
        <h3 class="reward-name">{{ tier.name }}</h3>
        <p class="reward-blurb">{{ tier.blurb }}</p>

        <div class="reward-includes">
          <span class="reward-includes-label">Includes</span>
          <ul>
            <li v-for="perk in tier.perks" :key="perk"><i class="ph-bold ph-check"></i><span>{{ perk }}</span></li>
          </ul>
        </div>

        <div class="reward-meta">
          <span><i class="ph-bold ph-calendar-blank"></i> {{ tier.delivery }}</span>
          <span><i class="ph-bold ph-truck"></i> {{ tier.ships }}</span>
          <span><i class="ph-bold ph-users-three"></i> {{ tier.backers }}</span>
        </div>

        <template v-if="!(tier.total != null && tier.claimed >= tier.total)">
          <div class="reward-deposit">
            Reserve <strong>{{ inr(Math.round(priceNum(tier.price) * 0.25)) }}</strong> now ·
            {{ inr(priceNum(tier.price) - Math.round(priceNum(tier.price) * 0.25)) }} on ship
          </div>
          <button v-if="isMine(tier)" class="btn btn-outline btn-sm w-full mt-2 cr-reserved" @click="cancel">
            <i class="ph-bold ph-check mr-1"></i>Reserved · tap to cancel
          </button>
          <button v-else class="btn btn-stamp btn-sm w-full mt-2" @click="reserve(tier)">
            Reserve for {{ inr(Math.round(priceNum(tier.price) * 0.25)) }}
          </button>
        </template>
        <div v-else class="btn btn-outline btn-sm w-full mt-3" style="opacity:0.5; cursor:not-allowed;">Sold out</div>
      </div>
    </div>

    <p class="cr-foot">
      <i class="ph-bold ph-shield-check"></i>
      All-or-nothing. Cancel any time before shipment for a full refund.
    </p>
  </div>
</template>

<style scoped>
.cr-root { margin-bottom: 1.25rem; }

.cr-pledged {
  border: 1.5px solid rgba(42, 95, 65, 0.4);
  background: rgba(42, 95, 65, 0.07);
  border-radius: 0.75rem;
  padding: 0.85rem 0.9rem;
  margin-bottom: 0.85rem;
}
.cr-pledged-icon { color: #2a5f41; font-size: 1.1rem; flex-shrink: 0; margin-top: 0.05rem; }
.cr-cancel {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  margin-top: 0.5rem;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  font-size: 0.7rem;
  font-weight: 600;
  color: #6b5b4a;
  transition: color 0.15s;
}
.cr-cancel:hover { color: #d94800; }

.reward-card {
  border: 1.5px solid rgba(26, 26, 26, 0.1);
  border-radius: 0.75rem;
  padding: 1rem 1.1rem;
  background: rgba(250, 243, 232, 0.4);
  transition: border-color 0.15s;
}
.reward-card:hover { border-color: rgba(26, 26, 26, 0.28); }
.reward-card--soldout { opacity: 0.6; }
.reward-card--mine { border-color: #2a5f41; background: rgba(42, 95, 65, 0.05); }
.reward-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.35rem;
}
.reward-price {
  font-family: 'Fraunces', serif;
  font-weight: 800;
  font-size: 1.25rem;
  color: #1a1a1a;
}
.reward-left {
  font-size: 0.62rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: #b74803;
  background: rgba(217, 72, 0, 0.08);
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  white-space: nowrap;
}
.reward-left--out { color: #6b5b4a; background: rgba(26, 26, 26, 0.06); }
.reward-name {
  font-family: 'Fraunces', serif;
  font-weight: 700;
  font-size: 1rem;
  color: #1a1a1a;
  margin-bottom: 0.2rem;
}
.reward-blurb {
  font-size: 0.8rem;
  color: #6b5b4a;
  line-height: 1.5;
  margin-bottom: 0.75rem;
}
.reward-includes-label {
  display: block;
  font-size: 0.58rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #6b5b4a;
  margin-bottom: 0.35rem;
}
.reward-includes ul {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  margin-bottom: 0.75rem;
}
.reward-includes li {
  display: flex;
  align-items: flex-start;
  gap: 0.45rem;
  font-size: 0.82rem;
  color: #1a1a1a;
  line-height: 1.4;
}
.reward-includes li i { color: #2a5f41; font-size: 0.75rem; margin-top: 0.18rem; flex-shrink: 0; }
.reward-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 0.9rem;
  padding: 0.65rem 0;
  border-top: 1px solid rgba(26, 26, 26, 0.06);
  font-size: 0.7rem;
  color: #6b5b4a;
}
.reward-deposit {
  font-size: 0.72rem;
  color: #4a3d2f;
  background: rgba(26, 26, 26, 0.04);
  border-radius: 0.4rem;
  padding: 0.4rem 0.55rem;
  line-height: 1.4;
}
.reward-deposit strong { color: #1a1a1a; }
.cr-reserved { color: #2a5f41 !important; border-color: rgba(42, 95, 65, 0.4) !important; }

.cr-foot {
  display: flex;
  align-items: flex-start;
  gap: 0.4rem;
  font-size: 0.68rem;
  color: #6b5b4a;
  line-height: 1.4;
  margin-top: 0.85rem;
}
.cr-foot i { color: #2a5f41; margin-top: 0.05rem; flex-shrink: 0; }

.cr-fade-enter-active, .cr-fade-leave-active { transition: opacity 0.2s ease; }
.cr-fade-enter-from, .cr-fade-leave-to { opacity: 0; }
</style>
