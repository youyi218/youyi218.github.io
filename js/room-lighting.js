// A small studio HDR: one movable area light and neutral fill, without a skybox.
const RoomLighting = (() => {
    function kelvinColor(temperature) {
        if (!Number.isFinite(temperature) || temperature < 2700 || temperature > 8000) {
            throw new RangeError('Color temperature must be between 2700 K and 8000 K');
        }
        // Approximate a black-body source at RGB wavelengths, relative to daylight.
        const color = [610e-9, 550e-9, 460e-9].map(wavelength =>
            Math.expm1(0.014388 / (wavelength * 6500)) /
            Math.expm1(0.014388 / (wavelength * temperature)));
        const luminance = color[0] * .2126 + color[1] * .7152 + color[2] * .0722;
        return color.map(value => value / luminance);
    }

    function createEnvironment({ azimuth = -45, elevation = 50, temperature = 4500 } = {}) {
        if (!Number.isFinite(azimuth) || Math.abs(azimuth) > 180 ||
            !Number.isFinite(elevation) || elevation < 10 || elevation > 85) {
            throw new RangeError('Light direction is outside the supported range');
        }
        const color = kelvinColor(temperature);
        const radians = Math.PI / 180;
        const a = azimuth * radians, e = elevation * radians;
        const light = [Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e)];
        const width = 128, height = 64;
        const header = new TextEncoder().encode(`#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y ${height} +X ${width}\n`);
        const data = new Uint8Array(header.length + width * height * 4);
        data.set(header);
        let offset = header.length;
        for (let y = 0; y < height; y++) {
            const latitude = Math.PI / 2 - (y + .5) * Math.PI / height;
            const dy = Math.sin(latitude), horizontal = Math.cos(latitude);
            for (let x = 0; x < width; x++) {
                const longitude = (x + .5) * 2 * Math.PI / width - Math.PI;
                const dx = horizontal * Math.cos(longitude), dz = horizontal * Math.sin(longitude);
                const dot = dx * light[0] + dy * light[1] + dz * light[2];
                const key = 16 * Math.exp((dot - 1) / .04);
                const fill = .18 + .1 * Math.max(0, dy) + .25 * Math.exp((-dot - 1) / .5);
                const rgb = color.map(channel => fill + key * channel);
                // Radiance RGBE stores linear RGB mantissas and one shared exponent.
                const exponent = Math.floor(Math.log2(Math.max(...rgb))) + 1;
                const scale = 256 / 2 ** exponent;
                for (const channel of rgb) data[offset++] = Math.min(255, Math.floor(channel * scale));
                data[offset++] = exponent + 128;
            }
        }
        return data;
    }

    function environmentURL(settings) {
        // model-viewer retains environment textures. Reuse at most 90 studio maps
        // (6 directions × 3 heights × 5 temperatures), shared across all rooms.
        const nearest = (value, choices, circular = false) => {
            if (!Number.isFinite(value)) throw new RangeError('Light setting must be finite');
            const distance = choice => {
                const delta = Math.abs(value - choice) % 360;
                return circular ? Math.min(delta, 360 - delta) : Math.abs(value - choice);
            };
            return choices.reduce((best, choice) => distance(choice) < distance(best) ? choice : best);
        };
        const bytes = createEnvironment({
            azimuth: nearest(settings.azimuth, [-135, -45, 0, 45, 135, 180], true),
            elevation: nearest(settings.elevation, [20, 50, 80]),
            temperature: nearest(settings.temperature, [2700, 3200, 4500, 6500, 8000])
        });
        // The suffix selects model-viewer's HDR loader; it is not part of the data payload.
        return 'data:application/octet-stream;base64,' + btoa(String.fromCharCode(...bytes)) + '#light.hdr';
    }

    return { kelvinColor, createEnvironment, environmentURL };
})();
if (typeof module !== 'undefined') module.exports = RoomLighting;
