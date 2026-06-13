# My Notes

基于 VitePress 的个人笔记网站。

## 项目结构

```
github/
├── .github/workflows/deploy.yml   # 自动部署到 GitHub Pages
├── docs/
│   ├── .vitepress/config.mts      # VitePress 配置
│   ├── index.md                   # 首页（hero 样式）
│   └── notes/                     # 笔记目录，.md 文件放这里
├── package.json
└── .gitignore
```

## 常用命令

| 命令 | 作用 |
|------|------|
| `npm run docs:dev` | 启动本地开发服务器 (localhost:5173) |
| `npm run docs:build` | 构建静态站点 |
| `npm run docs:preview` | 预览构建结果 |

## 完整流程

### 1. 写笔记

在 `docs/notes/` 下新建 `.md` 文件，例如 `docs/notes/react-hooks.md`。

### 2. 注册到侧边栏

编辑 `docs/.vitepress/config.mts`，在 `sidebar` 的 `items` 里加一行：

```ts
{ text: '笔记标题', link: '/notes/文件名' }
```

### 3. 本地预览

```bash
npm run docs:dev
```

浏览器打开 `http://localhost:5173/`，边写边看效果。

### 4. 发布上线

```bash
git add .
git commit -m "添加 xxx 笔记"
git push
```

push 之后 GitHub Actions 自动部署，等一两分钟站点 `https://todochenxi.github.io/` 即更新。
