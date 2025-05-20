const std = @import("std");

pub fn build(b: *std.Build) void {
    // Get optimization level from command line or default to Debug
    const optimize = b.option(std.builtin.OptimizeMode, "optimize", "Optimization level (Debug, ReleaseFast, ReleaseSafe, ReleaseSmall)") orelse .Debug;
    const sdk_path_str = b.option([]const u8, "sdk-path", "Path to macOS SDK (optional)") orelse getDefaultMacOSSDKPath();

    const lib_name = "webgpu_wrapper";
    const root_source_path = "lib.zig";
    const output_base_dir = "../../lib";

    const targets = [_]std.Target.Query{
        .{ .cpu_arch = .x86_64, .os_tag = .linux },
        .{ .cpu_arch = .x86_64, .os_tag = .macos },
        .{ .cpu_arch = .aarch64, .os_tag = .macos },
        // .{ .cpu_arch = .x86_64, .os_tag = .windows },
        // Note: Dawn does not yet support linux aarch64
        // .{ .cpu_arch = .aarch64, .os_tag = .linux },
    };

    // Generate library for each target
    for (targets) |target_query| {
        const target = b.resolveTargetQuery(target_query);

        // Generate target_name_str first as it's needed for Dawn paths
        var target_name_buffer: [64]u8 = undefined;
        const target_name_str = std.fmt.bufPrint(
            &target_name_buffer,
            "{s}-{s}",
            .{
                @tagName(target.result.cpu.arch),
                @tagName(target.result.os.tag),
            },
        ) catch @panic("target_name_buffer too small");

        const dawn_platform_libs_dir_str = b.fmt("../../dawn/libs/{s}", .{target_name_str});
        const dawn_platform_libs_path = b.path(dawn_platform_libs_dir_str); // For RPath

        const target_lib = b.addSharedLibrary(.{
            .name = lib_name,
            .root_source_file = b.path(root_source_path),
            .target = target,
            .optimize = optimize,
            .link_libc = true,
        });

        target_lib.addIncludePath(.{ .cwd_relative = b.fmt("{s}/include", .{dawn_platform_libs_dir_str}) });
        target_lib.linkSystemLibrary("webgpu_dawn");

        // The library path for the linker to find the dawn library during build
        target_lib.addLibraryPath(.{ .cwd_relative = dawn_platform_libs_dir_str });
        target_lib.addLibraryPath(.{ .cwd_relative = "../../dawn/libs" });

        if (target.result.os.tag == .macos) {
            target_lib.linkLibCpp();
            target_lib.linkFramework("Foundation");
            target_lib.linkFramework("CoreFoundation");
            target_lib.linkFramework("IOKit");
            target_lib.linkFramework("IOSurface");
            target_lib.linkFramework("Metal");
            target_lib.linkFramework("QuartzCore");

            // Add SDK paths for frameworks and libraries
            target_lib.addFrameworkPath(.{ .cwd_relative = b.fmt("{s}/System/Library/Frameworks", .{sdk_path_str}) });

            target_lib.addLibraryPath(.{ .cwd_relative = b.fmt("{s}/usr/lib", .{sdk_path_str}) });
        }

        const install_target_lib = b.addInstallArtifact(target_lib, .{
            .dest_dir = .{
                .override = .{
                    .custom = b.fmt("{s}/{s}", .{ output_base_dir, target_name_str }),
                },
            },
        });

        target_lib.addRPath(dawn_platform_libs_path);

        const build_step_name = b.fmt("build-{s}", .{target_name_str});
        const build_step = b.step(build_step_name, b.fmt("Build for {s}", .{target_name_str}));
        build_step.dependOn(&install_target_lib.step);
        b.getInstallStep().dependOn(&install_target_lib.step);
    }
}

fn getDefaultMacOSSDKPath() []const u8 {
    // This is a common path; adjust if your SDK is elsewhere or prefer to always set via -Dsdk-path
    // For a more robust solution, consider using `xcrun --sdk macosx --show-sdk-path`
    // and passing it via -Dsdk-path, or detecting common Xcode/Command Line Tools locations.
    return "/Library/Developer/CommandLineTools/SDKs/MacOSX.sdk";
}
