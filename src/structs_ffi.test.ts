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

        it("should unpack complex nested structs with multiple levels and different types", () => {
            const ColorEnum = defineEnum({
                RED: 0,
                GREEN: 1,
                BLUE: 2
            });

            // Level 3 nested struct
            const PositionStruct = defineStruct([
                ['x', 'f32'],
                ['y', 'f32'],
                ['z', 'f32']
            ] as const);

            // Level 2 nested struct with enum and primitives
            const MaterialStruct = defineStruct([
                ['color', ColorEnum],
                ['opacity', 'f32', { default: 1.0 }],
                ['roughness', 'f32'],
                ['metallic', 'bool_u32', { default: false }]
            ] as const);

            // Level 1 nested struct combining the above
            const ObjectStruct = defineStruct([
                ['id', 'u32'],
                ['position', PositionStruct],
                ['material', MaterialStruct],
                ['scale', 'f32', { default: 1.0 }]
            ] as const);

            // Top level struct
            const SceneStruct = defineStruct([
                ['name', 'cstring'],
                ['objectCount', 'u32'],
                ['mainObject', ObjectStruct],
                ['ambientLight', 'f32'],
                ['enableShadows', 'bool_u8']
            ] as const);

            const input = {
                name: "test-scene",
                objectCount: 1,
                mainObject: {
                    id: 42,
                    position: { x: 10.5, y: -5.2, z: 3.7 },
                    material: {
                        color: 'BLUE' as const,
                        roughness: 0.8,
                        // opacity and metallic will use defaults
                    },
                    // scale will use default
                },
                ambientLight: 0.3,
                enableShadows: true
            };

            const packed = SceneStruct.pack(input);
            const unpacked = SceneStruct.unpack(packed);

            // Verify top level fields
            expect(unpacked.objectCount).toBe(1);
            expect(unpacked.ambientLight).toBeCloseTo(0.3);
            expect(unpacked.enableShadows).toBe(true);

            // Verify level 1 nested struct
            expect(unpacked.mainObject.id).toBe(42);
            expect(unpacked.mainObject.scale).toBeCloseTo(1.0); // default value

            // Verify level 2 nested struct (position)
            expect(unpacked.mainObject.position.x).toBeCloseTo(10.5);
            expect(unpacked.mainObject.position.y).toBeCloseTo(-5.2);
            expect(unpacked.mainObject.position.z).toBeCloseTo(3.7);

            // Verify level 2 nested struct (material) with enum and defaults
            expect(unpacked.mainObject.material.color).toBe('BLUE');
            expect(unpacked.mainObject.material.roughness).toBeCloseTo(0.8);
            expect(unpacked.mainObject.material.opacity).toBeCloseTo(1.0); // default value
            expect(unpacked.mainObject.material.metallic).toBe(false); // default value
        });

        it("should unpack optional nested structs correctly", () => {
            const ConfigStruct = defineStruct([
                ['enabled', 'bool_u32', { default: false }],
                ['timeout', 'u32', { default: 5000 }]
            ] as const);

            const ServiceStruct = defineStruct([
                ['name', 'cstring'],
                ['port', 'u32'],
                ['config', ConfigStruct, { optional: true }],
                ['fallbackPort', 'u32', { default: 8080 }]
            ] as const);

            // Test with config provided
            const inputWithConfig = {
                name: "test-service",
                port: 3000,
                config: {
                    enabled: true,
                    timeout: 10000
                }
            };

            const packedWithConfig = ServiceStruct.pack(inputWithConfig);
            const unpackedWithConfig = ServiceStruct.unpack(packedWithConfig);

            expect(unpackedWithConfig.port).toBe(3000);
            expect(unpackedWithConfig.fallbackPort).toBe(8080); // default
            expect(unpackedWithConfig.config).toBeDefined();
            expect(unpackedWithConfig.config!.enabled).toBe(true);
            expect(unpackedWithConfig.config!.timeout).toBe(10000);

            // Test with empty config (should get defaults)
            const inputWithEmptyConfig = {
                name: "test-service-2",
                port: 4000,
                config: {} // Empty config should get defaults
            };

            const packedWithEmptyConfig = ServiceStruct.pack(inputWithEmptyConfig);
            const unpackedWithEmptyConfig = ServiceStruct.unpack(packedWithEmptyConfig);

            expect(unpackedWithEmptyConfig.port).toBe(4000);
            expect(unpackedWithEmptyConfig.config).toBeDefined();
            expect(unpackedWithEmptyConfig.config!.enabled).toBe(false); // default value
            expect(unpackedWithEmptyConfig.config!.timeout).toBe(5000); // explicit default
        });

        it("should handle nested structs with different alignments correctly", () => {
            // Create structs with different alignment requirements
            const SmallStruct = defineStruct([
                ['a', 'u8'],
                ['b', 'u8']
            ] as const);

            const LargeStruct = defineStruct([
                ['x', 'u64'],
                ['y', 'f64']
            ] as const);

            const MixedStruct = defineStruct([
                ['flag', 'u8'],
                ['small', SmallStruct], // Should be aligned properly
                ['big', LargeStruct],   // Should force 8-byte alignment
                ['value', 'u32']
            ] as const);

            const input = {
                flag: 255,
                small: { a: 10, b: 20 },
                big: { x: 0x1234567890ABCDEFn, y: 3.14159 },
                value: 0xDEADBEEF
            };

            const packed = MixedStruct.pack(input);
            const unpacked = MixedStruct.unpack(packed);

            // Verify all fields unpacked correctly despite alignment complexity
            expect(unpacked.flag).toBe(255);
            expect(unpacked.small.a).toBe(10);
            expect(unpacked.small.b).toBe(20);
            expect(unpacked.big.x).toBe(0x1234567890ABCDEFn);
            expect(unpacked.big.y).toBeCloseTo(3.14159);
            expect(unpacked.value).toBe(0xDEADBEEF);

            // Verify struct has expected size (considering alignment)
            expect(MixedStruct.size).toBeGreaterThan(1 + 2 + 16 + 4); // At least the sum of field sizes
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

        it("should apply reduceValue transformation", () => {
            const StringStruct = defineStruct([
                ['data', 'char*'],
                ['length', 'u64'],
            ] as const, {
                mapValue: (v: string) => ({
                    data: v,
                    length: Buffer.byteLength(v),
                }),
                reduceValue: (v: { data: number; length: bigint }) => {
                    // @ts-ignore - toArrayBuffer pointer type issue
                    const buffer = toArrayBuffer(v.data, 0, Number(v.length));
                    return new TextDecoder().decode(buffer);
                },
            });

            const testString = "Hello, World! 🌍";
            const packed = StringStruct.pack(testString);
            const unpacked = StringStruct.unpack(packed);

            // The unpacked value should be the original string (transformed by reduceValue)
            expect(typeof unpacked).toBe('string');
            expect(unpacked).toBe(testString);
        });

        it("should support both mapValue and reduceValue with different types", () => {
            interface Point3D {
                x: number;
                y: number;
                z: number;
            }

            const Point3DStruct = defineStruct([
                ['x', 'f32'],
                ['y', 'f32'],
                ['z', 'f32'],
                ['magnitude', 'f32'] // Computed field
            ] as const, {
                mapValue: (point: Point3D) => ({
                    x: point.x,
                    y: point.y,
                    z: point.z,
                    magnitude: Math.sqrt(point.x * point.x + point.y * point.y + point.z * point.z)
                }),
                reduceValue: (packed: { x: number; y: number; z: number; magnitude: number }) => ({
                    x: packed.x,
                    y: packed.y,
                    z: packed.z,
                    // Note: we can return a different structure or add computed properties
                    length: packed.magnitude,
                    normalized: {
                        x: packed.x / packed.magnitude,
                        y: packed.y / packed.magnitude,
                        z: packed.z / packed.magnitude,
                    }
                })
            });

            const inputPoint: Point3D = { x: 3, y: 4, z: 5 };
            const packed = Point3DStruct.pack(inputPoint);
            const unpacked = Point3DStruct.unpack(packed);

            // Verify the transformed output
            expect(unpacked.x).toBeCloseTo(3);
            expect(unpacked.y).toBeCloseTo(4);
            expect(unpacked.z).toBeCloseTo(5);
            expect(unpacked.length).toBeCloseTo(Math.sqrt(50)); // ~7.07
            expect(unpacked.normalized.x).toBeCloseTo(3 / Math.sqrt(50));
            expect(unpacked.normalized.y).toBeCloseTo(4 / Math.sqrt(50));
            expect(unpacked.normalized.z).toBeCloseTo(5 / Math.sqrt(50));
        });

        it("should work without reduceValue (normal struct behavior)", () => {
            const NormalStruct = defineStruct([
                ['a', 'u32'],
                ['b', 'f32']
            ] as const);

            const input = { a: 42, b: 3.14 };
            const packed = NormalStruct.pack(input);
            const unpacked = NormalStruct.unpack(packed);

            // Should return the raw struct object
            expect(unpacked.a).toBe(42);
            expect(unpacked.b).toBeCloseTo(3.14);
            expect(typeof unpacked).toBe('object');
        });

        it("should handle nested structs with reduceValue transformations", () => {
            // Create a nested struct that transforms a coordinate pair into a complex number
            const ComplexNumberStruct = defineStruct([
                ['real', 'f32'],
                ['imaginary', 'f32']
            ] as const, {
                mapValue: (complex: { re: number; im: number }) => ({
                    real: complex.re,
                    imaginary: complex.im
                }),
                reduceValue: (packed: { real: number; imaginary: number }) => ({
                    re: packed.real,
                    im: packed.imaginary,
                    magnitude: Math.sqrt(packed.real * packed.real + packed.imaginary * packed.imaginary),
                    phase: Math.atan2(packed.imaginary, packed.real),
                    toString: () => `${packed.real} + ${packed.imaginary}i`
                })
            });

            // Create a parent struct that contains the transformed nested struct
            const SignalStruct = defineStruct([
                ['frequency', 'f32'],
                ['amplitude', ComplexNumberStruct],
                ['timestamp', 'u64']
            ] as const, {
                reduceValue: (packed: { frequency: number; amplitude: any; timestamp: bigint }) => ({
                    freq: packed.frequency,
                    signal: packed.amplitude, // This should be the transformed complex number
                    time: Number(packed.timestamp),
                    powerLevel: packed.amplitude.magnitude * packed.frequency
                })
            });

            const input = {
                frequency: 440.0, // A4 note
                amplitude: { re: 3.0, im: 4.0 }, // Complex number input
                timestamp: 1234567890n
            };

            const packed = SignalStruct.pack(input);
            const unpacked = SignalStruct.unpack(packed);

            // Verify the outer transformation worked
            expect(unpacked.freq).toBeCloseTo(440.0);
            expect(unpacked.time).toBe(1234567890);
            expect(unpacked.powerLevel).toBeCloseTo(440.0 * 5.0); // magnitude of 3+4i is 5

            // Verify the nested struct transformation worked
            expect(unpacked.signal.re).toBeCloseTo(3.0);
            expect(unpacked.signal.im).toBeCloseTo(4.0);
            expect(unpacked.signal.magnitude).toBeCloseTo(5.0); // sqrt(3^2 + 4^2)
            expect(unpacked.signal.phase).toBeCloseTo(Math.atan2(4, 3));
            expect(typeof unpacked.signal.toString).toBe('function');
            expect(unpacked.signal.toString()).toBe('3 + 4i');
        });

        it("should handle multiple nested structs with different reduceValue transformations", () => {
            // Version struct that transforms to a string
            const VersionStruct = defineStruct([
                ['major', 'u32'],
                ['minor', 'u32'],
                ['patch', 'u32']
            ] as const, {
                reduceValue: (v: { major: number; minor: number; patch: number }) => 
                    `${v.major}.${v.minor}.${v.patch}`
            });

            // Status struct that transforms to an enum-like object
            const StatusStruct = defineStruct([
                ['code', 'u32'],
                ['message', 'char*'],
                ['severity', 'u32']
            ] as const, {
                mapValue: (status: { code: number; msg: string; level: number }) => ({
                    code: status.code,
                    message: status.msg,
                    severity: status.level
                }),
                reduceValue: (s: { code: number; message: number; severity: number }) => ({
                    isOk: s.code === 0,
                    isWarning: s.severity === 1,
                    isError: s.severity === 2,
                    statusCode: s.code,
                    // Note: message is a pointer in the packed struct
                    messagePtr: s.message
                })
            });

            // Parent struct containing multiple transformed nested structs
            const ApplicationStruct = defineStruct([
                ['name', 'cstring'],
                ['version', VersionStruct],
                ['status', StatusStruct],
                ['uptime', 'u64']
            ] as const);

            const input = {
                name: "MyApp",
                version: { major: 2, minor: 1, patch: 3 },
                status: { code: 0, msg: "OK", level: 0 },
                uptime: 86400n // 1 day in seconds
            };

            const packed = ApplicationStruct.pack(input);
            const unpacked = ApplicationStruct.unpack(packed);

            // Verify the version was transformed to a string
            expect(typeof unpacked.version).toBe('string');
            expect(unpacked.version).toBe('2.1.3');

            // Verify the status was transformed to the enum-like object
            const transformedStatus = unpacked.status as { isOk: boolean; isWarning: boolean; isError: boolean; statusCode: number; messagePtr: number };
            expect(transformedStatus.isOk).toBe(true);
            expect(transformedStatus.isWarning).toBe(false);
            expect(transformedStatus.isError).toBe(false);
            expect(transformedStatus.statusCode).toBe(0);
            expect(typeof transformedStatus.messagePtr).toBe('number');

            // Verify other fields remain unchanged
            expect(unpacked.uptime).toBe(86400n);
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
            
            // These should be the enum values, not zeros!
            expect(sampleType).toBe(2); // 'float' enum value
            expect(viewDimension).toBe(2); // '2d' enum value  
            expect(multisampled).toBe(0); // false
        });
    });

    describe("empty object defaults", () => {
        it("should apply defaults when packing empty objects", () => {
            const SamplerStruct = defineStruct([
                ['type', 'u32', { default: 2 }] // filtering = 2
            ] as const);

            // Test packing with empty object vs undefined
            const emptyObjectPacked = SamplerStruct.pack({});
            
            const emptyView = new DataView(emptyObjectPacked);
            
            // Empty object should apply the default value of 2
            expect(emptyView.getUint32(0, true)).toBe(2);
        });

        it("should handle nested struct with empty object", () => {
            const SamplerStruct = defineStruct([
                ['type', 'u32', { default: 2 }]
            ] as const);
            
            const EntryStruct = defineStruct([
                ['binding', 'u32'],
                ['sampler', SamplerStruct, { optional: true }]
            ] as const);

            // This mimics the GPUDevice scenario: sampler: {}
            const packed = EntryStruct.pack({
                binding: 1,
                sampler: {} // Empty object - should get defaults
            });
            
            const view = new DataView(packed);
            const binding = view.getUint32(0, true);
            const samplerType = view.getUint32(4, true); // sampler.type after binding field
            
            expect(binding).toBe(1);
            expect(samplerType).toBe(2); // Should have default applied
        });
    });

    describe("conditional fields", () => {
        it("should include field when condition returns true", () => {
            const TestStruct = defineStruct([
                ['field1', 'u32'],
                ['conditionalField', 'u32', { condition: () => true, default: 42 }],
                ['field2', 'u32']
            ] as const);

            // Field should be included in layout
            const layout = TestStruct.describe();
            expect(layout).toHaveLength(3);
            
            const conditionalField = layout.find(f => f.name === 'conditionalField');
            expect(conditionalField).toBeDefined();
            expect(conditionalField?.size).toBe(4);

            // Struct size should include the conditional field
            expect(TestStruct.size).toBe(12); // 3 * u32 = 12 bytes

            // Packing should work with the field included
            const packed = TestStruct.pack({ field1: 1, field2: 3 });
            const unpacked = TestStruct.unpack(packed);
            
            expect(unpacked.field1).toBe(1);
            expect(unpacked.conditionalField).toBe(42); // default value
            expect(unpacked.field2).toBe(3);
        });

        it("should exclude field when condition returns false", () => {
            const TestStruct = defineStruct([
                ['field1', 'u32'],
                ['excludedField', 'u32', { condition: () => false, default: 42 }],
                ['field2', 'u32']
            ] as const);

            // Field should NOT be included in layout
            const layout = TestStruct.describe();
            expect(layout).toHaveLength(2);
            
            const excludedField = layout.find(f => f.name === 'excludedField');
            expect(excludedField).toBeUndefined();

            // Struct size should NOT include the excluded field
            expect(TestStruct.size).toBe(8); // 2 * u32 = 8 bytes (not 12)

            // Packing should work without the excluded field
            const packed = TestStruct.pack({ field1: 1, field2: 3 });
            const unpacked = TestStruct.unpack(packed);
            
            expect(unpacked.field1).toBe(1);
            expect(unpacked.field2).toBe(3);
            expect((unpacked as any).excludedField).toBeUndefined(); // Field should not exist
        });

        it("should handle conditional fields affecting alignment", () => {
            // Test alignment changes when conditional fields are excluded
            const TestStructWithAlignment = defineStruct([
                ['smallField', 'u8'],
                ['alignmentField', 'u64', { condition: () => false }], // This would force alignment
                ['normalField', 'u32']
            ] as const);

            const TestStructWithoutAlignment = defineStruct([
                ['smallField', 'u8'],
                ['normalField', 'u32']
            ] as const);

            // Both structs should have the same layout when the alignment field is excluded
            expect(TestStructWithAlignment.size).toBe(TestStructWithoutAlignment.size);
            expect(TestStructWithAlignment.describe()).toEqual(TestStructWithoutAlignment.describe());
        });

        it("should handle nested structs with conditional fields", () => {
            const InnerStruct = defineStruct([
                ['value', 'u32'],
                ['conditionalInner', 'u32', { condition: () => true, default: 99 }]
            ] as const);

            const OuterStruct = defineStruct([
                ['prefix', 'u32'],
                ['inner', InnerStruct],
                ['conditionalOuter', 'u32', { condition: () => false, default: 88 }],
                ['suffix', 'u32']
            ] as const);

            // Verify layout
            const layout = OuterStruct.describe();
            expect(layout).toHaveLength(3); // prefix, inner, suffix (conditionalOuter excluded)
            
            const conditionalOuter = layout.find(f => f.name === 'conditionalOuter');
            expect(conditionalOuter).toBeUndefined();

            // Inner struct should still have its conditional field
            expect(InnerStruct.size).toBe(8); // 2 * u32

            // Pack and verify
            const input = {
                prefix: 1,
                inner: { value: 10 },
                suffix: 3
            };

            const packed = OuterStruct.pack(input);
            const unpacked = OuterStruct.unpack(packed);

            expect(unpacked.prefix).toBe(1);
            expect(unpacked.inner.value).toBe(10);
            expect(unpacked.inner.conditionalInner).toBe(99); // default from inner struct
            expect(unpacked.suffix).toBe(3);
            expect((unpacked as any).conditionalOuter).toBeUndefined();
        });

        it("should handle arrays with conditional length fields", () => {
            const TestEnum = defineEnum({
                VALUE_A: 0,
                VALUE_B: 1,
                VALUE_C: 2
            });

            const TestStruct = defineStruct([
                ['normalCount', 'u32', { lengthOf: 'normalArray' }],
                ['normalArray', [TestEnum]],
                ['conditionalCount', 'u32', { condition: () => false, lengthOf: 'conditionalArray' }],
                ['conditionalArray', [TestEnum], { condition: () => false }],
                ['suffix', 'u32']
            ] as const);

            // Only fields with condition true should be in layout
            const layout = TestStruct.describe();
            expect(layout).toHaveLength(3); // normalCount, normalArray, suffix
            
            expect(layout.find(f => f.name === 'conditionalCount')).toBeUndefined();
            expect(layout.find(f => f.name === 'conditionalArray')).toBeUndefined();

            const input = {
                normalArray: ['VALUE_A', 'VALUE_B', 'VALUE_C'] as const,
                suffix: 99
            };

            const packed = TestStruct.pack(input);
            const unpacked = TestStruct.unpack(packed);

            expect(unpacked.normalCount).toBe(3);
            expect(unpacked.normalArray).toEqual(['VALUE_A', 'VALUE_B', 'VALUE_C']);
            expect(unpacked.suffix).toBe(99);
            expect((unpacked as any).conditionalCount).toBeUndefined();
            expect((unpacked as any).conditionalArray).toBeUndefined();
        });

        it("should handle real-world platform-specific field (like _alignment0)", () => {
            // Simulate the actual WGPUBindGroupLayoutEntryStruct behavior
            let simulatedPlatform = 'linux';
            
            const PlatformStruct = defineStruct([
                ['binding', 'u32'],
                ['visibility', 'u64'],
                ['_alignment0', 'u64', { 
                    default: 0, 
                    condition: () => simulatedPlatform === 'linux' 
                }],
                ['buffer', 'u32', { optional: true, default: 1 }]
            ] as const);

            // On Linux - field should be included
            const linuxLayout = PlatformStruct.describe();
            expect(linuxLayout).toHaveLength(4);
            expect(linuxLayout.find(f => f.name === '_alignment0')).toBeDefined();

            const linuxSize = PlatformStruct.size;
            
            // Test packing on Linux
            const linuxPacked = PlatformStruct.pack({ binding: 0, visibility: 4n });
            const linuxUnpacked = PlatformStruct.unpack(linuxPacked);
            expect(linuxUnpacked._alignment0).toBe(0n);

            // Now simulate non-Linux platform
            simulatedPlatform = 'darwin';
            
            const NonLinuxStruct = defineStruct([
                ['binding', 'u32'],
                ['visibility', 'u64'],
                ['_alignment0', 'u64', { 
                    default: 0, 
                    condition: () => simulatedPlatform === 'linux' 
                }],
                ['buffer', 'u32', { optional: true, default: 1 }]
            ] as const);

            // On non-Linux - field should be excluded
            const nonLinuxLayout = NonLinuxStruct.describe();
            expect(nonLinuxLayout).toHaveLength(3);
            expect(nonLinuxLayout.find(f => f.name === '_alignment0')).toBeUndefined();

            const nonLinuxSize = NonLinuxStruct.size;
            expect(nonLinuxSize).toBeLessThan(linuxSize); // Should be smaller without alignment field

            // Test packing on non-Linux
            const nonLinuxPacked = NonLinuxStruct.pack({ binding: 0, visibility: 4n });
            const nonLinuxUnpacked = NonLinuxStruct.unpack(nonLinuxPacked);
            expect((nonLinuxUnpacked as any)._alignment0).toBeUndefined();
        });

        it("should evaluate condition only once at definition time", () => {
            let conditionCallCount = 0;
            
            const TestStruct = defineStruct([
                ['field1', 'u32'],
                ['conditionalField', 'u32', { 
                    condition: () => {
                        conditionCallCount++;
                        return true;
                    },
                    default: 42 
                }]
            ] as const);

            // Condition should have been called once during definition
            expect(conditionCallCount).toBe(1);

            // Multiple pack operations should not call condition again
            TestStruct.pack({ field1: 1 });
            TestStruct.pack({ field1: 2 });
            TestStruct.pack({ field1: 3 });

            expect(conditionCallCount).toBe(1); // Still only called once

            // Unpack operations should not call condition
            const packed = TestStruct.pack({ field1: 1 });
            TestStruct.unpack(packed);
            TestStruct.unpack(packed);

            expect(conditionCallCount).toBe(1); // Still only called once
        });

        it("should handle multiple conditional fields with different conditions", () => {
            const TestStruct = defineStruct([
                ['alwaysField', 'u32'],
                ['trueConditionField', 'u32', { condition: () => true, default: 1 }],
                ['falseConditionField', 'u32', { condition: () => false, default: 2 }],
                ['complexConditionField', 'u32', { 
                    condition: () => process.env.NODE_ENV !== 'test', 
                    default: 3 
                }]
            ] as const);

            const layout = TestStruct.describe();
            
            // Should include alwaysField and trueConditionField
            expect(layout.find(f => f.name === 'alwaysField')).toBeDefined();
            expect(layout.find(f => f.name === 'trueConditionField')).toBeDefined();
            
            // Should exclude falseConditionField
            expect(layout.find(f => f.name === 'falseConditionField')).toBeUndefined();
            
            // complexConditionField depends on NODE_ENV (likely excluded in test environment)
            const complexField = layout.find(f => f.name === 'complexConditionField');
            if (process.env.NODE_ENV === 'test') {
                expect(complexField).toBeUndefined();
            } else {
                expect(complexField).toBeDefined();
            }

            const packed = TestStruct.pack({ alwaysField: 10 });
            const unpacked = TestStruct.unpack(packed);

            expect(unpacked.alwaysField).toBe(10);
            expect(unpacked.trueConditionField).toBe(1);
            expect((unpacked as any).falseConditionField).toBeUndefined();
        });
    });
}); 