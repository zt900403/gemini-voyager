# Gemini Voyager ChatGPT Fork 维护流程

本文档约定这份仓库后续按“上游同步 + 本地 ChatGPT 补丁栈”的方式维护。

## 当前基线

- 当前上游基线 tag：`v1.3.4`
- 当前上游版本号：`1.3.4`
- 本地长期分支：`chatgpt/main`
- 当前本地维护 tag：`chatgpt-v1.3.4.0`

## Remote 约定

- `upstream`：原仓库 `Nagi-ovo/gemini-voyager`
- `origin`：你自己的 GitHub fork

如果当前本地只有 `upstream`，先去 GitHub 创建 fork，再执行：

```bash
git remote add origin <your-fork-url>
git fetch origin
```

## 分支约定

- `main`：纯上游镜像，不做功能开发
- `chatgpt/main`：长期维护分支，承载所有 ChatGPT 能力
- `chatgpt/feature/<name>`：新功能分支
- `chatgpt/upgrade/vX.Y.Z`：升级上游版本时的临时分支

## 日常开发

新功能固定从 `chatgpt/main` 开始：

```bash
git switch chatgpt/main
git pull --ff-only origin chatgpt/main
git switch -c chatgpt/feature/<name>
```

完成后至少执行：

```bash
bun run typecheck
bun run test
bun run lint
bun run build:chrome
```

## 升级上游版本

当上游发布新版本，例如 `v1.3.4`：

```bash
git fetch upstream --tags
git switch main
git reset --hard upstream/main
git switch -c chatgpt/upgrade/v1.3.4 upstream/main
git rebase --onto chatgpt/upgrade/v1.3.4 <old-upstream-base> chatgpt/main
```

推荐冲突处理顺序：

1. `provider`、类型、provider-scoped storage
2. `export`、`context sync`、`title updater`
3. `timeline`、`folders`、`chat width`
4. `prompt manager` 与样式
5. 文档和测试

验证通过后更新长期分支：

```bash
git switch chatgpt/main
git merge --ff-only chatgpt/upgrade/v1.3.4
git tag chatgpt-v1.3.4.0
git push origin chatgpt/main --tags
```

## 最短命令清单

下面这组命令是按你当前仓库状态整理的最短路径；上面的“升级上游版本”仍然保留为更通用、可重放的保守流程。

以后如果要从当前基线升级到 `v1.3.5`，默认直接执行下面这组命令即可：

```bash
git fetch upstream --tags
git switch chatgpt/main
git pull --ff-only origin chatgpt/main
git switch -c chatgpt/upgrade/v1.3.5
git merge v1.3.5
bun run typecheck
bun run test
bun run lint
bun run build:chrome
git switch chatgpt/main
git merge --ff-only chatgpt/upgrade/v1.3.5
git tag -a chatgpt-v1.3.5.0 -m "ChatGPT fork baseline on upstream v1.3.5"
git push -u origin chatgpt/main
git push origin chatgpt-v1.3.5.0
```

说明：

- 如果 `git merge v1.3.5` 没冲突，这就是最短路径。
- 如果有冲突，只在 `chatgpt/upgrade/v1.3.5` 上解决，不要直接在 `chatgpt/main` 上修。
- 冲突优先处理顺序仍然是：`provider/types/storage` -> `export/context sync/title updater` -> `timeline/folders/chat width` -> `prompt/theme` -> `docs/tests`。
- 如果升级失败，直接丢弃临时分支即可：

```bash
git switch chatgpt/main
git branch -D chatgpt/upgrade/v1.3.5
```

## 提交纪律

- 共享抽象与 ChatGPT 适配不要混在一个提交里
- 优先把 ChatGPT 专属 DOM 逻辑放在 provider adapter、`chatgpt.ts`、provider-scoped storage helper
- 新测试尽量跟对应实现同一批提交
- 不要在 `main` 上直接堆未提交改动
