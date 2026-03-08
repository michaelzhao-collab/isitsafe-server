# 请用 Xcode 打开本目录下的 IsItSafe1.xcodeproj

- 工程和源码现在都在 **iOS/IsItSafe/** 下，少一层目录。
- 若打开后左侧没有文件或编译报错「找不到同步根」：在 Xcode 中把工程里同步根（IsItSafe1）的 path 改回一个子文件夹名（例如新建 `Source`，把 App、Views 等移入），再在 project 里把 path 设为 `Source`。
