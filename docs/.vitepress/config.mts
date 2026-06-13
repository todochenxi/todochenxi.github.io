import { defineConfig } from 'vitepress'

export default defineConfig({
  title: "My Notes",
  description: "个人笔记站",
  lang: 'zh-CN',
  base: '/',

  themeConfig: {
    nav: [
      { text: '首页', link: '/' },
      { text: '笔记', link: '/notes/' },
    ],

    sidebar: {
      '/notes/': [
        {
          text: '笔记',
          items: [
            { text: '所有笔记', link: '/notes/' },
          ],
        },
      ],
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com' },
    ],

    search: {
      provider: 'local',
    },

    outline: 'deep',
    docFooter: {
      prev: '上一篇',
      next: '下一篇',
    },
  },
})
