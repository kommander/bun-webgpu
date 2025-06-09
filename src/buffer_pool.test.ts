import { expect, describe, it } from "bun:test";
import { BufferPool } from "./buffer_pool";

describe("BufferPool", () => {

    describe("constructor", () => {
        it("should create pool with correct parameters", () => {
            const pool = new BufferPool(5, 10, 256);
            
            expect(pool.blockSize).toBe(256);
            expect(pool.minBlockCount).toBe(5);
            expect(pool.maxBlockCount).toBe(10);
            expect(pool.totalBlockCount).toBe(5); // starts with min
            expect(pool.allocatedBlockCount).toBe(0);
            expect(pool.freeBlockCount).toBe(5);
            expect(pool.hasAvailableBlocks).toBe(true);
            expect(pool.utilizationRatio).toBe(0);
        });

        it("should create pool with different sizes", () => {
            const smallPool = new BufferPool(2, 5, 128);
            const largePool = new BufferPool(50, 100, 4096);
            
            expect(smallPool.totalBlockCount).toBe(2);
            expect(smallPool.maxBlockCount).toBe(5);
            expect(smallPool.blockSize).toBe(128);
            
            expect(largePool.totalBlockCount).toBe(50);
            expect(largePool.maxBlockCount).toBe(100);
            expect(largePool.blockSize).toBe(4096);
        });

        it("should throw on invalid min blocks", () => {
            expect(() => new BufferPool(0, 10, 256)).toThrow('Min blocks, max blocks, and block size must be positive');
            expect(() => new BufferPool(-1, 10, 256)).toThrow('Min blocks, max blocks, and block size must be positive');
        });

        it("should throw on invalid max blocks", () => {
            expect(() => new BufferPool(5, 0, 256)).toThrow('Min blocks, max blocks, and block size must be positive');
            expect(() => new BufferPool(5, -1, 256)).toThrow('Min blocks, max blocks, and block size must be positive');
        });

        it("should throw on invalid block size", () => {
            expect(() => new BufferPool(5, 10, 0)).toThrow('Min blocks, max blocks, and block size must be positive');
            expect(() => new BufferPool(5, 10, -1)).toThrow('Min blocks, max blocks, and block size must be positive');
        });

        it("should throw when min > max", () => {
            expect(() => new BufferPool(10, 5, 256)).toThrow('Min blocks cannot be greater than max blocks');
        });

        it("should allow min == max", () => {
            const pool = new BufferPool(5, 5, 256);
            expect(pool.minBlockCount).toBe(5);
            expect(pool.maxBlockCount).toBe(5);
            expect(pool.totalBlockCount).toBe(5);
        });

        it("should throw on both parameters invalid", () => {
            expect(() => new BufferPool(0, 0, 256)).toThrow('Min blocks, max blocks, and block size must be positive');
            expect(() => new BufferPool(-5, -10, 256)).toThrow('Min blocks, max blocks, and block size must be positive');
        });
    });

    describe("request", () => {
        it("should return buffer and index with correct values", () => {
            const pool = new BufferPool(2, 5, 256);
            const { buffer, index } = pool.request();
            
            expect(buffer).not.toBeNull();
            expect(buffer.byteLength).toBe(256);
            expect(buffer).toBeInstanceOf(ArrayBuffer);
            expect(index).toBe(1);
        });

        it("should track allocated count correctly", () => {
            const pool = new BufferPool(2, 3, 128);
            
            expect(pool.allocatedBlockCount).toBe(0);
            expect(pool.freeBlockCount).toBe(2);
            
            const buffer1 = pool.request();
            expect(pool.allocatedBlockCount).toBe(1);
            expect(pool.freeBlockCount).toBe(1);
            
            const buffer2 = pool.request();
            expect(pool.allocatedBlockCount).toBe(2);
            expect(pool.freeBlockCount).toBe(0);
            
            expect(buffer1).not.toBeNull();
            expect(buffer2).not.toBeNull();
            expect(buffer1).not.toBe(buffer2);
        });

        it("should update utilization ratio", () => {
            const pool = new BufferPool(2, 4, 64);
            
            expect(pool.utilizationRatio).toBe(0);
            
            pool.request();
            expect(pool.utilizationRatio).toBe(0.5); // 1/2
            
            pool.request();
            expect(pool.utilizationRatio).toBe(1.0); // 2/2
        });

        it("should update hasAvailableBlocks correctly", () => {
            const pool = new BufferPool(1, 2, 64);
            
            expect(pool.hasAvailableBlocks).toBe(true);
            
            pool.request();
            expect(pool.hasAvailableBlocks).toBe(true);
            
            pool.request();
            expect(pool.hasAvailableBlocks).toBe(false);
        });

        it("should expand pool when running out of blocks", () => {
            const pool = new BufferPool(1, 4, 128);
            
            expect(pool.totalBlockCount).toBe(1);
            expect(pool.freeBlockCount).toBe(1);
            
            const buffer1 = pool.request();
            expect(pool.allocatedBlockCount).toBe(1);
            expect(pool.freeBlockCount).toBe(0);
            expect(pool.totalBlockCount).toBe(1);
            
            const buffer2 = pool.request();
            expect(pool.allocatedBlockCount).toBe(2);
            expect(pool.totalBlockCount).toBe(2);
            expect(pool.freeBlockCount).toBe(0);
            
            expect(buffer1).not.toBeNull();
            expect(buffer2).not.toBeNull();
            expect(buffer1).not.toBe(buffer2);
        });

        it("should throw when reaching max capacity", () => {
            const pool = new BufferPool(1, 2, 128);
            
            const { buffer: buffer1 } = pool.request();
            const { buffer: buffer2 } = pool.request();
            
            expect(buffer1).not.toBeNull();
            expect(buffer2).not.toBeNull();
            expect(pool.totalBlockCount).toBe(2);
            expect(() => pool.request()).toThrow('BufferPool out of memory: no free blocks available');
            
            expect(pool.allocatedBlockCount).toBe(2);
            expect(pool.freeBlockCount).toBe(0);
            expect(pool.hasAvailableBlocks).toBe(false);
        });

        it("should return different buffer instances", () => {
            const pool = new BufferPool(2, 3, 256);
            
            const { buffer: buffer1 } = pool.request();
            const { buffer: buffer2 } = pool.request();
            
            expect(buffer1).not.toBe(buffer2);
        });

        it("should handle single block pool", () => {
            const pool = new BufferPool(1, 1, 512);
            
            const { buffer: buffer1, index } = pool.request();
            
            expect(buffer1).not.toBeNull();
            expect(buffer1.byteLength).toBe(512);
            expect(index).toBe(0);
            expect(() => pool.request()).toThrow('BufferPool out of memory: no free blocks available');
            
            expect(pool.utilizationRatio).toBe(1.0);
            expect(pool.hasAvailableBlocks).toBe(false);
        });
    });

    describe("release", () => {
        it("should release buffer correctly", () => {
            const pool = new BufferPool(2, 3, 128);
            
            const { buffer } = pool.request();
            expect(pool.allocatedBlockCount).toBe(1);
            expect(pool.freeBlockCount).toBe(1);
            
            pool.release(buffer);
            expect(pool.allocatedBlockCount).toBe(0);
            expect(pool.freeBlockCount).toBe(2);
            expect(pool.hasAvailableBlocks).toBe(true);
        });

        it("should allow reuse of released buffer slot", () => {
            const pool = new BufferPool(1, 2, 256);
            
            const { buffer: buffer1 } = pool.request();
            pool.request();
            
            expect(pool.totalBlockCount).toBe(2);
            expect(() => pool.request()).toThrow('BufferPool out of memory: no free blocks available');
            
            pool.release(buffer1);
            const { buffer: buffer4 } = pool.request();
            
            expect(buffer4).not.toBeNull();
            expect(buffer4.byteLength).toBe(256);
            expect(pool.allocatedBlockCount).toBe(2);
        });

        it("should update utilization ratio after release", () => {
            const pool = new BufferPool(2, 4, 64);
            
            const buffers: ArrayBuffer[] = [];
            buffers.push(pool.request().buffer);
            buffers.push(pool.request().buffer);
            
            expect(pool.utilizationRatio).toBe(1.0);
            
            pool.release(buffers[0]!);
            expect(pool.utilizationRatio).toBe(0.5);
            
            pool.release(buffers[1]!);
            expect(pool.utilizationRatio).toBe(0);
        });

        it("should throw on buffer not from this pool", () => {
            const pool1 = new BufferPool(2, 2, 128);
            const pool2 = new BufferPool(2, 2, 128);
            
            const { buffer: buffer1 } = pool1.request();
            const { buffer: buffer2 } = pool2.request();
            
            expect(() => pool1.release(buffer2)).toThrow('ArrayBuffer was not allocated from this allocator or already freed');
            expect(() => pool2.release(buffer1)).toThrow('ArrayBuffer was not allocated from this allocator or already freed');
        });

        it("should throw on already released buffer", () => {
            const pool = new BufferPool(2, 2, 128);
            
            const { buffer } = pool.request();
            pool.release(buffer);
            
            expect(() => pool.release(buffer)).toThrow('ArrayBuffer was not allocated from this allocator or already freed');
        });

        it("should throw on arbitrary ArrayBuffer", () => {
            const pool = new BufferPool(2, 2, 128);
            const arbitraryBuffer = new ArrayBuffer(128);
            
            expect(() => pool.release(arbitraryBuffer)).toThrow('ArrayBuffer was not allocated from this allocator or already freed');
        });

        it("should handle multiple releases correctly", () => {
            const pool = new BufferPool(3, 5, 256);
            
            const buffers = [
                pool.request().buffer,
                pool.request().buffer,
                pool.request().buffer,
            ];
            
            expect(pool.allocatedBlockCount).toBe(3);
            
            pool.release(buffers[1]!);
            expect(pool.allocatedBlockCount).toBe(2);
            
            pool.release(buffers[0]!);
            expect(pool.allocatedBlockCount).toBe(1);
            
            pool.release(buffers[2]!);
            expect(pool.allocatedBlockCount).toBe(0);
            expect(pool.freeBlockCount).toBe(3);
        });
    });

    describe("releaseBlock", () => {
        it("should release buffer correctly by index", () => {
            const pool = new BufferPool(2, 3, 128);
            
            const { index } = pool.request();
            expect(pool.allocatedBlockCount).toBe(1);
            expect(pool.freeBlockCount).toBe(1);
            
            pool.releaseBlock(index);
            expect(pool.allocatedBlockCount).toBe(0);
            expect(pool.freeBlockCount).toBe(2);
            expect(pool.hasAvailableBlocks).toBe(true);
        });

        it("should allow reuse of a block released by index", () => {
            const pool = new BufferPool(1, 1, 256);
            const { buffer: buffer1, index } = pool.request();
            expect(pool.allocatedBlockCount).toBe(1);
            
            pool.releaseBlock(index);
            expect(pool.allocatedBlockCount).toBe(0);

            const { buffer: buffer2, index: index2 } = pool.request();
            expect(pool.allocatedBlockCount).toBe(1);
            
            expect(buffer2).toBe(buffer1);
            expect(index2).toBe(index);
        });
        
        it("should throw on releasing a free block", () => {
            const pool = new BufferPool(2, 2, 128);
            expect(() => pool.releaseBlock(0)).toThrow('Block was not allocated or already freed');
            expect(() => pool.releaseBlock(1)).toThrow('Block was not allocated or already freed');
        });

        it("should throw on already released block", () => {
            const pool = new BufferPool(2, 2, 128);
            
            const { index } = pool.request();
            pool.releaseBlock(index);
            
            expect(() => pool.releaseBlock(index)).toThrow('Block was not allocated or already freed');
        });

        it("should throw on negative index", () => {
            const pool = new BufferPool(3, 3, 128);
            expect(() => pool.releaseBlock(-1)).toThrow('Block index out of range');
        });

        it("should throw on index too large", () => {
            const pool = new BufferPool(3, 3, 128);
            expect(() => pool.releaseBlock(3)).toThrow('Block index out of range');
        });
    });

    describe("getBuffer", () => {
        it("should return buffer by index", () => {
            const pool = new BufferPool(3, 3, 512);
            
            const buffer0 = pool.getBuffer(0);
            const buffer1 = pool.getBuffer(1);
            const buffer2 = pool.getBuffer(2);
            
            expect(buffer0.byteLength).toBe(512);
            expect(buffer1.byteLength).toBe(512);
            expect(buffer2.byteLength).toBe(512);
            
            expect(buffer0).not.toBe(buffer1);
            expect(buffer1).not.toBe(buffer2);
        });

        it("should return same instance for same index", () => {
            const pool = new BufferPool(2, 2, 256);
            
            const buffer1 = pool.getBuffer(0);
            const buffer2 = pool.getBuffer(0);
            
            expect(buffer1).toBe(buffer2);
        });

        it("should throw on negative index", () => {
            const pool = new BufferPool(3, 3, 128);
            
            expect(() => pool.getBuffer(-1)).toThrow('Block index out of range');
            expect(() => pool.getBuffer(-10)).toThrow('Block index out of range');
        });

        it("should throw on index too large", () => {
            const pool = new BufferPool(3, 3, 128);
            
            expect(() => pool.getBuffer(3)).toThrow('Block index out of range');
            expect(() => pool.getBuffer(10)).toThrow('Block index out of range');
        });

        it("should work with boundary indices", () => {
            const pool = new BufferPool(5, 5, 64);
            
            const firstBuffer = pool.getBuffer(0);
            const lastBuffer = pool.getBuffer(4);
            
            expect(firstBuffer.byteLength).toBe(64);
            expect(lastBuffer.byteLength).toBe(64);
            expect(firstBuffer).not.toBe(lastBuffer);
        });

        it("should only allow access to current blocks, not max", () => {
            const pool = new BufferPool(2, 5, 64);
            
            expect(() => pool.getBuffer(0)).not.toThrow();
            expect(() => pool.getBuffer(1)).not.toThrow();
            expect(() => pool.getBuffer(2)).toThrow('Block index out of range');
        });
    });

    describe("reset", () => {
        it("should reset pool to initial state", () => {
            const pool = new BufferPool(2, 4, 256);
            
            const buffer1 = pool.request();
            const buffer2 = pool.request();
            const buffer3 = pool.request();
            
            expect(pool.allocatedBlockCount).toBe(3);
            expect(pool.totalBlockCount).toBe(4);
            expect(pool.utilizationRatio).toBe(0.75);
            
            pool.reset();
            
            expect(pool.allocatedBlockCount).toBe(0);
            expect(pool.totalBlockCount).toBe(2);
            expect(pool.freeBlockCount).toBe(2);
            expect(pool.utilizationRatio).toBe(0);
            expect(pool.hasAvailableBlocks).toBe(true);
        });

        it("should allow full reallocation after reset", () => {
            const pool = new BufferPool(1, 3, 128);
            
            pool.request();
            pool.request();
            pool.request();
            
            expect(pool.totalBlockCount).toBe(3);
            expect(() => pool.request()).toThrow('BufferPool out of memory: no free blocks available');
            
            pool.reset();
            
            expect(pool.totalBlockCount).toBe(1);

            const newBuffers = [
                pool.request(),
                pool.request(),
                pool.request()
            ];
            
            expect(newBuffers[0]).toBeDefined();
            expect(newBuffers[1]).toBeDefined();
            expect(newBuffers[2]).toBeDefined();
            expect(pool.totalBlockCount).toBe(3);
            expect(() => pool.request()).toThrow('BufferPool out of memory: no free blocks available');
        });

        it("should invalidate old buffer references", () => {
            const pool = new BufferPool(2, 2, 256);
            
            const { buffer } = pool.request();
            pool.reset();
            
            expect(() => pool.release(buffer)).toThrow('ArrayBuffer was not allocated from this allocator or already freed');
        });

        it("should reset empty pool correctly", () => {
            const pool = new BufferPool(3, 5, 512);
            
            pool.reset();
            
            expect(pool.allocatedBlockCount).toBe(0);
            expect(pool.totalBlockCount).toBe(3);
            expect(pool.freeBlockCount).toBe(3);
            expect(pool.utilizationRatio).toBe(0);
            expect(pool.hasAvailableBlocks).toBe(true);
        });

        it("should work multiple times", () => {
            const pool = new BufferPool(1, 2, 64);
            
            for (let i = 0; i < 3; i++) {
                pool.request();
                expect(pool.allocatedBlockCount).toBe(1);
                
                pool.reset();
                expect(pool.allocatedBlockCount).toBe(0);
                expect(pool.totalBlockCount).toBe(1);
                expect(pool.freeBlockCount).toBe(1);
            }
        });
    });

    describe("properties", () => {
        it("should return correct totalBlockCount", () => {
            const pools: [BufferPool, BufferPool, BufferPool] = [
                new BufferPool(1, 1, 64),
                new BufferPool(5, 10, 128),
                new BufferPool(50, 100, 256)
            ];
            
            expect(pools[0].totalBlockCount).toBe(1);
            expect(pools[1].totalBlockCount).toBe(5);
            expect(pools[2].totalBlockCount).toBe(50);
        });

        it("should return correct blockSize", () => {
            const pools: [BufferPool, BufferPool, BufferPool] = [
                new BufferPool(2, 5, 64),
                new BufferPool(2, 5, 256),
                new BufferPool(2, 5, 1024)
            ];
            
            expect(pools[0].blockSize).toBe(64);
            expect(pools[1].blockSize).toBe(256);
            expect(pools[2].blockSize).toBe(1024);
        });

        it("should track allocatedBlockCount accurately", () => {
            const pool = new BufferPool(2, 4, 128);
            const buffers: ArrayBuffer[] = [];
            
            expect(pool.allocatedBlockCount).toBe(0);
            buffers.push(pool.request().buffer);
            expect(pool.allocatedBlockCount).toBe(1);
            
            buffers.push(pool.request().buffer);
            expect(pool.allocatedBlockCount).toBe(2);
            
            pool.release(buffers[1]!);
            expect(pool.allocatedBlockCount).toBe(1);
            
            pool.release(buffers[0]!);
            expect(pool.allocatedBlockCount).toBe(0);
        });

        it("should track freeBlockCount accurately", () => {
            const pool = new BufferPool(2, 3, 256);
            
            expect(pool.freeBlockCount).toBe(2);
            
            const buffer1 = pool.request().buffer;
            expect(pool.freeBlockCount).toBe(1);
            
            const buffer2 = pool.request().buffer;
            expect(pool.freeBlockCount).toBe(0);
            
            const buffer3 = pool.request().buffer;
            expect(pool.freeBlockCount).toBe(0);
            
            pool.release(buffer2);
            expect(pool.freeBlockCount).toBe(1);
        });

        it("should calculate utilizationRatio correctly for edge cases", () => {
            const pool = new BufferPool(1, 1, 64);
            
            expect(pool.utilizationRatio).toBe(0);
            
            pool.request();
            expect(pool.utilizationRatio).toBe(1);
            
            pool.reset();
            expect(pool.utilizationRatio).toBe(0);
        });

        it("should update hasAvailableBlocks correctly in all scenarios", () => {
            const pool = new BufferPool(1, 2, 128);
            
            expect(pool.hasAvailableBlocks).toBe(true);
            
            const { buffer: buffer1 } = pool.request();
            expect(pool.hasAvailableBlocks).toBe(true);
            
            const { buffer: buffer2 } = pool.request();
            expect(pool.hasAvailableBlocks).toBe(false);
            
            pool.release(buffer1);
            expect(pool.hasAvailableBlocks).toBe(true);
            
            pool.release(buffer2);
            expect(pool.hasAvailableBlocks).toBe(true);
            
            pool.reset();
            expect(pool.hasAvailableBlocks).toBe(true);
        });
    });

    describe("dynamic expansion", () => {
        it("should expand pool when needed", () => {
            const pool = new BufferPool(1, 8, 256);
            
            expect(pool.totalBlockCount).toBe(1);
            
            pool.request();
            expect(pool.totalBlockCount).toBe(1);
            
            pool.request();
            expect(pool.totalBlockCount).toBe(2);
            
            pool.request();
            pool.request();
            expect(pool.totalBlockCount).toBe(4);
        });

        it("should expand by doubling until max is reached", () => {
            const pool = new BufferPool(1, 7, 128);
            
            const buffers: ArrayBuffer[] = [];
            
            expect(pool.totalBlockCount).toBe(1);
            buffers.push(pool.request().buffer);
            
            buffers.push(pool.request().buffer);
            expect(pool.totalBlockCount).toBe(2);
            
            buffers.push(pool.request().buffer);
            buffers.push(pool.request().buffer);
            expect(pool.totalBlockCount).toBe(4);
            
            buffers.push(pool.request().buffer);
            buffers.push(pool.request().buffer);
            buffers.push(pool.request().buffer);
            expect(pool.totalBlockCount).toBe(7);
            
            expect(() => pool.request()).toThrow('BufferPool out of memory: no free blocks available');
        });

        it("should not expand beyond max blocks", () => {
            const pool = new BufferPool(2, 3, 128);
            
            pool.request();
            pool.request();
            pool.request();
            
            expect(pool.totalBlockCount).toBe(3);
            expect(() => pool.request()).toThrow('BufferPool out of memory: no free blocks available');
        });

        it("should handle released blocks in expanded pool", () => {
            const pool = new BufferPool(1, 4, 256);
            
            const { buffer: buffer1 } = pool.request();
            const { buffer: buffer2 } = pool.request();
            const { buffer: buffer3 } = pool.request();
            const { buffer: buffer4 } = pool.request();
            
            expect(pool.totalBlockCount).toBe(4);
            expect(pool.allocatedBlockCount).toBe(4);
            
            pool.release(buffer2);
            expect(pool.allocatedBlockCount).toBe(3);
            expect(pool.freeBlockCount).toBe(1);
            
            pool.request();
            expect(pool.allocatedBlockCount).toBe(4);
            expect(pool.totalBlockCount).toBe(4);
        });
    });

    describe("edge cases", () => {
        it("should handle large pool sizes", () => {
            const pool = new BufferPool(100, 1000, 4096);
            
            expect(pool.totalBlockCount).toBe(100);
            expect(pool.maxBlockCount).toBe(1000);
            expect(pool.blockSize).toBe(4096);
            expect(pool.freeBlockCount).toBe(100);
            
            const { buffer } = pool.request();
            expect(buffer.byteLength).toBe(4096);
            expect(pool.allocatedBlockCount).toBe(1);
        });

        it("should handle small block sizes", () => {
            const pool = new BufferPool(5, 10, 1);
            
            expect(pool.blockSize).toBe(1);
            
            const { buffer } = pool.request();
            expect(buffer.byteLength).toBe(1);
        });

        it("should handle rapid allocation and deallocation", () => {
            const pool = new BufferPool(2, 5, 256);
            
            for (let cycle = 0; cycle < 10; cycle++) {
                const buffers: ArrayBuffer[] = [];
                
                // Allocate up to max
                for (let i = 0; i < 5; i++) {
                    buffers.push(pool.request().buffer);
                }
                expect(pool.allocatedBlockCount).toBe(5);
                expect(pool.hasAvailableBlocks).toBe(false);
                
                // Release all
                for (const buffer of buffers) {
                    pool.release(buffer);
                }
                expect(pool.allocatedBlockCount).toBe(0);
                expect(pool.hasAvailableBlocks).toBe(true);
            }
        });

        it("should maintain consistency during interleaved operations", () => {
            const pool = new BufferPool(1, 3, 128);
            
            const { buffer: buffer1 } = pool.request();
            const { buffer: buffer2 } = pool.request();
            
            expect(pool.allocatedBlockCount).toBe(2);
            expect(pool.totalBlockCount).toBe(2);
            expect(pool.freeBlockCount).toBe(0);
            
            pool.release(buffer1);
            
            expect(pool.allocatedBlockCount).toBe(1);
            expect(pool.freeBlockCount).toBe(1);
            
            const { buffer: buffer3 } = pool.request();
            const { buffer: buffer4 } = pool.request();
            
            expect(pool.allocatedBlockCount).toBe(3);
            expect(pool.totalBlockCount).toBe(3);
            expect(pool.freeBlockCount).toBe(0);
            
            pool.release(buffer2);
            pool.release(buffer3);
            pool.release(buffer4);
            
            expect(pool.allocatedBlockCount).toBe(0);
            expect(pool.freeBlockCount).toBe(3);
        });
    });

    describe("memory management", () => {
        it("should not allocate new buffers on request when available", () => {
            const pool = new BufferPool(2, 2, 256);
            
            const internalBuffer0 = pool.getBuffer(0);
            const internalBuffer1 = pool.getBuffer(1);
            
            const { buffer: requestedBuffer1 } = pool.request();
            const { buffer: requestedBuffer2 } = pool.request();
            
            expect([internalBuffer0, internalBuffer1]).toContain(requestedBuffer1);
            expect([internalBuffer0, internalBuffer1]).toContain(requestedBuffer2);
            expect(requestedBuffer1).not.toBe(requestedBuffer2);
        });

        it("should reuse buffer instances after release", () => {
            const pool = new BufferPool(1, 1, 512);
            
            const { buffer: buffer1 } = pool.request();
            pool.release(buffer1);
            
            const { buffer: buffer2 } = pool.request();
            
            expect(buffer2).toBe(buffer1);
        });

        it("should maintain buffer contents after release and reallocation", () => {
            const pool = new BufferPool(1, 1, 256);
            
            const { buffer } = pool.request();
            const view = new Uint8Array(buffer);
            
            view[0] = 42;
            view[100] = 123;
            view[255] = 200;
            
            pool.release(buffer);
            const { buffer: reusedBuffer } = pool.request();
            const reusedView = new Uint8Array(reusedBuffer);
            
            expect(reusedView[0]).toBe(42);
            expect(reusedView[100]).toBe(123);
            expect(reusedView[255]).toBe(200);
        });
    });

    describe("concurrent operations simulation", () => {
        it("should handle multiple operations in sequence", () => {
            const pool = new BufferPool(1, 3, 128);
            const operations: string[] = [];
            
            operations.push('request');
            const { buffer: buffer1 } = pool.request();
            expect(pool.allocatedBlockCount).toBe(1);
            
            operations.push('request');
            const { buffer: buffer2 } = pool.request();
            expect(pool.allocatedBlockCount).toBe(2);
            expect(pool.totalBlockCount).toBe(2);
            
            operations.push('release');
            pool.release(buffer1);
            expect(pool.allocatedBlockCount).toBe(1);
            
            operations.push('request');
            const { buffer: buffer3 } = pool.request();
            expect(pool.allocatedBlockCount).toBe(2);
            
            operations.push('reset');
            pool.reset();
            expect(pool.allocatedBlockCount).toBe(0);
            expect(pool.totalBlockCount).toBe(1);
            
            operations.push('request');
            const { buffer: buffer4 } = pool.request();
            expect(buffer4).not.toBeNull();
            expect(pool.allocatedBlockCount).toBe(1);
        });
    });
}); 