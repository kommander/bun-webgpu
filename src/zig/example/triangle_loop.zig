const std = @import("std");
const print = std.debug.print;

// Import C headers from webgpu.h
const c = @cImport({
    @cInclude("dawn/webgpu.h");
});

// Helper function to create WGPUStringView from string literal
fn makeStringView(str: [*:0]const u8) c.WGPUStringView {
    return c.WGPUStringView{
        .data = str,
        .length = std.mem.len(str),
    };
}

// Helper function to create null WGPUStringView
fn makeNullStringView() c.WGPUStringView {
    return c.WGPUStringView{
        .data = null,
        .length = 0,
    };
}

// External function declarations from the dynamic library
extern fn zwgpuCreateInstance(descriptor: ?*const c.WGPUInstanceDescriptor) c.WGPUInstance;
extern fn zwgpuInstanceRelease(instance: c.WGPUInstance) void;
extern fn zwgpuInstanceRequestAdapter(instance: c.WGPUInstance, options: ?*const c.WGPURequestAdapterOptions, callback_info: *const c.WGPURequestAdapterCallbackInfo) u64;
extern fn zwgpuInstanceWaitAny(instance: c.WGPUInstance, future_count: u64, futures: [*]c.WGPUFutureWaitInfo, timeout_ns: u64) c.WGPUWaitStatus;
extern fn zwgpuInstanceProcessEvents(instance: c.WGPUInstance) void;

extern fn zwgpuAdapterRelease(adapter: c.WGPUAdapter) void;
extern fn zwgpuAdapterRequestDevice(adapter: c.WGPUAdapter, descriptor: ?*const c.WGPUDeviceDescriptor, callback_info: *const c.WGPURequestDeviceCallbackInfo) u64;

extern fn zwgpuDeviceRelease(device: c.WGPUDevice) void;
extern fn zwgpuDeviceGetQueue(device: c.WGPUDevice) c.WGPUQueue;
extern fn zwgpuDeviceCreateBuffer(device: c.WGPUDevice, descriptor: *const c.WGPUBufferDescriptor) c.WGPUBuffer;
extern fn zwgpuDeviceCreateTexture(device: c.WGPUDevice, descriptor: *const c.WGPUTextureDescriptor) c.WGPUTexture;
extern fn zwgpuDeviceCreateShaderModule(device: c.WGPUDevice, descriptor: *const c.WGPUShaderModuleDescriptor) c.WGPUShaderModule;
extern fn zwgpuDeviceCreateBindGroupLayout(device: c.WGPUDevice, descriptor: *const c.WGPUBindGroupLayoutDescriptor) c.WGPUBindGroupLayout;
extern fn zwgpuDeviceCreateBindGroup(device: c.WGPUDevice, descriptor: *const c.WGPUBindGroupDescriptor) c.WGPUBindGroup;
extern fn zwgpuDeviceCreatePipelineLayout(device: c.WGPUDevice, descriptor: *const c.WGPUPipelineLayoutDescriptor) c.WGPUPipelineLayout;
extern fn zwgpuDeviceCreateRenderPipeline(device: c.WGPUDevice, descriptor: *const c.WGPURenderPipelineDescriptor) c.WGPURenderPipeline;
extern fn zwgpuDeviceCreateCommandEncoder(device: c.WGPUDevice, descriptor: ?*const c.WGPUCommandEncoderDescriptor) c.WGPUCommandEncoder;
extern fn zwgpuDeviceDestroy(device: c.WGPUDevice) void;

extern fn zwgpuQueueRelease(queue: c.WGPUQueue) void;
extern fn zwgpuQueueSubmit(queue: c.WGPUQueue, command_count: u64, commands: [*]const c.WGPUCommandBuffer) void;
extern fn zwgpuQueueWriteBuffer(queue: c.WGPUQueue, buffer: c.WGPUBuffer, buffer_offset: u64, data: ?*const anyopaque, size: u64) void;
extern fn zwgpuQueueOnSubmittedWorkDone(queue: c.WGPUQueue, callback_info: *const c.WGPUQueueWorkDoneCallbackInfo) u64;

extern fn zwgpuBufferMapAsync(buffer: c.WGPUBuffer, mode: c.WGPUMapMode, offset: u64, size: u64, callback_info: *const c.WGPUBufferMapCallbackInfo) u64;
extern fn zwgpuBufferUnmap(buffer: c.WGPUBuffer) void;
extern fn zwgpuBufferRelease(buffer: c.WGPUBuffer) void;
extern fn zwgpuBufferDestroy(buffer: c.WGPUBuffer) void;

extern fn zwgpuTextureCreateView(texture: c.WGPUTexture, descriptor: ?*const c.WGPUTextureViewDescriptor) c.WGPUTextureView;
extern fn zwgpuTextureDestroy(texture: c.WGPUTexture) void;
extern fn zwgpuTextureRelease(texture: c.WGPUTexture) void;

extern fn zwgpuTextureViewRelease(texture_view: c.WGPUTextureView) void;

extern fn zwgpuShaderModuleRelease(shader_module: c.WGPUShaderModule) void;
extern fn zwgpuBindGroupLayoutRelease(bind_group_layout: c.WGPUBindGroupLayout) void;
extern fn zwgpuBindGroupRelease(bind_group: c.WGPUBindGroup) void;
extern fn zwgpuPipelineLayoutRelease(pipeline_layout: c.WGPUPipelineLayout) void;
extern fn zwgpuRenderPipelineRelease(render_pipeline: c.WGPURenderPipeline) void;

extern fn zwgpuCommandEncoderBeginRenderPass(encoder: c.WGPUCommandEncoder, descriptor: *const c.WGPURenderPassDescriptor) c.WGPURenderPassEncoder;
extern fn zwgpuCommandEncoderCopyTextureToBuffer(encoder: c.WGPUCommandEncoder, source: *const c.WGPUTexelCopyTextureInfo, destination: *const c.WGPUTexelCopyBufferInfo, copy_size: *const c.WGPUExtent3D) void;
extern fn zwgpuCommandEncoderFinish(encoder: c.WGPUCommandEncoder, descriptor: ?*const c.WGPUCommandBufferDescriptor) c.WGPUCommandBuffer;
extern fn zwgpuCommandEncoderRelease(encoder: c.WGPUCommandEncoder) void;

extern fn zwgpuRenderPassEncoderSetPipeline(encoder: c.WGPURenderPassEncoder, pipeline: c.WGPURenderPipeline) void;
extern fn zwgpuRenderPassEncoderSetViewport(encoder: c.WGPURenderPassEncoder, x: f32, y: f32, width: f32, height: f32, min_depth: f32, max_depth: f32) void;
extern fn zwgpuRenderPassEncoderSetScissorRect(encoder: c.WGPURenderPassEncoder, x: u32, y: u32, width: u32, height: u32) void;
extern fn zwgpuRenderPassEncoderSetVertexBuffer(encoder: c.WGPURenderPassEncoder, slot: u32, buffer: c.WGPUBuffer, offset: u64, size: u64) void;
extern fn zwgpuRenderPassEncoderSetIndexBuffer(encoder: c.WGPURenderPassEncoder, buffer: c.WGPUBuffer, format: c.WGPUIndexFormat, offset: u64, size: u64) void;
extern fn zwgpuRenderPassEncoderSetBindGroup(encoder: c.WGPURenderPassEncoder, group_index: u32, group: c.WGPUBindGroup, dynamic_offset_count: u64, dynamic_offsets: ?*const u32) void;
extern fn zwgpuRenderPassEncoderDrawIndexed(encoder: c.WGPURenderPassEncoder, index_count: u32, instance_count: u32, first_index: u32, base_vertex: i32, first_instance: u32) void;
extern fn zwgpuRenderPassEncoderEnd(encoder: c.WGPURenderPassEncoder) void;
extern fn zwgpuRenderPassEncoderRelease(encoder: c.WGPURenderPassEncoder) void;

extern fn zwgpuCommandBufferRelease(command_buffer: c.WGPUCommandBuffer) void;

// Global state for async operations
var g_adapter: c.WGPUAdapter = null;
var g_device: c.WGPUDevice = null;
var g_adapter_ready = false;
var g_device_ready = false;
var g_map_ready = false;
var g_work_done = false;

fn adapterCallback(status: c.WGPURequestAdapterStatus, adapter: c.WGPUAdapter, message: c.WGPUStringView, userdata1: ?*anyopaque, userdata2: ?*anyopaque) callconv(.C) void {
    _ = userdata1;
    _ = userdata2;
    if (status == c.WGPURequestAdapterStatus_Success) {
        g_adapter = adapter;
        g_adapter_ready = true;
        print("Adapter acquired successfully\n", .{});
    } else {
        print("Failed to acquire adapter: status={}\n", .{status});
        if (message.data != null) {
            const msg_slice = message.data[0..message.length];
            print("Message: {s}\n", .{msg_slice});
        }
    }
}

fn deviceCallback(status: c.WGPURequestDeviceStatus, device: c.WGPUDevice, message: c.WGPUStringView, userdata1: ?*anyopaque, userdata2: ?*anyopaque) callconv(.C) void {
    _ = userdata1;
    _ = userdata2;
    if (status == c.WGPURequestDeviceStatus_Success) {
        g_device = device;
        g_device_ready = true;
        print("Device acquired successfully\n", .{});
    } else {
        print("Failed to acquire device: status={}\n", .{status});
        if (message.data != null) {
            const msg_slice = message.data[0..message.length];
            print("Message: {s}\n", .{msg_slice});
        }
    }
}

fn mapCallback(status: c.WGPUMapAsyncStatus, message: c.WGPUStringView, userdata1: ?*anyopaque, userdata2: ?*anyopaque) callconv(.C) void {
    _ = userdata1;
    _ = userdata2;
    if (status == c.WGPUMapAsyncStatus_Success) {
        g_map_ready = true;
        print("Buffer mapped successfully\n", .{});
    } else {
        print("Failed to map buffer: status={}\n", .{status});
        if (message.data != null) {
            const msg_slice = message.data[0..message.length];
            print("Message: {s}\n", .{msg_slice});
        }
    }
}

fn workDoneCallback(status: c.WGPUQueueWorkDoneStatus, userdata1: ?*anyopaque, userdata2: ?*anyopaque) callconv(.C) void {
    _ = userdata1;
    _ = userdata2;
    if (status == c.WGPUQueueWorkDoneStatus_Success) {
        g_work_done = true;
        print("Work done\n", .{});
    } else {
        print("Work failed: status={}\n", .{status});
    }
}

pub fn main() !void {
    print("\n--- Running Triangle Loop Example in Zig ---\n", .{});

    // Parse command line arguments
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();

    const args = try std.process.argsAlloc(allocator);
    defer std.process.argsFree(allocator, args);

    var num_loops: u32 = 10; // default value
    if (args.len > 1) {
        num_loops = std.fmt.parseInt(u32, args[1], 10) catch |err| blk: {
            print("Error parsing loop count '{s}': {}\n", .{ args[1], err });
            print("Using default value of 10 loops\n", .{});
            break :blk 10;
        };
    }

    print("Running {} loops\n", .{num_loops});

    // 1. Create instance
    const instance_desc = c.WGPUInstanceDescriptor{};
    const instance = zwgpuCreateInstance(&instance_desc);
    if (instance == null) {
        print("Failed to create WebGPU instance\n", .{});
        return;
    }
    defer zwgpuInstanceRelease(instance);

    // 2. Request adapter
    const adapter_options = c.WGPURequestAdapterOptions{};
    const adapter_callback_info = c.WGPURequestAdapterCallbackInfo{
        .nextInChain = null,
        .mode = c.WGPUCallbackMode_AllowProcessEvents,
        .callback = adapterCallback,
        .userdata1 = null,
        .userdata2 = null,
    };

    _ = zwgpuInstanceRequestAdapter(instance, &adapter_options, &adapter_callback_info);

    // Wait for adapter
    while (!g_adapter_ready) {
        zwgpuInstanceProcessEvents(instance);
        std.time.sleep(1000000); // 1ms
    }

    const adapter = g_adapter;
    if (adapter == null) {
        print("Failed to get adapter\n", .{});
        return;
    }
    defer zwgpuAdapterRelease(adapter);

    // 3. Request device
    const device_desc = c.WGPUDeviceDescriptor{};
    const device_callback_info = c.WGPURequestDeviceCallbackInfo{
        .nextInChain = null,
        .mode = c.WGPUCallbackMode_AllowProcessEvents,
        .callback = deviceCallback,
        .userdata1 = null,
        .userdata2 = null,
    };

    _ = zwgpuAdapterRequestDevice(adapter, &device_desc, &device_callback_info);

    // Wait for device
    while (!g_device_ready) {
        zwgpuInstanceProcessEvents(instance);
        std.time.sleep(1000000); // 1ms
    }

    const device = g_device;
    if (device == null) {
        print("Failed to get device\n", .{});
        return;
    }
    // Note: Device cleanup order is important - destroy before release
    defer zwgpuDeviceRelease(device);
    defer zwgpuDeviceDestroy(device);

    // 4. Get queue
    const queue = zwgpuDeviceGetQueue(device);
    if (queue == null) {
        print("Failed to get queue\n", .{});
        return;
    }
    defer zwgpuQueueRelease(queue);

    // 5. Create resources
    const width: u32 = 128;
    const height: u32 = 128;

    // Vertex data: triangle
    const vertex_data = [_]f32{ -0.5, -0.5, 0.0, 0.5, -0.5, 0.0, 0.0, 0.5, 0.0 };
    const index_data = [_]u16{ 0, 1, 2 };

    // Create vertex buffer
    const vertex_buffer_desc = c.WGPUBufferDescriptor{
        .nextInChain = null,
        .label = makeStringView("Vertex Buffer"),
        .usage = c.WGPUBufferUsage_Vertex | c.WGPUBufferUsage_CopyDst,
        .size = vertex_data.len * @sizeOf(f32),
        .mappedAtCreation = 0,
    };
    const vertex_buffer = zwgpuDeviceCreateBuffer(device, &vertex_buffer_desc);
    if (vertex_buffer == null) {
        print("Failed to create vertex buffer\n", .{});
        return;
    }
    defer zwgpuBufferRelease(vertex_buffer);
    defer zwgpuBufferDestroy(vertex_buffer);

    // Create index buffer
    const index_buffer_desc = c.WGPUBufferDescriptor{
        .nextInChain = null,
        .label = makeStringView("Index Buffer"),
        .usage = c.WGPUBufferUsage_Index | c.WGPUBufferUsage_CopyDst,
        .size = index_data.len * @sizeOf(u16),
        .mappedAtCreation = 0,
    };
    const index_buffer = zwgpuDeviceCreateBuffer(device, &index_buffer_desc);
    if (index_buffer == null) {
        print("Failed to create index buffer\n", .{});
        return;
    }
    defer zwgpuBufferRelease(index_buffer);
    defer zwgpuBufferDestroy(index_buffer);

    // Upload data to buffers
    zwgpuQueueWriteBuffer(queue, vertex_buffer, 0, &vertex_data, vertex_data.len * @sizeOf(f32));
    zwgpuQueueWriteBuffer(queue, index_buffer, 0, &index_data, index_data.len * @sizeOf(u16));

    // Create shaders
    const vs_code = "@vertex fn main(@location(0) pos: vec3f) -> @builtin(position) vec4f { return vec4f(pos, 1.0); }";
    const fs_code = "@fragment fn main() -> @location(0) vec4f { return vec4f(0.0, 1.0, 0.0, 1.0); }";

    const vs_wgsl = c.WGPUShaderSourceWGSL{
        .chain = c.WGPUChainedStruct{ .next = null, .sType = c.WGPUSType_ShaderSourceWGSL },
        .code = makeStringView(vs_code.ptr),
    };
    const vs_desc = c.WGPUShaderModuleDescriptor{
        .nextInChain = @ptrCast(@constCast(&vs_wgsl)),
        .label = makeStringView("Vertex Shader"),
    };
    const vs_module = zwgpuDeviceCreateShaderModule(device, &vs_desc);
    if (vs_module == null) {
        print("Failed to create vertex shader\n", .{});
        return;
    }
    defer zwgpuShaderModuleRelease(vs_module);

    const fs_wgsl = c.WGPUShaderSourceWGSL{
        .chain = c.WGPUChainedStruct{ .next = null, .sType = c.WGPUSType_ShaderSourceWGSL },
        .code = makeStringView(fs_code.ptr),
    };
    const fs_desc = c.WGPUShaderModuleDescriptor{
        .nextInChain = @ptrCast(@constCast(&fs_wgsl)),
        .label = makeStringView("Fragment Shader"),
    };
    const fs_module = zwgpuDeviceCreateShaderModule(device, &fs_desc);
    if (fs_module == null) {
        print("Failed to create fragment shader\n", .{});
        return;
    }
    defer zwgpuShaderModuleRelease(fs_module);

    // Create bind group layout (empty)
    const bgl_desc = c.WGPUBindGroupLayoutDescriptor{
        .nextInChain = null,
        .label = makeStringView("Empty Bind Group Layout"),
        .entryCount = 0,
        .entries = null,
    };
    const bind_group_layout = zwgpuDeviceCreateBindGroupLayout(device, &bgl_desc);
    if (bind_group_layout == null) {
        print("Failed to create bind group layout\n", .{});
        return;
    }
    defer zwgpuBindGroupLayoutRelease(bind_group_layout);

    // Create pipeline layout
    const bgl_array = [_]c.WGPUBindGroupLayout{bind_group_layout};
    const pll_desc = c.WGPUPipelineLayoutDescriptor{
        .nextInChain = null,
        .label = makeStringView("Pipeline Layout"),
        .bindGroupLayoutCount = 1,
        .bindGroupLayouts = &bgl_array,
    };
    const pipeline_layout = zwgpuDeviceCreatePipelineLayout(device, &pll_desc);
    if (pipeline_layout == null) {
        print("Failed to create pipeline layout\n", .{});
        return;
    }
    defer zwgpuPipelineLayoutRelease(pipeline_layout);

    // Create bind group (empty)
    const bg_desc = c.WGPUBindGroupDescriptor{
        .nextInChain = null,
        .label = makeStringView("Empty Bind Group"),
        .layout = bind_group_layout,
        .entryCount = 0,
        .entries = null,
    };
    const bind_group = zwgpuDeviceCreateBindGroup(device, &bg_desc);
    if (bind_group == null) {
        print("Failed to create bind group\n", .{});
        return;
    }
    defer zwgpuBindGroupRelease(bind_group);

    // Create render pipeline
    const vertex_attr = c.WGPUVertexAttribute{
        .format = c.WGPUVertexFormat_Float32x3,
        .offset = 0,
        .shaderLocation = 0,
    };
    const vertex_buffer_layout = c.WGPUVertexBufferLayout{
        .arrayStride = 3 * @sizeOf(f32),
        .stepMode = c.WGPUVertexStepMode_Vertex,
        .attributeCount = 1,
        .attributes = &vertex_attr,
    };

    const color_target = c.WGPUColorTargetState{
        .nextInChain = null,
        .format = c.WGPUTextureFormat_RGBA8Unorm,
        .blend = null,
        .writeMask = c.WGPUColorWriteMask_All,
    };
    const fragment_state = c.WGPUFragmentState{
        .nextInChain = null,
        .module = fs_module,
        .entryPoint = makeNullStringView(),
        .constantCount = 0,
        .constants = null,
        .targetCount = 1,
        .targets = &color_target,
    };

    const pipeline_desc = c.WGPURenderPipelineDescriptor{
        .nextInChain = null,
        .label = makeStringView("Render Pipeline"),
        .layout = pipeline_layout,
        .vertex = c.WGPUVertexState{
            .nextInChain = null,
            .module = vs_module,
            .entryPoint = makeNullStringView(),
            .constantCount = 0,
            .constants = null,
            .bufferCount = 1,
            .buffers = &vertex_buffer_layout,
        },
        .primitive = c.WGPUPrimitiveState{
            .nextInChain = null,
            .topology = c.WGPUPrimitiveTopology_TriangleList,
            .stripIndexFormat = c.WGPUIndexFormat_Undefined,
            .frontFace = c.WGPUFrontFace_CCW,
            .cullMode = c.WGPUCullMode_None,
            .unclippedDepth = 0,
        },
        .depthStencil = null,
        .multisample = c.WGPUMultisampleState{
            .nextInChain = null,
            .count = 1,
            .mask = 0xFFFFFFFF,
            .alphaToCoverageEnabled = 0,
        },
        .fragment = &fragment_state,
    };
    const render_pipeline = zwgpuDeviceCreateRenderPipeline(device, &pipeline_desc);
    if (render_pipeline == null) {
        print("Failed to create render pipeline\n", .{});
        return;
    }
    defer zwgpuRenderPipelineRelease(render_pipeline);

    // Create render target texture
    const texture_desc = c.WGPUTextureDescriptor{
        .nextInChain = null,
        .label = makeStringView("Render Target"),
        .usage = c.WGPUTextureUsage_RenderAttachment | c.WGPUTextureUsage_CopySrc,
        .dimension = c.WGPUTextureDimension_2D,
        .size = c.WGPUExtent3D{ .width = width, .height = height, .depthOrArrayLayers = 1 },
        .format = c.WGPUTextureFormat_RGBA8Unorm,
        .mipLevelCount = 1,
        .sampleCount = 1,
        .viewFormatCount = 0,
        .viewFormats = null,
    };
    const render_texture = zwgpuDeviceCreateTexture(device, &texture_desc);
    if (render_texture == null) {
        print("Failed to create render texture\n", .{});
        return;
    }
    defer zwgpuTextureRelease(render_texture);
    defer zwgpuTextureDestroy(render_texture);

    // Create texture view
    const view_desc = c.WGPUTextureViewDescriptor{
        .nextInChain = null,
        .label = makeStringView("Render Target View"),
        .format = c.WGPUTextureFormat_RGBA8Unorm,
        .dimension = c.WGPUTextureViewDimension_2D,
        .baseMipLevel = 0,
        .mipLevelCount = 1,
        .baseArrayLayer = 0,
        .arrayLayerCount = 1,
        .aspect = c.WGPUTextureAspect_All,
        .usage = 0,
    };
    const render_view = zwgpuTextureCreateView(render_texture, &view_desc);
    if (render_view == null) {
        print("Failed to create texture view\n", .{});
        return;
    }
    defer zwgpuTextureViewRelease(render_view);

    // Create readback buffer
    const bytes_per_row: u32 = width * 4; // RGBA8
    const readback_buffer_size = bytes_per_row * height;
    const readback_buffer_desc = c.WGPUBufferDescriptor{
        .nextInChain = null,
        .label = makeStringView("Readback Buffer"),
        .usage = c.WGPUBufferUsage_MapRead | c.WGPUBufferUsage_CopyDst,
        .size = readback_buffer_size,
        .mappedAtCreation = 0,
    };
    const readback_buffer = zwgpuDeviceCreateBuffer(device, &readback_buffer_desc);
    if (readback_buffer == null) {
        print("Failed to create readback buffer\n", .{});
        return;
    }
    defer zwgpuBufferRelease(readback_buffer);
    defer zwgpuBufferDestroy(readback_buffer);

    // 6. Render once
    const cmd_encoder_desc = c.WGPUCommandEncoderDescriptor{
        .nextInChain = null,
        .label = makeStringView("Command Encoder"),
    };
    const command_encoder = zwgpuDeviceCreateCommandEncoder(device, &cmd_encoder_desc);
    if (command_encoder == null) {
        print("Failed to create command encoder\n", .{});
        return;
    }
    defer zwgpuCommandEncoderRelease(command_encoder);

    // Begin render pass
    const color_attachment = c.WGPURenderPassColorAttachment{
        .nextInChain = null,
        .view = render_view,
        .depthSlice = c.WGPU_DEPTH_SLICE_UNDEFINED,
        .resolveTarget = null,
        .loadOp = c.WGPULoadOp_Clear,
        .storeOp = c.WGPUStoreOp_Store,
        .clearValue = c.WGPUColor{ .r = 0.1, .g = 0.1, .b = 0.1, .a = 1.0 },
    };
    const render_pass_desc = c.WGPURenderPassDescriptor{
        .nextInChain = null,
        .label = makeStringView("Render Pass"),
        .colorAttachmentCount = 1,
        .colorAttachments = &color_attachment,
        .depthStencilAttachment = null,
        .occlusionQuerySet = null,
        .timestampWrites = null,
    };
    const pass_encoder = zwgpuCommandEncoderBeginRenderPass(command_encoder, &render_pass_desc);
    if (pass_encoder == null) {
        print("Failed to begin render pass\n", .{});
        return;
    }
    defer zwgpuRenderPassEncoderRelease(pass_encoder);

    // Set pipeline and draw
    zwgpuRenderPassEncoderSetPipeline(pass_encoder, render_pipeline);
    zwgpuRenderPassEncoderSetViewport(pass_encoder, 0, 0, @floatFromInt(width), @floatFromInt(height), 0, 1);
    zwgpuRenderPassEncoderSetScissorRect(pass_encoder, 0, 0, width, height);
    zwgpuRenderPassEncoderSetVertexBuffer(pass_encoder, 0, vertex_buffer, 0, vertex_data.len * @sizeOf(f32));
    zwgpuRenderPassEncoderSetIndexBuffer(pass_encoder, index_buffer, c.WGPUIndexFormat_Uint16, 0, index_data.len * @sizeOf(u16));
    zwgpuRenderPassEncoderSetBindGroup(pass_encoder, 0, bind_group, 0, null);
    zwgpuRenderPassEncoderDrawIndexed(pass_encoder, 3, 1, 0, 0, 0);
    zwgpuRenderPassEncoderEnd(pass_encoder);

    // 7. Loop: copy texture to buffer and map
    var count: u32 = 0;
    while (count < num_loops) {
        print("Loop {}...\n", .{count});
        count += 1;

        // Create copy command encoder
        const copy_cmd_encoder = zwgpuDeviceCreateCommandEncoder(device, &cmd_encoder_desc);
        if (copy_cmd_encoder == null) {
            print("Failed to create copy command encoder\n", .{});
            return;
        }
        defer zwgpuCommandEncoderRelease(copy_cmd_encoder);

        // Copy texture to buffer
        const copy_src = c.WGPUTexelCopyTextureInfo{
            .texture = render_texture,
            .mipLevel = 0,
            .origin = c.WGPUOrigin3D{ .x = 0, .y = 0, .z = 0 },
            .aspect = c.WGPUTextureAspect_All,
        };
        const copy_dst = c.WGPUTexelCopyBufferInfo{
            .layout = c.WGPUTexelCopyBufferLayout{
                .offset = 0,
                .bytesPerRow = bytes_per_row,
                .rowsPerImage = height,
            },
            .buffer = readback_buffer,
        };
        const copy_size = c.WGPUExtent3D{ .width = width, .height = height, .depthOrArrayLayers = 1 };
        zwgpuCommandEncoderCopyTextureToBuffer(copy_cmd_encoder, &copy_src, &copy_dst, &copy_size);

        const copy_cmd_buffer = zwgpuCommandEncoderFinish(copy_cmd_encoder, null);
        if (copy_cmd_buffer == null) {
            print("Failed to finish copy command buffer\n", .{});
            return;
        }
        defer zwgpuCommandBufferRelease(copy_cmd_buffer);

        // Submit commands
        const cmd_buffers = [_]c.WGPUCommandBuffer{copy_cmd_buffer};
        zwgpuQueueSubmit(queue, 1, &cmd_buffers);

        // Wait for work to complete
        g_work_done = false;
        const work_done_callback_info = c.WGPUQueueWorkDoneCallbackInfo{
            .nextInChain = null,
            .mode = c.WGPUCallbackMode_AllowProcessEvents,
            .callback = workDoneCallback,
            .userdata1 = null,
            .userdata2 = null,
        };
        _ = zwgpuQueueOnSubmittedWorkDone(queue, &work_done_callback_info);

        while (!g_work_done) {
            zwgpuInstanceProcessEvents(instance);
            std.time.sleep(1000000); // 1ms
        }

        // Map buffer for reading
        g_map_ready = false;
        const map_callback_info = c.WGPUBufferMapCallbackInfo{
            .nextInChain = null,
            .mode = c.WGPUCallbackMode_AllowProcessEvents,
            .callback = mapCallback,
            .userdata1 = null,
            .userdata2 = null,
        };
        _ = zwgpuBufferMapAsync(readback_buffer, c.WGPUMapMode_Read, 0, readback_buffer_size, &map_callback_info);

        while (!g_map_ready) {
            zwgpuInstanceProcessEvents(instance);
            std.time.sleep(1000000); // 1ms
        }

        // Unmap buffer
        zwgpuBufferUnmap(readback_buffer);

        // Sleep briefly
        std.time.sleep(100000000); // 100ms
    }

    print("--- Example Finished ---\n", .{});
}
