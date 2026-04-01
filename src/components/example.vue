<script setup>
import { ref, onMounted } from "vue";
import { getProducts } from "../services/api";

const products = ref([]);

onMounted(async () => {
  products.value = await getProducts();
});
</script>



<template>
  <h1>Product List</h1>
<ul>
  <li v-for="p in products" :key="p.id">
    {{ p.name }} - {{ p.price }}
  </li>
</ul>
</template>


<style scoped>
/* Styles hier */
</style>