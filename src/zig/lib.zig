const std = @import("std");

// Import C headers from webgpu.h
const c = @cImport({
    @cInclude("dawn/webgpu.h");
});

// --- Instance Functions ---

pub export fn zwgpuCreateInstance(descriptor: ?*const c.WGPUInstanceDescriptor) c.WGPUInstance {
    return c.wgpuCreateInstance(descriptor);
}

pub export fn zwgpuInstanceRelease(instance: c.WGPUInstance) void {
    c.wgpuInstanceRelease(instance);
}

pub export fn zwgpuInstanceRequestAdapter(
    instance: c.WGPUInstance,
    options: ?*const c.WGPURequestAdapterOptions,
    callback_info_ptr: *const c.WGPURequestAdapterCallbackInfo,
) u64 {
    const future = c.wgpuInstanceRequestAdapter(instance, options, callback_info_ptr.*);
    return future.id;
}

pub export fn zwgpuInstanceCreateSurface(instance: c.WGPUInstance, descriptor: *const c.WGPUSurfaceDescriptor) c.WGPUSurface {
    return c.wgpuInstanceCreateSurface(instance, descriptor);
}

pub export fn zwgpuInstanceProcessEvents(instance: c.WGPUInstance) void {
    c.wgpuInstanceProcessEvents(instance);
}

pub export fn zwgpuInstanceWaitAny(instance: c.WGPUInstance, future_count: u64, futures: [*]c.WGPUFutureWaitInfo, timeout_ns: u64) c.WGPUWaitStatus {
    return c.wgpuInstanceWaitAny(instance, @intCast(future_count), futures, timeout_ns);
}

pub export fn zwgpuInstanceAddRef(instance: c.WGPUInstance) void {
    c.wgpuInstanceAddRef(instance);
}

// --- Adapter Functions ---

pub export fn zwgpuAdapterRelease(adapter: c.WGPUAdapter) void {
    c.wgpuAdapterRelease(adapter);
}

pub export fn zwgpuAdapterGetInfo(adapter: c.WGPUAdapter, info_ptr: *c.WGPUAdapterInfo) c.WGPUStatus {
    return c.wgpuAdapterGetInfo(adapter, info_ptr);
}

pub export fn zwgpuAdapterRequestDevice(
    adapter: c.WGPUAdapter,
    descriptor: ?*const c.WGPUDeviceDescriptor,
    callback_info_ptr: *const c.WGPURequestDeviceCallbackInfo,
) u64 {
    const future = c.wgpuAdapterRequestDevice(adapter, descriptor, callback_info_ptr.*);
    return future.id;
}

pub export fn zwgpuAdapterCreateDevice(adapter: c.WGPUAdapter, descriptor: ?*const c.WGPUDeviceDescriptor) c.WGPUDevice {
    return c.wgpuAdapterCreateDevice(adapter, descriptor);
}

// Note: Same Linux issue as with device features - Dawn frees the features array prematurely
pub export fn zwgpuAdapterGetFeatures(adapter: c.WGPUAdapter, js_features_struct_ptr: *c.WGPUSupportedFeatures) void {
    var temp_dawn_features_struct: c.WGPUSupportedFeatures = undefined;
    c.wgpuAdapterGetFeatures(adapter, &temp_dawn_features_struct);

    if (temp_dawn_features_struct.featureCount > 0 and temp_dawn_features_struct.features != null) {
        const dawn_features_slice = temp_dawn_features_struct.features[0..temp_dawn_features_struct.featureCount];

        js_features_struct_ptr.featureCount = temp_dawn_features_struct.featureCount;
        const mutable_features: [*]c.WGPUFeatureName = @ptrCast(@constCast(js_features_struct_ptr.features));
        @memcpy(mutable_features[0..temp_dawn_features_struct.featureCount], dawn_features_slice);
    } else {
        js_features_struct_ptr.featureCount = 0;
        js_features_struct_ptr.features = null;
    }

    c.wgpuSupportedFeaturesFreeMembers(temp_dawn_features_struct);
}

pub export fn zwgpuAdapterGetLimits(adapter: c.WGPUAdapter, limits: *c.WGPULimits) c.WGPUStatus {
    return c.wgpuAdapterGetLimits(adapter, limits);
}

// --- Device Functions ---

pub export fn zwgpuDeviceRelease(device: c.WGPUDevice) void {
    c.wgpuDeviceRelease(device);
}

pub export fn zwgpuDeviceGetAdapterInfo(device: c.WGPUDevice, info_ptr: *c.WGPUAdapterInfo) c.WGPUStatus {
    return c.wgpuDeviceGetAdapterInfo(device, info_ptr);
}

pub export fn zwgpuDeviceGetQueue(device: c.WGPUDevice) c.WGPUQueue {
    return c.wgpuDeviceGetQueue(device);
}

pub export fn zwgpuDeviceCreateBuffer(device: c.WGPUDevice, descriptor: *const c.WGPUBufferDescriptor) c.WGPUBuffer {
    return c.wgpuDeviceCreateBuffer(device, descriptor);
}

pub export fn zwgpuDeviceCreateTexture(device: c.WGPUDevice, descriptor: *const c.WGPUTextureDescriptor) c.WGPUTexture {
    return c.wgpuDeviceCreateTexture(device, descriptor);
}

pub export fn zwgpuDeviceCreateSampler(device: c.WGPUDevice, descriptor: ?*const c.WGPUSamplerDescriptor) c.WGPUSampler {
    return c.wgpuDeviceCreateSampler(device, descriptor);
}

pub export fn zwgpuDeviceCreateShaderModule(device: c.WGPUDevice, descriptor: *const c.WGPUShaderModuleDescriptor) c.WGPUShaderModule {
    return c.wgpuDeviceCreateShaderModule(device, descriptor);
}

pub export fn zwgpuDeviceCreateBindGroupLayout(device: c.WGPUDevice, descriptor: *const c.WGPUBindGroupLayoutDescriptor) c.WGPUBindGroupLayout {
    return c.wgpuDeviceCreateBindGroupLayout(device, descriptor);
}

pub export fn zwgpuDeviceCreateBindGroup(device: c.WGPUDevice, descriptor: *const c.WGPUBindGroupDescriptor) c.WGPUBindGroup {
    return c.wgpuDeviceCreateBindGroup(device, descriptor);
}

pub export fn zwgpuDeviceCreatePipelineLayout(device: c.WGPUDevice, descriptor: *const c.WGPUPipelineLayoutDescriptor) c.WGPUPipelineLayout {
    return c.wgpuDeviceCreatePipelineLayout(device, descriptor);
}

pub export fn zwgpuDeviceCreateRenderPipeline(device: c.WGPUDevice, descriptor: *const c.WGPURenderPipelineDescriptor) c.WGPURenderPipeline {
    return c.wgpuDeviceCreateRenderPipeline(device, descriptor);
}

pub export fn zwgpuDeviceCreateComputePipeline(device: c.WGPUDevice, descriptor: *const c.WGPUComputePipelineDescriptor) c.WGPUComputePipeline {
    return c.wgpuDeviceCreateComputePipeline(device, descriptor);
}

pub export fn zwgpuDeviceCreateCommandEncoder(device: c.WGPUDevice, descriptor: ?*const c.WGPUCommandEncoderDescriptor) c.WGPUCommandEncoder {
    return c.wgpuDeviceCreateCommandEncoder(device, descriptor);
}

pub export fn zwgpuDeviceCreateQuerySet(device: c.WGPUDevice, descriptor: *const c.WGPUQuerySetDescriptor) c.WGPUQuerySet {
    return c.wgpuDeviceCreateQuerySet(device, descriptor);
}

pub export fn zwgpuDeviceGetLimits(device: c.WGPUDevice, limits: *c.WGPULimits) c.WGPUStatus {
    return c.wgpuDeviceGetLimits(device, limits);
}

pub export fn zwgpuDeviceHasFeature(device: c.WGPUDevice, feature: c.WGPUFeatureName) bool {
    return c.wgpuDeviceHasFeature(device, feature) != 0;
}

// Note: On linux the u32 features array allocated by dawn is freed again when leaving the boundary,
// even though it should be kept until freed via wgpuSupportedFeaturesFreeMembers,
// that is why we copy it to the js heap.
pub export fn zwgpuDeviceGetFeatures(device: c.WGPUDevice, js_features_struct_ptr: *c.WGPUSupportedFeatures) void {
    var temp_dawn_features_struct: c.WGPUSupportedFeatures = undefined;
    c.wgpuDeviceGetFeatures(device, &temp_dawn_features_struct);

    if (temp_dawn_features_struct.featureCount > 0 and temp_dawn_features_struct.features != null) {
        const dawn_features_slice = temp_dawn_features_struct.features[0..temp_dawn_features_struct.featureCount];

        js_features_struct_ptr.featureCount = temp_dawn_features_struct.featureCount;
        const mutable_features: [*]c.WGPUFeatureName = @ptrCast(@constCast(js_features_struct_ptr.features));
        @memcpy(mutable_features[0..temp_dawn_features_struct.featureCount], dawn_features_slice);
    } else {
        js_features_struct_ptr.featureCount = 0;
        js_features_struct_ptr.features = null;
    }

    c.wgpuSupportedFeaturesFreeMembers(temp_dawn_features_struct);
}

pub export fn zwgpuDevicePushErrorScope(device: c.WGPUDevice, filter: c.WGPUErrorFilter) void {
    c.wgpuDevicePushErrorScope(device, filter);
}

pub export fn zwgpuDevicePopErrorScope(device: c.WGPUDevice, callback_info_ptr: *const c.WGPUPopErrorScopeCallbackInfo) u64 {
    const future = c.wgpuDevicePopErrorScope(device, callback_info_ptr.*);
    return future.id;
}

pub export fn zwgpuDeviceTick(device: c.WGPUDevice) void {
    c.wgpuDeviceTick(device);
}

pub export fn zwgpuDeviceDestroy(device: c.WGPUDevice) void {
    c.wgpuDeviceDestroy(device);
}

pub export fn zwgpuDeviceInjectError(device: c.WGPUDevice, error_type: c.WGPUErrorType, message_view_ptr: *const c.WGPUStringView) void {
    c.wgpuDeviceInjectError(device, error_type, message_view_ptr.*);
}

pub export fn zwgpuDeviceCreateComputePipelineAsync(
    device: c.WGPUDevice,
    descriptor: *const c.WGPUComputePipelineDescriptor,
    callback_info_ptr: *const c.WGPUCreateComputePipelineAsyncCallbackInfo,
) u64 {
    const future = c.wgpuDeviceCreateComputePipelineAsync(device, descriptor, callback_info_ptr.*);
    return future.id;
}

pub export fn zwgpuDeviceCreateRenderPipelineAsync(
    device: c.WGPUDevice,
    descriptor: *const c.WGPURenderPipelineDescriptor,
    callback_info_ptr: *const c.WGPUCreateRenderPipelineAsyncCallbackInfo,
) u64 {
    const future = c.wgpuDeviceCreateRenderPipelineAsync(device, descriptor, callback_info_ptr.*);
    return future.id;
}

// --- Queue Functions ---

pub export fn zwgpuQueueRelease(queue: c.WGPUQueue) void {
    c.wgpuQueueRelease(queue);
}

pub export fn zwgpuQueueSubmit(queue: c.WGPUQueue, command_count: u64, commands: [*]const c.WGPUCommandBuffer) void {
    c.wgpuQueueSubmit(queue, @intCast(command_count), commands);
}

pub export fn zwgpuQueueWriteBuffer(queue: c.WGPUQueue, buffer: c.WGPUBuffer, buffer_offset: u64, data: ?*const anyopaque, size: u64) void {
    c.wgpuQueueWriteBuffer(queue, buffer, buffer_offset, data, @intCast(size));
}

pub export fn zwgpuQueueWriteTexture(queue: c.WGPUQueue, destination: *const c.WGPUTexelCopyTextureInfo, data: ?*const anyopaque, data_size: u64, data_layout: *const c.WGPUTexelCopyBufferLayout, write_size: *const c.WGPUExtent3D) void {
    c.wgpuQueueWriteTexture(queue, destination, data, @intCast(data_size), data_layout, write_size);
}

pub export fn zwgpuQueueOnSubmittedWorkDone(queue: c.WGPUQueue, callback_info_ptr: *const c.WGPUQueueWorkDoneCallbackInfo) u64 {
    const future = c.wgpuQueueOnSubmittedWorkDone(queue, callback_info_ptr.*);
    return future.id;
}

// --- Buffer Functions ---

pub export fn zwgpuBufferMapAsync(
    buffer: c.WGPUBuffer,
    mode: c.WGPUMapMode,
    offset: u64,
    size: u64,
    callback_info_ptr: *const c.WGPUBufferMapCallbackInfo,
) u64 {
    const future = c.wgpuBufferMapAsync(buffer, mode, offset, size, callback_info_ptr.*);
    return future.id;
}

pub export fn zwgpuBufferUnmap(buffer: c.WGPUBuffer) void {
    c.wgpuBufferUnmap(buffer);
}

pub export fn zwgpuBufferRelease(buffer: c.WGPUBuffer) void {
    c.wgpuBufferRelease(buffer);
}

pub export fn zwgpuBufferGetMappedRange(buffer: c.WGPUBuffer, offset: u64, size: u64) ?*anyopaque {
    return c.wgpuBufferGetMappedRange(buffer, @intCast(offset), @intCast(size));
}

pub export fn zwgpuBufferGetConstMappedRange(buffer: c.WGPUBuffer, offset: u64, size: u64) ?*const anyopaque {
    return c.wgpuBufferGetConstMappedRange(buffer, @intCast(offset), @intCast(size));
}

pub export fn zwgpuBufferDestroy(buffer: c.WGPUBuffer) void {
    c.wgpuBufferDestroy(buffer);
}

// --- Texture Functions ---

pub export fn zwgpuTextureCreateView(texture: c.WGPUTexture, descriptor: ?*const c.WGPUTextureViewDescriptor) c.WGPUTextureView {
    return c.wgpuTextureCreateView(texture, descriptor);
}

pub export fn zwgpuTextureDestroy(texture: c.WGPUTexture) void {
    c.wgpuTextureDestroy(texture);
}

pub export fn zwgpuTextureRelease(texture: c.WGPUTexture) void {
    c.wgpuTextureRelease(texture);
}

// --- TextureView Functions ---

pub export fn zwgpuTextureViewRelease(texture_view: c.WGPUTextureView) void {
    c.wgpuTextureViewRelease(texture_view);
}

// --- Sampler Functions ---

pub export fn zwgpuSamplerRelease(sampler: c.WGPUSampler) void {
    c.wgpuSamplerRelease(sampler);
}

// --- ShaderModule Functions ---

pub export fn zwgpuShaderModuleGetCompilationInfo(shader_module: c.WGPUShaderModule, callback_info_ptr: *const c.WGPUCompilationInfoCallbackInfo) u64 {
    const future = c.wgpuShaderModuleGetCompilationInfo(shader_module, callback_info_ptr.*);
    return future.id;
}

pub export fn zwgpuShaderModuleRelease(shader_module: c.WGPUShaderModule) void {
    c.wgpuShaderModuleRelease(shader_module);
}

// --- BindGroupLayout Functions ---

pub export fn zwgpuBindGroupLayoutRelease(bind_group_layout: c.WGPUBindGroupLayout) void {
    c.wgpuBindGroupLayoutRelease(bind_group_layout);
}

// --- BindGroup Functions ---

pub export fn zwgpuBindGroupRelease(bind_group: c.WGPUBindGroup) void {
    c.wgpuBindGroupRelease(bind_group);
}

// --- PipelineLayout Functions ---

pub export fn zwgpuPipelineLayoutRelease(pipeline_layout: c.WGPUPipelineLayout) void {
    c.wgpuPipelineLayoutRelease(pipeline_layout);
}

// --- QuerySet Functions ---

pub export fn zwgpuQuerySetDestroy(query_set: c.WGPUQuerySet) void {
    c.wgpuQuerySetDestroy(query_set);
}

pub export fn zwgpuQuerySetRelease(query_set: c.WGPUQuerySet) void {
    c.wgpuQuerySetRelease(query_set);
}

// --- RenderPipeline Functions ---

pub export fn zwgpuRenderPipelineRelease(render_pipeline: c.WGPURenderPipeline) void {
    c.wgpuRenderPipelineRelease(render_pipeline);
}

// --- ComputePipeline Functions ---

pub export fn zwgpuComputePipelineRelease(compute_pipeline: c.WGPUComputePipeline) void {
    c.wgpuComputePipelineRelease(compute_pipeline);
}

pub export fn zwgpuComputePipelineGetBindGroupLayout(compute_pipeline: c.WGPUComputePipeline, group_index: u32) c.WGPUBindGroupLayout {
    return c.wgpuComputePipelineGetBindGroupLayout(compute_pipeline, group_index);
}

// --- CommandEncoder Functions ---

pub export fn zwgpuCommandEncoderBeginRenderPass(encoder: c.WGPUCommandEncoder, descriptor: *const c.WGPURenderPassDescriptor) c.WGPURenderPassEncoder {
    return c.wgpuCommandEncoderBeginRenderPass(encoder, descriptor);
}

pub export fn zwgpuCommandEncoderBeginComputePass(encoder: c.WGPUCommandEncoder, descriptor: ?*const c.WGPUComputePassDescriptor) c.WGPUComputePassEncoder {
    return c.wgpuCommandEncoderBeginComputePass(encoder, descriptor);
}

pub export fn zwgpuCommandEncoderClearBuffer(encoder: c.WGPUCommandEncoder, buffer: c.WGPUBuffer, offset: u64, size: u64) void {
    c.wgpuCommandEncoderClearBuffer(encoder, buffer, offset, size);
}

pub export fn zwgpuCommandEncoderCopyBufferToBuffer(encoder: c.WGPUCommandEncoder, source: c.WGPUBuffer, source_offset: u64, destination: c.WGPUBuffer, destination_offset: u64, size: u64) void {
    c.wgpuCommandEncoderCopyBufferToBuffer(encoder, source, source_offset, destination, destination_offset, size);
}

pub export fn zwgpuCommandEncoderCopyBufferToTexture(encoder: c.WGPUCommandEncoder, source: *const c.WGPUTexelCopyBufferInfo, destination: *const c.WGPUTexelCopyTextureInfo, copy_size: *const c.WGPUExtent3D) void {
    c.wgpuCommandEncoderCopyBufferToTexture(encoder, source, destination, copy_size);
}

pub export fn zwgpuCommandEncoderCopyTextureToBuffer(encoder: c.WGPUCommandEncoder, source: *const c.WGPUTexelCopyTextureInfo, destination: *const c.WGPUTexelCopyBufferInfo, copy_size: *const c.WGPUExtent3D) void {
    c.wgpuCommandEncoderCopyTextureToBuffer(encoder, source, destination, copy_size);
}

pub export fn zwgpuCommandEncoderCopyTextureToTexture(encoder: c.WGPUCommandEncoder, source: *const c.WGPUTexelCopyTextureInfo, destination: *const c.WGPUTexelCopyTextureInfo, copy_size: *const c.WGPUExtent3D) void {
    c.wgpuCommandEncoderCopyTextureToTexture(encoder, source, destination, copy_size);
}

pub export fn zwgpuCommandEncoderFinish(encoder: c.WGPUCommandEncoder, descriptor: ?*const c.WGPUCommandBufferDescriptor) c.WGPUCommandBuffer {
    return c.wgpuCommandEncoderFinish(encoder, descriptor);
}

pub export fn zwgpuCommandEncoderRelease(encoder: c.WGPUCommandEncoder) void {
    c.wgpuCommandEncoderRelease(encoder);
}

// --- RenderPassEncoder Functions ---

pub export fn zwgpuRenderPassEncoderSetScissorRect(encoder: c.WGPURenderPassEncoder, x: u32, y: u32, width: u32, height: u32) void {
    c.wgpuRenderPassEncoderSetScissorRect(encoder, x, y, width, height);
}

pub export fn zwgpuRenderPassEncoderSetViewport(encoder: c.WGPURenderPassEncoder, x: f32, y: f32, width: f32, height: f32, min_depth: f32, max_depth: f32) void {
    c.wgpuRenderPassEncoderSetViewport(encoder, x, y, width, height, min_depth, max_depth);
}

pub export fn zwgpuRenderPassEncoderSetPipeline(encoder: c.WGPURenderPassEncoder, pipeline: c.WGPURenderPipeline) void {
    c.wgpuRenderPassEncoderSetPipeline(encoder, pipeline);
}

pub export fn zwgpuRenderPassEncoderSetBindGroup(encoder: c.WGPURenderPassEncoder, group_index: u32, group: c.WGPUBindGroup, dynamic_offset_count: u64, dynamic_offsets: ?*const u32) void {
    c.wgpuRenderPassEncoderSetBindGroup(encoder, group_index, group, @intCast(dynamic_offset_count), dynamic_offsets);
}

pub export fn zwgpuRenderPassEncoderSetVertexBuffer(encoder: c.WGPURenderPassEncoder, slot: u32, buffer: c.WGPUBuffer, offset: u64, size: u64) void {
    c.wgpuRenderPassEncoderSetVertexBuffer(encoder, slot, buffer, offset, size);
}

pub export fn zwgpuRenderPassEncoderSetIndexBuffer(encoder: c.WGPURenderPassEncoder, buffer: c.WGPUBuffer, format: c.WGPUIndexFormat, offset: u64, size: u64) void {
    c.wgpuRenderPassEncoderSetIndexBuffer(encoder, buffer, format, offset, size);
}

pub export fn zwgpuRenderPassEncoderDraw(encoder: c.WGPURenderPassEncoder, vertex_count: u32, instance_count: u32, first_vertex: u32, first_instance: u32) void {
    c.wgpuRenderPassEncoderDraw(encoder, vertex_count, instance_count, first_vertex, first_instance);
}

pub export fn zwgpuRenderPassEncoderDrawIndexed(encoder: c.WGPURenderPassEncoder, index_count: u32, instance_count: u32, first_index: u32, base_vertex: i32, first_instance: u32) void {
    c.wgpuRenderPassEncoderDrawIndexed(encoder, index_count, instance_count, first_index, base_vertex, first_instance);
}

pub export fn zwgpuRenderPassEncoderEnd(encoder: c.WGPURenderPassEncoder) void {
    c.wgpuRenderPassEncoderEnd(encoder);
}

pub export fn zwgpuRenderPassEncoderRelease(encoder: c.WGPURenderPassEncoder) void {
    c.wgpuRenderPassEncoderRelease(encoder);
}

// --- ComputePassEncoder Functions ---

pub export fn zwgpuComputePassEncoderSetPipeline(encoder: c.WGPUComputePassEncoder, pipeline: c.WGPUComputePipeline) void {
    c.wgpuComputePassEncoderSetPipeline(encoder, pipeline);
}

pub export fn zwgpuComputePassEncoderSetBindGroup(encoder: c.WGPUComputePassEncoder, group_index: u32, group: c.WGPUBindGroup, dynamic_offset_count: u64, dynamic_offsets: ?*const u32) void {
    c.wgpuComputePassEncoderSetBindGroup(encoder, group_index, group, @intCast(dynamic_offset_count), dynamic_offsets);
}

pub export fn zwgpuComputePassEncoderDispatchWorkgroups(encoder: c.WGPUComputePassEncoder, count_x: u32, count_y: u32, count_z: u32) void {
    c.wgpuComputePassEncoderDispatchWorkgroups(encoder, count_x, count_y, count_z);
}

pub export fn zwgpuComputePassEncoderDispatchWorkgroupsIndirect(encoder: c.WGPUComputePassEncoder, indirect_buffer: c.WGPUBuffer, indirect_offset: u64) void {
    c.wgpuComputePassEncoderDispatchWorkgroupsIndirect(encoder, indirect_buffer, indirect_offset);
}

pub export fn zwgpuComputePassEncoderEnd(encoder: c.WGPUComputePassEncoder) void {
    c.wgpuComputePassEncoderEnd(encoder);
}

pub export fn zwgpuComputePassEncoderRelease(encoder: c.WGPUComputePassEncoder) void {
    c.wgpuComputePassEncoderRelease(encoder);
}

// --- CommandBuffer Functions ---

pub export fn zwgpuCommandBufferRelease(command_buffer: c.WGPUCommandBuffer) void {
    c.wgpuCommandBufferRelease(command_buffer);
}

// --- Surface Functions ---

pub export fn zwgpuSurfaceConfigure(surface: c.WGPUSurface, config: *const c.WGPUSurfaceConfiguration) void {
    c.wgpuSurfaceConfigure(surface, config);
}

pub export fn zwgpuSurfaceUnconfigure(surface: c.WGPUSurface) void {
    c.wgpuSurfaceUnconfigure(surface);
}

pub export fn zwgpuSurfaceGetCurrentTexture(surface: c.WGPUSurface, surface_texture: *c.WGPUSurfaceTexture) void {
    c.wgpuSurfaceGetCurrentTexture(surface, surface_texture);
}

pub export fn zwgpuSurfacePresent(surface: c.WGPUSurface) void {
    c.wgpuSurfacePresent(surface);
}

pub export fn zwgpuSurfaceRelease(surface: c.WGPUSurface) void {
    c.wgpuSurfaceRelease(surface);
}

// --- Freeing Functions ---

pub export fn zwgpuAdapterInfoFreeMembers(value_ptr: *const c.WGPUAdapterInfo) void {
    c.wgpuAdapterInfoFreeMembers(value_ptr.*);
}

pub export fn zwgpuSurfaceCapabilitiesFreeMembers(value_ptr: *const c.WGPUSurfaceCapabilities) void {
    c.wgpuSurfaceCapabilitiesFreeMembers(value_ptr.*);
}

pub export fn zwgpuSupportedFeaturesFreeMembers(value_ptr: *const c.WGPUSupportedFeatures) void {
    c.wgpuSupportedFeaturesFreeMembers(value_ptr.*);
}

pub export fn zwgpuSharedBufferMemoryEndAccessStateFreeMembers(value_ptr: *const c.WGPUSharedBufferMemoryEndAccessState) void {
    c.wgpuSharedBufferMemoryEndAccessStateFreeMembers(value_ptr.*);
}

pub export fn zwgpuSharedTextureMemoryEndAccessStateFreeMembers(value_ptr: *const c.WGPUSharedTextureMemoryEndAccessState) void {
    c.wgpuSharedTextureMemoryEndAccessStateFreeMembers(value_ptr.*);
}
