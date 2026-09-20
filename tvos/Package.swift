// swift-tools-version: 6.0
// Builds only the app's Layout folder (no UI, no Firebase) so its tests run in
// seconds with `swift test`, no simulator needed. The app itself does not
// depend on this package; Xcode compiles the same files as part of the app
// target.
import PackageDescription

let package = Package(
    name: "FlipFlapLayout",
    targets: [
        .target(name: "FlipFlapLayout", path: "SplitFlapTV/SplitFlapTV/Layout"),
        .testTarget(name: "LayoutTests", dependencies: ["FlipFlapLayout"], path: "LayoutTests"),
    ]
)
