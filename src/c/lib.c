#include <stdbool.h>
#include "webgpu.h"
#include <stdlib.h>
#include <string.h>
#include <stdint.h>
#include <stdio.h>

// NOTE: This just wraps the Dawn WebGPU C API, as bun-ffi currently doesn't support passing structs by value.
// This is a temporary solution until bun-ffi supports passing structs by value.

// --- Instance Functions ---

WGPU_EXPORT WGPUInstance zwgpuCreateInstance(const WGPUInstanceDescriptor* descriptor) {
    return wgpuCreateInstance(descriptor);
}

WGPU_EXPORT void zwgpuInstanceRelease(WGPUInstance instance) {
    wgpuInstanceRelease(instance);
}

WGPU_EXPORT uint64_t zwgpuInstanceRequestAdapter(
    WGPUInstance instance,
    const WGPURequestAdapterOptions* options,
    const WGPURequestAdapterCallbackInfo* callback_info_ptr
) {
    if (callback_info_ptr == NULL) {
        printf("[C WRAPPER ERROR] zwgpuInstanceRequestAdapter: callback_info_ptr is NULL!\n");
        WGPUFuture dummy_future = {0};
        return dummy_future.id;
    }
    WGPUFuture future = wgpuInstanceRequestAdapter(instance, options, *callback_info_ptr);
    return future.id;
}

WGPU_EXPORT WGPUSurface zwgpuInstanceCreateSurface(WGPUInstance instance, const WGPUSurfaceDescriptor* descriptor) {
    return wgpuInstanceCreateSurface(instance, descriptor);
}

WGPU_EXPORT void zwgpuInstanceProcessEvents(WGPUInstance instance) {
    wgpuInstanceProcessEvents(instance);
}

WGPU_EXPORT WGPUWaitStatus zwgpuInstanceWaitAny(WGPUInstance instance, uint64_t future_count, WGPUFutureWaitInfo* futures, uint64_t timeout_ns) {
    return wgpuInstanceWaitAny(instance, (size_t)future_count, futures, timeout_ns);
}

WGPU_EXPORT void zwgpuInstanceAddRef(WGPUInstance instance) {
    wgpuInstanceAddRef(instance);
}

// --- Adapter Functions ---

WGPU_EXPORT void zwgpuAdapterRelease(WGPUAdapter adapter) {
    wgpuAdapterRelease(adapter);
}

WGPU_EXPORT WGPUStatus zwgpuAdapterGetInfo(WGPUAdapter adapter, WGPUAdapterInfo* info_ptr) {
    return wgpuAdapterGetInfo(adapter, info_ptr);
}

WGPU_EXPORT uint64_t zwgpuAdapterRequestDevice(
    WGPUAdapter adapter,
    const WGPUDeviceDescriptor* descriptor,
    const WGPURequestDeviceCallbackInfo* callback_info_ptr
) {
    if (callback_info_ptr == NULL) {
        printf("[C WRAPPER ERROR] zwgpuAdapterRequestDevice: callback_info_ptr is NULL!\n");
        WGPUFuture dummy_future = {0};
        return dummy_future.id;
    }
    WGPUFuture future = wgpuAdapterRequestDevice(adapter, descriptor, *callback_info_ptr);
    return future.id;
}

WGPU_EXPORT WGPUDevice zwgpuAdapterCreateDevice(WGPUAdapter adapter, const WGPUDeviceDescriptor* descriptor) {
    return wgpuAdapterCreateDevice(adapter, descriptor);
}

WGPU_EXPORT void zwgpuAdapterGetFeatures(WGPUAdapter adapter, WGPUSupportedFeatures* features) {
    wgpuAdapterGetFeatures(adapter, features);
}

WGPU_EXPORT WGPUStatus zwgpuAdapterGetLimits(WGPUAdapter adapter, WGPULimits* limits) {
    return wgpuAdapterGetLimits(adapter, limits);
}

// --- Device Functions ---

WGPU_EXPORT void zwgpuDeviceRelease(WGPUDevice device) {
    wgpuDeviceRelease(device);
}

WGPU_EXPORT WGPUQueue zwgpuDeviceGetQueue(WGPUDevice device) {
    return wgpuDeviceGetQueue(device);
}

WGPU_EXPORT WGPUBuffer zwgpuDeviceCreateBuffer(WGPUDevice device, const WGPUBufferDescriptor* descriptor) {
    return wgpuDeviceCreateBuffer(device, descriptor);
}

WGPU_EXPORT WGPUTexture zwgpuDeviceCreateTexture(WGPUDevice device, const WGPUTextureDescriptor* descriptor) {
    return wgpuDeviceCreateTexture(device, descriptor);
}

WGPU_EXPORT WGPUSampler zwgpuDeviceCreateSampler(WGPUDevice device, const WGPUSamplerDescriptor* descriptor) {
    return wgpuDeviceCreateSampler(device, descriptor);
}

WGPU_EXPORT WGPUShaderModule zwgpuDeviceCreateShaderModule(WGPUDevice device, const WGPUShaderModuleDescriptor* descriptor) {
    return wgpuDeviceCreateShaderModule(device, descriptor);
}

WGPU_EXPORT WGPUBindGroupLayout zwgpuDeviceCreateBindGroupLayout(WGPUDevice device, const WGPUBindGroupLayoutDescriptor* descriptor) {
    return wgpuDeviceCreateBindGroupLayout(device, descriptor);
}

WGPU_EXPORT WGPUBindGroup zwgpuDeviceCreateBindGroup(WGPUDevice device, const WGPUBindGroupDescriptor* descriptor) {
    return wgpuDeviceCreateBindGroup(device, descriptor);
}

WGPU_EXPORT WGPUPipelineLayout zwgpuDeviceCreatePipelineLayout(WGPUDevice device, const WGPUPipelineLayoutDescriptor* descriptor) {
    return wgpuDeviceCreatePipelineLayout(device, descriptor);
}

WGPU_EXPORT WGPURenderPipeline zwgpuDeviceCreateRenderPipeline(WGPUDevice device, const WGPURenderPipelineDescriptor* descriptor) {
    return wgpuDeviceCreateRenderPipeline(device, descriptor);
}

WGPU_EXPORT WGPUComputePipeline zwgpuDeviceCreateComputePipeline(WGPUDevice device, const WGPUComputePipelineDescriptor* descriptor) {
    return wgpuDeviceCreateComputePipeline(device, descriptor);
}

WGPU_EXPORT WGPUCommandEncoder zwgpuDeviceCreateCommandEncoder(WGPUDevice device, const WGPUCommandEncoderDescriptor* descriptor) {
    return wgpuDeviceCreateCommandEncoder(device, descriptor);
}

WGPU_EXPORT WGPUQuerySet zwgpuDeviceCreateQuerySet(WGPUDevice device, const WGPUQuerySetDescriptor* descriptor) {
    return wgpuDeviceCreateQuerySet(device, descriptor);
}

WGPU_EXPORT WGPUStatus zwgpuDeviceGetLimits(WGPUDevice device, WGPULimits* limits) {
    return wgpuDeviceGetLimits(device, limits);
}

WGPU_EXPORT bool zwgpuDeviceHasFeature(WGPUDevice device, WGPUFeatureName feature) {
    return wgpuDeviceHasFeature(device, feature); // wgpuDeviceHasFeature returns WGPUBool which is compatible with bool
}

WGPU_EXPORT void zwgpuDeviceGetFeatures(WGPUDevice device, WGPUSupportedFeatures* js_features_struct_ptr) {
    WGPUSupportedFeatures temp_dawn_features_struct;
    wgpuDeviceGetFeatures(device, &temp_dawn_features_struct);

    if (temp_dawn_features_struct.featureCount > 0 && temp_dawn_features_struct.features != NULL) {
        memcpy((void *)js_features_struct_ptr->features, temp_dawn_features_struct.features, sizeof(WGPUFeatureName) * temp_dawn_features_struct.featureCount);

        js_features_struct_ptr->featureCount = temp_dawn_features_struct.featureCount;
    } else {
        js_features_struct_ptr->featureCount = 0;
        js_features_struct_ptr->features = NULL;
    }

    wgpuSupportedFeaturesFreeMembers(temp_dawn_features_struct);
}

WGPU_EXPORT void zwgpuDevicePushErrorScope(WGPUDevice device, WGPUErrorFilter filter) {
    wgpuDevicePushErrorScope(device, filter);
}

WGPU_EXPORT uint64_t zwgpuDevicePopErrorScope(WGPUDevice device, const WGPUPopErrorScopeCallbackInfo* callback_info_ptr) {
    if (callback_info_ptr == NULL) {
        printf("[C WRAPPER ERROR] zwgpuDevicePopErrorScope: callback_info_ptr is NULL!\n");
        WGPUFuture dummy_future = {0};
        return dummy_future.id;
    }
    WGPUFuture future = wgpuDevicePopErrorScope(device, *callback_info_ptr);
    return future.id;
}

WGPU_EXPORT void zwgpuDeviceTick(WGPUDevice device) {
    wgpuDeviceTick(device);
}

WGPU_EXPORT void zwgpuDeviceDestroy(WGPUDevice device) {
    wgpuDeviceDestroy(device);
}

// --- Queue Functions ---

WGPU_EXPORT void zwgpuQueueRelease(WGPUQueue queue) {
    wgpuQueueRelease(queue);
}

WGPU_EXPORT void zwgpuQueueSubmit(WGPUQueue queue, uint64_t command_count, const WGPUCommandBuffer* commands) {
    wgpuQueueSubmit(queue, (size_t)command_count, commands);
}

WGPU_EXPORT void zwgpuQueueWriteBuffer(WGPUQueue queue, WGPUBuffer buffer, uint64_t buffer_offset, const void* data, uint64_t size) {
    wgpuQueueWriteBuffer(queue, buffer, buffer_offset, data, (size_t)size);
}

WGPU_EXPORT void zwgpuQueueWriteTexture(WGPUQueue queue, const WGPUTexelCopyTextureInfo* destination, const void* data, size_t data_size, const WGPUTexelCopyBufferLayout* data_layout, const WGPUExtent3D* write_size) {
    wgpuQueueWriteTexture(queue, destination, data, data_size, data_layout, write_size);
}

WGPU_EXPORT uint64_t zwgpuQueueOnSubmittedWorkDone(WGPUQueue queue, const WGPUQueueWorkDoneCallbackInfo* callback_info_ptr) {
    if (callback_info_ptr == NULL) {
        printf("[C WRAPPER ERROR] zwgpuQueueOnSubmittedWorkDone: callback_info_ptr is NULL!\n");
        WGPUFuture dummy_future = {0};
        return dummy_future.id;
    }
    WGPUFuture future = wgpuQueueOnSubmittedWorkDone(queue, *callback_info_ptr);
    return future.id;
}

// --- Buffer Functions ---

WGPU_EXPORT uint64_t zwgpuBufferMapAsync(
    WGPUBuffer buffer,
    WGPUMapMode mode,
    uint64_t offset,
    uint64_t size,
    const WGPUBufferMapCallbackInfo* callback_info_ptr
) {
    if (callback_info_ptr == NULL) {
        printf("[C WRAPPER ERROR] zwgpuBufferMapAsync: callback_info_ptr is NULL!\n");
        WGPUFuture dummy_future = {0};
        return dummy_future.id;
    }
    WGPUFuture future = wgpuBufferMapAsync(buffer, mode, offset, size, *callback_info_ptr);
    return future.id;
}

WGPU_EXPORT void zwgpuBufferUnmap(WGPUBuffer buffer) {
    wgpuBufferUnmap(buffer);
}

WGPU_EXPORT void zwgpuBufferRelease(WGPUBuffer buffer) {
    wgpuBufferRelease(buffer);
}

WGPU_EXPORT void* zwgpuBufferGetMappedRange(WGPUBuffer buffer, uint64_t offset, uint64_t size) {
    return wgpuBufferGetMappedRange(buffer, (size_t)offset, (size_t)size);
}

WGPU_EXPORT const void* zwgpuBufferGetConstMappedRange(WGPUBuffer buffer, uint64_t offset, uint64_t size) {
    return wgpuBufferGetConstMappedRange(buffer, (size_t)offset, (size_t)size);
}

WGPU_EXPORT void zwgpuBufferDestroy(WGPUBuffer buffer) {
    wgpuBufferDestroy(buffer);
}

// --- Texture Functions ---

WGPU_EXPORT WGPUTextureView zwgpuTextureCreateView(WGPUTexture texture, const WGPUTextureViewDescriptor* descriptor) {
    return wgpuTextureCreateView(texture, descriptor);
}

WGPU_EXPORT void zwgpuTextureDestroy(WGPUTexture texture) {
    wgpuTextureDestroy(texture);
}

WGPU_EXPORT void zwgpuTextureRelease(WGPUTexture texture) {
    wgpuTextureRelease(texture);
}

// --- TextureView Functions ---

WGPU_EXPORT void zwgpuTextureViewRelease(WGPUTextureView texture_view) {
    wgpuTextureViewRelease(texture_view);
}

// --- Sampler Functions ---

WGPU_EXPORT void zwgpuSamplerRelease(WGPUSampler sampler) {
    wgpuSamplerRelease(sampler);
}

// --- ShaderModule Functions ---

WGPU_EXPORT uint64_t zwgpuShaderModuleGetCompilationInfo(WGPUShaderModule shader_module, const WGPUCompilationInfoCallbackInfo* callback_info_ptr) {
    if (callback_info_ptr == NULL) {
        printf("[C WRAPPER ERROR] zwgpuShaderModuleGetCompilationInfo: callback_info_ptr is NULL!\n");
        WGPUFuture dummy_future = {0};
        return dummy_future.id;
    }
    WGPUFuture future = wgpuShaderModuleGetCompilationInfo(shader_module, *callback_info_ptr);
    return future.id;
}

WGPU_EXPORT void zwgpuShaderModuleRelease(WGPUShaderModule shader_module) {
    wgpuShaderModuleRelease(shader_module);
}

// --- BindGroupLayout Functions ---

WGPU_EXPORT void zwgpuBindGroupLayoutRelease(WGPUBindGroupLayout bind_group_layout) {
    wgpuBindGroupLayoutRelease(bind_group_layout);
}

// --- BindGroup Functions ---

WGPU_EXPORT void zwgpuBindGroupRelease(WGPUBindGroup bind_group) {
    wgpuBindGroupRelease(bind_group);
}

// --- PipelineLayout Functions ---

WGPU_EXPORT void zwgpuPipelineLayoutRelease(WGPUPipelineLayout pipeline_layout) {
    wgpuPipelineLayoutRelease(pipeline_layout);
}

// --- QuerySet Functions ---

WGPU_EXPORT void zwgpuQuerySetDestroy(WGPUQuerySet query_set) {
    wgpuQuerySetDestroy(query_set);
}

WGPU_EXPORT void zwgpuQuerySetRelease(WGPUQuerySet query_set) {
    wgpuQuerySetRelease(query_set);
}

// --- RenderPipeline Functions ---

WGPU_EXPORT void zwgpuRenderPipelineRelease(WGPURenderPipeline render_pipeline) {
    wgpuRenderPipelineRelease(render_pipeline);
}

// --- ComputePipeline Functions ---

WGPU_EXPORT void zwgpuComputePipelineRelease(WGPUComputePipeline compute_pipeline) {
    wgpuComputePipelineRelease(compute_pipeline);
}

// --- CommandEncoder Functions ---

WGPU_EXPORT WGPURenderPassEncoder zwgpuCommandEncoderBeginRenderPass(WGPUCommandEncoder encoder, const WGPURenderPassDescriptor* descriptor) {
    return wgpuCommandEncoderBeginRenderPass(encoder, descriptor);
}

WGPU_EXPORT WGPUComputePassEncoder zwgpuCommandEncoderBeginComputePass(WGPUCommandEncoder encoder, const WGPUComputePassDescriptor* descriptor) {
    return wgpuCommandEncoderBeginComputePass(encoder, descriptor);
}

WGPU_EXPORT void zwgpuCommandEncoderClearBuffer(WGPUCommandEncoder encoder, WGPUBuffer buffer, uint64_t offset, uint64_t size) {
    wgpuCommandEncoderClearBuffer(encoder, buffer, offset, size);
}

WGPU_EXPORT void zwgpuCommandEncoderCopyBufferToBuffer(WGPUCommandEncoder encoder, WGPUBuffer source, uint64_t source_offset, WGPUBuffer destination, uint64_t destination_offset, uint64_t size) {
    wgpuCommandEncoderCopyBufferToBuffer(encoder, source, source_offset, destination, destination_offset, size);
}

WGPU_EXPORT void zwgpuCommandEncoderCopyBufferToTexture(WGPUCommandEncoder encoder, const WGPUTexelCopyBufferInfo* source, const WGPUTexelCopyTextureInfo* destination, const WGPUExtent3D* copy_size) {
    wgpuCommandEncoderCopyBufferToTexture(encoder, source, destination, copy_size);
}

WGPU_EXPORT void zwgpuCommandEncoderCopyTextureToBuffer(WGPUCommandEncoder encoder, const WGPUTexelCopyTextureInfo* source, const WGPUTexelCopyBufferInfo* destination, const WGPUExtent3D* copy_size) {
    wgpuCommandEncoderCopyTextureToBuffer(encoder, source, destination, copy_size);
}

WGPU_EXPORT void zwgpuCommandEncoderCopyTextureToTexture(WGPUCommandEncoder encoder, const WGPUTexelCopyTextureInfo* source, const WGPUTexelCopyTextureInfo* destination, const WGPUExtent3D* copy_size) {
    wgpuCommandEncoderCopyTextureToTexture(encoder, source, destination, copy_size);
}

WGPU_EXPORT WGPUCommandBuffer zwgpuCommandEncoderFinish(WGPUCommandEncoder encoder, const WGPUCommandBufferDescriptor* descriptor) {
    return wgpuCommandEncoderFinish(encoder, descriptor);
}

WGPU_EXPORT void zwgpuCommandEncoderRelease(WGPUCommandEncoder encoder) {
    wgpuCommandEncoderRelease(encoder);
}

// --- RenderPassEncoder Functions ---

WGPU_EXPORT void zwgpuRenderPassEncoderSetScissorRect(WGPURenderPassEncoder encoder, uint32_t x, uint32_t y, uint32_t width, uint32_t height) {
    wgpuRenderPassEncoderSetScissorRect(encoder, x, y, width, height);
}

WGPU_EXPORT void zwgpuRenderPassEncoderSetViewport(WGPURenderPassEncoder encoder, float x, float y, float width, float height, float min_depth, float max_depth) {
    wgpuRenderPassEncoderSetViewport(encoder, x, y, width, height, min_depth, max_depth);
}

WGPU_EXPORT void zwgpuRenderPassEncoderSetPipeline(WGPURenderPassEncoder encoder, WGPURenderPipeline pipeline) {
    wgpuRenderPassEncoderSetPipeline(encoder, pipeline);
}

WGPU_EXPORT void zwgpuRenderPassEncoderSetBindGroup(WGPURenderPassEncoder encoder, uint32_t group_index, WGPUBindGroup group, uint64_t dynamic_offset_count, const uint32_t* dynamic_offsets) {
    wgpuRenderPassEncoderSetBindGroup(encoder, group_index, group, (size_t)dynamic_offset_count, dynamic_offsets);
}

WGPU_EXPORT void zwgpuRenderPassEncoderSetVertexBuffer(WGPURenderPassEncoder encoder, uint32_t slot, WGPUBuffer buffer, uint64_t offset, uint64_t size) {
    wgpuRenderPassEncoderSetVertexBuffer(encoder, slot, buffer, offset, size);
}

WGPU_EXPORT void zwgpuRenderPassEncoderSetIndexBuffer(WGPURenderPassEncoder encoder, WGPUBuffer buffer, WGPUIndexFormat format, uint64_t offset, uint64_t size) {
    wgpuRenderPassEncoderSetIndexBuffer(encoder, buffer, format, offset, size);
}

WGPU_EXPORT void zwgpuRenderPassEncoderDraw(WGPURenderPassEncoder encoder, uint32_t vertex_count, uint32_t instance_count, uint32_t first_vertex, uint32_t first_instance) {
    wgpuRenderPassEncoderDraw(encoder, vertex_count, instance_count, first_vertex, first_instance);
}

WGPU_EXPORT void zwgpuRenderPassEncoderDrawIndexed(WGPURenderPassEncoder encoder, uint32_t index_count, uint32_t instance_count, uint32_t first_index, int32_t base_vertex, uint32_t first_instance) {
    wgpuRenderPassEncoderDrawIndexed(encoder, index_count, instance_count, first_index, base_vertex, first_instance);
}

WGPU_EXPORT void zwgpuRenderPassEncoderEnd(WGPURenderPassEncoder encoder) {
    wgpuRenderPassEncoderEnd(encoder);
}

WGPU_EXPORT void zwgpuRenderPassEncoderRelease(WGPURenderPassEncoder encoder) {
    wgpuRenderPassEncoderRelease(encoder);
}

// --- ComputePassEncoder Functions ---

WGPU_EXPORT void zwgpuComputePassEncoderSetPipeline(WGPUComputePassEncoder encoder, WGPUComputePipeline pipeline) {
    wgpuComputePassEncoderSetPipeline(encoder, pipeline);
}

WGPU_EXPORT void zwgpuComputePassEncoderSetBindGroup(WGPUComputePassEncoder encoder, uint32_t group_index, WGPUBindGroup group, uint64_t dynamic_offset_count, const uint32_t* dynamic_offsets) {
    wgpuComputePassEncoderSetBindGroup(encoder, group_index, group, (size_t)dynamic_offset_count, dynamic_offsets);
}

WGPU_EXPORT void zwgpuComputePassEncoderDispatchWorkgroups(WGPUComputePassEncoder encoder, uint32_t count_x, uint32_t count_y, uint32_t count_z) {
    wgpuComputePassEncoderDispatchWorkgroups(encoder, count_x, count_y, count_z);
}

WGPU_EXPORT void zwgpuComputePassEncoderDispatchWorkgroupsIndirect(WGPUComputePassEncoder encoder, WGPUBuffer indirect_buffer, uint64_t indirect_offset) {
    wgpuComputePassEncoderDispatchWorkgroupsIndirect(encoder, indirect_buffer, indirect_offset);
}

WGPU_EXPORT void zwgpuComputePassEncoderEnd(WGPUComputePassEncoder encoder) {
    wgpuComputePassEncoderEnd(encoder);
}

WGPU_EXPORT void zwgpuComputePassEncoderRelease(WGPUComputePassEncoder encoder) {
    wgpuComputePassEncoderRelease(encoder);
}

// --- CommandBuffer Functions ---

WGPU_EXPORT void zwgpuCommandBufferRelease(WGPUCommandBuffer command_buffer) {
    wgpuCommandBufferRelease(command_buffer);
}

// --- Surface Functions ---

WGPU_EXPORT void zwgpuSurfaceConfigure(WGPUSurface surface, const WGPUSurfaceConfiguration* config) {
    wgpuSurfaceConfigure(surface, config);
}

WGPU_EXPORT void zwgpuSurfaceUnconfigure(WGPUSurface surface) {
    wgpuSurfaceUnconfigure(surface);
}

WGPU_EXPORT void zwgpuSurfaceGetCurrentTexture(WGPUSurface surface, WGPUSurfaceTexture* surface_texture) {
    wgpuSurfaceGetCurrentTexture(surface, surface_texture);
}

WGPU_EXPORT void zwgpuSurfacePresent(WGPUSurface surface) {
    wgpuSurfacePresent(surface);
}

WGPU_EXPORT void zwgpuSurfaceRelease(WGPUSurface surface) {
    wgpuSurfaceRelease(surface);
}

// --- Freeing Functions ---
// These functions take pointers to the structures, matching the Zig API.
// The original webgpu.h functions take the struct by value for wgpu*FreeMembers.
// However, the Zig code passes pointers, so we'll maintain that for the C interface for consistency.

WGPU_EXPORT void zwgpuAdapterInfoFreeMembers(const WGPUAdapterInfo* value_ptr) {
    if (value_ptr == NULL) {
        printf("[C WRAPPER ERROR] zwgpuAdapterInfoFreeMembers: value_ptr is NULL!\n");
        return;
    }
    wgpuAdapterInfoFreeMembers(*value_ptr);
}

WGPU_EXPORT void zwgpuSurfaceCapabilitiesFreeMembers(const WGPUSurfaceCapabilities* value_ptr) {
    if (value_ptr == NULL) {
        printf("[C WRAPPER ERROR] zwgpuSurfaceCapabilitiesFreeMembers: value_ptr is NULL!\n");
        return;
    }
    wgpuSurfaceCapabilitiesFreeMembers(*value_ptr);
}

// This one is already defined and handled in zwgpuDeviceGetFeatures
WGPU_EXPORT void zwgpuSupportedFeaturesFreeMembers(const WGPUSupportedFeatures* value_ptr) {
    if (value_ptr == NULL) {
        printf("[C WRAPPER ERROR] zwgpuSupportedFeaturesFreeMembers: value_ptr is NULL!\n");
        return;
    }
    wgpuSupportedFeaturesFreeMembers(*value_ptr);
}

WGPU_EXPORT void zwgpuSharedBufferMemoryEndAccessStateFreeMembers(const WGPUSharedBufferMemoryEndAccessState* value_ptr) {
    if (value_ptr == NULL) {
        printf("[C WRAPPER ERROR] zwgpuSharedBufferMemoryEndAccessStateFreeMembers: value_ptr is NULL!\n");
        return;
    }
    wgpuSharedBufferMemoryEndAccessStateFreeMembers(*value_ptr);
}

WGPU_EXPORT void zwgpuSharedTextureMemoryEndAccessStateFreeMembers(const WGPUSharedTextureMemoryEndAccessState* value_ptr) {
    if (value_ptr == NULL) {
        printf("[C WRAPPER ERROR] zwgpuSharedTextureMemoryEndAccessStateFreeMembers: value_ptr is NULL!\n");
        return;
    }
    wgpuSharedTextureMemoryEndAccessStateFreeMembers(*value_ptr);
}
