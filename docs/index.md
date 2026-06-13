---
layout: home

hero:
  name: "My Notes"
  text: "个人笔记站"
  tagline: 记录学习与思考
  actions:
    - theme: brand
      text: 开始阅读
      link: /notes/
    - theme: alt
      text: GitHub
      link: https://github.com/todochenxi
---

## 最近更新

<ul>
  <li v-for="item in $frontmatter.recent" :key="item.link">
    {{ item.date }} — <a :href="item.link">{{ item.title }}</a>
  </li>
</ul>
