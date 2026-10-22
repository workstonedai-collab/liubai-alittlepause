# 验证记录 · 1.0.0

2026-10-22 在隔离的 Chromium 用户环境中验证，截图及数据均为虚构示例。没有读取个人日记、照片或麦克风，也没有调用收费模型。

| 范围 | 已验证的路径 | 证据 |
| --- | --- | --- |
| 本机模型与服务 | 12 项测试：模式、数据保留、概览范围、合并幂等、账号隔离、版本冲突、来信及 AI 请求边界 | `npm test` |
| 网页 | 16 项路径：引导、切换模式、日记保存重开、分享图、照片手帐保存重开、草稿接续、主题与周笺、小册子、AI 发送预览、个人资料、完整备份、第二个浏览器恢复、关怀空间隔离、不同宽度布局 | [结果](validation/browser-results.json) |
| 浏览器扩展 | 6 项路径：MV3 加载、弹窗保存、完整页读取和重开、手帐装饰、PNG 下载 | [结果](validation/extension-results.json) |
| 自托管服务界面 | 7 项路径：账号登录、备份上传、第二个浏览器下载合并、AI 对话及回望确认、来信与维护者回复重开 | [结果](validation/service-ui-results.json) |
| 语音 | 4 项路径：录制、保存、重开、重新读取音频附件；使用 Chromium 生成的测试音频 | [结果](validation/voice-results.json) |

JavaScript 语法与相对引用检查、网页和扩展构建均通过。上述浏览器验收没有出现页面脚本错误；布局检查覆盖 320、390、768、1280 像素宽度。

## 怎样复现

Node.js 22 或更新版本：

```bash
npm test
npm run check
npm run build:all
```

浏览器验收需要额外安装 Playwright；这些包仅用于测试，不是应用的运行时依赖。

```bash
npm install --no-save --package-lock=false playwright@1.62.1
npx playwright install chromium
PORT=4190 npm start
```

保持预览运行，在另一终端执行：

```bash
LIUBAI_TEST_URL=http://127.0.0.1:4190 node tests/browser.cjs
node tests/extension-browser.cjs
node tests/service-browser.cjs
LIUBAI_TEST_URL=http://127.0.0.1:4190 node tests/voice-browser.cjs
```

截图与结果默认写入系统临时目录下的 `liubai-browser-acceptance`。服务测试自行启动隔离服务、临时账号及数据目录；结束后清理。扩展测试使用 Playwright Chromium 的完整浏览器通道。仓库也提供对应的 GitHub Actions 工作流。

## 证据边界

- AI 界面与服务测试使用明确标记的虚构模型传输，验证确认发送、登录、收发与显示，不代表已连接或实测某个真实模型。混元适配器需部署者自行配置；本轮未消耗模型额度。
- 同步为用户主动上传和下载合并，不是后台实时同步。测试覆盖文本、手帐附件和跨独立浏览器恢复，不能保证浏览器配额或磁盘故障时不存在部分导入。
- 扩展在 Chromium 的开发者加载模式下验证；尚未上架 Chrome/Edge 扩展商店。没有把此结果当作 Safari 扩展或微信真机验收。
- 网页、浏览器扩展、微信小程序具有不同的账号及存储环境；本仓库未包含微信登录或作者的小程序云环境。
- 界面截图见 [首页](assets/home-mobile.png)、[日记](assets/journal-desktop.png)、[手帐](assets/scrapbook-mobile.png)、[对话](assets/chat-mobile.png)、[扩展](assets/extension-desktop.png)。

## 发布后的复验

- [GitHub Actions 浏览器验收](https://github.com/workstonedai-collab/liubai-alittlepause/actions/runs/39719518075)已在独立 Linux 环境通过网页、真实加载扩展、服务界面和生成音频的四组脚本。
- [构建检查](https://github.com/workstonedai-collab/liubai-alittlepause/actions/runs/39719518000)与[Pages 部署](https://github.com/workstonedai-collab/liubai-alittlepause/actions/runs/39719518184)成功。
- 在公开网址 https://workstonedai-collab.github.io/liubai-alittlepause/ 再次运行全部 16 条网页路径，通过日记与照片手帐保存重开、分享图、备份跨独立浏览器恢复和布局检查。详见[线上结果](validation/pages-results.json)。验证数据为隔离浏览器内的虚构记录，没有上传日记到共享后台。
