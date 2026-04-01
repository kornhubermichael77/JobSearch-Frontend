<script setup>
/**
 * SkeletonCard.vue - Platzhalter während Daten laden
 * 
 * Moderne UX: statt Spinner zeigen wir eine "Fake-Card"
 * die animiert wirkt (shimmer effect)
 * 
 * Props:
 * - count: wie viele Skeleton-Cards sollen angezeigt werden
 * - height: Höhe einer Card in px
 */

defineProps({
  count: {
    type: Number,
    default: 3,
  },
  height: {
    type: Number,
    default: 150,
  },
});
</script>

<template>
  <div class="skeleton-grid">
    <div
      v-for="i in count"
      :key="i"
      class="skeleton-card"
      :style="{ height: `${height}px` }"
    >
      <!-- Placeholders für Firmennamen, Text, etc. -->
      <div class="skeleton-row skeleton-title"></div>
      <div class="skeleton-row skeleton-text"></div>
      <div class="skeleton-row skeleton-text skeleton-short"></div>
    </div>
  </div>
</template>

<style scoped>
/**
 * CSS Grid für responsive Layout
 * Auf Mobile: 1 Spalte, auf Desktop: 2-3 Spalten
 */
.skeleton-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.5rem;
  margin: 1rem 0;
}

/**
 * Skeleton-Card Styling
 */
.skeleton-card {
  background: linear-gradient(
    90deg,
    #f0f0f0 25%,
    #e0e0e0 50%,
    #f0f0f0 75%
  );
  background-size: 200% 100%;
  animation: shimmer 2s infinite;
  border-radius: 8px;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

/**
 * Shimmer Animation - moderne Loading-Anzeige
 */
@keyframes shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

/**
 * Einzelne Zeilen (für Text-Effekt)
 */
.skeleton-row {
  height: 0.875rem;
  background: #e0e0e0;
  border-radius: 4px;
}

/* Erste Zeile (Titel) etwas dicker */
.skeleton-title {
  height: 1.2rem;
  width: 60%;
}

/* Text-Zeilen */
.skeleton-text {
  height: 0.75rem;
}

/* Manche Zeilen kürzer */
.skeleton-short {
  width: 40%;
}
</style>
