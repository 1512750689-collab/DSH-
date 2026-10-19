把你的开场动画放这个目录（任选其一即可，留 "auto" 配置会自动用它）：

  视频：mp4 / webm / mov / m4v
  图片：png / jpg / jpeg / webp / avif / gif / svg

建议：
- 1920x1080 左右，5 秒以内，体积 20MB 以内（每次打开应用都会读一次）
- 透明背景的动画（桌宠那种 webm）请把 config.jsonc 的 "veil" 改成 false、"fit" 改成 "contain"
- 目录里有多个文件时按文件名排序取第一个，想固定用哪个就在配置里写文件名
