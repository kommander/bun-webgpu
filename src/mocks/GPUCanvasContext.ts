export class GPUCanvasContextMock implements GPUCanvasContext {
	readonly __brand: "GPUCanvasContext" = "GPUCanvasContext";
	private _configuration: GPUCanvasConfiguration | null = null;
	private _currentTexture: GPUTexture | null = null;
	private _nextTexture: GPUTexture | null = null;
  private width: number;
  private height: number;
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

    this._configuration = {
        ...descriptor,
        alphaMode: descriptor.alphaMode ?? 'premultiplied',
        usage: descriptor.usage ?  descriptor.usage | GPUTextureUsage.TEXTURE_BINDING : (GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC | GPUTextureUsage.TEXTURE_BINDING),
        colorSpace: descriptor.colorSpace ?? 'srgb',
    };
		this._device = descriptor.device;

		this._currentTexture?.destroy();
		this._currentTexture = null;

    return undefined;
	}

	unconfigure(): undefined {
		this._configuration = null;
		this._currentTexture?.destroy();
		this._currentTexture = null;
		this._device = null;
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
			alphaMode: this._configuration.alphaMode ?? 'premultiplied',
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
    	this.createTextures();
		}
    return undefined;
  }

  private createTextures(): undefined {
		const currentTexture = this._currentTexture;
		const nextTexture = this._nextTexture;
		
		// defer destruction of textures as async methods might be using them
		setTimeout(() => {
			currentTexture?.destroy();
			nextTexture?.destroy();
		}, 1000);

    this._currentTexture = this.createRenderTexture(this.width, this.height);
		this._nextTexture = this.createRenderTexture(this.width, this.height);
  }

	private createRenderTexture(width: number, height: number): GPUTexture {
		if (!this._configuration || !this._device) {
			throw new Error("GPUCanvasContextMock.getCurrentTexture: Context is not configured.");
		}

		return this._device.createTexture({
      label: 'canvasCurrentTexture',
      size: {
        width: width,
        height: height,
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
			this.createTextures();
		}

		return this._currentTexture!;
	}

	switchTextures(): GPUTexture {
		const temp = this._currentTexture;
		this._currentTexture = this._nextTexture;
		this._nextTexture = temp;
		return this._currentTexture!;
	}
}