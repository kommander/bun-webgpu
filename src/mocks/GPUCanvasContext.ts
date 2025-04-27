export class GPUCanvasContextMock implements GPUCanvasContext {
	readonly __brand: "GPUCanvasContext" = "GPUCanvasContext";
	private _configuration: GPUCanvasConfiguration | null = null;
	private _currentTexture: GPUTexture | null = null;
  private width: number;
  private height: number;

	// Keep a reference to the associated device if needed for validation or texture creation
	private _device: GPUDevice | null = null;

	constructor(
		public readonly canvas: HTMLCanvasElement | OffscreenCanvas,
    width: number,
    height: number
	) {
    this.width = width;
    this.height = height;
  }

	configure(descriptor: GPUCanvasConfiguration): undefined {
		if (!descriptor || !descriptor.device) {
			throw new Error("GPUCanvasContextMock.configure: Invalid descriptor or missing device.");
		}
		
    this._configuration = { ...descriptor };
		this._device = descriptor.device; 

		// Invalidate any previously vended texture
		this._currentTexture?.destroy();
		this._currentTexture = null;

    return undefined;
	}

	unconfigure(): undefined {
		this._configuration = null;
		this._currentTexture?.destroy();
		this._currentTexture = null;
		this._device = null; // Or keep if it should persist? Depends on desired mock behavior.
		return undefined;
	}

	getConfiguration(): GPUCanvasConfigurationOut | null {
		if (!this._configuration) {
			return null;
		}
		
    const configOut: GPUCanvasConfigurationOut = {
			device: this._configuration.device,
			format: this._configuration.format,
			usage: this._configuration.usage ?? (GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC),
			viewFormats: Array.from(this._configuration.viewFormats ?? []),
			colorSpace: this._configuration.colorSpace ?? 'srgb',
			alphaMode: this._configuration.alphaMode ?? 'opaque',
		};

		if (this._configuration.toneMapping) {
			configOut.toneMapping = this._configuration.toneMapping;
		}

		return configOut;
	}

  
  setSize(width: number, height: number): undefined {
    this.width = width;
    this.height = height;
		if (this._configuration && this._device) {
    	this.updateCurrentTexture();
		}
    return undefined;
  }

  private updateCurrentTexture(): undefined {
		if (!this._configuration || !this._device) {
			throw new Error("GPUCanvasContextMock.getCurrentTexture: Context is not configured.");
		}

    if (this._currentTexture) {
      this._currentTexture.destroy();
    }

    this._currentTexture = this._device.createTexture({
      label: 'canvasCurrentTexture',
      size: { // Use current canvas size
        width: this.width,
        height: this.height,
        depthOrArrayLayers: 1,
      },
      format: this._configuration.format,
      usage: this._configuration.usage ?? (GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC),
      dimension: '2d',
      mipLevelCount: 1,
      sampleCount: 1,
    });
  }

	getCurrentTexture(): GPUTexture {
		if (!this._configuration || !this._device) {
			throw new Error("GPUCanvasContextMock.getCurrentTexture: Context is not configured.");
		}

		if (!this._currentTexture) {
			this.updateCurrentTexture();
		}

		return this._currentTexture!;
	}
}