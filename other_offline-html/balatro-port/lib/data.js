class BufferReader {
    /**
     * 
     * @param {ArrayBuffer} arrayBuffer 
     * @param {boolean} littleEndian 
     */
    constructor(arrayBuffer, littleEndian = true) {
        this.view = new DataView(arrayBuffer)
        this.offset = 0
        this.littleEndian = littleEndian
    }

    u8() {
        return this.view.getUint8(this.offset++)
    }

    i8() {
        return this.view.getInt8(this.offset++)
    }

    u16() {
        const val = this.view.getUint16(this.offset, this.littleEndian)
        this.offset += 2
        return val
    }

    i16() {
        const val = this.view.getInt16(this.offset, this.littleEndian)
        this.offset += 2
        return val
    }

    u32() {
        const val = this.view.getUint32(this.offset, this.littleEndian)
        this.offset += 4
        return val
    }

    i32() {
        const val = this.view.getInt32(this.offset, this.littleEndian)
        this.offset += 4
        return val
    }

    f32() {
        const val = this.view.getFloat32(this.offset, this.littleEndian)
        this.offset += 4
        return val
    }

    f16() {
        const val = this.view.getFloat16(this.offset, this.littleEndian)
        this.offset += 2
        return val
    }

    bytes(n) {
        const result = this.view.buffer.slice(this.offset, this.offset + n)
        this.offset += n
        return result
    }

    string(n) {
        const bytes = this.bytes(n)
        return new TextDecoder().decode(bytes)
    }

    goto(n) {
        this.offset = n
    }

    step(n) {
        this.offset += n
    }
}

class BufferWriter {
    constructor(size, littleEndian = true) {
        this.buffer = new ArrayBuffer(size)
        this.view = new DataView(this.buffer)
        this.offset = 0
        this.littleEndian = littleEndian
    }

    u8(value) {
        this.view.setUint8(this.offset++, value)
    }

    i8(value) {
        this.view.setInt8(this.offset++, value)
    }

    u16(value) {
        this.view.setUint16(this.offset, value, this.littleEndian)
        this.offset += 2
    }

    i16(value) {
        this.view.setInt16(this.offset, value, this.littleEndian)
        this.offset += 2
    }

    u32(value) {
        this.view.setUint32(this.offset, value, this.littleEndian)
        this.offset += 4
    }

    i32(value) {
        this.view.setInt32(this.offset, value, this.littleEndian)
        this.offset += 4
    }

    f32(value) {
        this.view.setFloat32(this.offset, value, this.littleEndian)
        this.offset += 4
    }

    f16(value) {
        if (typeof this.view.setFloat16 === "function") {
            this.view.setFloat16(this.offset, value, this.littleEndian)
        } else {
            // Manual conversion fallback (optional)
            throw new Error("setFloat16 is not supported in this environment")
        }
        this.offset += 2
    }

    bytes(byteArray) {
        if (!(byteArray instanceof Uint8Array)) {
            throw new TypeError("bytes() expects a Uint8Array")
        }
        new Uint8Array(this.buffer, this.offset, byteArray.length).set(byteArray)
        this.offset += byteArray.length
    }

    getBuffer() {
        return this.buffer.slice(0, this.offset)
    }
}
