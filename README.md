# My Notes

基于 VitePress 的个人笔记网站。

## 项目结构

```
github/
├── .github/workflows/deploy.yml   # 自动部署到 GitHub Pages
├── docs/
│   ├── .vitepress/config.mts      # VitePress 配置
│   ├── index.md                   # 首页（hero 样式）
│   └── notes/
│       └── index.md               # 笔记入口
├── package.json
└── .gitignore
```

## 常用命令

| 命令 | 作用 |
|------|------|
| `npm run docs:dev` | 启动本地开发服务器 (localhost:5173) |
| `npm run docs:build` | 构建静态站点 |
| `npm run docs:preview` | 预览构建结果 |

## 下一步

1. **写笔记** — 在 `docs/notes/` 下创建 `.md` 文件即可，VitePress 侧边栏会自动收录
2. **推送到 GitHub** — 创建仓库后 push 上去
3. **配置 Pages** — 在 GitHub 仓库 Settings → Pages → Source 选 **GitHub Actions**
4. **自动部署** — 以后每次 push 到 main 分支会自动构建发布
