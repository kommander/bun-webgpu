export const expectations = [{
    // CTS expects rgba32float to fail for external texture, but dawn supports it.
    // https://github.com/gpuweb/cts/blob/main/src/webgpu/api/validation/createBindGroup.spec.ts#L1335
    query: 'webgpu:api,validation,createBindGroup:external_texture,texture_view,format:format="rgba32float"',
    expectation: 'skip'
}, {
    // CTS expects postMessage to throw a TypeError if the ArrayBuffer was included in the transfer list.
    // No way to make the array buffer non-transferable currently
    query: 'webgpu:api,operation,buffers,map_ArrayBuffer:postMessage:transfer=true;mapMode="READ"',
    expectation: 'skip'
}, {
    // CTS expects postMessage to throw a TypeError if the ArrayBuffer was included in the transfer list.
    // No way to make the array buffer non-transferable currently
    query: 'webgpu:api,operation,buffers,map_ArrayBuffer:postMessage:transfer=true;mapMode="WRITE"',
    expectation: 'skip'
}]