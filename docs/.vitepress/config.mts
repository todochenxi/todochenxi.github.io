import { readdirSync, readFileSync, statSync } from 'fs'
import { basename, dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { defineConfig } from 'vitepress'
import { withMermaid } from 'vitepress-plugin-mermaid'
import katex from 'katex'
import texmath from 'markdown-it-texmath'

const __dirname = dirname(fileURLToPath(import.meta.url))

interface RecentItem {
  title: string
  link: string
  date: string
}

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function scanNotes() {
  const notesDir = join(__dirname, '..', 'notes')
  const dirs: { name: string; path: string }[] = []
  const files: { title: string; link: string; mtime: number }[] = []

  for (const d of readdirSync(notesDir, { withFileTypes: true })) {
    if (!d.isDirectory()) continue
    const dirPath = join(notesDir, d.name)
    dirs.push({ name: d.name, path: dirPath })

    for (const f of readdirSync(dirPath)) {
      if (!f.endsWith('.md')) continue
      const filePath = join(dirPath, f)
      const content = readFileSync(filePath, 'utf-8')
      const match = content.match(/^#\s+(.+)/m)
      const title = match ? match[1] : basename(f, '.md')
      const link = `/notes/${d.name}/${basename(f, '.md')}`
      const mtime = statSync(filePath).mtimeMs
      files.push({ title, link, mtime })
    }
  }

  const recent: RecentItem[] = files
    .sort((a, b) => b.mtime - a.mtime)
    .slice(0, 5)
    .map(f => ({ title: f.title, link: f.link, date: formatDate(f.mtime) }))

  const features = dirs.map(d => ({
    title: d.name,
    details: `${d.name} 相关笔记`,
    link: `/notes/${d.name}/`,
  }))

  return { features, recent }
}

function generateSidebar() {
  const notesDir = join(__dirname, '..', 'notes')
  const dirs = readdirSync(notesDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .sort()

  return dirs.map(dir => {
    const dirPath = join(notesDir, dir.name)
    const files = readdirSync(dirPath)
      .filter(f => f.endsWith('.md') && f !== 'index.md')
      .sort()
      .map(f => {
        const content = readFileSync(join(dirPath, f), 'utf-8')
        const match = content.match(/^#\s+(.+)/m)
        const title = match ? match[1] : basename(f, '.md')
        return { text: title, link: `/notes/${dir.name}/${basename(f, '.md')}` }
      })

    const group: any = {
      text: dir.name,
      link: `/notes/${dir.name}/`,
    }
    if (files.length) {
      group.collapsed = false
      group.items = files
    }
    return group
  })
}

export default withMermaid(
  defineConfig({
    mermaid: {
      theme: 'default',
    },
    markdown: {
      lineNumbers: true,
      config: (md) => {
        md.use(texmath, { engine: katex })
      },
    },
    title: "My Notes",
    description: "个人笔记站",
    lang: 'zh-CN',
    base: '/',
    cleanUrls: true,
    lastUpdated: {},
    head: [
      ['link', { rel: 'stylesheet', href: '/custom.css' }],
      ['link', { rel: 'stylesheet', href: '/katex.min.css' }],
    ],

    transformPageData(pageData, { siteConfig }) {
      const filePath = join(siteConfig.srcDir, pageData.filePath)
      const result: any = {}
      try {
        result.lastUpdated = statSync(filePath).mtimeMs
      } catch {}

      if (pageData.relativePath === 'index.md') {
        const { features, recent } = scanNotes()
        result.frontmatter = {
          ...pageData.frontmatter,
          features,
          recent,
        }
      }

      return result
    },

  themeConfig: {
    nav: [
      { text: '首页', link: '/' },
      { text: '笔记', link: '/notes/' },
    ],

    sidebar: {
      '/notes/': generateSidebar(),
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/todochenxi' },
    ],

    search: {
      provider: 'local',
      options: {
        miniSearch: {
          options: {
            tokenize(text: string) {
              return text
                .split(/([一-鿿㐀-䶿])/g)
                .filter(s => s.trim())
                .flatMap(s =>
                  /[一-鿿㐀-䶿]/.test(s)
                    ? [s]
                    : s.split(/\s+/).filter(Boolean),
                );
            },
          },
        },
      },
    },

    outline: 'deep',
    docFooter: {
      prev: '上一篇',
      next: '下一篇',
    },

    lastUpdated: {
      text: '最后更新',
      formatOptions: {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        forceLocale: true,
      },
    },
  },
}),
)
