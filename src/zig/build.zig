const std = @import("std");

pub fn build(b: *std.Build) void {
    // Get optimization level from command line or default to Debug
    const optimize = b.option(std.builtin.OptimizeMode, "optimize", "Optimization level (Debug, ReleaseFast, ReleaseSafe, ReleaseSmall)") orelse .Debug;

    const lib_name = "webgpu_wrapper";
    const root_source_path = "lib.zig";
    const output_base_dir = "../lib";

    // Define all target configurations we want to support
    // Mirroring renderoo's targets for now
    const targets = [_]std.Target.Query{
        // .{ .cpu_arch = .x86_64, .os_tag = .linux },
        // .{ .cpu_arch = .x86_64, .os_tag = .macos },
        .{ .cpu_arch = .aarch64, .os_tag = .macos },
        // .{ .cpu_arch = .x86_64, .os_tag = .windows },
        // .{ .cpu_arch = .aarch64, .os_tag = .linux },
    };

    // Generate library for each target
    for (targets) |target_query| {
        const target = b.resolveTargetQuery(target_query);
        const target_lib = b.addSharedLibrary(.{
            .name = lib_name,
            .root_source_file = b.path(root_source_path),
            .target = target,
            .optimize = optimize,
            // .link_libc = false, // Assuming WebGPU might need libc, can be re-evaluated
        });

        // Add WGPU header include path (relative to this build.zig file)
        target_lib.addIncludePath(.{ .cwd_relative = "../../dawn" });
        // Link WGPU library (libwebgpu_dawn.dylib / webgpu_dawn.dll etc.)
        target_lib.linkSystemLibrary("webgpu_dawn");
        // The library path for the linker to find the dawn library during build
        target_lib.addLibraryPath(.{ .cwd_relative = "../../dawn" }); // This path should contain the actual libwebgpu_dawn files

        // Create a suffix based on target to differentiate files
        var target_name_buffer: [64]u8 = undefined;
        const target_name_str = std.fmt.bufPrint(
            &target_name_buffer,
            "{s}-{s}",
            .{
                @tagName(target.result.cpu.arch),
                @tagName(target.result.os.tag),
            },
        ) catch @panic("target_name_buffer too small");

        const install_target_lib = b.addInstallArtifact(target_lib, .{
            .dest_dir = .{
                .override = .{
                    .custom = b.fmt("{s}/{s}", .{ output_base_dir, target_name_str }),
                },
            },
        });

        target_lib.addRPath(b.path("../../dawn/"));

        const build_step_name = b.fmt("build-{s}", .{target_name_str});
        const build_step = b.step(build_step_name, b.fmt("Build for {s}", .{target_name_str}));
        build_step.dependOn(&install_target_lib.step);
        b.getInstallStep().dependOn(&install_target_lib.step);
    }
}
