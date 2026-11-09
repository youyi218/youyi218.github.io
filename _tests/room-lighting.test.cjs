const test = require('node:test');
const assert = require('node:assert/strict');
const lighting = require('../js/room-lighting.js');

// Decode the generated Radiance file independently, as the renderer does.
function decode(options) {
    const data = Buffer.from(lighting.createEnvironment(options));
    const header = data.toString('ascii', 0, 100);
    const match = header.match(/-Y (\d+) \+X (\d+)\n/);
    assert.ok(match, 'HDR must declare its dimensions');
    const height = Number(match[1]), width = Number(match[2]);
    const offset = match.index + match[0].length;
    assert.equal(data.length - offset, width * height * 4);
    let brightest;
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const p = offset + (y * width + x) * 4;
            const scale = 2 ** (data[p + 3] - 136);
            const rgb = [data[p], data[p + 1], data[p + 2]].map(v => v * scale);
            const luma = rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
            assert.ok(Number.isFinite(luma));
            if (!brightest || luma > brightest.luma) brightest = { x, y, rgb, luma };
        }
    }
    return { ...brightest, width, height };
}

test('front light and right light illuminate different horizontal directions', () => {
    const front = decode({ azimuth: 0, elevation: 45, temperature: 6500 });
    const right = decode({ azimuth: 90, elevation: 45, temperature: 6500 });
    assert.ok(Math.abs(front.x / front.width - .75) < .03);
    assert.ok(Math.abs(right.x / right.width - .5) < .03);
    assert.ok(front.luma > 5, 'key light must preserve HDR highlights');
});

test('raising the source moves its brightest patch toward the top of the HDR', () => {
    const low = decode({ azimuth: 0, elevation: 15, temperature: 6500 });
    const high = decode({ azimuth: 0, elevation: 75, temperature: 6500 });
    assert.ok(low.y / low.height > .35);
    assert.ok(high.y / high.height < .12);
});

test('warm and cool temperatures change actual emitted RGB light', () => {
    const warm = decode({ azimuth: 0, elevation: 45, temperature: 2700 });
    const cool = decode({ azimuth: 0, elevation: 45, temperature: 8000 });
    assert.ok(warm.rgb[0] > warm.rgb[2] * 1.5);
    assert.ok(cool.rgb[2] > cool.rgb[0] * 1.1);
});

test('6500 K is the neutral reference and invalid inputs cannot create corrupt HDRs', () => {
    assert.deepEqual(lighting.kelvinColor(6500), [1, 1, 1]);
    for (const bad of [NaN, Infinity, -1]) {
        assert.throws(() => lighting.createEnvironment({ temperature: bad }), RangeError);
    }
});

test('nearby settings reuse one finite studio light instead of growing the texture cache', () => {
    const a = lighting.environmentURL({ azimuth: -44, elevation: 49, temperature: 4499 });
    const b = lighting.environmentURL({ azimuth: -46, elevation: 51, temperature: 4501 });
    assert.ok(a === b, 'nearby settings must reuse the same texture URL');
    assert.ok(a !== lighting.environmentURL({ azimuth: 45, elevation: 50, temperature: 4500 }));
});

test('the environment URL selects the HDR loader and its data remains fetchable', async () => {
    const url = lighting.environmentURL({ azimuth: 0, elevation: 50, temperature: 6500 });
    assert.ok(url.endsWith('.hdr'));
    const data = Buffer.from(await (await fetch(url)).arrayBuffer());
    assert.ok(data.toString('ascii', 0, 100).startsWith('#?RADIANCE\n'));
    assert.ok(data.toString('ascii', 0, 100).includes('-Y 64 +X 128\n'));
});
