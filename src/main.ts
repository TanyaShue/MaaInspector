import { createApp } from "vue";
import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';
import './assets/styles/tailwind.css' // <--- 重点是这行
import App from "./App.vue";

const app = createApp(App);

app.use(ElementPlus);
app.mount("#app");