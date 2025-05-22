import { ptr, toArrayBuffer, type Pointer } from "bun:ffi";
import { fatalError } from "./utils/error";

export const pointerSize = process.arch === 'x64' || process.arch === 'arm64' ? 8 : 4;

type PrimitiveType = 'u8' | 'u16' | 'u32' | 'u64' | 'f32' | 'f64' | 'pointer' | 'i32' | 'bool_u8' | 'bool_u32';

const typeSizes: Record<PrimitiveType, number> = {
  u8: 1,
  bool_u8: 1,
  bool_u32: 4,
  u16: 2,
  u32: 4,
  u64: 8,
  f32: 4,
  f64: 8,
  pointer: pointerSize,
  i32: 4,
} as const;
const primitiveKeys = Object.keys(typeSizes);

function isPrimitiveType(type: any): type is PrimitiveType {
  return typeof type === 'string' && primitiveKeys.includes(type);
}

const typeAlignments: Record<PrimitiveType, number> = { ...typeSizes };

const typeGetters = {
  u8: (view: DataView, offset: number) => view.getUint8(offset),
  bool_u8: (view: DataView, offset: number) => Boolean(view.getUint8(offset)),
  bool_u32: (view: DataView, offset: number) => Boolean(view.getUint32(offset, true)),
  u16: (view: DataView, offset: number) => view.getUint16(offset, true),
  u32: (view: DataView, offset: number) => view.getUint32(offset, true),
  u64: (view: DataView, offset: number) => view.getBigUint64(offset, true),
  f32: (view: DataView, offset: number) => view.getFloat32(offset, true),
  f64: (view: DataView, offset: number) => view.getFloat64(offset, true),
  i32: (view: DataView, offset: number) => view.getInt32(offset, true),
  pointer: (view: DataView, offset: number) =>
    pointerSize === 8
      ? view.getBigUint64(offset, true)
      : BigInt(view.getUint32(offset, true)),
};

// --- Types ---
interface PointyObject {
  ptr: Pointer | number | bigint | null
}

interface ObjectPointerDef<T extends PointyObject> {
  __type: 'objectPointer';
}

export function objectPtr<T extends PointyObject>(): ObjectPointerDef<T> {
  return {
      __type: 'objectPointer',
  };
}

function isObjectPointerDef<T extends PointyObject>(
  type: any
): type is ObjectPointerDef<T> {
  return typeof type === 'object' && type !== null && type.__type === 'objectPointer';
}

type PrimitiveToTSType<T extends PrimitiveType> =
  T extends 'u8' | 'u16' | 'u32' | 'i32' | 'f32' | 'f64' ? number :
  T extends 'u64' ? bigint | number : // typescript webgpu types currently use numbers for u64
  T extends 'bool_u8' | 'bool_u32' ? boolean :
  T extends 'pointer' ? number | bigint : // Represent pointers as numbers or bigints
  never;

type FieldDefType<Def> =
  Def extends PrimitiveType ? PrimitiveToTSType<Def> :
  Def extends 'cstring' | 'char*' ? string | null : // Strings can be null
  Def extends EnumDef<infer E> ? keyof E : // Enums map to their keys
  Def extends StructDef<infer S> ? S : // Structs map to their inferred type
  Def extends ObjectPointerDef<infer T> ? T | null :
  Def extends readonly [infer InnerDef] ? // Array check
    InnerDef extends PrimitiveType ? Iterable<PrimitiveToTSType<InnerDef>> :
    InnerDef extends EnumDef<infer E> ? Iterable<keyof E> :
    InnerDef extends StructDef<infer S> ? Iterable<S> :
    InnerDef extends ObjectPointerDef<infer T> ? (T | null)[] :
    never :
  never;

type IsOptional<Options extends StructFieldOptions | undefined> =
  Options extends { optional: true } ? true :
  Options extends { default: any } ? true :
  Options extends { lengthOf: string } ? true : // lengthOf implies the field is derived/optional input
  false;

// Constructs the TS object type from the struct field definitions
export type StructObjectType<Fields extends readonly StructField[]> = {
  // Gather non-optional fields
  [F in Fields[number] as IsOptional<F[2]> extends false ? F[0] : never]: FieldDefType<F[1]>;
} & {
  // Gather optional fields (marked with '?')
  [F in Fields[number] as IsOptional<F[2]> extends true ? F[0] : never]?: FieldDefType<F[1]> | null;
};


type DefineStructReturnType<Fields extends readonly StructField[], Options extends StructDefOptions | undefined> =
    StructDef<
        StructObjectType<Fields>, // OutputType is always the derived object type
        Options extends { mapValue: (value: infer V) => any } // Check if mapValue exists with an inferable input type V
            ? V // If yes, InputType is V
            : StructObjectType<Fields> // Otherwise, InputType is the same as OutputType
    >;
// --- END: types ---

export function allocStruct(structDef: { size: number }): { buffer: ArrayBuffer; view: DataView } {
  const buffer = new ArrayBuffer(structDef.size);
  const view = new DataView(buffer);
  return { buffer, view };
}

function alignOffset(offset: number, align: number): number {
  return (offset + (align - 1)) & ~(align - 1);
}

interface EnumDef<T extends Record<string, number>> {
  __type: 'enum';
  type: Exclude<PrimitiveType, 'bool_u8' | 'bool_u32'>;
  to(value: keyof T): number;
  from(value: number | bigint): keyof T;
  enum: T;
}

// Enums
export function defineEnum<T extends Record<string, number>>(mapping: T, base: Exclude<PrimitiveType, 'bool_u8' | 'bool_u32'> = 'u32'): EnumDef<T> {
  const reverse = Object.fromEntries(Object.entries(mapping).map(([k, v]) => [v, k]));
  return {
    __type: 'enum',
    type: base,
    to(value: keyof T): number {
      return typeof value === 'number' ? value : mapping[value] ?? fatalError(`Invalid enum value: ${String(value)}`);
    },
    from(value: number): keyof T {
      return reverse[value] ?? fatalError(`Invalid enum value: ${value}`);
    },
    enum: mapping,
  };
}

function isEnum<T extends Record<string, number>>(type: any): type is EnumDef<T> {
  // Check for __type property first to avoid errors on non-objects
  return typeof type === 'object' && type.__type === 'enum';
}

interface StructFieldOptions {
  optional?: boolean,
  unpackTransform?: (value: any) => any,
  packTransform?: (value: any) => any,
  lengthOf?: string,
  asPointer?: boolean,
  default?: any,
};

type StructField =
  | readonly [string, PrimitiveType, StructFieldOptions?]
  | readonly [string, EnumDef<any>, StructFieldOptions?]
  | readonly [string, StructDef<any>, StructFieldOptions?]
  | readonly [string, 'cstring' | 'char*', StructFieldOptions?]
  | readonly [string, ObjectPointerDef<any>, StructFieldOptions?]
  | readonly [string, readonly [EnumDef<any> | StructDef<any> | PrimitiveType | ObjectPointerDef<any>], StructFieldOptions?];

interface StructLayoutField {
  name: string;
  offset: number;
  size: number;
  align: number;
  optional: boolean;
  default?: any;
  pack: (view: DataView, offset: number, value: any, obj: any) => void;
  unpack: (view: DataView, offset: number) => any;
}

interface StructDef<OutputType, InputType = OutputType> {
  __type: 'struct';
  size: number;
  align: number;
  pack(obj: InputType): ArrayBuffer;
  packInto(obj: InputType, view: DataView, offset: number): void;
  unpack(buf: ArrayBuffer | SharedArrayBuffer): OutputType;
  describe(): { name: string; offset: number; size: number; align: number; optional: boolean }[];
}

function isStruct(type: any): type is StructDef<any> {
  return typeof type === 'object' && type.__type === 'struct';
}

function primitivePackers(type: PrimitiveType) {
  let pack: (view: DataView, off: number, val: any) => void;
  let unpack: (view: DataView, off: number) => any;

  switch (type) {
    case 'u8':
      pack = (view: DataView, off: number, val: number) => view.setUint8(off, val);
      unpack = (view: DataView, off: number) => view.getUint8(off);
      break;
    case 'bool_u8':
      pack = (view: DataView, off: number, val: boolean) => view.setUint8(off, !!val ? 1 : 0);
      unpack = (view: DataView, off: number) => Boolean(view.getUint8(off));
      break;
    case 'bool_u32':
      pack = (view: DataView, off: number, val: boolean) => view.setUint32(off, !!val ? 1 : 0, true);
      unpack = (view: DataView, off: number) => Boolean(view.getUint32(off, true));
      break;
    case 'u16':
      pack = (view: DataView, off: number, val: number) => view.setUint16(off, val, true);
      unpack = (view: DataView, off: number) => view.getUint16(off, true);
      break;
    case 'u32':
      pack = (view: DataView, off: number, val: number) => view.setUint32(off, val, true);
      unpack = (view: DataView, off: number) => view.getUint32(off, true);
      break;
    case 'i32':
      pack = (view: DataView, off: number, val: number) => view.setInt32(off, val, true);
      unpack = (view: DataView, off: number) => view.getInt32(off, true);
      break;
    case 'u64':
      pack = (view: DataView, off: number, val: bigint) => view.setBigUint64(off, BigInt(val), true);
      unpack = (view: DataView, off: number) => view.getBigUint64(off, true);
      break;
    case 'f32':
      pack = (view: DataView, off: number, val: number) => view.setFloat32(off, val, true);
      unpack = (view: DataView, off: number) => view.getFloat32(off, true);
      break;
    case 'f64':
      pack = (view: DataView, off: number, val: number) => view.setFloat64(off, val, true);
      unpack = (view: DataView, off: number) => view.getFloat64(off, true);
      break;
    case 'pointer':
      pack = (view: DataView, off: number, val: bigint | number) => {
        pointerSize === 8
          ? view.setBigUint64(off, val ? BigInt(val) : 0n, true)
          : view.setUint32(off, val ? Number(val) : 0, true);
      };
      unpack = (view: DataView, off: number): bigint => {
        return pointerSize === 8
          ? view.getBigUint64(off, true)
          : BigInt(view.getUint32(off, true));
      }
      break;
    default:
      // This should be caught by PrimitiveType, but belts and suspenders
      fatalError(`Unsupported primitive type: ${type}`);
  }

  return { pack, unpack };
}

interface StructDefOptions {
  default?: Record<string, any>; // Default values for the entire struct on unpack
  mapValue?: (value: any) => any; // Map input object before packing
}

const { pack: pointerPacker, unpack: pointerUnpacker } = primitivePackers('pointer');

export function packObjectArray(val: (PointyObject | null)[]) {
  const buffer = new ArrayBuffer(val.length * pointerSize);
  const bufferView = new DataView(buffer);
  for (let i = 0; i < val.length; i++) {
      const instance = val[i];
      const ptrValue = instance?.ptr ?? null; // Extract pointer or null
      pointerPacker(bufferView, i * pointerSize, ptrValue);
  }
  return bufferView;
}

const encoder = new TextEncoder();

// Define Struct
export function defineStruct<const Fields extends readonly StructField[], const Opts extends StructDefOptions = {} >(
  fields: Fields,
  structDefOptions?: Opts // Capture the options type accurately
): DefineStructReturnType<Fields, Opts> {
  let offset = 0;
  let maxAlign = 1;
  const layout: StructLayoutField[] = [];
  const lengthOfFields: Record<string, StructLayoutField> = {};
  const lengthOfRequested: { requester: StructLayoutField, def: EnumDef<any> | PrimitiveType }[] = [];

  for (const [name, typeOrStruct, options = {}] of fields) {
    let size = 0, align = 0;
    let pack: (view: DataView, offset: number, value: any, obj: any) => void;
    let unpack: (view: DataView, offset: number) => any;
    let needsLengthOf = false;
    let lengthOfDef: EnumDef<any> | null = null;

    // Primitive
    if (isPrimitiveType(typeOrStruct)) {
      size = typeSizes[typeOrStruct];
      align = typeAlignments[typeOrStruct];
      ({ pack, unpack } = primitivePackers(typeOrStruct));
    // CString (null-terminated)
    } else if (typeof typeOrStruct === 'string' && typeOrStruct === 'cstring') {
      size = pointerSize;
      align = pointerSize;
      pack = (view: DataView, off: number, val: string | null) => {
        const bufPtr = val ? ptr(encoder.encode(val + '\0')) : null;
        pointerPacker(view, off, bufPtr);
      };
      unpack = (view: DataView, off: number) => {
        // TODO: Unpack CString from pointer
        const ptrVal = pointerUnpacker(view, off);
        // Need Bun FFI utilities to read string from pointer
        return ptrVal; // Returning pointer for now
      };
    // char* (raw string pointer, length usually external)
    } else if (typeof typeOrStruct === 'string' && typeOrStruct === 'char*') {
      size = pointerSize;
      align = pointerSize;
      pack = (view: DataView, off: number, val: string | null) => {
        const bufPtr = val ? ptr(encoder.encode(val)) : null; // No null terminator
        pointerPacker(view, off, bufPtr);
      };
      unpack = (view: DataView, off: number) => {
         // TODO: Unpack char* requires length info, typically from another field
        const ptrVal = pointerUnpacker(view, off);
        return ptrVal; // Returning pointer for now
      }
    // Enum
    } else if (isEnum(typeOrStruct)) {
      const base = typeOrStruct.type;
      size = typeSizes[base];
      align = typeAlignments[base];
      const { pack: packEnum } = primitivePackers(base);
      pack = (view, off, val) => {
        const num = typeOrStruct.to(val);
        packEnum(view, off, num);
      };
      unpack = (view, off) => {
        const raw = typeGetters[base](view, off);
        return typeOrStruct.from(raw);
      };
    // Struct
    } else if (isStruct(typeOrStruct)) {
      if (options.asPointer === true) {
        size = pointerSize;
        align = pointerSize;
        pack = (view, off, val) => {
          if (!val) {
             pointerPacker(view, off, null);
             return;
          }
          const nestedBuf = typeOrStruct.pack(val);
          pointerPacker(view, off, ptr(nestedBuf));
        };
        unpack = (view, off) => {
          throw new Error('Not implemented yet');
        };
      } else { // Inline struct
        size = typeOrStruct.size;
        align = typeOrStruct.align;
        pack = (view, off, val) => {
          const nestedBuf = typeOrStruct.pack(val);
          const nestedView = new Uint8Array(nestedBuf);
          const dView = new Uint8Array(view.buffer);
          dView.set(nestedView, off);
        };
        unpack = (view, off) => {
          const slice = view.buffer.slice(off, off + size);
          return typeOrStruct.unpack(slice);
        };
      }
    // Object Pointer
    } else if (isObjectPointerDef(typeOrStruct)) {
      size = pointerSize;
      align = pointerSize;

      pack = (view, off, value: PointyObject | null) => {
          const ptrValue = value?.ptr ?? null;
          // @ts-ignore
          if (ptrValue === undefined) {
               console.warn(`Field '${name}' expected object with '.ptr' property, but got undefined pointer value from:`, value);
               pointerPacker(view, off, null); // Pack null if pointer is missing
          } else {
              pointerPacker(view, off, ptrValue);
          }
      };
      // Unpacking returns the raw pointer value, not the class instance
      unpack = (view, off) => {
           return pointerUnpacker(view, off);
      };

    // Array ([EnumType], [StructType], [PrimitiveType], ...)
    } else if (Array.isArray(typeOrStruct) && typeOrStruct.length === 1) {
      const [def] = typeOrStruct;
      size = pointerSize; // Arrays are always represented by a pointer to the data
      align = pointerSize;

      if (isEnum(def)) {
        // Packing an array of enums
        const elemSize = def.type === 'u32' ? 4 : 8;
        pack = (view, off, val: string[], obj) => {
          if (!val || val.length === 0) {
            pointerPacker(view, off, null);
            return;
          }
          const buffer = new ArrayBuffer(val.length * elemSize);
          const bufferView = new DataView(buffer);
          for (let i = 0; i < val.length; i++) {
            const num = def.to(val[i]!);
            bufferView.setUint32(i * elemSize, num, true);
          }
          pointerPacker(view, off, ptr(buffer));
        };
        unpack = null!;
        needsLengthOf = true;
        lengthOfDef = def;
      } else if (isStruct(def)) {
        // Array of Structs
        const elemSize = def.size;
        pack = (view, off, val: any[]) => { // val should be StructObjectType<typeof def>[]
          if (!val || val.length === 0) {
            pointerPacker(view, off, null);
            return;
          }
          const buffer = new ArrayBuffer(val.length * elemSize);
          const bufferView = new DataView(buffer);
          for (let i = 0; i < val.length; i++) {
            def.packInto(val[i], bufferView, i * elemSize);
          }
          pointerPacker(view, off, ptr(buffer));
        };
        unpack = (view, off) => {
          throw new Error('Not implemented yet');
        };
      } else if (isPrimitiveType(def)) {
        // Array of Primitives
        const elemSize = typeSizes[def];
        const { pack: primitivePack } = primitivePackers(def);
         // Ensure 'val' type matches the expected primitive array type
        pack = (view, off, val: PrimitiveToTSType<typeof def>[]) => {
          if (!val || val.length === 0) {
            pointerPacker(view, off, null);
            return;
          }
          const buffer = new ArrayBuffer(val.length * elemSize);
          const bufferView = new DataView(buffer);
          for (let i = 0; i < val.length; i++) {
            primitivePack(bufferView, i * elemSize, val[i]);
          }
          pointerPacker(view, off, ptr(buffer));
        };
        unpack = null!;
        // TODO: Implement unpack for primitve array
      } else if (isObjectPointerDef(def)) {
        const elemSize = pointerSize; // Each element is a pointer
        pack = (view, off, val) => {
          if (!val || val.length === 0) {
              pointerPacker(view, off, null);
              return;
          }

          const packedView = packObjectArray(val);
          pointerPacker(view, off, ptr(packedView.buffer));
        }
        unpack = () => {
          // TODO: implement unpack for class pointers
          throw new Error('not implemented yet');
        }
      } else {
        throw new Error(`Unsupported array element type for ${name}: ${JSON.stringify(def)}`);
      }
    } else {
      throw new Error(`Unsupported field type for ${name}: ${JSON.stringify(typeOrStruct)}`);
    }

    offset = alignOffset(offset, align);

    if (options.unpackTransform) {
      const originalUnpack = unpack;
      unpack = (view, off) => options.unpackTransform!(originalUnpack(view, off));
    }
    if (options.packTransform) {
      const originalPack = pack;
      pack = (view, off, val, obj) => originalPack(view, off, options.packTransform!(val), obj);
    }
    if (options.optional) {
      const originalPack = pack;
      if (isStruct(typeOrStruct) && !options.asPointer) {
        pack = (view, off, val, obj) => {
          if (!val) {
            // no-op, just skip the inline range
          } else {
            originalPack(view, off, val, obj);
          }
        };
      } else {
        pack = (view, off, val, obj) => originalPack(view, off, val ?? 0, obj);
      }
    }
    if (options.lengthOf) {
      const originalPack = pack;
      pack = (view, off, val, obj) => originalPack(view, off, obj[options.lengthOf!] ? obj[options.lengthOf!].length : 0, obj);
    }

    // LAYOUT FIELD
    const layoutField: StructLayoutField = {
      name,
      offset,
      size,
      align,
      optional: !!options.optional || !!options.lengthOf || options.default !== undefined,
      default: options.default,
      pack,
      unpack
    };
    layout.push(layoutField);

    if (options.lengthOf) {
      lengthOfFields[options.lengthOf] = layoutField; // Map: arrayFieldName -> lengthFieldLayout
    }
    if (needsLengthOf) {
        if (!lengthOfDef) fatalError(`Internal error: needsLengthOf=true but lengthOfDef is null for ${name}`);
        lengthOfRequested.push({ requester: layoutField, def: lengthOfDef }); // requester = array field
    }

    offset += size;
    maxAlign = Math.max(maxAlign, align);
  }

  // Resolve lengthOf fields
  for (const { requester, def } of lengthOfRequested) {
    if (isPrimitiveType(def)) {
      // TODO: Implement lengthOf for primitive types
      continue;
    }
    const lengthOfField = lengthOfFields[requester.name];
    if (!lengthOfField) {
      throw new Error(`lengthOf field not found for array field ${requester.name}`);
    }
    const elemSize = def.type === 'u32' ? 4 : 8;

    requester.unpack = (view, off) => {
      const result = [];
      const length = lengthOfField.unpack(view, lengthOfField.offset);
      const ptrAddress = pointerUnpacker(view, off);

      if (ptrAddress === 0n && length > 0) {
        throw new Error(`Array field ${requester.name} has null pointer but length ${length}.`);
      }
      if (ptrAddress === 0n && length === 0) {
        return [];
      }
      if (length === 0) {
        return [];
      }

      const buffer = toArrayBuffer(ptrAddress, 0, length * elemSize);
      const bufferView = new DataView(buffer);

      for (let i = 0; i < length; i++) {
        result.push(def.from(bufferView.getUint32(i * elemSize, true)));
      }
      return result;
    }

  }

  const totalSize = alignOffset(offset, maxAlign);

  // Return the struct definition object conforming to StructDef<StructObjectType<Fields>>
  return {
    __type: 'struct',
    size: totalSize,
    align: maxAlign,

    pack(obj: StructObjectType<Fields>): ArrayBuffer {
      let mappedObj: any = obj;
      if (structDefOptions?.mapValue) {
        mappedObj = structDefOptions.mapValue(obj);
      }
      const buf = new ArrayBuffer(totalSize);
      const view = new DataView(buf);

      for (const field of layout) {
        const value = (mappedObj as any)[field.name] ?? field.default;
        if (!field.optional && value === undefined) {
          fatalError(`Packing non-optional field '${field.name}' but value is undefined (and no default provided)`);
        }
        field.pack(view, field.offset, value, mappedObj);
      }
      return view.buffer;
    },

    packInto(obj: StructObjectType<Fields>, view: DataView, offset: number): void {
      for (const field of layout) {
        const value = (obj as any)[field.name] ?? field.default;
        if (!field.optional && value === undefined) {
          console.warn(`packInto missing value for non-optional field '${field.name}' at offset ${offset + field.offset}. Writing default or zero.`);
        }
        field.pack(view, offset + field.offset, value, obj);
      }
    },

    // unpack method now returns the specific inferred object type
    unpack(buf: ArrayBuffer | SharedArrayBuffer): StructObjectType<Fields> {
      if (buf.byteLength < totalSize) {
        fatalError(`Buffer size (${buf.byteLength}) is smaller than struct size (${totalSize}) for unpacking.`);
      }
      const view = new DataView(buf);
      // Start with struct-level defaults if provided
      const result: any = structDefOptions?.default ? { ...structDefOptions.default } : {};

      for (const field of layout) {
        // Skip fields that don't have an unpacker (e.g., write-only or complex cases not yet impl)
        if (!field.unpack) {
           // This could happen for lengthOf fields if unpack isn't needed, or unimplemented array types
           // console.warn(`Field '${field.name}' has no unpacker defined.`);
           continue;
        }

        try {
          result[field.name] = field.unpack(view, field.offset);
        } catch (e: any) {
           console.error(`Error unpacking field '${field.name}' at offset ${field.offset}:`, e);
           throw e; // Re-throw after logging context
        }
      }
       // Assert the final result matches the inferred type
      return result as StructObjectType<Fields>;
    },

    describe() {
      return layout.map(f => ({
        name: f.name,
        offset: f.offset,
        size: f.size,
        align: f.align,
        optional: f.optional,
      }));
    }
  };
}
