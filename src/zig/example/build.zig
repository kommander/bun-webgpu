const std = @import("std");

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});

    // Create the executable
    const exe = b.addExecutable(.{
        .name = "triangle_loop",
        .root_source_file = b.path("triangle_loop.zig"),
        .target = target,
        .optimize = optimize,
    });

    // Determine the target string for library path
    const target_result = target.result;
    var target_name_buffer: [64]u8 = undefined;
    const target_name_str = std.fmt.bufPrint(
        &target_name_buffer,
        "{s}-{s}",
        .{
            @tagName(target_result.cpu.arch),
            @tagName(target_result.os.tag),
        },
    ) catch @panic("target_name_buffer too small");

    // Add library path and link the WebGPU wrapper
    const lib_path = b.fmt("../../lib/{s}", .{target_name_str});
    exe.addLibraryPath(.{ .cwd_relative = lib_path });
    exe.linkSystemLibrary("webgpu_wrapper");
    exe.linkLibC();

    // Add include path for WebGPU headers
    const include_path = b.fmt("../../../dawn/libs/{s}/include", .{target_name_str});
    exe.addIncludePath(.{ .cwd_relative = include_path });

    // Add rpath so the executable can find the dynamic library at runtime
    exe.addRPath(.{ .cwd_relative = lib_path });

    // Install the executable
    b.installArtifact(exe);

    // Create a run step
    const run_cmd = b.addRunArtifact(exe);
    run_cmd.step.dependOn(b.getInstallStep());

    if (b.args) |args| {
        run_cmd.addArgs(args);
    }

    const run_step = b.step("run", "Run the triangle loop example");
    run_step.dependOn(&run_cmd.step);
}
