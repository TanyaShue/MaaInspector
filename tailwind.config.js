/** @type {import('tailwindcss').Config} */
export default {
  // 确保这里包含了你的 index.html 和 src 下的所有 vue/js 文件
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [
      require("tailwindcss-animate"), // <--- 添加这一行
  ],
}