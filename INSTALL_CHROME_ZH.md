# Gemini Voyager 本地安装指南

本文档对应当前仓库的 Chrome 构建产物，适用于 `Chrome`、`Edge`、`Brave`、`Opera`、`Vivaldi` 等 Chromium 浏览器。

## 构建结果

- 已编译目录：`/Users/zhangtao/Desktop/Projects/chrome/gemini-voyager/dist_chrome`
- 已打包文件：`/Users/zhangtao/Desktop/Projects/chrome/gemini-voyager/dist_chrome/gemini-voyager-chatgpt-chrome.zip`

> 说明：本次构建包含 Gemini 与 ChatGPT (`https://chatgpt.com/`) 支持。

## 安装方式一：加载已解压扩展（推荐）

这是本地开发和测试最稳定的方式。

1. 打开浏览器扩展管理页：
   - Chrome / Brave / Vivaldi / Opera：`chrome://extensions`
   - Edge：`edge://extensions`
2. 打开右上角的“开发者模式”。
3. 点击“加载已解压的扩展程序”。
4. 选择目录：

```text
/Users/zhangtao/Desktop/Projects/chrome/gemini-voyager/dist_chrome
```

5. 安装完成后，把插件固定到工具栏。
6. 打开或刷新以下页面验证功能：
   - `https://gemini.google.com/`
   - `https://chatgpt.com/`

## 安装方式二：先解压 zip 再安装

如果你想把构建结果发给别人测试，可以使用 zip 包。

1. 解压文件：

```text
/Users/zhangtao/Desktop/Projects/chrome/gemini-voyager/dist_chrome/gemini-voyager-chatgpt-chrome.zip
```

2. 打开扩展管理页并开启“开发者模式”。
3. 点击“加载已解压的扩展程序”。
4. 选择解压后的文件夹。

> Chrome 系浏览器本地安装通常仍然要求“解压后加载”，不能直接双击 zip 安装。

## 更新构建后的重新安装方法

如果你后续重新执行了：

```bash
bun run build:chrome
```

不需要删除扩展，按下面步骤刷新即可：

1. 打开扩展管理页。
2. 找到 Gemini Voyager。
3. 点击“重新加载”。
4. 回到 `chatgpt.com` 或 `gemini.google.com` 页面刷新标签页。

## 常见问题

### 1. 安装后页面没有按钮或侧栏

先做这几步：

1. 确认扩展已经启用。
2. 刷新目标页面。
3. 如果页面原本就开着，关闭后重新打开。
4. 在扩展管理页点击一次“重新加载”。

### 2. ChatGPT 页面没有生效

请确认访问的是：

```text
https://chatgpt.com/
```

当前构建首期只正式支持 `chatgpt.com`，不包含其他历史 OpenAI 域名。

### 3. 更新代码后功能异常

建议按顺序执行：

```bash
bun run build:chrome
```

然后在扩展管理页点击“重新加载”，最后刷新网页。

## 给测试同事的最短说明

把 `dist_chrome` 发给对方，然后让对方：

1. 打开 `chrome://extensions`
2. 开启开发者模式
3. 点击“加载已解压的扩展程序”
4. 选择 `dist_chrome`
5. 打开 `https://chatgpt.com/` 或 `https://gemini.google.com/`

