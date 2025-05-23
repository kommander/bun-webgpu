import { expect, describe, it } from "bun:test";
import { 
    defineEnum, 
    defineStruct, 
    objectPtr,
    allocStruct,
    packObjectArray,
} from "./structs_ffi";
import { toArrayBuffer } from "bun:ffi";

describe("Structs FFI", () => {

    describe("defineEnum", () => {
        it("should create enum with correct mapping", () => {
            const TestEnum = defineEnum({
                VALUE_A: 0,
                VALUE_B: 1,
                VALUE_C: 42
            });

            expect(TestEnum.to('VALUE_A')).toBe(0);
            expect(TestEnum.to('VALUE_B')).toBe(1);
            expect(TestEnum.to('VALUE_C')).toBe(42);

            expect(TestEnum.from(0)).toBe('VALUE_A');
            expect(TestEnum.from(1)).toBe('VALUE_B');
            expect(TestEnum.from(42)).toBe('VALUE_C');
        });

        it("should support different base types", () => {
            const U8Enum = defineEnum({ A: 0, B: 255 }, 'u8');
            const U64Enum = defineEnum({ X: 0, Y: 1 }, 'u64');

            expect(U8Enum.type).toBe('u8');
            expect(U64Enum.type).toBe('u64');
        });

        it("should throw on invalid enum values", () => {
            const TestEnum = defineEnum({ VALID: 0 });

            expect(() => TestEnum.to('INVALID' as any)).toThrow();
            expect(() => TestEnum.from(999)).toThrow();
        });
    });

    describe("primitive types", () => {
        it("should pack and unpack u8 correctly", () => {
            const TestStruct = defineStruct([
                ['value', 'u8']
            ] as const);

            const packed = TestStruct.pack({ value: 123 });
            expect(packed.byteLength).toBe(1);

            const unpacked = TestStruct.unpack(packed);
            expect(unpacked.value).toBe(123);
        });

        it("should pack and unpack u32 correctly", () => {
            const TestStruct = defineStruct([
                ['value', 'u32']
            ] as const);

            const packed = TestStruct.pack({ value: 0x12345678 });
            expect(packed.byteLength).toBe(4);

            const unpacked = TestStruct.unpack(packed);
            expect(unpacked.value).toBe(0x12345678);
        });

        it("should pack and unpack f32 correctly", () => {
            const TestStruct = defineStruct([
                ['value', 'f32']
            ] as const);

            const testValue = 3.14159;
            const packed = TestStruct.pack({ value: testValue });
            expect(packed.byteLength).toBe(4);

            const unpacked = TestStruct.unpack(packed);
            expect(unpacked.value).toBeCloseTo(testValue, 5);
        });

        it("should pack and unpack bool types correctly", () => {
            const TestStruct = defineStruct([
                ['flag8', 'bool_u8'],
                ['flag32', 'bool_u32']
            ] as const);

            const packed = TestStruct.pack({ flag8: true, flag32: false });
            expect(packed.byteLength).toBe(8); // 1 + 3 padding + 4 = 8 bytes due to alignment

            const unpacked = TestStruct.unpack(packed);
            expect(unpacked.flag8).toBe(true);
            expect(unpacked.flag32).toBe(false);
        });
    });

    describe("struct definition", () => {
        it("should create struct with correct size and alignment", () => {
            const TestStruct = defineStruct([
                ['a', 'u8'],
                ['b', 'u32'],
                ['c', 'u8']
            ] as const);

            // u8(1) + padding(3) + u32(4) + u8(1) + padding(3) = 12 bytes
            expect(TestStruct.size).toBe(12);
            expect(TestStruct.align).toBe(4);
        });

        it("should pack and unpack simple struct", () => {
            const TestStruct = defineStruct([
                ['x', 'f32'],
                ['y', 'f32'],
                ['count', 'u32']
            ] as const);

            const input = { x: 1.5, y: 2.5, count: 10 };
            const packed = TestStruct.pack(input);
            const unpacked = TestStruct.unpack(packed);

            expect(unpacked.x).toBeCloseTo(1.5);
            expect(unpacked.y).toBeCloseTo(2.5);
            expect(unpacked.count).toBe(10);
        });

        it("should handle optional fields with defaults", () => {
            const TestStruct = defineStruct([
                ['required', 'u32'],
                ['optional', 'u32', { optional: true, default: 42 }]
            ] as const);

            const packed = TestStruct.pack({ required: 100 });
            const unpacked = TestStruct.unpack(packed);

            expect(unpacked.required).toBe(100);
            expect(unpacked.optional).toBe(42);
        });

        it("should support enum fields", () => {
            const TestEnum = defineEnum({
                OPTION_A: 0,
                OPTION_B: 1,
                OPTION_C: 2
            });

            const TestStruct = defineStruct([
                ['option', TestEnum],
                ['value', 'u32']
            ] as const);

            const input = { option: 'OPTION_B' as const, value: 123 };
            const packed = TestStruct.pack(input);
            const unpacked = TestStruct.unpack(packed);

            expect(unpacked.option).toBe('OPTION_B');
            expect(unpacked.value).toBe(123);
        });
    });

    describe("nested structs", () => {
        it("should handle inline nested structs", () => {
            const InnerStruct = defineStruct([
                ['x', 'f32'],
                ['y', 'f32']
            ] as const);

            const OuterStruct = defineStruct([
                ['position', InnerStruct],
                ['scale', 'f32']
            ] as const);

            const input = {
                position: { x: 1.0, y: 2.0 },
                scale: 3.0
            };

            const packed = OuterStruct.pack(input);
            const unpacked = OuterStruct.unpack(packed);

            expect(unpacked.position.x).toBeCloseTo(1.0);
            expect(unpacked.position.y).toBeCloseTo(2.0);
            expect(unpacked.scale).toBeCloseTo(3.0);
        });
    });

    describe("arrays", () => {
        it("should pack primitive arrays", () => {
            const TestStruct = defineStruct([
                ['count', 'u32', { lengthOf: 'values' }],
                ['values', ['u32']]
            ] as const);

            const input = { values: [1, 2, 3, 4, 5] };
            const packed = TestStruct.pack(input);
            
            expect(packed.byteLength).toBeGreaterThan(0);
        });

        it("should pack enum arrays with length field", () => {
            const TestEnum = defineEnum({
                RED: 0,
                GREEN: 1,
                BLUE: 2
            });

            const TestStruct = defineStruct([
                ['colorCount', 'u32', { lengthOf: 'colors' }],
                ['colors', [TestEnum]]
            ] as const);

            const input = { colors: ['RED', 'GREEN', 'BLUE'] as const };
            const packed = TestStruct.pack(input);
            const unpacked = TestStruct.unpack(packed);

            expect(unpacked.colorCount).toBe(3);
            expect(unpacked.colors).toEqual(['RED', 'GREEN', 'BLUE']);
        });
    });

    describe("object pointers", () => {
        interface TestObject {
            ptr: number | bigint | null;
            name?: string;
        }

        it("should pack object pointers", () => {
            const TestStruct = defineStruct([
                ['objectRef', objectPtr<TestObject>()]
            ] as const);

            const mockObject: TestObject = { ptr: 0x12345678 };
            const input = { objectRef: mockObject };

            const packed = TestStruct.pack(input);
            expect(packed.byteLength).toBeGreaterThan(0);
        });

        it("should pack null object pointers", () => {
            const TestStruct = defineStruct([
                ['objectRef', objectPtr<TestObject>(), { optional: true }]
            ] as const);

            const input = { objectRef: null };
            const packed = TestStruct.pack(input);
            
            expect(packed.byteLength).toBeGreaterThan(0);
        });

        it("should pack object pointer arrays", () => {
            const objects: (TestObject | null)[] = [
                { ptr: 0x1000 },
                { ptr: 0x2000 },
                null,
                { ptr: 0x3000 }
            ];

            const packed = packObjectArray(objects);
            expect(packed.byteLength).toBe(objects.length * (process.arch === 'x64' || process.arch === 'arm64' ? 8 : 4));
        });
    });

    describe("struct options", () => {
        it("should apply mapValue transformation", () => {
            const TestStruct = defineStruct([
                ['value', 'u32']
            ] as const, {
                mapValue: (input: { doubled: number }) => ({ value: input.doubled * 2 })
            });

            const input = { doubled: 21 };
            const packed = TestStruct.pack(input);
            const unpacked = TestStruct.unpack(packed);

            expect(unpacked.value).toBe(42);
        });

        it("should use struct-level defaults", () => {
            const TestStruct = defineStruct([
                ['a', 'u32'],
                ['b', 'u32']
            ] as const, {
                default: { a: 100, b: 200 }
            });

            const packed = TestStruct.pack({ a: 10, b: 20 });
            const unpacked = TestStruct.unpack(packed);

            expect(unpacked.a).toBe(10);
            expect(unpacked.b).toBe(20);
        });
    });

    describe("struct utilities", () => {
        it("should allocate struct buffer", () => {
            const TestStruct = defineStruct([
                ['a', 'u32'],
                ['b', 'f32']
            ] as const);

            const { buffer, view } = allocStruct(TestStruct);
            expect(buffer.byteLength).toBe(TestStruct.size);
            expect(view.buffer).toBe(buffer);
        });

        it("should describe struct layout", () => {
            const TestStruct = defineStruct([
                ['a', 'u8'],
                ['b', 'u32'],
                ['c', 'f32', { optional: true }]
            ] as const);

            const description = TestStruct.describe();
            expect(description).toHaveLength(3);
            
            const fieldA = description.find(f => f.name === 'a');
            expect(fieldA?.size).toBe(1);
            expect(fieldA?.optional).toBe(false);

            const fieldC = description.find(f => f.name === 'c');
            expect(fieldC?.optional).toBe(true);
        });
    });

    describe("error handling", () => {
        it("should throw on missing required field", () => {
            const TestStruct = defineStruct([
                ['required', 'u32']
            ] as const);

            expect(() => {
                TestStruct.pack({} as any);
            }).toThrow();
        });

        it("should throw on buffer too small for unpacking", () => {
            const TestStruct = defineStruct([
                ['a', 'u32'],
                ['b', 'u32']
            ] as const);

            const smallBuffer = new ArrayBuffer(4); // Only room for one u32
            
            expect(() => {
                TestStruct.unpack(smallBuffer);
            }).toThrow();
        });
    });

    describe("complex struct with length field and nested arrays", () => {
        it("should handle bind group layout-like structure", () => {
            const BufferLayoutStruct = defineStruct([
                ['type', 'u32', { default: 2 }], // uniform = 2
                ['hasDynamicOffset', 'bool_u32', { default: false }],
                ['minBindingSize', 'u64', { default: 0 }]
            ] as const);

            const SamplerLayoutStruct = defineStruct([
                ['type', 'u32', { default: 2 }] // filtering = 2
            ] as const);

            const TextureLayoutStruct = defineStruct([
                ['sampleType', 'u32', { default: 2 }], // float = 2
                ['viewDimension', 'u32', { default: 2 }], // 2d = 2
                ['multisampled', 'bool_u32', { default: false }]
            ] as const);

            const BindGroupLayoutEntryStruct = defineStruct([
                ['binding', 'u32'],
                ['visibility', 'u64'],
                ['buffer', BufferLayoutStruct, { optional: true }],
                ['sampler', SamplerLayoutStruct, { optional: true }],
                ['texture', TextureLayoutStruct, { optional: true }]
            ] as const);

            const BindGroupLayoutDescriptorStruct = defineStruct([
                ['label', 'cstring', { optional: true }],
                ['entryCount', 'u64', { lengthOf: 'entries' }],
                ['entries', [BindGroupLayoutEntryStruct]]
            ] as const);

            const input = {
                label: "test-layout",
                entries: [
                    {
                        binding: 0,
                        visibility: 0x4n, // FRAGMENT = 4
                        buffer: {
                            type: 2, // uniform
                            hasDynamicOffset: false,
                            minBindingSize: 0
                        }
                    },
                    {
                        binding: 1,
                        visibility: 0x4n, // FRAGMENT = 4
                        sampler: {
                            type: 2 // filtering
                        }
                    },
                    {
                        binding: 2,
                        visibility: 0x4n, // FRAGMENT = 4
                        texture: {
                            sampleType: 2, // float
                            viewDimension: 2, // 2d
                            multisampled: false
                        }
                    }
                ]
            };

            const packed = BindGroupLayoutDescriptorStruct.pack(input);
            
            // Verify basic buffer properties
            expect(packed.byteLength).toBeGreaterThan(0);
            expect(packed.byteLength).toBe(BindGroupLayoutDescriptorStruct.size);
            
            // Verify the length field was set correctly by reading it directly
            const view = new DataView(packed);
            const entryCount = view.getBigUint64(8, true); // entryCount is at offset 8 (after label pointer)
            expect(entryCount).toBe(3n);
            
            // Verify entries pointer is not null (should point to allocated array)
            const entriesPtr = view.getBigUint64(16, true); // entries pointer at offset 16
            expect(entriesPtr).not.toBe(0n);
            
            // Now verify the actual packed entries data
            const entryStructSize = BindGroupLayoutEntryStruct.size;
            const totalEntriesSize = entryStructSize * 3;
            
            // Get the field layout to understand offsets
            const entryLayout = BindGroupLayoutEntryStruct.describe();
            console.log('Entry struct layout:', entryLayout);
            console.log('Entry struct size:', entryStructSize);
            
            // Read the entries array buffer
            // @ts-ignore - ignoring the Pointer type error as requested
            const entriesBuffer = toArrayBuffer(Number(entriesPtr), 0, totalEntriesSize);
            const entriesView = new DataView(entriesBuffer);
            
            // Get field offsets from the struct layout
            const bindingOffset = entryLayout.find(f => f.name === 'binding')?.offset ?? 0;
            const visibilityOffset = entryLayout.find(f => f.name === 'visibility')?.offset ?? 0;
            const bufferOffset = entryLayout.find(f => f.name === 'buffer')?.offset ?? 0;
            const samplerOffset = entryLayout.find(f => f.name === 'sampler')?.offset ?? 0;
            const textureOffset = entryLayout.find(f => f.name === 'texture')?.offset ?? 0;
            
            // Verify first entry (buffer binding)
            let entryBaseOffset = 0;
            expect(entriesView.getUint32(entryBaseOffset + bindingOffset, true)).toBe(0); // binding = 0
            expect(entriesView.getBigUint64(entryBaseOffset + visibilityOffset, true)).toBe(0x4n); // visibility = FRAGMENT
            
            // Check buffer sub-struct fields (type, hasDynamicOffset, minBindingSize)
            expect(entriesView.getUint32(entryBaseOffset + bufferOffset, true)).toBe(2); // buffer.type = uniform
            expect(entriesView.getUint32(entryBaseOffset + bufferOffset + 4, true)).toBe(0); // buffer.hasDynamicOffset = false
            expect(entriesView.getBigUint64(entryBaseOffset + bufferOffset + 8, true)).toBe(0n); // buffer.minBindingSize = 0
            
            // Verify second entry (sampler binding)
            entryBaseOffset = entryStructSize;
            expect(entriesView.getUint32(entryBaseOffset + bindingOffset, true)).toBe(1); // binding = 1
            expect(entriesView.getBigUint64(entryBaseOffset + visibilityOffset, true)).toBe(0x4n); // visibility = FRAGMENT
            
            // Check sampler sub-struct field (type)
            expect(entriesView.getUint32(entryBaseOffset + samplerOffset, true)).toBe(2); // sampler.type = filtering
            
            // Verify third entry (texture binding)  
            entryBaseOffset = entryStructSize * 2;
            expect(entriesView.getUint32(entryBaseOffset + bindingOffset, true)).toBe(2); // binding = 2
            expect(entriesView.getBigUint64(entryBaseOffset + visibilityOffset, true)).toBe(0x4n); // visibility = FRAGMENT
            
            // Check texture sub-struct fields (sampleType, viewDimension, multisampled)
            expect(entriesView.getUint32(entryBaseOffset + textureOffset, true)).toBe(2); // texture.sampleType = float
            expect(entriesView.getUint32(entryBaseOffset + textureOffset + 4, true)).toBe(2); // texture.viewDimension = 2d
            expect(entriesView.getUint32(entryBaseOffset + textureOffset + 8, true)).toBe(0); // texture.multisampled = false
        });

        it("should handle empty entries array with correct length field", () => {
            const SimpleEntryStruct = defineStruct([
                ['value', 'u32']
            ] as const);

            const ContainerStruct = defineStruct([
                ['count', 'u32', { lengthOf: 'items' }],
                ['items', [SimpleEntryStruct]]
            ] as const);

            const input = { items: [] };
            
            const packed = ContainerStruct.pack(input);
            
            // Verify buffer size
            expect(packed.byteLength).toBe(ContainerStruct.size);
            
            // Verify count field is 0
            const view = new DataView(packed);
            const count = view.getUint32(0, true);
            expect(count).toBe(0);
            
            // Verify items pointer is null for empty array
            const itemsPtr = view.getBigUint64(8, true); // items pointer after count (u32 + padding)
            expect(itemsPtr).toBe(0n);
        });

        it("should calculate correct struct sizes for nested layouts", () => {
            const InnerStruct = defineStruct([
                ['a', 'u32'],
                ['b', 'f32']
            ] as const);
            
            const OuterStruct = defineStruct([
                ['count', 'u32', { lengthOf: 'items' }],
                ['items', [InnerStruct]]
            ] as const);
            
            // Each InnerStruct: u32(4) + f32(4) = 8 bytes
            expect(InnerStruct.size).toBe(8);
            // OuterStruct: u32(4) + padding(4) + pointer(8) = 16 bytes  
            expect(OuterStruct.size).toBe(16);
            
            const input = { items: [{ a: 1, b: 2.0 }, { a: 3, b: 4.0 }] };
            const packed = OuterStruct.pack(input);
            
            expect(packed.byteLength).toBe(16);
            
            const view = new DataView(packed);
            const count = view.getUint32(0, true);
            expect(count).toBe(2); // Should auto-set from items.length
        });

        it("should handle empty sub-structs with default values", () => {
            const BufferLayoutStruct = defineStruct([
                ['type', 'u32', { default: 2 }], // uniform = 2
                ['hasDynamicOffset', 'bool_u32', { default: false }],
                ['minBindingSize', 'u64', { default: 0 }]
            ] as const);

            const SamplerLayoutStruct = defineStruct([
                ['type', 'u32', { default: 2 }] // filtering = 2
            ] as const);

            const TextureLayoutStruct = defineStruct([
                ['sampleType', 'u32', { default: 2 }], // float = 2
                ['viewDimension', 'u32', { default: 2 }], // 2d = 2
                ['multisampled', 'bool_u32', { default: false }]
            ] as const);

            const BindGroupLayoutEntryStruct = defineStruct([
                ['binding', 'u32'],
                ['visibility', 'u64'],
                ['buffer', BufferLayoutStruct, { optional: true }],
                ['sampler', SamplerLayoutStruct, { optional: true }],
                ['texture', TextureLayoutStruct, { optional: true }]
            ] as const);

            const BindGroupLayoutDescriptorStruct = defineStruct([
                ['label', 'cstring', { optional: true }],
                ['entryCount', 'u64', { lengthOf: 'entries' }],
                ['entries', [BindGroupLayoutEntryStruct]]
            ] as const);

            // Test data with EMPTY objects - should get filled with defaults
            const input = {
                label: "test-defaults",
                entries: [
                    {
                        binding: 0,
                        visibility: 0x4n, // FRAGMENT = 4
                        buffer: {} // Empty object - should get defaults
                    },
                    {
                        binding: 1,
                        visibility: 0x4n, // FRAGMENT = 4
                        sampler: {} // Empty object - should get defaults
                    },
                    {
                        binding: 2,
                        visibility: 0x4n, // FRAGMENT = 4
                        texture: {} // Empty object - should get defaults
                    }
                ]
            };

            const packed = BindGroupLayoutDescriptorStruct.pack(input);
            
            // Verify basic properties
            expect(packed.byteLength).toBe(BindGroupLayoutDescriptorStruct.size);
            
            const view = new DataView(packed);
            const entryCount = view.getBigUint64(8, true);
            expect(entryCount).toBe(3n);
            
            const entriesPtr = view.getBigUint64(16, true);
            expect(entriesPtr).not.toBe(0n);
            
            // Verify the packed entries have default values
            const entryStructSize = BindGroupLayoutEntryStruct.size;
            const totalEntriesSize = entryStructSize * 3;
            
            // Get field offsets
            const entryLayout = BindGroupLayoutEntryStruct.describe();
            const bindingOffset = entryLayout.find(f => f.name === 'binding')?.offset ?? 0;
            const visibilityOffset = entryLayout.find(f => f.name === 'visibility')?.offset ?? 0;
            const bufferOffset = entryLayout.find(f => f.name === 'buffer')?.offset ?? 0;
            const samplerOffset = entryLayout.find(f => f.name === 'sampler')?.offset ?? 0;
            const textureOffset = entryLayout.find(f => f.name === 'texture')?.offset ?? 0;
            
            // @ts-ignore
            const entriesBuffer = toArrayBuffer(Number(entriesPtr), 0, totalEntriesSize);
            const entriesView = new DataView(entriesBuffer);
            
            // Verify first entry (buffer with defaults)
            let entryBaseOffset = 0;
            expect(entriesView.getUint32(entryBaseOffset + bindingOffset, true)).toBe(0);
            expect(entriesView.getBigUint64(entryBaseOffset + visibilityOffset, true)).toBe(0x4n);
            
            // Buffer should have DEFAULT values (type=2, hasDynamicOffset=false, minBindingSize=0)
            expect(entriesView.getUint32(entryBaseOffset + bufferOffset, true)).toBe(2); // default type = uniform
            expect(entriesView.getUint32(entryBaseOffset + bufferOffset + 4, true)).toBe(0); // default hasDynamicOffset = false
            expect(entriesView.getBigUint64(entryBaseOffset + bufferOffset + 8, true)).toBe(0n); // default minBindingSize = 0
            
            // Verify second entry (sampler with defaults)
            entryBaseOffset = entryStructSize;
            expect(entriesView.getUint32(entryBaseOffset + bindingOffset, true)).toBe(1);
            expect(entriesView.getBigUint64(entryBaseOffset + visibilityOffset, true)).toBe(0x4n);
            
            // Sampler should have DEFAULT value (type=2)
            expect(entriesView.getUint32(entryBaseOffset + samplerOffset, true)).toBe(2); // default type = filtering
            
            // Verify third entry (texture with defaults)
            entryBaseOffset = entryStructSize * 2;
            expect(entriesView.getUint32(entryBaseOffset + bindingOffset, true)).toBe(2);
            expect(entriesView.getBigUint64(entryBaseOffset + visibilityOffset, true)).toBe(0x4n);
            
            // Texture should have DEFAULT values (sampleType=2, viewDimension=2, multisampled=false)
            expect(entriesView.getUint32(entryBaseOffset + textureOffset, true)).toBe(2); // default sampleType = float
            expect(entriesView.getUint32(entryBaseOffset + textureOffset + 4, true)).toBe(2); // default viewDimension = 2d
            expect(entriesView.getUint32(entryBaseOffset + textureOffset + 8, true)).toBe(0); // default multisampled = false
        });

        it("should handle enum defaults in empty sub-structs (reproducing GPUDevice issue)", () => {
            // Create enums exactly like the real ones
            const SampleTypeEnum = defineEnum({
                "binding-not-used": 0,
                undefined: 1,
                float: 2,
                "unfilterable-float": 3,
                depth: 4,
                sint: 5,
                uint: 6,
            });

            const ViewDimensionEnum = defineEnum({
                "undefined": 0,
                "1d": 1,
                "2d": 2,
                "2d-array": 3,
                cube: 4,
                "cube-array": 5,
                "3d": 6,
            });

            // Create struct with enum defaults (like WGPUTextureBindingLayoutStruct)
            const TextureLayoutStruct = defineStruct([
                ['nextInChain', 'pointer', { optional: true }],
                ['sampleType', SampleTypeEnum, { default: 'float' }], // Should become 2
                ['viewDimension', ViewDimensionEnum, { default: '2d' }], // Should become 2
                ['multisampled', 'bool_u32', { default: false }],
            ] as const);

            // Create parent struct (like WGPUBindGroupLayoutEntryStruct)
            const EntryStruct = defineStruct([
                ['binding', 'u32'],
                ['visibility', 'u64'],
                ['texture', TextureLayoutStruct, { optional: true }], // This is the problematic field
            ] as const);

            // Test input with empty texture object (like GPUDevice test)
            const input = {
                binding: 2,
                visibility: 0x4n,
                texture: {} // Empty object - should get enum defaults applied!
            };

            const packed = EntryStruct.pack(input);
            
            // Get field offsets
            const layout = EntryStruct.describe();
            const textureOffset = layout.find(f => f.name === 'texture')?.offset ?? 0;
            
            const view = new DataView(packed);
            
            // Check that enum defaults were applied correctly
            const sampleType = view.getUint32(textureOffset + 8, true); // After nextInChain pointer
            const viewDimension = view.getUint32(textureOffset + 12, true); // After sampleType
            const multisampled = view.getUint32(textureOffset + 16, true); // After viewDimension
            
            console.log('=== ENUM DEFAULT TEST ===');
            console.log('texture offset:', textureOffset);
            console.log('sampleType (should be 2):', sampleType);
            console.log('viewDimension (should be 2):', viewDimension);
            console.log('multisampled (should be 0):', multisampled);
            
            // These should be the enum values, not zeros!
            expect(sampleType).toBe(2); // 'float' enum value
            expect(viewDimension).toBe(2); // '2d' enum value  
            expect(multisampled).toBe(0); // false
        });
    });
}); 