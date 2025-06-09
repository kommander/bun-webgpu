export interface BlockBuffer {
  __type: "BlockBuffer";
  buffer: ArrayBuffer;
  index: number;
}

/**
 * Buffer pool with minimal overhead.
 * To control when ArrayBuffers are allocated and freed
 * and to avoid some gc runs.
 */
export class BufferPool {
  private buffers: ArrayBuffer[];
  public readonly blockSize: number;
  private freeBlocks: number[] = []; 
  private readonly minBlocks: number;
  private readonly maxBlocks: number;
  private currentBlocks: number;
  private allocatedCount: number = 0;
  private bufferToBlockIndex = new WeakMap<ArrayBuffer, number>();

  constructor(minBlocks: number, maxBlocks: number, blockSize: number) {
    if (minBlocks <= 0 || maxBlocks <= 0 || blockSize <= 0) {
      throw new Error('Min blocks, max blocks, and block size must be positive');
    }
    if (minBlocks > maxBlocks) {
      throw new Error('Min blocks cannot be greater than max blocks');
    }

    this.minBlocks = minBlocks;
    this.maxBlocks = maxBlocks;
    this.blockSize = blockSize;
    this.currentBlocks = minBlocks;
    
    this.buffers = [];
    this.initializePool();
  }

  private initializePool(): void {
    this.freeBlocks = [];
    for (let i = 0; i < this.minBlocks; i++) {
      this.buffers.push(new ArrayBuffer(this.blockSize));
      this.freeBlocks.push(i);
    }
  }

  private expandPool(): boolean {
    if (this.currentBlocks >= this.maxBlocks) {
      return false;
    }

    const oldBlocks = this.currentBlocks;
    const newBlocks = Math.min(this.maxBlocks, this.currentBlocks * 2);
    
    for (let i = oldBlocks; i < newBlocks; i++) {
      this.buffers.push(new ArrayBuffer(this.blockSize));
      this.freeBlocks.push(i);
    }
    
    this.currentBlocks = newBlocks;
    return true;
  }

  /**
   * Request a block. Returns an object with the pre-allocated ArrayBuffer and its index, or throws if out of memory.
   */
  request(): BlockBuffer {
    if (this.freeBlocks.length === 0) {
      if (!this.expandPool()) {
        throw new Error('BufferPool out of memory: no free blocks available');
      }
    }

    const blockIndex = this.freeBlocks.pop()!;
    
    if (blockIndex < 0 || blockIndex >= this.buffers.length) {
      throw new Error('Invalid block index');
    }
    
    this.allocatedCount++;
    
    const buffer = this.buffers[blockIndex]!;
    this.bufferToBlockIndex.set(buffer, blockIndex);
    
    return { __type: "BlockBuffer", buffer, index: blockIndex };
  }

  /**
   * Release a block using the ArrayBuffer returned from request().
   */
  release(buffer: ArrayBuffer): void {
    const blockIndex = this.bufferToBlockIndex.get(buffer);
    
    if (blockIndex === undefined) {
      throw new Error('ArrayBuffer was not allocated from this allocator or already freed');
    }

    this.bufferToBlockIndex.delete(buffer);
    this.freeBlocks.push(blockIndex);
    this.allocatedCount--;
  }

  /**
   * Release a block by its index.
   */
  releaseBlock(blockIndex: number): void {
    if (blockIndex < 0 || blockIndex >= this.currentBlocks) {
      throw new Error('Block index out of range');
    }

    const buffer = this.buffers[blockIndex]!;
    
    if (!this.bufferToBlockIndex.has(buffer)) {
      throw new Error('Block was not allocated or already freed');
    }

    this.bufferToBlockIndex.delete(buffer);
    this.freeBlocks.push(blockIndex);
    this.allocatedCount--;
  }

  /**
   * Get the ArrayBuffer for a specific block index.
   */
  getBuffer(blockIndex: number): ArrayBuffer {
    if (blockIndex < 0 || blockIndex >= this.currentBlocks) {
      throw new Error('Block index out of range');
    }
    return this.buffers[blockIndex]!;
  }

  reset(): void {
    this.allocatedCount = 0;
    this.bufferToBlockIndex = new WeakMap<ArrayBuffer, number>();
    this.currentBlocks = this.minBlocks;
    this.buffers = [];
    this.initializePool();
  }

  get totalBlockCount(): number {
    return this.currentBlocks;
  }

  get maxBlockCount(): number {
    return this.maxBlocks;
  }

  get minBlockCount(): number {
    return this.minBlocks;
  }

  get allocatedBlockCount(): number {
    return this.allocatedCount;
  }

  get freeBlockCount(): number {
    return this.freeBlocks.length;
  }

  get hasAvailableBlocks(): boolean {
    return this.freeBlocks.length > 0 || this.currentBlocks < this.maxBlocks;
  }

  get utilizationRatio(): number {
    return this.currentBlocks > 0 ? this.allocatedCount / this.currentBlocks : 0;
  }
}