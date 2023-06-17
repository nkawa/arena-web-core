function doubleToBits(f) {
    return new Uint32Array(Float64Array.of(f).buffer);
}

export class HybridRenderingUtils {
    static doublesToCamMsg(...args) {
        let arrayLength = 0;
        for (const arg of args) {
            if (typeof arg === 'number') {
                arrayLength += 2;
            }
        }

        const msg = new Uint32Array(arrayLength);
        let i = 0;
        for (const arg of args) {
            if (typeof arg === 'number') {
                const bits = doubleToBits(arg);
                msg[i] = bits[0];
                msg[i + 1] = bits[1];
                i += 2;
            }
        }

        return msg;
    }
}
