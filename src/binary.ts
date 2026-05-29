import { ScalarType } from '@bufbuild/protobuf';

export class BinaryWriter {
	bytes: number[] = [];

	writeUint8(val: number) {
		this.bytes.push(val & 255);
	}

	writeUint16(val: number) {
		this.bytes.push(val & 255, (val >> 8) & 255);
	}

	writeUint32(val: number) {
		this.bytes.push(
			val & 255,
			(val >> 8) & 255,
			(val >> 16) & 255,
			(val >> 24) & 255,
		);
	}

	writeInt32(val: number) {
		this.writeUint32(val >>> 0);
	}

	writeFloat32(val: number) {
		const buf = new ArrayBuffer(4);
		new DataView(buf).setFloat32(0, val, true);
		const u8 = new Uint8Array(buf);
		this.bytes.push(u8[0], u8[1], u8[2], u8[3]);
	}

	writeBytes(val: Uint8Array) {
		this.writeUint32(val.length);
		for (let i = 0; i < val.length; i++) {
			this.bytes.push(val[i]);
		}
	}

	toUint8Array(): Uint8Array {
		return new Uint8Array(this.bytes);
	}
}

export class BinaryReader {
	view: DataView;
	buffer: Uint8Array;
	offset: number = 0;

	constructor(buffer: Uint8Array) {
		this.buffer = buffer;
		this.view = new DataView(
			buffer.buffer,
			buffer.byteOffset,
			buffer.byteLength,
		);
	}

	readUint8(): number {
		const val = this.view.getUint8(this.offset);
		this.offset += 1;
		return val;
	}

	readUint16(): number {
		const val = this.view.getUint16(this.offset, true);
		this.offset += 2;
		return val;
	}

	readUint32(): number {
		const val = this.view.getUint32(this.offset, true);
		this.offset += 4;
		return val;
	}

	readInt32(): number {
		const val = this.view.getInt32(this.offset, true);
		this.offset += 4;
		return val;
	}

	readFloat32(): number {
		const val = this.view.getFloat32(this.offset, true);
		this.offset += 4;
		return val;
	}

	readBytes(): Uint8Array {
		const len = this.readUint32();
		const start = this.offset;
		const end = start + len;
		this.offset = end;
		return this.buffer.subarray(start, end);
	}
}

const textDecoder = new TextDecoder('utf-8');
const textEncoder = new TextEncoder();

const fieldsByNumberCache = new WeakMap<any, Map<number, any>>();
const fieldsByLocalNameCache = new WeakMap<any, Map<string, any>>();

function getFieldsByNumber(schema: any): Map<number, any> {
	let map = fieldsByNumberCache.get(schema);
	if (!map) {
		map = new Map<number, any>();
		for (const field of schema.fields) {
			map.set(field.number, field);
		}
		fieldsByNumberCache.set(schema, map);
	}
	return map;
}

function getFieldsByLocalName(schema: any): Map<string, any> {
	let map = fieldsByLocalNameCache.get(schema);
	if (!map) {
		map = new Map<string, any>();
		for (const field of schema.fields) {
			map.set(field.localName, field);
		}
		fieldsByLocalNameCache.set(schema, map);
	}
	return map;
}

function getSubSchema(schema: any, localName: string): any {
	const field = schema.fields.find((f: any) => f.localName === localName);
	return field?.message;
}

function decodeScalar(reader: BinaryReader, scalarType: ScalarType): any {
	switch (scalarType) {
		case ScalarType.INT32:
		case ScalarType.SINT32:
		case ScalarType.SFIXED32:
			return reader.readInt32();
		case ScalarType.UINT32:
		case ScalarType.FIXED32:
			return reader.readUint32();
		case ScalarType.FLOAT:
			return reader.readFloat32();
		case ScalarType.BOOL:
			return reader.readUint8() === 1;
		case ScalarType.STRING:
			return textDecoder.decode(reader.readBytes());
		case ScalarType.BYTES:
			return reader.readBytes();
		default:
			throw new Error(`Unsupported scalar type: ${scalarType}`);
	}
}

function encodeScalar(writer: BinaryWriter, scalarType: ScalarType, val: any) {
	switch (scalarType) {
		case ScalarType.INT32:
		case ScalarType.SINT32:
		case ScalarType.SFIXED32:
			writer.writeInt32(val);
			break;
		case ScalarType.UINT32:
		case ScalarType.FIXED32:
			writer.writeUint32(val);
			break;
		case ScalarType.FLOAT:
			writer.writeFloat32(val);
			break;
		case ScalarType.BOOL:
			writer.writeUint8(val ? 1 : 0);
			break;
		case ScalarType.STRING:
			writer.writeBytes(textEncoder.encode(val));
			break;
		case ScalarType.BYTES:
			writer.writeBytes(val instanceof ArrayBuffer ? new Uint8Array(val) : val);
			break;
		default:
			throw new Error(`Unsupported scalar type: ${scalarType}`);
	}
}

function decodeValue(reader: BinaryReader, kind: string, field: any): any {
	switch (kind) {
		case 'enum':
			return reader.readInt32();
		case 'scalar':
			return decodeScalar(reader, field.scalar);
		case 'message':
			return decodeMessageInternal(reader, field.message);
		default:
			throw new Error(`Unsupported field kind: ${kind}`);
	}
}

function encodeValue(writer: BinaryWriter, kind: string, field: any, val: any) {
	switch (kind) {
		case 'enum':
			writer.writeInt32(val);
			break;
		case 'scalar':
			encodeScalar(writer, field.scalar, val);
			break;
		case 'message':
			encodeMessageInternal(writer, field.message, val);
			break;
		default:
			throw new Error(`Unsupported field kind: ${kind}`);
	}
}

function decodeMessageInternal(reader: BinaryReader, schema: any): any {
	const fieldCount = reader.readUint16();
	const obj: any = {};
	const fieldsByNumber = getFieldsByNumber(schema);

	for (let i = 0; i < fieldCount; i++) {
		const fieldNum = reader.readUint16();
		const field = fieldsByNumber.get(fieldNum);
		if (!field) {
			throw new Error(
				`Unknown field number: ${fieldNum} in schema ${schema.name}`,
			);
		}
		const key = field.localName;
		if (field.fieldKind === 'list') {
			const arrayLen = reader.readUint16();
			const arr = [];
			for (let j = 0; j < arrayLen; j++) {
				arr.push(decodeValue(reader, field.listKind, field));
			}
			obj[key] = arr;
		} else {
			obj[key] = decodeValue(reader, field.fieldKind, field);
		}
	}
	return obj;
}

function encodeMessageInternal(writer: BinaryWriter, schema: any, obj: any) {
	const fieldsToWrite: { field: any; val: any }[] = [];
	const fieldsByLocalName = getFieldsByLocalName(schema);

	for (const [key, val] of Object.entries(obj)) {
		if (val !== undefined && val !== null) {
			const field = fieldsByLocalName.get(key);
			if (field) {
				fieldsToWrite.push({ field, val });
			}
		}
	}

	fieldsToWrite.sort((a, b) => a.field.number - b.field.number);

	writer.writeUint16(fieldsToWrite.length);
	for (const { field, val } of fieldsToWrite) {
		writer.writeUint16(field.number);
		if (field.fieldKind === 'list') {
			writer.writeUint16(val.length);
			for (const item of val) {
				encodeValue(writer, field.listKind, field, item);
			}
		} else {
			encodeValue(writer, field.fieldKind, field, val);
		}
	}
}

export interface PackedEntity {
	id: number;
	x?: number;
	y?: number;
	radius?: number;
}

export function decodeXEntities(buffer: Uint8Array): PackedEntity[] {
	const view = new DataView(
		buffer.buffer,
		buffer.byteOffset,
		buffer.byteLength,
	);
	const list: PackedEntity[] = [];
	for (let i = 0; i + 8 <= buffer.length; i += 8) {
		list.push({
			id: view.getUint32(i, true),
			x: view.getFloat32(i + 4, true),
		});
	}
	return list;
}

export function decodeYEntities(buffer: Uint8Array): PackedEntity[] {
	const view = new DataView(
		buffer.buffer,
		buffer.byteOffset,
		buffer.byteLength,
	);
	const list: PackedEntity[] = [];
	for (let i = 0; i + 8 <= buffer.length; i += 8) {
		list.push({
			id: view.getUint32(i, true),
			y: view.getFloat32(i + 4, true),
		});
	}
	return list;
}

export function decodeXyEntities(buffer: Uint8Array): PackedEntity[] {
	const view = new DataView(
		buffer.buffer,
		buffer.byteOffset,
		buffer.byteLength,
	);
	const list: PackedEntity[] = [];
	for (let i = 0; i + 12 <= buffer.length; i += 12) {
		list.push({
			id: view.getUint32(i, true),
			x: view.getFloat32(i + 4, true),
			y: view.getFloat32(i + 8, true),
		});
	}
	return list;
}

export function decodeXyRadiusEntities(buffer: Uint8Array): PackedEntity[] {
	const view = new DataView(
		buffer.buffer,
		buffer.byteOffset,
		buffer.byteLength,
	);
	const list: PackedEntity[] = [];
	for (let i = 0; i + 16 <= buffer.length; i += 16) {
		list.push({
			id: view.getUint32(i, true),
			x: view.getFloat32(i + 4, true),
			y: view.getFloat32(i + 8, true),
			radius: view.getFloat32(i + 12, true),
		});
	}
	return list;
}

function decodeFramePayload(reader: BinaryReader, schema: any): any {
	const version = reader.readUint8();
	if (version !== 1) {
		throw new Error(`Unsupported frame version: ${version}`);
	}

	const flags1 = reader.readUint8();
	const flags2 = reader.readUint8();
	const sequence = reader.readUint32();

	const obj: any = {
		sequence,
		entities: [],
		globalEntities: [],
		debugObjects: [],
	};

	if (flags1 & 1) obj.complete = true;
	if (flags1 & 2) obj.completeGlobal = true;
	if (flags1 & 4) obj.reset = true;
	if (flags1 & 8) obj.selfId = reader.readUint32();
	if (flags1 & 16) obj.tickRate = reader.readFloat32();
	if (flags1 & 32) obj.pong = reader.readUint32();

	if (flags1 & 64) {
		const subReader = new BinaryReader(reader.readBytes());
		obj.area = decodeMessageInternal(subReader, getSubSchema(schema, 'area'));
	}
	if (flags1 & 128) {
		const subReader = new BinaryReader(reader.readBytes());
		obj.map = decodeMessageInternal(subReader, getSubSchema(schema, 'map'));
	}

	if (flags2 & 1) {
		const subReader = new BinaryReader(reader.readBytes());
		obj.chat = decodeMessageInternal(subReader, getSubSchema(schema, 'chat'));
	}
	if (flags2 & 2) {
		const subReader = new BinaryReader(reader.readBytes());
		obj.settings = decodeMessageInternal(
			subReader,
			getSubSchema(schema, 'settings'),
		);
	}
	if (flags2 & 4) {
		const subReader = new BinaryReader(reader.readBytes());
		obj.modToolsResponse = decodeMessageInternal(
			subReader,
			getSubSchema(schema, 'modToolsResponse'),
		);
	}
	if (flags2 & 8) {
		const subReader = new BinaryReader(reader.readBytes());
		obj.questData = decodeMessageInternal(
			subReader,
			getSubSchema(schema, 'questData'),
		);
	}

	if (flags2 & 16) obj.xEntities = decodeXEntities(reader.readBytes());
	if (flags2 & 32) obj.yEntities = decodeYEntities(reader.readBytes());
	if (flags2 & 64) obj.xyEntities = decodeXyEntities(reader.readBytes());
	if (flags2 & 128)
		obj.xyRadiusEntities = decodeXyRadiusEntities(reader.readBytes());

	const entitiesSchema = getSubSchema(schema, 'entities');
	const entitiesCount = reader.readUint32();
	for (let i = 0; i < entitiesCount; i++) {
		obj.entities.push(decodeMessageInternal(reader, entitiesSchema));
	}

	const globalEntitiesCount = reader.readUint32();
	for (let i = 0; i < globalEntitiesCount; i++) {
		obj.globalEntities.push(decodeMessageInternal(reader, entitiesSchema));
	}

	const debugObjectSchema = getSubSchema(schema, 'debugObjects');
	const debugObjectsCount = reader.readUint32();
	for (let i = 0; i < debugObjectsCount; i++) {
		obj.debugObjects.push(decodeMessageInternal(reader, debugObjectSchema));
	}

	return obj;
}

function encodeFramePayload(writer: BinaryWriter, schema: any, obj: any) {
	writer.writeUint8(1);

	let flags1 = 0;
	let flags2 = 0;

	if (obj.complete) flags1 |= 1;
	if (obj.completeGlobal) flags1 |= 2;
	if (obj.reset) flags1 |= 4;
	if (obj.selfId !== undefined && obj.selfId !== null) flags1 |= 8;
	if (obj.tickRate !== undefined && obj.tickRate !== null) flags1 |= 16;
	if (obj.pong !== undefined && obj.pong !== null) flags1 |= 32;
	if (obj.area !== undefined && obj.area !== null) flags1 |= 64;
	if (obj.map !== undefined && obj.map !== null) flags1 |= 128;

	if (obj.chat !== undefined && obj.chat !== null) flags2 |= 1;
	if (obj.settings !== undefined && obj.settings !== null) flags2 |= 2;
	if (obj.modToolsResponse !== undefined && obj.modToolsResponse !== null)
		flags2 |= 4;
	if (obj.questData !== undefined && obj.questData !== null) flags2 |= 8;
	if (obj.xEntities !== undefined && obj.xEntities !== null) flags2 |= 16;
	if (obj.yEntities !== undefined && obj.yEntities !== null) flags2 |= 32;
	if (obj.xyEntities !== undefined && obj.xyEntities !== null) flags2 |= 64;
	if (obj.xyRadiusEntities !== undefined && obj.xyRadiusEntities !== null)
		flags2 |= 128;

	writer.writeUint8(flags1);
	writer.writeUint8(flags2);
	writer.writeUint32(obj.sequence || 0);

	if (flags1 & 8) writer.writeUint32(obj.selfId);
	if (flags1 & 16) writer.writeFloat32(obj.tickRate);
	if (flags1 & 32) writer.writeUint32(obj.pong);

	if (flags1 & 64) {
		const subWriter = new BinaryWriter();
		encodeMessageInternal(subWriter, getSubSchema(schema, 'area'), obj.area);
		writer.writeBytes(subWriter.toUint8Array());
	}
	if (flags1 & 128) {
		const subWriter = new BinaryWriter();
		encodeMessageInternal(subWriter, getSubSchema(schema, 'map'), obj.map);
		writer.writeBytes(subWriter.toUint8Array());
	}

	if (flags2 & 1) {
		const subWriter = new BinaryWriter();
		encodeMessageInternal(subWriter, getSubSchema(schema, 'chat'), obj.chat);
		writer.writeBytes(subWriter.toUint8Array());
	}
	if (flags2 & 2) {
		const subWriter = new BinaryWriter();
		encodeMessageInternal(
			subWriter,
			getSubSchema(schema, 'settings'),
			obj.settings,
		);
		writer.writeBytes(subWriter.toUint8Array());
	}
	if (flags2 & 4) {
		const subWriter = new BinaryWriter();
		encodeMessageInternal(
			subWriter,
			getSubSchema(schema, 'modToolsResponse'),
			obj.modToolsResponse,
		);
		writer.writeBytes(subWriter.toUint8Array());
	}
	if (flags2 & 8) {
		const subWriter = new BinaryWriter();
		encodeMessageInternal(
			subWriter,
			getSubSchema(schema, 'questData'),
			obj.questData,
		);
		writer.writeBytes(subWriter.toUint8Array());
	}

	if (flags2 & 16) writer.writeBytes(obj.xEntities);
	if (flags2 & 32) writer.writeBytes(obj.yEntities);
	if (flags2 & 64) writer.writeBytes(obj.xyEntities);
	if (flags2 & 128) writer.writeBytes(obj.xyRadiusEntities);

	const entities = obj.entities || [];
	writer.writeUint32(entities.length);
	const entitiesSchema = getSubSchema(schema, 'entities');
	for (const ent of entities) {
		encodeMessageInternal(writer, entitiesSchema, ent);
	}

	const globalEntities = obj.globalEntities || [];
	writer.writeUint32(globalEntities.length);
	for (const ent of globalEntities) {
		encodeMessageInternal(writer, entitiesSchema, ent);
	}

	const debugObjects = obj.debugObjects || [];
	writer.writeUint32(debugObjects.length);
	const debugObjectSchema = getSubSchema(schema, 'debugObjects');
	for (const dbg of debugObjects) {
		encodeMessageInternal(writer, debugObjectSchema, dbg);
	}
}

export function decode<T = any>(schema: any, buffer: Uint8Array): T {
	if (schema.name === 'ServerDebugObject' && buffer[1] !== 0) {
		const view = new DataView(
			buffer.buffer,
			buffer.byteOffset,
			buffer.byteLength,
		);
		const x = view.getInt32(1, true);
		const y = view.getInt32(5, true);
		const color = view.getUint32(9, true);
		const textLen = view.getUint32(13, true);
		const text = new TextDecoder('utf-8').decode(
			buffer.subarray(17, 17 + textLen),
		);
		return { x, y, color, text } as any;
	}

	const reader = new BinaryReader(buffer);

	if (schema.name === 'FramePayload') {
		return decodeFramePayload(reader, schema);
	}

	return decodeMessageInternal(reader, schema);
}

export function encode(schema: any, obj: any): Uint8Array {
	const writer = new BinaryWriter();

	if (schema.name === 'FramePayload') {
		encodeFramePayload(writer, schema, obj);
	} else {
		encodeMessageInternal(writer, schema, obj);
	}

	return writer.toUint8Array();
}
