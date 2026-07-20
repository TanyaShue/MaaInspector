/// <reference types="vite/client" />

declare const __APP_VERSION__: string

declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent;
  export default component;
}

// 声明 .md 文件的 raw 导入
declare module "*.md?raw" {
  const content: string;
  export default content;
}
