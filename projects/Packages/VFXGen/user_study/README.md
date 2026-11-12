# User Study 20

可直接部署的静态研究问卷。包含 20 个固定 case、每题 3 个指标、4 个匿名候选视频。
支持中英文切换、拖动教学、拖拽与点击选择、手机布局、浏览器进度保存和完成后自动提交。

## 文件

```text
user_study/
  index.html          网页入口
  app.js              答题、教学与提交逻辑
  data.js             20 题的提示和相对素材路径
  i18n.js             中英文界面文字
  config.js           Google Apps Script 接收地址
  style.css           基础样式
  compact-study.css   紧凑答题布局与手机适配
  tutorial.css        拖动教学动画
  media/              20 张参考图和 80 个视频
  README.md           本说明
```

## 项目页入口与发布

本目录已放入主页仓库的 `projects/Packages/VFXGen/user_study/`。
`projects/VFXGen.html` 的 **User Study** 按钮使用相对链接 `Packages/VFXGen/user_study/index.html` 打开问卷。

随主页仓库一起发布以下文件：

- `projects/VFXGen.html`
- `projects/Packages/VFXGen/user_study/` 下的全部文件，包括 `media/`。

网页入口是 `/projects/VFXGen.html`，问卷入口是 `/projects/Packages/VFXGen/user_study/index.html`（前面可带站点部署的子路径）。
脚本、样式、图片和视频均使用相对路径，无需 npm 构建、Python 后端或本地电脑持续运行。
所有界面和媒体都包含在本目录中；在线提交仍需要访问 Google Apps Script。

后续页面修改直接在本目录进行。发布后检查语言切换、教学页和视频加载；如提交测试答卷，在 Google 表格核对记录，并将测试记录排除在研究统计之外。

## Google 接收接口

`config.js` 已保留当前 `/exec` 地址。接收端必须是 `vfx-study-20-v2`，健康检查的 `case_count` 应为 20。
答卷写入 `VFX_Responses_20_v2`。如果 Google 端已经部署该版本，这次打包不需要重新部署。
如果以后新建了另一个 Google 部署，只需替换 `config.js` 中的 `appsScriptUrl`。
如果接收端未更新或网络中断，页面会保留答案，允许重试或导出 JSON。

## 本地预览

在 `homepage` 仓库根目录运行：

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

项目页：`http://127.0.0.1:8000/projects/VFXGen.html`。
问卷：`http://127.0.0.1:8000/projects/Packages/VFXGen/user_study/index.html`。
此命令仅用于本地预览；正式发布后不需要运行。

双击 HTML 可查看界面，但完整的资源加载和提交检查请通过 HTTP/HTTPS 地址完成。
浏览器进度按网站来源保存，本地预览中的进度不会自动迁移到线上域名。

## 固定题库

版本：`vfx-study-20-v2`。题库按以下原始编号升序排列：

```text
001, 002, 007, 008, 014, 018, 028, 041, 054, 059, 073, 075, 118, 125, 137, 139, 143, 156, 170, 200
```

每题独立评价整体效果、图片一致性和文字一致性，共 60 项选择。候选位置随机安排，每种方法在 A–D 每个位置各出现 5 次。
本发布目录不包含答卷数据、方法对照表、本地结果页面或 Google 服务端源码。
