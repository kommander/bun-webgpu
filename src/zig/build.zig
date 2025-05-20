const std = @import("std");

pub fn build(b: *std.Build) void {
    // Get optimization level from command line or default to Debug
    const optimize = b.option(std.builtin.OptimizeMode, "optimize", "Optimization level (Debug, ReleaseFast, ReleaseSafe, ReleaseSmall)") orelse .Debug;
    const sdk_path_str = b.option([]const u8, "sdk-path", "Path to macOS SDK (optional)") orelse getDefaultMacOSSDKPath();
    const target_str_opt = b.option([]const u8, "target", "Specific target to build (e.g., x86_64-macos). If not given, builds all default targets (excluding Windows and aarch64-linux).") orelse null;

    const lib_name = "webgpu_wrapper";
    const root_source_path = "lib.zig";
    const output_base_dir = "../../lib";

    var targets_to_build_slice: []const std.Target.Query = undefined;
    var single_target_storage: [1]std.Target.Query = undefined; // Storage if a single target is specified

    if (target_str_opt) |target_str| {
        var parts = std.mem.splitScalar(u8, target_str, '-');
        const arch_str = parts.next() orelse {
            std.log.err("Invalid target string: {s}. Expected format: arch-os. Missing arch part.", .{target_str});
            return;
        };
        const os_str = parts.next() orelse {
            std.log.err("Invalid target string: {s}. Expected format: arch-os. Missing os part after arch {s}.", .{ target_str, arch_str });
            return;
        };
        if (parts.next() != null) {
            std.log.err("Invalid target string: {s}. Expected format: arch-os. Too many parts.", .{target_str});
            return;
        }

        const arch = std.meta.stringToEnum(std.Target.Cpu.Arch, arch_str) orelse {
            std.log.err("Unsupported architecture: {s} in target string {s}. Please use one of the standard architecture names (e.g., x86_64, aarch64).", .{ arch_str, target_str });
            return;
        };

        const os = std.meta.stringToEnum(std.Target.Os.Tag, os_str) orelse {
            std.log.err("Unsupported OS: {s} in target string {s}. Please use one of the standard OS names (e.g., linux, macos).", .{ os_str, target_str });
            return;
        };

        if (arch == .aarch64 and os == .linux) {
            std.log.warn("Building for aarch64-linux. Note: Dawn support for this target might be experimental or incomplete.", .{});
        }
        if (arch == .x86_64 and os == .windows) {
            std.log.warn("Building for x86_64-windows. This target is typically excluded by default but allowed if specified.", .{});
        }

        single_target_storage[0] = .{ .cpu_arch = arch, .os_tag = os };
        targets_to_build_slice = &single_target_storage;
    } else {
        // Default targets (all currently supported, non-Windows, non-aarch64-linux due to Dawn limitations)
        const default_targets = [_]std.Target.Query{
            .{ .cpu_arch = .x86_64, .os_tag = .linux },
            .{ .cpu_arch = .x86_64, .os_tag = .macos },
            .{ .cpu_arch = .aarch64, .os_tag = .macos },
            // .{ .cpu_arch = .x86_64, .os_tag = .windows }, // Excluded by default
            // .{ .cpu_arch = .aarch64, .os_tag = .linux }, // Excluded by default (Dawn limitation)
        };
        targets_to_build_slice = &default_targets;
    }

    // Generate library for each target
    for (targets_to_build_slice) |target_query| {
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
